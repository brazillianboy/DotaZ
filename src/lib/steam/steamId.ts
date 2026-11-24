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
 * Максимальный 32-битный account id: `2^32 − 1`.
 * Именно этот диапазон заложен в SteamID64 индивидуального аккаунта.
 */
export const DOTA_ACCOUNT_ID_MAX = 0xffffffff

/**
 * Восстанавливает SteamID64 из 32-битного account id (для серверных нужд).
 * Возвращает строку, а не число.
 */
export function steamIdFromAccountId(accountId: number): string | null {
  if (!Number.isInteger(accountId) || accountId < 0 || accountId > DOTA_ACCOUNT_ID_MAX) {
    return null
  }
  return (BigInt(STEAM_ID64_INDIVIDUAL_BASE) + BigInt(accountId)).toString()
}

/**
 * Dota 2 / OpenDota `account_id` из проверенного SteamID64 (Task 20B).
 *
 * Связь трёх идентификаторов, которые нельзя путать:
 *  - **Supabase UUID** (`auth.users.id`) — владелец строк в PostgreSQL и RLS;
 *  - **SteamID64** — подтверждённая OpenID 2.0 личность Steam (строка из 17 цифр);
 *  - **account_id** — 32-битный номер аккаунта Dota 2, которым оперирует OpenDota.
 *
 * Формула для публичного индивидуального аккаунта:
 * `account_id = SteamID64 − 76561197960265728`.
 *
 * Расчёт ведётся строкой и `BigInt`: SteamID64 не помещается в безопасный
 * диапазон `Number` (2^53−1), поэтому числовая арифметика исказила бы старшие
 * разряды. В `Number` значение переводится только после проверки, что результат
 * — целое число в допустимом диапазоне `0 … 2^32−1` и безопасное целое.
 *
 * Ограничения:
 *  - поддерживаются только **индивидуальные** аккаунты Steam (тот же диапазон,
 *    что у `isSteamId64`); анонимные (Lobby) и клановые идентификаторы отклоняются;
 *  - `account_id = 0` математически корректен, но у Dota 2 такого аккаунта нет:
 *    запрос к OpenDota вернёт «не найдено», а не выдуманные данные;
 *  - обратное преобразование — `steamIdFromAccountId`; исходный SteamID64 эта
 *    функция не изменяет и не хранит.
 *
 * @returns account id либо `null`, если SteamID64 некорректен/неподдерживаем.
 */
export function accountIdFromSteamId64(value: unknown): number | null {
  const steamId = parseSteamId64(value)
  if (steamId === null) {
    return null
  }
  const account = BigInt(steamId) - BigInt(STEAM_ID64_INDIVIDUAL_BASE)
  if (account < BigInt(0) || account > BigInt(DOTA_ACCOUNT_ID_MAX)) {
    return null
  }
  // Проверка точности перед переходом в Number: диапазон 2^32−1 заведомо
  // меньше 2^53−1, но условие оставлено явным, чтобы правило было проверяемым.
  if (account > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null
  }
  const asNumber = Number(account)
  return Number.isSafeInteger(asNumber) ? asNumber : null
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
