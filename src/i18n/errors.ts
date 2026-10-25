import type { TranslationKey } from './translations'

/**
 * Локализация ошибок (Task 13).
 *
 * Классы ошибок из ранних задач сохраняются полностью: 403 от провайдера не
 * превращается в «матч не найден», а ошибка прав не становится «отчёта нет».
 * Локализуется только текст; технические детали и секреты не показываются.
 */

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

/** Коды ошибок валидации ID матча (Task 5). */
export type MatchIdErrorCode = 'empty' | 'digits' | 'positive' | 'tooLong'

/** Коды ошибок OpenDota (Task 5). */
export type OpenDotaErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'rate_limited'
  | 'server_error'
  | 'unexpected_status'
  | 'network'
  | 'timeout'
  | 'invalid_response'
  | 'aborted'

/** Коды ошибок Supabase Auth (Task 3). */
export type AuthErrorCode =
  | 'not_configured'
  | 'network'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'already_registered'
  | 'rate_limited'
  | 'weak_password'
  | 'invalid_email'
  | 'signup_disabled'
  | 'link_invalid'
  | 'generic'

const MATCH_ID_KEYS: Record<MatchIdErrorCode, TranslationKey> = {
  empty: 'errors.matchId.empty',
  digits: 'errors.matchId.digits',
  positive: 'errors.matchId.positive',
  tooLong: 'errors.matchId.tooLong',
}

const OPENDOTA_KEYS: Record<OpenDotaErrorCode, TranslationKey> = {
  not_found: 'errors.opendota.not_found',
  forbidden: 'errors.opendota.forbidden',
  rate_limited: 'errors.opendota.rate_limited',
  server_error: 'errors.opendota.server_error',
  unexpected_status: 'errors.opendota.unexpected_status',
  network: 'errors.opendota.network',
  timeout: 'errors.opendota.timeout',
  invalid_response: 'errors.opendota.invalid_response',
  aborted: 'errors.opendota.aborted',
}

const AUTH_KEYS: Record<AuthErrorCode, TranslationKey> = {
  not_configured: 'auth.error.notConfigured',
  network: 'auth.error.network',
  invalid_credentials: 'auth.error.invalidCredentials',
  email_not_confirmed: 'auth.error.emailNotConfirmed',
  already_registered: 'auth.error.alreadyRegistered',
  rate_limited: 'auth.error.rateLimited',
  weak_password: 'auth.error.weakPassword',
  invalid_email: 'auth.error.invalidEmail',
  signup_disabled: 'auth.error.signupDisabled',
  link_invalid: 'auth.error.linkInvalid',
  generic: 'auth.error.generic',
}

/** Текст ошибки валидации ID матча. */
export function matchIdErrorText(t: Translate, code: MatchIdErrorCode): string {
  return t(MATCH_ID_KEYS[code])
}

/**
 * Текст ошибки OpenDota по её классу.
 * `fallback` (сообщение провайдера) используется только для неизвестного класса.
 */
export function openDotaErrorText(
  t: Translate,
  code: OpenDotaErrorCode | string,
  options: { status?: number; fallback?: string } = {},
): string {
  const key = OPENDOTA_KEYS[code as OpenDotaErrorCode]
  if (key === undefined) {
    return options.fallback ?? t('errors.opendota.unexpected')
  }
  return options.status === undefined ? t(key) : t(key, { status: options.status })
}

/** Текст ошибки аутентификации по коду. */
export function authErrorText(
  t: Translate,
  code: AuthErrorCode | null | undefined,
  fallback?: string | null,
): string {
  if (code === null || code === undefined) {
    return fallback ?? t('auth.error.generic')
  }
  return t(AUTH_KEYS[code])
}