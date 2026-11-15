/**
 * Steam OpenID 2.0 — построение запроса и проверка ответа (Task 20A).
 *
 * Steam использует **OpenID 2.0**, а не OpenID Connect и не OAuth2, поэтому
 * стандартный OAuth-провайдер Supabase к нему неприменим. Здесь реализована
 * только та часть протокола, которая нужна DotaZ, и она полностью детерминирована:
 * сетевой вызов Steam приходит снаружи через `fetchImpl`, поэтому логику можно
 * покрыть тестами без сети.
 *
 * Модуль чистый: без Node/DOM-специфичных API, чтобы один и тот же код исполнялся
 * и в браузере, и в серверной Edge Function (Deno).
 */

import { STEAM_OPENID_CLAIMED_PREFIX, parseSteamId64, steamIdFromClaimedId } from './steamId.ts'
import type { NonceStore } from './stores.ts'

/** Легитимный endpoint Steam OpenID 2.0 (единственный доверенный). */
export const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login'

export const OPENID_NS_2_0 = 'http://specs.openid.net/auth/2.0'

/** `identifier_select` — Steam сам определяет вошедшего пользователя. */
export const OPENID_IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select'

/** Тайм-аут сетевой проверки утверждения у Steam. */
export const STEAM_VERIFY_TIMEOUT_MS = 10_000

/** Максимальный возраст `openid.response_nonce` — защита от replay. */
export const DEFAULT_NONCE_MAX_AGE_MS = 5 * 60 * 1000

export interface SteamLoginUrlOptions {
  /** Абсолютный URL callback'а нашего backend (https в production). */
  returnTo: string
  /** Абсолютный origin приложения (realm). */
  realm: string
  /** Криптостойкое одноразовое значение, привязанное к сессии браузера. */
  state: string
}

/** Причины отказа; стабильные коды, по которым UI выбирает текст. */
export type SteamOpenIdFailure =
  | 'cancelled'
  | 'provider_error'
  | 'malformed'
  | 'bad_mode'
  | 'bad_op_endpoint'
  | 'bad_claimed_id'
  | 'identity_mismatch'
  | 'return_to_mismatch'
  | 'realm_mismatch'
  | 'state_mismatch'
  | 'stale_nonce'
  | 'replay'
  | 'nonce_store_unavailable'
  | 'invalid_signature'
  | 'network_error'

export type SteamOpenIdResult =
  | { ok: true; steamId64: string; claimedId: string; nonce: string }
  | { ok: false; reason: SteamOpenIdFailure }

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Строит URL редиректа на Steam.
 * Возвращает `null`, если параметры небезопасны: относительный return_to,
 * пустой state, несовпадение realm с origin return_to.
 */
export function buildSteamLoginUrl(options: SteamLoginUrlOptions): string | null {
  const { returnTo, realm, state } = options
  if (typeof state !== 'string' || state.trim().length < 16) {
    return null
  }
  if (!isAbsoluteHttpUrl(returnTo) || !isAbsoluteHttpUrl(realm)) {
    return null
  }
  const returnUrl = new URL(returnTo)
  const realmUrl = new URL(realm)
  if (returnUrl.origin !== realmUrl.origin) {
    return null
  }
  const url = new URL(STEAM_OPENID_ENDPOINT)
  url.searchParams.set('openid.ns', OPENID_NS_2_0)
  url.searchParams.set('openid.mode', 'checkid_setup')
  url.searchParams.set('openid.return_to', returnTo)
  url.searchParams.set('openid.realm', realmUrl.origin)
  url.searchParams.set('openid.identity', OPENID_IDENTIFIER_SELECT)
  url.searchParams.set('openid.claimed_id', OPENID_IDENTIFIER_SELECT)
  return url.toString()
}

/** Извлекает только значимые параметры OpenID + state из строки запроса. */
export function readOpenIdParams(search: string): Map<string, string> {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const result = new Map<string, string>()
  for (const [key, value] of params.entries()) {
    if (key.startsWith('openid.') || key === 'state') {
      result.set(key, value)
    }
  }
  return result
}

/**
 * Сравнивает return_to с ожидаемым без учёта порядка параметров, но строго по
 * origin, пути и полному набору параметров. Любое добавление или удаление
 * параметра считается несовпадением.
 */
