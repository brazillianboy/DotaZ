import type { LaningInterval, LaningPurchase, LaningStageData } from '../types/match'

/**
 * Фактические данные ранней стадии матча (Task 8; интервал 00:00–15:00).
 *
 * Чистые функции: нет HTTP, React, Supabase и глобального состояния; вход не изменяется.
 * Семантика полей OpenDota подтверждена на живом ответе для матча `9007760151`:
 *  - `lh_t`, `gold_t`, `xp_t` — массивы накопительных значений, длина = ⌊duration/60⌋ + 1,
 *    индекс 0 → 0:00, индекс 15 → 15:00;
 *  - `kills_log`, `deaths_log`, `purchase_log` — события `{ time: секунды, key: ... }`,
 *    время может быть отрицательным (предматчевая закупка).
 *
 * Отсутствующие или недостоверные данные возвращаются как `null` и никогда не
 * подменяются нулём; легитимный ноль сохраняется.
 */

/** Длина отчётного интервала ранней стадии в минутах (00:00–15:00). */
export const LANING_INTERVAL_MINUTES = 15

/** Конец отчётного интервала: 15 минут = 900 секунд (граница включительно). */
export const LANING_INTERVAL_END_SECONDS = LANING_INTERVAL_MINUTES * 60

/** Индекс конца интервала в таймлайнах OpenDota (`lh_t`, `gold_t`, `xp_t`). */
export const LANING_INTERVAL_INDEX = LANING_INTERVAL_MINUTES

/** Подпись текущего интервала (используется в текстах и ограничениях анализа). */
export const LANING_INTERVAL_LABEL = '00:00–15:00'

/** Подпись интервала по его длине в минутах: 10 → `00:00–10:00`, 15 → `00:00–15:00`. */
export function laningIntervalLabel(minutes: number): string {
  return `00:00–${String(minutes).padStart(2, '0')}:00`
}

/** Метка конца интервала для подписей вида «к 15:00». */
export function laningIntervalEndLabel(minutes: number): string {
  return `${String(minutes).padStart(2, '0')}:00`
}

/** Описание интервала ранней стадии по числу минут. */
export function buildLaningInterval(minutes: number = LANING_INTERVAL_MINUTES): LaningInterval {
  return { minutes, label: laningIntervalLabel(minutes) }
}

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
 *
 * Фильтрация по типу предмета здесь НЕ выполняется: сырые события журнала
 * сохраняются без изменений (в нормализованных данных и в сохранённом снимке).
 * Единый отбор для показа (компоненты и собранные предметы — да, обычные
 * расходники — нет, пять исключений — всегда) выполняет общий фильтр
 * `filterDisplayedPurchases` из `src/lib/items.ts`, одинаковый для секции
 * 00:00–15:00 и для секции предметов за матч.
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
 * Полный журнал покупок за матч (включая предматчевые записи с отрицательным
 * временем и покупки после ранней стадии).
 *
 * `null` — журнал отсутствует или содержит невалидную запись (итог был бы
 * недостоверным); `[]` — журнал получен, но покупок нет. Порядок записей
 * сохраняется как в ответе OpenDota; фильтрация по типу предмета не выполняется.
 */
export function collectPurchaseLog(log: unknown): LaningPurchase[] | null {
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
    purchases.push({ time, key })
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

/** Сборка блока ранней стадии из записи игрока; входной объект не изменяется. */
export function buildLaningStageData(raw: unknown): LaningStageData {
  const player = isRecord(raw) ? raw : {}
  return {
    interval: buildLaningInterval(LANING_INTERVAL_MINUTES),
    lastHits: extractTimelineValueAtMinute(player.lh_t, LANING_INTERVAL_INDEX),
    gold: extractTimelineValueAtMinute(player.gold_t, LANING_INTERVAL_INDEX),
    xp: extractTimelineValueAtMinute(player.xp_t, LANING_INTERVAL_INDEX),
    killsFirst: countEventsInInterval(player.kills_log),
    deathsFirst: countEventsInInterval(player.deaths_log),
    purchasesFirst: collectPurchasesInInterval(player.purchase_log),
    laneEfficiencyPct: normalizeLaneEfficiencyPct(player.lane_efficiency_pct),
  }
}

/** Есть ли хотя бы один подтверждённый факт ранней стадии. */
export function hasLaningFacts(laning: LaningStageData): boolean {
  return (
    laning.lastHits !== null ||
    laning.gold !== null ||
    laning.xp !== null ||
    laning.killsFirst !== null ||
    laning.deathsFirst !== null ||
    laning.purchasesFirst !== null ||
    laning.laneEfficiencyPct !== null
  )
}