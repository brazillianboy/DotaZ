import {
  ITEM_TIMING_MIN_CLASSIFY_SAMPLE,
  type ItemTimingStats,
} from './itemTimings'

/**
 * Геометрия компактной шкалы тайминга покупки (Task 18).
 *
 * Модуль чистый: только линейная шкала времени, без React и DOM. Все позиции
 * считаются из фактических значений (покупка, p25, p50, p75), а не «на глаз».
 * Если выборка меньше порога или значения некорректны, шкала не строится:
 * выдумывать диапазон и медиану нельзя.
 */

/** Доля запаса по краям: маркеры не прилипают к границам области. */
export const TIMING_SCALE_PADDING_RATIO = 0.15

/** Минимальный запас в секундах, когда все значения совпали. */
export const TIMING_SCALE_MIN_PADDING_SECONDS = 60

export type TimingScaleActualPosition = 'before-range' | 'in-range' | 'after-range'

export interface TimingScaleLayout {
  /** Левый край области видимости (секунды от 0:00, может быть отрицательным). */
  domainMinSeconds: number
  /** Правый край области видимости. */
  domainMaxSeconds: number
  actualSeconds: number
  medianSeconds: number
  p25Seconds: number
  p75Seconds: number
  sampleSize: number
  /** Позиции в процентах от ширины шкалы, 0…100 (округление до 0.01). */
  actualPercent: number
  medianPercent: number
  p25Percent: number
  p75Percent: number
  /** Начало и ширина закрашенной зоны p25–p75 в процентах. */
  rangeStartPercent: number
  rangeWidthPercent: number
  /** Где фактическая покупка относительно типичного диапазона. */
  actualPosition: TimingScaleActualPosition
}

export interface TimingScaleInput {
  actualSeconds: number
  stats: ItemTimingStats
}

export interface TimingScaleOptions {
  /** Минимальная выборка для построения шкалы (по умолчанию — порог классификации). */
  minSample?: number
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  if (value > 100) {
    return 100
  }
  return Math.round(value * 100) / 100
}

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

/**
 * Строит геометрию шкалы или `null`, если сравнивать нельзя.
 *
 * Порядок вычислений:
 * 1. проверка выборки (`n >= minSample`), конечности времени покупки и квартилей;
 * 2. область видимости = min…max из {покупка, p25, p50, p75} + пропорциональный запас;
 * 3. позиция = (значение − domainMin) / (domainMax − domainMin), обрезанная в 0…100.
 *
 * Отрицательные значения (предматчевая закупка), равные значения и очень поздние
 * покупки обрабатываются без особых случаев: шкала линейна, деление на ноль исключено.
 */
export function buildTimingScale(
  input: TimingScaleInput,
  options: TimingScaleOptions = {},
): TimingScaleLayout | null {
  const minSample = options.minSample ?? ITEM_TIMING_MIN_CLASSIFY_SAMPLE
  const { actualSeconds, stats } = input

  if (!Number.isFinite(minSample) || minSample <= 0) {
    return null
  }
  if (typeof stats.n !== 'number' || !Number.isInteger(stats.n) || stats.n < minSample) {
    return null
  }
  if (!Number.isFinite(actualSeconds)) {
    return null
  }
  const { p25, p50, p75 } = stats
  if (!isFiniteNumber(p25) || !isFiniteNumber(p50) || !isFiniteNumber(p75)) {
    return null
  }
  if (!(p25 <= p50 && p50 <= p75)) {
    return null
  }

  const values = [actualSeconds, p25, p50, p75]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const padding =
    span > 0 ? span * TIMING_SCALE_PADDING_RATIO : TIMING_SCALE_MIN_PADDING_SECONDS
  const domainMinSeconds = min - padding
  const domainMaxSeconds = max + padding
  const domainSpan = domainMaxSeconds - domainMinSeconds
  if (!(domainSpan > 0) || !Number.isFinite(domainSpan)) {
    return null
  }

  const percent = (value: number): number =>
    clampPercent(((value - domainMinSeconds) / domainSpan) * 100)

  const p25Percent = percent(p25)
  const p75Percent = percent(p75)
  const actualPosition: TimingScaleActualPosition =
    actualSeconds < p25
      ? 'before-range'
      : actualSeconds > p75
        ? 'after-range'
        : 'in-range'

  return {
    domainMinSeconds: Math.round(domainMinSeconds * 10) / 10,
    domainMaxSeconds: Math.round(domainMaxSeconds * 10) / 10,
    actualSeconds,
    medianSeconds: p50,
    p25Seconds: p25,
    p75Seconds: p75,
    sampleSize: stats.n,
    actualPercent: percent(actualSeconds),
    medianPercent: percent(p50),
    p25Percent,
    p75Percent,
    rangeStartPercent: p25Percent,
    rangeWidthPercent: Math.round(Math.max(0, p75Percent - p25Percent) * 100) / 100,
    actualPosition,
  }
}
