/**
 * Серверная обработка callback'а Steam (Task 20A, усиление).
 *
 * Два независимых шага, и оба обязательны:
 *
 * 1. `handleSteamCallback` — проверяет утверждение Steam, потребляет nonce в
 *    постоянном хранилище, находит или создаёт пользователя и выпускает
 *    **одноразовый код обмена**. Ни Supabase-токен, ни SteamID в браузер не
 *    передаются; в URL уходит только непрозрачный код.
 * 2. `redeemSteamExchange` — атомарно потребляет код и только затем выдаёт
 *    Supabase-токен. Токен передаётся в теле ответа, поэтому не попадает в
 *    историю браузера, Referer и логи прокси.
 *
 * Модуль чистый: сеть, хранилища и время внедряются.
 */

import {
  type SteamAccountsGateway,
  type SteamProfileData,
  issueSession,
  linkSteamToExistingUser,
  resolveOrCreateSteamUser,
  type LinkFailureReason,
} from './accounts.ts'
import { readOpenIdParams, verifySteamAssertion, type SteamOpenIdFailure } from './openid.ts'
import { sanitizeInternalPath } from './redirect.ts'
import {
  EXCHANGE_TTL_SECONDS,
  type ExchangeStore,
  type NonceStore,
  computeCodeChallenge,
  createExchangeCode,
  hashExchangeCode,
  isValidCodeVerifier,
  isValidExchangeCode,
} from './stores.ts'

/** Куда отправлять пользователя после успешного обмена. */
export const STEAM_AFTER_LOGIN_PATH = '/'

export type SteamCallbackFailure =
  | SteamOpenIdFailure
  | LinkFailureReason
  | 'exchange_failed'
  | 'invalid_steam_id'

export type SteamCallbackOutcome =
  | {
      ok: true
      steamId64: string
      /** Непрозрачный одноразовый код; не является токеном. */
      exchangeCode: string
      nextPath: string
      created: boolean
      linked: boolean
    }
  | { ok: false; reason: SteamCallbackFailure }

export interface SteamCallbackInput {
  /** Сырая строка запроса callback'а (как пришла от Steam). */
  search: string
  expectedReturnTo: string
  expectedRealm: string
  expectedState: string | null
  fetchImpl: typeof fetch
  /** Постоянное хранилище nonce: обязательное условие распределённой защиты. */
  nonceStore: NonceStore
  exchangeStore: ExchangeStore
  /**
   * SHA-256 (hex) от PKCE-секрета, созданного приложением перед редиректом на
   * Steam. Привязывает код обмена к браузеру без cookie.
   */
  codeChallenge: string
  gateway: SteamAccountsGateway
  profile?: SteamProfileData | null
  linkUserId?: string | null
  returnPath?: string | null
  now?: number
}

/**
 * Полный серверный шаг входа.
 *
 * Порядок важен: сначала подпись, затем nonce, затем запись в БД. Отмена входа и
 * ошибки Steam не создают пользователей и не выпускают кодов.
 */
export async function handleSteamCallback(
  input: SteamCallbackInput,
): Promise<SteamCallbackOutcome> {
  const params = readOpenIdParams(input.search)

  const verified = await verifySteamAssertion({
    params,
    expectedReturnTo: input.expectedReturnTo,
    expectedRealm: input.expectedRealm,
    expectedState: input.expectedState,
    fetchImpl: input.fetchImpl,
    nonceStore: input.nonceStore,
    now: input.now,
  })
  if (!verified.ok) {
    return { ok: false, reason: verified.reason }
  }

  const profile: SteamProfileData = input.profile ?? {
    personaName: null,
    avatarUrl: null,
    profileUrl: null,
  }

  let userId: string
  let created = false
  let linked = false

  if (typeof input.linkUserId === 'string' && input.linkUserId.length > 0) {
    // Привязка: UUID существующего пользователя не меняется.
    const link = await linkSteamToExistingUser(input.gateway, {
      steamId64: verified.steamId64,
      userId: input.linkUserId,
      profile,
    })
    if (!link.ok) {
      return { ok: false, reason: link.reason }
    }
    userId = link.identity.userId
    linked = true
  } else {
    const resolved = await resolveOrCreateSteamUser(
      input.gateway,
      verified.steamId64,
      profile,
      input.now === undefined ? new Date() : new Date(input.now),
    )
    if (resolved === null) {
      return { ok: false, reason: 'invalid_steam_id' }
    }
    userId = resolved.userId
    created = resolved.created
  }

  const exchangeCode = createExchangeCode()
  if (!/^[0-9a-f]{64}$/.test(input.codeChallenge)) {
    // Без PKCE-привязки код выдавать нельзя: он был бы полезен любому, кто увидел URL.
    return { ok: false, reason: 'exchange_failed' }
  }
  const stored = await input.exchangeStore.create({
    codeHash: await hashExchangeCode(exchangeCode),
    codeChallenge: input.codeChallenge,
    userId,
    steamId64: verified.steamId64,
    ttlSeconds: EXCHANGE_TTL_SECONDS,
  })
  if (!stored) {
    return { ok: false, reason: 'exchange_failed' }
  }

  return {
    ok: true,
    steamId64: verified.steamId64,
    exchangeCode,
    nextPath: sanitizeInternalPath(input.returnPath ?? STEAM_AFTER_LOGIN_PATH),
    created,
    linked,
  }
}

export type SteamExchangeFailure =
  | 'exchange_invalid'
  | 'exchange_expired'
  | 'session_failed'

export type SteamExchangeOutcome =
  | { ok: true; tokenHash: string; userId: string; steamId64: string }
  | { ok: false; reason: SteamExchangeFailure }

/**
 * Обмен одноразового кода на Supabase-токен.
 *
 * Код потребляется атомарно: два одновременных запроса не могут получить сессию.
 * Просроченный и неизвестный код неотличимы для клиента намеренно — одинаковый
 * ответ `exchange_invalid` не раскрывает существование записи.
 */
export async function redeemSteamExchange(input: {
  code: string
  /** PKCE-секрет из sessionStorage приложения; не является токеном. */
  verifier: string
  exchangeStore: ExchangeStore
  gateway: SteamAccountsGateway
}): Promise<SteamExchangeOutcome> {
  if (!isValidExchangeCode(input.code) || !isValidCodeVerifier(input.verifier)) {
    return { ok: false, reason: 'exchange_invalid' }
  }

  let codeHash: string
  let challenge: string
  try {
    codeHash = await hashExchangeCode(input.code)
    challenge = await computeCodeChallenge(input.verifier)
  } catch {
    return { ok: false, reason: 'exchange_invalid' }
  }

  const record = await input.exchangeStore.redeem(codeHash, challenge)
  if (record === null) {
    return { ok: false, reason: 'exchange_invalid' }
  }

  // Сессия выпускается только для пользователя из записи обмена, а не из запроса.
  const tokenHash = await issueSession(input.gateway, record.userId)
  if (tokenHash === null) {
    return { ok: false, reason: 'session_failed' }
  }

  return { ok: true, tokenHash, userId: record.userId, steamId64: record.steamId64 }
}