export function sameReturnUrl(actual: string, expected: string): boolean {
  let a: URL
  let b: URL
  try {
    a = new URL(actual)
    b = new URL(expected)
  } catch {
    return false
  }
  if (a.origin !== b.origin || a.pathname !== b.pathname) {
    return false
  }
  const normalize = (url: URL): string =>
    [...url.searchParams.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('&')
  return normalize(a) === normalize(b)
}

/** Разбирает временную метку из `openid.response_nonce` (`2026-11-10T09:00:00Z…`). */
export function parseNonceTimestamp(nonce: unknown): number | null {
  if (typeof nonce !== 'string') {
    return null
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/.exec(nonce)
  if (match === null) {
    return null
  }
  const [, year, month, day, hour, minute, second] = match
  const value = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  return Number.isFinite(value) ? value : null
}

export interface SteamOpenIdValidationInput {
  params: ReadonlyMap<string, string>
  /** Ровно тот return_to, который мы отправляли в Steam. */
  expectedReturnTo: string
  /** Ровно тот realm, который мы отправляли в Steam. */
  expectedRealm: string
  /** Одноразовое значение, выданное перед редиректом. */
  expectedState: string | null
  /** Текущее время, мс (для тестируемости). */
  now?: number
  maxNonceAgeMs?: number
  /** Уже использованные nonce — защита от повторного предъявления ответа. */
  seenNonces?: ReadonlySet<string>
}

/**
 * Полная локальная проверка ответа Steam OpenID **без обращения к сети**.
 * Сетевой шаг (`check_authentication`) выполняется отдельно в
 * `verifySteamAssertion`, чтобы можно было тестировать проверки по отдельности.
 */
export function validateOpenIdResponse(input: SteamOpenIdValidationInput): SteamOpenIdResult {
  const { params } = input
  const mode = params.get('openid.mode')

  if (mode === 'cancel') {
    return { ok: false, reason: 'cancelled' }
  }
  if (mode === 'error') {
    return { ok: false, reason: 'provider_error' }
  }
  if (mode !== 'id_res') {
    return { ok: false, reason: 'bad_mode' }
  }

  const opEndpoint = params.get('openid.op_endpoint')
  if (opEndpoint !== STEAM_OPENID_ENDPOINT) {
    return { ok: false, reason: 'bad_op_endpoint' }
  }

  // CSRF: состояние должно совпасть с выданным и не быть пустым.
  const state = params.get('state')
  if (typeof state !== 'string' || state.length === 0) {
    return { ok: false, reason: 'state_mismatch' }
  }
  if (input.expectedState === null || state !== input.expectedState) {
    return { ok: false, reason: 'state_mismatch' }
  }

  // return_to должен совпадать с ожидаемым: защита от подмены адреса возврата.
  const returnTo = params.get('openid.return_to')
  if (typeof returnTo !== 'string' || !sameReturnUrl(returnTo, input.expectedReturnTo)) {
    return { ok: false, reason: 'return_to_mismatch' }
  }

  // realm обязан совпадать с origin нашего приложения (тот же, что у return_to).
  let realmOrigin: string
  let returnOrigin: string
  try {
    realmOrigin = new URL(input.expectedRealm).origin
    returnOrigin = new URL(input.expectedReturnTo).origin
  } catch {
    return { ok: false, reason: 'realm_mismatch' }
  }
  if (realmOrigin !== returnOrigin) {
    return { ok: false, reason: 'realm_mismatch' }
  }

  // Личность: claimed_id и identity должны указывать на один аккаунт Steam.
  const claimedId = params.get('openid.claimed_id')
  const identity = params.get('openid.identity')
  if (typeof claimedId !== 'string' || !claimedId.startsWith(STEAM_OPENID_CLAIMED_PREFIX)) {
    return { ok: false, reason: 'bad_claimed_id' }
  }
  const steamId64 = steamIdFromClaimedId(claimedId)
  if (steamId64 === null || parseSteamId64(steamId64) === null) {
    return { ok: false, reason: 'bad_claimed_id' }
  }
  if (identity !== claimedId) {
    return { ok: false, reason: 'identity_mismatch' }
  }

  // Свежесть ответа и защита от повторного предъявления.
  const nonce = params.get('openid.response_nonce')
  const issuedAt = parseNonceTimestamp(nonce)
  if (typeof nonce !== 'string' || issuedAt === null) {
    return { ok: false, reason: 'malformed' }
  }
  const now = input.now ?? Date.now()
  const maxAge = input.maxNonceAgeMs ?? DEFAULT_NONCE_MAX_AGE_MS
  if (Math.abs(now - issuedAt) > maxAge) {
    return { ok: false, reason: 'stale_nonce' }
  }
  if (input.seenNonces !== undefined && input.seenNonces.has(nonce)) {
    return { ok: false, reason: 'replay' }
  }

  return { ok: true, steamId64, claimedId, nonce }
}

/**
 * Формирует тело запроса `check_authentication` к Steam.
 *
 * По протоколу OpenID 2.0 relying party обязана подтвердить подпись у самого
 * провайдера: все полученные `openid.*` параметры отправляются обратно с
 * `openid.mode=check_authentication`. Ответ должен содержать `is_valid:true`.
 * Собственный параметр `state` в запрос не включается — он не является частью
 * подписанного утверждения.
 */
export function buildCheckAuthenticationBody(
  params: ReadonlyMap<string, string>,
): URLSearchParams {
  const body = new URLSearchParams()
  for (const [key, value] of params.entries()) {
    if (key.startsWith('openid.') && key !== 'openid.mode') {
      body.append(key, value)
    }
  }
  body.set('openid.mode', 'check_authentication')
  return body
}

/** Разбирает ответ Steam `check_authentication` (`is_valid:true` / `is_valid:false`). */
export function isCheckAuthenticationValid(raw: string): boolean {
  if (typeof raw !== 'string') {
    return false
  }
  return raw
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line === 'is_valid:true')
}

export interface VerifySteamAssertionInput extends SteamOpenIdValidationInput {
  /** Внедряемая реализация `fetch` (реальная или тестовая). */
  fetchImpl: typeof fetch
  timeoutMs?: number
  /**
   * Постоянное хранилище использованных nonce. Если задано, nonce потребляется
   * атомарно после подтверждения подписи; без него распределённая защита от
   * replay считается отсутствующей.
   */
  nonceStore?: NonceStore
}

/**
 * Полная серверная проверка утверждения Steam: локальные проверки, затем
 * обязательный `check_authentication` у Steam.
 *
 * Подпись **не** проверяется самостоятельно по ключам Steam: единственный
 * поддерживаемый протоколом способ — спросить провайдера. Ошибка сети или
 * тайм-аут трактуются как отказ (fail closed), а не как успех.
 */
export async function verifySteamAssertion(
  input: VerifySteamAssertionInput,
): Promise<SteamOpenIdResult> {
  const local = validateOpenIdResponse(input)
  if (!local.ok) {
    return local
  }

  const body = buildCheckAuthenticationBody(input.params)
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null
  const timeout = setTimeout(() => controller?.abort(), input.timeoutMs ?? STEAM_VERIFY_TIMEOUT_MS)

  try {
    const response = await input.fetchImpl(STEAM_OPENID_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/plain',
      },
      body: body.toString(),
      signal: controller?.signal,
    })
    if (!response.ok) {
      return { ok: false, reason: 'invalid_signature' }
    }
    const text = await response.text()
    if (!isCheckAuthenticationValid(text)) {
      return { ok: false, reason: 'invalid_signature' }
    }

    // Подпись подтверждена — только теперь потребляем nonce, чтобы недействительные
    // ответы не могли «сжечь» записи и заблокировать настоящий вход.
    if (input.nonceStore !== undefined) {
      const issuedAt = parseNonceTimestamp(local.nonce)
      if (issuedAt === null) {
        return { ok: false, reason: 'malformed' }
      }
      const maxAge = input.maxNonceAgeMs ?? DEFAULT_NONCE_MAX_AGE_MS
      const consumed = await input.nonceStore.consume({
        nonce: local.nonce,
        issuedAt,
        expiresAt: issuedAt + maxAge,
      })
      if (consumed === 'replay') {
        return { ok: false, reason: 'replay' }
      }
      if (consumed === 'invalid') {
        return { ok: false, reason: 'malformed' }
      }
      // Сбой хранилища — отказ: без защиты от replay вход невозможен.
      if (consumed !== 'consumed') {
        return { ok: false, reason: 'nonce_store_unavailable' }
      }
    }

    return local
  } catch {
    return { ok: false, reason: 'network_error' }
  } finally {
    clearTimeout(timeout)
  }
}


