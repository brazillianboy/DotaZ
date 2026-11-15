import type { TranslationKey } from '../i18n/translations'
import { sanitizeInternalPath } from './steam/redirect'
import { computeCodeChallenge, createCodeVerifier } from './steam/stores'

/**
 * Клиентские хелперы Steam-входа (Task 20A).
 *
 * В браузере нет ни SteamID, ни доверия к нему: клиент только отправляет
 * пользователя на серверную функцию и обменивает выданный ею одноразовый
 * токен на настоящую сессию Supabase.
 */

const VERIFIER_STORAGE_KEY = 'dotaz.steam.pkce'

function sessionStore(): Storage | null {
  try {
    if (typeof window === 'undefined') {
      return null
    }
    return window.sessionStorage
  } catch {
    // Приватный режим или запрет хранилища: PKCE без хранилища невозможен.
    return null
  }
}

/**
 * Готовит PKCE-секрет для текущей попытки входа.
 *
 * Секрет живёт только в `sessionStorage` этого origin и исчезает вместе с
 * вкладкой. На сервер уходит лишь SHA-256 (challenge), поэтому код обмена не
 * может быть погашен из другого браузера — и cookie для этого не нужны.
 */
export async function beginSteamExchange(): Promise<string | null> {
  const store = sessionStore()
  if (store === null) {
    return null
  }
  try {
    const verifier = createCodeVerifier()
    const challenge = await computeCodeChallenge(verifier)
    store.setItem(VERIFIER_STORAGE_KEY, verifier)
    return challenge
  } catch {
    return null
  }
}

