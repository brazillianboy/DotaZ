/**
 * Хранилища состояния Steam-аутентификации (Task 20A, усиление).
 *
 * Две независимые задачи:
 *
 * 1. **Защита от replay.** Каждый `openid.response_nonce` можно потребить ровно
 *    один раз, причём решение принимает база (`INSERT ... ON CONFLICT DO
 *    NOTHING`), а не память процесса. Это работает и при нескольких инстансах
 *    Edge Function.
 * 2. **Одноразовый код обмена.** Браузер получает непрозрачный код, а не
 *    Supabase-токен: токен выдаётся только в ответ на POST-обмен, поэтому он не
 *    попадает в историю браузера, Referer и логи прокси.
 *
 * Оба хранилища описаны интерфейсами: продакшн-реализация использует SQL-функции
 * из миграции, тесты — in-memory реализацию с той же семантикой.
 */

/** Сколько времени ответ Steam вообще считается пригодным. */
export const NONCE_MAX_AGE_MS = 5 * 60 * 1000

/** Время жизни кода обмена: короткое окно на один редирект. */
export const EXCHANGE_TTL_SECONDS = 120

const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/

export type NonceConsumeResult = 'consumed' | 'replay' | 'invalid' | 'unavailable'

export interface NonceConsumeInput {
  nonce: string
  /** Момент выпуска nonce по данным Steam, мс. */
  issuedAt: number
  /** Момент, после которого запись можно удалять, мс. */
  expiresAt: number
}

export interface NonceStore {
  /**
   * Атомарно помечает nonce использованным.
   * `unavailable` означает сбой хранилища — вызывающий обязан отказать во входе.
   */
  consume(input: NonceConsumeInput): Promise<NonceConsumeResult>
}

export interface ExchangeRecord {
  userId: string
  steamId64: string
}

export interface ExchangeStore {
  /** Создаёт запись обмена; `false` — не удалось (конфликт/сбой). */
  create(input: {
    codeHash: string
    /** SHA-256 (hex) от секрета, который остаётся в браузере приложения. */
    codeChallenge: string
    userId: string
    steamId64: string
    ttlSeconds: number
  }): Promise<boolean>
  /**
   * Атомарно потребляет код: ровно один вызов получает запись.
   * `challenge` сверяется в том же запросе, поэтому неверный секрет не
   * расходует код.
   */
  redeem(codeHash: string, challenge: string): Promise<ExchangeRecord | null>
}

/**
 * Проверяет формат кода обмена: 43 символа base64url (32 случайных байта).
 * Строгая проверка не даёт использовать код как канал инъекции.
 */
export function isValidExchangeCode(value: unknown): value is string {
  return typeof value === 'string' && CODE_PATTERN.test(value)
}

/** Генерирует новый код обмена. */
export function createExchangeCode(): string {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto
  if (typeof cryptoRef === 'undefined' || typeof cryptoRef.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues недоступен: код обмена не может быть создан')
  }
  const bytes = new Uint8Array(32)
  cryptoRef.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  if (typeof btoa !== 'function') {
    throw new Error('btoa недоступен: код обмена не может быть создан')
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Хэширует код обмена (SHA-256, hex). В базе хранится только хэш: утечка таблицы
 * не даёт возможности redeem'ить код.
 */
export async function hashExchangeCode(code: string): Promise<string> {
  return sha256Hex(code)
}

/** Общий SHA-256 (hex) для кода обмена и PKCE-секрета. */
export async function sha256Hex(value: string): Promise<string> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle
  if (typeof subtle === 'undefined') {
    throw new Error('crypto.subtle недоступен: хэширование невозможно')
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// --- PKCE-привязка обмена к браузеру ---------------------------------------

/**
 * Почему PKCE, а не cookie.
 *
 * Приложение и Supabase Edge Function обычно находятся на **разных сайтах**
 * (`dotaz.example` и `<ref>.supabase.co`). Cookie `SameSite=Lax` не отправляется
 * в кросс-сайтовом `fetch POST`, а `SameSite=None` ломается политиками сторонних
 * cookie в браузерах. Поэтому привязка строится на секрете, который создаётся в
 * приложении, остаётся в `sessionStorage` этого же origin и передаётся только в
 * теле запроса обмена. Сервер хранит лишь SHA-256 секрета.
 */

const VERIFIER_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** Создаёт PKCE-секрет (32 случайных байта, base64url). */
export function createCodeVerifier(): string {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto
  if (typeof cryptoRef === 'undefined' || typeof cryptoRef.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues недоступен: секрет обмена не создан')
  }
  const bytes = new Uint8Array(32)
  cryptoRef.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  if (typeof btoa !== 'function') {
    throw new Error('btoa недоступен: секрет обмена не создан')
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Проверяет формат PKCE-секрета. */
export function isValidCodeVerifier(value: unknown): value is string {
  return typeof value === 'string' && VERIFIER_PATTERN.test(value)
}

/**
 * Вычисляет challenge из секрета: SHA-256 в hex.
 * Хранится на сервере, секрет — только в браузере пользователя.
 */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  if (!isValidCodeVerifier(verifier)) {
    throw new Error('Некорректный формат PKCE-секрета')
  }
  return sha256Hex(verifier)
}
