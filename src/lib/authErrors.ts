import type { AuthErrorCode } from '../i18n/errors'

/**
 * Перевод ошибок Supabase Auth в короткие понятные сообщения (Task 3, Task 13).
 *
 * Функция `mapAuthErrorCode` возвращает стабильный код ошибки, по которому
 * интерфейс выбирает текст на текущем языке; `mapAuthError` сохранён для
 * обратной совместимости и возвращает русское сообщение.
 *
 * Технические детали, стектрейсы и значения токенов пользователям не показываются.
 */
const NOT_CONFIGURED_MESSAGE =
  'Авторизация временно недоступна: Supabase не настроен. Обратитесь к администратору проекта.'

const GENERIC_MESSAGE = 'Не удалось выполнить операцию. Повторите попытку позже.'

const NETWORK_MESSAGE =
  'Сеть недоступна или сервис не отвечает. Проверьте подключение к интернету и повторите попытку.'

/** Русские тексты по кодам ошибок (для `mapAuthError` и совместимости). */
const RU_MESSAGES: Record<AuthErrorCode, string> = {
  not_configured: NOT_CONFIGURED_MESSAGE,
  network: NETWORK_MESSAGE,
  invalid_credentials: 'Неверный email или пароль.',
  email_not_confirmed:
    'Email ещё не подтверждён. Проверьте почту и перейдите по ссылке из письма.',
  already_registered: 'Похоже, аккаунт с таким email уже существует. Попробуйте войти.',
  rate_limited: 'Слишком много попыток. Подождите немного и повторите.',
  weak_password: 'Пароль не соответствует требованиям проекта Supabase. Выберите пароль длиннее.',
  invalid_email: 'Указан некорректный email.',
  signup_disabled: 'Регистрация временно отключена в настройках проекта.',
  link_invalid: 'Ссылка недействительна или устарела. Запросите новое письмо.',
  generic: GENERIC_MESSAGE,
}

/** Классификация ошибки Supabase Auth по стабильному коду. */
export function mapAuthErrorCode(error: unknown): AuthErrorCode {
  let raw = ''
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    raw = error.message
  }
  const message = raw.toLowerCase()

  if (message.includes('failed to fetch') || message.includes('fetch failed') || message.includes('network')) {
    return 'network'
  }
  if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
    return 'invalid_credentials'
  }
  if (message.includes('email not confirmed')) {
    return 'email_not_confirmed'
  }
  if (
    message.includes('user already registered') ||
    message.includes('already been registered') ||
    message.includes('already registered')
  ) {
    return 'already_registered'
  }
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('over_email_send_rate_limit')
  ) {
    return 'rate_limited'
  }
  if (
    message.includes('password should be at least') ||
    message.includes('password is too short') ||
    message.includes('weak password')
  ) {
    return 'weak_password'
  }
  if (
    message.includes('invalid email') ||
    message.includes('unable to validate email') ||
    message.includes('email address is invalid')
  ) {
    return 'invalid_email'
  }
  if (message.includes('signups not allowed') || message.includes('signup is disabled')) {
    return 'signup_disabled'
  }
  if (
    message.includes('otp') ||
    message.includes('token') ||
    message.includes('confirmation link') ||
    message.includes('expired')
  ) {
    return 'link_invalid'
  }
  return 'generic'
}

/** Русское сообщение об ошибке (сохранено для совместимости с Task 3). */
export function mapAuthError(error: unknown): string {
  return RU_MESSAGES[mapAuthErrorCode(error)]
}

/** Русский текст по коду ошибки (используется как fallback). */
export function authErrorMessageForCode(code: AuthErrorCode): string {
  return RU_MESSAGES[code]
}

export { NOT_CONFIGURED_MESSAGE, GENERIC_MESSAGE, NETWORK_MESSAGE }