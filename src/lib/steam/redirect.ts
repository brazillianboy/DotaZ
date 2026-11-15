/**
 * Безопасные редиректы и одноразовый `state` (Task 20A).
 *
 * Общие правила для клиента и сервера: наружу не уводим, двойной слэш и
 * обратные слэши отвергаем, управляющие символы вырезаем. `state` — это
 * криптостойкое случайное значение, привязанное к попытке входа (CSRF).
 */

const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/

/** Минимальная длина `state`: 32 символа base64url ≈ 192 бита. */
export const STATE_MIN_LENGTH = 32

function getCrypto(): Crypto {
  const value = (globalThis as { crypto?: Crypto }).crypto
  if (typeof value === 'undefined' || typeof value.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues недоступен: генерация state невозможна')
  }
  return value
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  if (typeof btoa !== 'function') {
    // Молча возвращать пустую строку нельзя: это ослабило бы CSRF-защиту.
    throw new Error('btoa недоступен: кодирование state невозможно')
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Создаёт новый одноразовый `state` (32 случайных байта, base64url). */
export function createOAuthState(): string {
  const bytes = new Uint8Array(32)
  getCrypto().getRandomValues(bytes)
  return toBase64Url(bytes)
}

/** Проверяет формат `state` (не подлинность — подлинность даёт сверка с сессией). */
export function isValidOAuthState(value: unknown): value is string {
  return typeof value === 'string' && STATE_PATTERN.test(value)
}

/**
 * Приводит произвольное значение к безопасному внутреннему пути приложения.
 * Внешние адреса, `//host`, обратные слэши, `/login` и пустые строки → `fallback`.
 */
export function sanitizeInternalPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') {
    return fallback
  }
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 2048) {
    return fallback
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return fallback
  }
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback
  }
  if (trimmed.startsWith('/login') || trimmed.startsWith('/auth/steam/callback')) {
    return fallback
  }
  return trimmed
}

/**
 * Проверка пути серверного редиректа на доверенный origin.
 *
 * В отличие от `sanitizeInternalPath` НЕ запрещает `/login` и
 * `/auth/steam/callback`: серверная функция сама возвращает пользователя на
 * эти маршруты после Steam-входа (успех) и при ошибке. Внешние адреса, `//host`,
 * обратные слэши и управляющие символы по-прежнему отклоняются, а `origin`
 * берётся из доверенной конфигурации `APP_ORIGIN`, а не из запроса.
 */
export function sanitizeServerRedirectPath(value: string, fallback = '/'): string {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 2048) {
    return fallback
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return fallback
  }
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback
  }
  return trimmed
}

/**
 * Собирает абсолютный URL для возврата в приложение строго на том же origin.
 * Возвращает `null`, если origin некорректен или путь небезопасен.
 */
export function buildAppRedirectUrl(origin: string, path: string): string | null {
  let base: URL
  try {
    base = new URL(origin)
  } catch {
    return null
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    return null
  }
  const safePath = sanitizeServerRedirectPath(path, '/')
  return new URL(safePath, base).toString()
}
