/**
 * Перевод ошибок Supabase Auth в короткие понятные сообщения на русском.
 * Технические детали, стектрейсы и значения токенов пользователям не показываются.
 */
const NOT_CONFIGURED_MESSAGE =
  'Авторизация временно недоступна: Supabase не настроен. Обратитесь к администратору проекта.'

const GENERIC_MESSAGE = 'Не удалось выполнить операцию. Повторите попытку позже.'

const NETWORK_MESSAGE =
  'Сеть недоступна или сервис не отвечает. Проверьте подключение к интернету и повторите попытку.'

export function mapAuthError(error: unknown): string {
  let raw = ''
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    raw = error.message
  }
  const message = raw.toLowerCase()

  if (message.includes('failed to fetch') || message.includes('fetch failed') || message.includes('network')) {
    return NETWORK_MESSAGE
  }
  if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
    return 'Неверный email или пароль.'
  }
  if (message.includes('email not confirmed')) {
    return 'Email ещё не подтверждён. Проверьте почту и перейдите по ссылке из письма.'
  }
  if (message.includes('user already registered') || message.includes('already been registered') || message.includes('already registered')) {
    return 'Похоже, аккаунт с таким email уже существует. Попробуйте войти.'
  }
  if (message.includes('rate limit') || message.includes('too many requests') || message.includes('over_email_send_rate_limit')) {
    return 'Слишком много попыток. Подождите немного и повторите.'
  }
  if (message.includes('password should be at least') || message.includes('password is too short') || message.includes('weak password')) {
    return 'Пароль не соответствует требованиям проекта Supabase. Выберите пароль длиннее.'
  }
  if (message.includes('invalid email') || message.includes('unable to validate email') || message.includes('email address is invalid')) {
    return 'Указан некорректный email.'
  }
  if (message.includes('signups not allowed') || message.includes('signup is disabled')) {
    return 'Регистрация временно отключена в настройках проекта.'
  }
  if (message.includes('otp') || message.includes('token') || message.includes('confirmation link') || message.includes('expired')) {
    return 'Ссылка недействительна или устарела. Запросите новое письмо.'
  }
  return GENERIC_MESSAGE
}

export { NOT_CONFIGURED_MESSAGE, GENERIC_MESSAGE, NETWORK_MESSAGE }