/** Читает PKCE-секрет текущей попытки входа. */
export function readSteamVerifier(): string | null {
  const store = sessionStore()
  if (store === null) {
    return null
  }
  try {
    return store.getItem(VERIFIER_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Удаляет PKCE-секрет после обмена или ошибки. */
export function clearSteamVerifier(): void {
  const store = sessionStore()
  if (store === null) {
    return
  }
  try {
    store.removeItem(VERIFIER_STORAGE_KEY)
  } catch {
    // Ничего страшного: секрет одноразовый и живёт только до закрытия вкладки.
  }
}

/**
 * Базовый URL серверной функции авторизации.
 * Значение — публичный адрес функции (`https://<ref>.supabase.co/functions/v1/steam-auth`),
 * никаких секретов здесь нет.
 */
export function steamAuthBaseUrl(): string | null {
  const raw = import.meta.env.VITE_STEAM_AUTH_URL
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null
  }
  try {
    const parsed = new URL(raw.trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

/** Признак того, что Steam-вход настроен в текущей сборке. */
export function isSteamConfigured(): boolean {
  return steamAuthBaseUrl() !== null
}

/**
 * URL начала входа. `next` всегда проверяется: наружу увести нельзя.
 * `challenge` — SHA-256 от PKCE-секрета, созданного в этом браузере.
 */
export function steamLoginUrl(nextPath: string, challenge: string): string | null {
  const base = steamAuthBaseUrl()
  if (base === null || !/^[0-9a-f]{64}$/.test(challenge)) {
    return null
  }
  const url = new URL(`${base}/login`)
  url.searchParams.set('next', sanitizeInternalPath(nextPath, '/'))
  url.searchParams.set('challenge', challenge)
  return url.toString()
}

/** Путь внутри приложения, куда сервер вернёт пользователя с кодом обмена. */
export const STEAM_CALLBACK_PATH = '/auth/steam/callback'

/** Адрес обмена одноразового кода на Supabase-токен. */
export function steamExchangeUrl(): string | null {
  const base = steamAuthBaseUrl()
  return base === null ? null : `${base}/exchange`
}

/** Адрес старта привязки Steam к текущему аккаунту. */
export function steamLinkStartUrl(nextPath: string, challenge: string): string | null {
  const base = steamAuthBaseUrl()
  if (base === null || !/^[0-9a-f]{64}$/.test(challenge)) {
    return null
  }
  const url = new URL(`${base}/link/start`)
  url.searchParams.set('next', sanitizeInternalPath(nextPath, '/profile'))
  url.searchParams.set('challenge', challenge)
  return url.toString()
}

/**
 * Обменивает одноразовый код на Supabase-токен.
 *
 * Код и PKCE-секрет едут в теле POST: ни токен, ни секрет не попадают в историю
 * браузера, Referer и логи прокси. Cookie не используются, поэтому запрос
 * работает и когда приложение и функция находятся на разных сайтах.
 */
export async function exchangeSteamCode(
  code: string,
  verifier: string,
): Promise<{ ok: true; tokenHash: string } | { ok: false; error: string }> {
  const url = steamExchangeUrl()
  if (url === null) {
    return { ok: false, error: 'not_configured' }
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, verifier }),
    })
    if (!response.ok) {
      let error = 'exchange_invalid'
      try {
        const parsed = (await response.json()) as { error?: unknown }
        if (typeof parsed.error === 'string') {
          error = parsed.error
        }
      } catch {
        // Ответ без тела: оставляем нейтральную ошибку.
      }
      return { ok: false, error }
    }
    const parsed = (await response.json()) as { token_hash?: unknown }
    if (typeof parsed.token_hash !== 'string' || parsed.token_hash.length === 0) {
      return { ok: false, error: 'session_failed' }
    }
    return { ok: true, tokenHash: parsed.token_hash }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

/**
 * Коды ошибок серверной части. Неизвестный код трактуется как общая ошибка и
 * никогда не превращается в «успешный вход».
 */
const STEAM_ERROR_KEYS: Record<string, TranslationKey> = {
  cancelled: 'auth.steam.error.cancelled',
  provider_error: 'auth.steam.error.provider',
  malformed: 'auth.steam.error.provider',
  bad_mode: 'auth.steam.error.invalid',
  bad_op_endpoint: 'auth.steam.error.invalid',
  bad_claimed_id: 'auth.steam.error.invalid',
  identity_mismatch: 'auth.steam.error.invalid',
  return_to_mismatch: 'auth.steam.error.invalid',
  realm_mismatch: 'auth.steam.error.invalid',
  state_mismatch: 'auth.steam.error.invalid',
  stale_nonce: 'auth.steam.error.expired',
  replay: 'auth.steam.error.replay',
  invalid_signature: 'auth.steam.error.invalid',
  network_error: 'auth.steam.error.network',
  session_failed: 'auth.steam.error.session',
  steam_already_linked: 'auth.steam.error.steamTaken',
  user_already_linked: 'auth.steam.error.alreadyLinked',
  identity_conflict: 'auth.steam.error.alreadyLinked',
  invalid_steam_id: 'auth.steam.error.invalid',
  not_configured: 'auth.steam.error.notConfigured',
  exchange_failed: 'auth.steam.error.exchangeFailed',
  exchange_invalid: 'auth.steam.error.exchangeInvalid',
  exchange_expired: 'auth.steam.error.exchangeInvalid',
  nonce_store_unavailable: 'auth.steam.error.temporarilyUnavailable',
  rate_limited: 'auth.steam.error.rateLimited',
  origin_mismatch: 'auth.steam.error.invalid',
  link_failed: 'auth.steam.error.generic',
  invalid_session: 'auth.steam.error.session',
  invalid_authorization: 'auth.steam.error.session',
}

/** Ключ локализации для кода ошибки Steam (безопасный фолбэк). */
export function steamErrorKey(code: string | null | undefined): TranslationKey {
  if (typeof code !== 'string') {
    return 'auth.steam.error.generic'
  }
  return STEAM_ERROR_KEYS[code] ?? 'auth.steam.error.generic'
}

/** Читает `steam_error` из строки запроса страницы входа. */
export function readSteamError(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const value = params.get('steam_error')
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) {
    return null
  }
  return /^[a-z_]+$/.test(value) ? value : null
}
