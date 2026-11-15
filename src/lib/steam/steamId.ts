/**
 * SteamID64 — идентификатор пользователя Steam в виде десятичной строки (Task 20A).
 *
 * SteamID64 — это 64-битное беззнаковое число, которое **не помещается** в
 * безопасный диапазон JavaScript `Number` (±2^53−1). Любая арифметика через
 * `Number` исказит старшие разряды и превратит два разных аккаунта в один.
 *
 * Поэтому здесь всё построено на строке и `BigInt`:
 * - значение принимается и возвращается только строкой;
 * - проверяется формат (ровно 17 цифр) и попадание в реальный диапазон
 *   Steam-аккаунтов: `76561197960265728` … `76561202255233022`
 *   (база `76561197960265728` + 32-битный account id).
 */

/** Индивидуальный аккаунт Steam (личный профиль). */
export const STEAM_ID64_INDIVIDUAL_BASE = '76561197960265728'

/** Максимальный SteamID64 для индивидуального аккаунта (база + 2^32 − 1). */
export const STEAM_ID64_INDIVIDUAL_MAX = '76561202255233023'

/** Шаблон идентификатора профиля Steam, который приходит в OpenID claimed_id. */
export const STEAM_OPENID_CLAIMED_PREFIX = 'https://steamcommunity.com/openid/id/'

const DIGITS_17 = /^\d{17}$/

/**
 * Проверяет, что значение — корректная строка SteamID64 индивидуального аккаунта.
 * Отвергает не-строки (в том числе `number`, `bigint`, объекты) и значения вне
 * диапазона, чтобы нельзя было передать «почти правильный» идентификатор.
 */
export function isSteamId64(value: unknown): value is string {
  if (typeof value !== 'string' || !DIGITS_17.test(value)) {
    return false
  }
  // Сравнение в BigInt безопасно: строка уже проверена как 17 цифр.
  const numeric = BigInt(value)
  return numeric >= BigInt(STEAM_ID64_INDIVIDUAL_BASE) && numeric <= BigInt(STEAM_ID64_INDIVIDUAL_MAX)
}

/**
 * Возвращает нормализованный SteamID64 либо `null`.
 * Строка обрезается по краям, ведущие нули не допускаются шаблоном из 17 цифр.
 */
export function parseSteamId64(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return isSteamId64(trimmed) ? trimmed : null
}

/**
 * Извлекает SteamID64 из `claimed_id` OpenID.
 * Принимается только точный префикс Steam и корректный идентификатор.
 */
export function steamIdFromClaimedId(claimedId: unknown): string | null {
  if (typeof claimedId !== 'string') {
    return null
  }
  const trimmed = claimedId.trim()
  if (!trimmed.startsWith(STEAM_OPENID_CLAIMED_PREFIX)) {
    return null
  }
  return parseSteamId64(trimmed.slice(STEAM_OPENID_CLAIMED_PREFIX.length))
}

/** Публичный URL профиля Steam (безопасен для отображения как ссылка). */
export function steamProfileUrl(steamId64: string): string | null {
  const id = parseSteamId64(steamId64)
  return id === null ? null : `https://steamcommunity.com/profiles/${id}`
}

/**
 * Восстанавливает SteamID64 из 32-битного account id (для серверных нужд).
 * Возвращает строку, а не число.
 */
export function steamIdFromAccountId(accountId: number): string | null {
  if (!Number.isInteger(accountId) || accountId < 0 || accountId > 0xffffffff) {
    return null
  }
  return (BigInt(STEAM_ID64_INDIVIDUAL_BASE) + BigInt(accountId)).toString()
}

/**
 * Проверяет, что два идентификатора описывают один и тот же аккаунт.
 * Используется для сверки `claimed_id` и `identity` в OpenID-ответе.
 */
export function isSameSteamAccount(left: unknown, right: unknown): boolean {
  const a = typeof left === 'string' ? steamIdFromClaimedId(left) : null
  const b = typeof right === 'string' ? steamIdFromClaimedId(right) : null
  return a !== null && b !== null && a === b
}
