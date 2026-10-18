import type { LaningPurchase, LaningStageData } from '../types/match'

/**
 * Фактические данные стадии линии 00:00–10:00 (Task 8).
 *
 * Чистые функции: нет HTTP, React, Supabase и глобального состояния; вход не изменяется.
 * Семантика полей OpenDota подтверждена на живом ответе для матча `9007760151`:
 *  - `lh_t`, `gold_t`, `xp_t` — массивы накопительных значений, длина = ⌊duration/60⌋ + 1,
 *    индекс 0 → 0:00, индекс 10 → 10:00;
 *  - `kills_log`, `deaths_log`, `purchase_log` — события `{ time: секунды, key: ... }`,
 *    время может быть отрицательным (предматчевая закупка).
 *
 * Отсутствующие или недостоверные данные возвращаются как `null` и никогда не
 * подменяются нулём; легитимный ноль сохраняется.
 */

/** Конец отчётного интервала: 10 минут = 600 секунд (граница включительно). */
export const LANING_INTERVAL_END_SECONDS = 600

/** Индекс 10-й минуты в таймлайнах OpenDota (`lh_t`, `gold_t`, `xp_t`). */
export const TEN_MINUTE_INDEX = 10

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return value
}

/**
 * Значение таймлайна на заданной минуте.
 * Не массив, слишком короткий массив или некорректное значение → `null`.
 * Значение `0` сохраняется; экстраполяция и интерполяция не выполняются.
 */
export function extractTimelineValueAtMinute(series: unknown, minute: number): number | null {
  if (!Array.isArray(series) || !Number.isInteger(minute) || minute < 0) {
    return null
  }
  if (series.length <= minute) {
    return null
  }
  return toFiniteNumberOrNull(series[minute])
}

/**
 * Количество событий в интервале `[0, endSeconds]`.
 * `null` — лог отсутствует либо содержит записи с невалидным временем
 * (итог был бы недостоверным). Пустой массив даёт `0`: событий в интервале не было.
 */
export function countEventsInInterval(
  log: unknown,
  endSeconds: number = LANING_INTERVAL_END_SECONDS,
): number | null {
  if (!Array.isArray(log)) {
    return null
  }
  let count = 0
  for (const entry of log) {
    if (!isRecord(entry)) {
      return null
    }
    const time = toFiniteNumberOrNull(entry.time)
    if (time === null) {
      return null
    }
    if (time >= 0 && time <= endSeconds) {
      count += 1
    }
  }
  return count
}

/**
 * Покупки в интервале `[0, endSeconds]` (предматчевые записи с отрицательным
 * временем не входят в отчёт).
 * `null` — лог отсутствует или содержит невалидную запись; `[]` — лог есть,
 * но покупок в интервале не было. Ключи предметов сохраняются как есть.
 */
export function collectPurchasesInInterval(
  log: unknown,
  endSeconds: number = LANING_INTERVAL_END_SECONDS,
): LaningPurchase[] | null {
  if (!Array.isArray(log)) {
    return null
  }
  const purchases: LaningPurchase[] = []
  for (const entry of log) {
    if (!isRecord(entry)) {
      return null
    }
    const time = toFiniteNumberOrNull(entry.time)
    const key = entry.key
    if (time === null || typeof key !== 'string' || key.length === 0) {
      return null
    }
    if (time >= 0 && time <= endSeconds) {
      purchases.push({ time, key })
    }
  }
  return purchases
}

/**
 * Процент эффективности линии по версии OpenDota.
 * Шкала подтверждена: `lane_efficiency_pct` = 78 при `lane_efficiency` = 0.78.
 * Значения вне диапазона 0–100 и не-числа → `null`.
 */
export function normalizeLaneEfficiencyPct(value: unknown): number | null {
  const numeric = toFiniteNumberOrNull(value)
  if (numeric === null || numeric < 0 || numeric > 100) {
    return null
  }
  return numeric
}

/** Сборка блока стадии линии из записи игрока; входной объект не изменяется. */
export function buildLaningStageData(raw: unknown): LaningStageData {
  const player = isRecord(raw) ? raw : {}
  return {
    lastHitsAt10: extractTimelineValueAtMinute(player.lh_t, TEN_MINUTE_INDEX),
    goldAt10: extractTimelineValueAtMinute(player.gold_t, TEN_MINUTE_INDEX),
    xpAt10: extractTimelineValueAtMinute(player.xp_t, TEN_MINUTE_INDEX),
    killsFirst10: countEventsInInterval(player.kills_log),
    deathsFirst10: countEventsInInterval(player.deaths_log),
    purchasesFirst10: collectPurchasesInInterval(player.purchase_log),
    laneEfficiencyPct: normalizeLaneEfficiencyPct(player.lane_efficiency_pct),
  }
}

/** Есть ли хотя бы один подтверждённый факт стадии линии. */
export function hasLaningFacts(laning: LaningStageData): boolean {
  return (
    laning.lastHitsAt10 !== null ||
    laning.goldAt10 !== null ||
    laning.xpAt10 !== null ||
    laning.killsFirst10 !== null ||
    laning.deathsFirst10 !== null ||
    laning.purchasesFirst10 !== null ||
    laning.laneEfficiencyPct !== null
  )
}