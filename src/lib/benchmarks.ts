/**
 * Нормативы 15-й минуты (Task 16): чистый модуль сравнения.
 *
 * Принципы:
 *  - никаких сетевых запросов и React — только разбор проверенного снапшота;
 *  - значения сравниваются строго в пределах одного патча и одной роли;
 *  - отсутствие нормы — это отсутствие данных, а не «плохая игра»;
 *  - размер выборки считается отдельно для каждой метрики;
 *  - модуль не выносит оценок «хорошо/плохо»: только факт, медиана, квартили и разница.
 *
 * Источник снапшота — OpenDota Explorer (см. `scripts/build-benchmarks.mjs`).
 */

/** Версия методики. Несовпадение с версией снапшота не считается ошибкой данных. */
export const BENCHMARK_METHOD_VERSION = '1.0.0'

/** Класс линии по OpenDota: 1 — safe, 2 — mid, 3 — off, 4 — jungle (не позиция 1–5). */
export const LANE_ROLES = [1, 2, 3, 4] as const
export type LaneRole = (typeof LANE_ROLES)[number]

/** Поддерживаемые метрики снапшота. */
export const BENCHMARK_METRICS = ['lastHits', 'gold', 'xp'] as const
export type BenchmarkMetricKey = (typeof BENCHMARK_METRICS)[number]

export function isLaneRole(value: unknown): value is LaneRole {
  return value === 1 || value === 2 || value === 3 || value === 4
}

/** Статистика одной метрики: медиана и квартили с размером выборки. */
export interface BenchmarkMetricStats {
  /** Сколько наблюдений использовано именно для этой метрики. */
  n: number
  p25: number | null
  p50: number | null
  p75: number | null
}

export interface BenchmarkBucket {
  hero_id: number
  lane_role: LaneRole
  metrics: Record<BenchmarkMetricKey, BenchmarkMetricStats>
}

export interface BenchmarkSnapshot {
  method_version: string
  source: { name: string; url: string; dataset: string; attribution: string }
  generated_at: string
  /** Название патча снапшота, например «7.41». */
  patch: string
  /** Числовой id того же патча в OpenDota: по нему сопоставляется матч. */
  patch_id: number | null
  interval: { minutes: number; arrayIndex: number; label: string }
  thresholds: { full: number; medianOnly: number }
  bucket_count: number
  buckets: BenchmarkBucket[]
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFiniteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseMetricStats(value: unknown): BenchmarkMetricStats | null {
  if (!isRecord(value)) {
    return null
  }
  const n = value.n
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    return null
  }
  const p25 = toFiniteNumberOrNull(value.p25)
  const p50 = toFiniteNumberOrNull(value.p50)
  const p75 = toFiniteNumberOrNull(value.p75)
  if (n === 0) {
    // Нет наблюдений — нет перцентилей. Значения не подменяются нулём.
    if (p25 !== null || p50 !== null || p75 !== null) {
      return null
    }
    return { n: 0, p25: null, p50: null, p75: null }
  }
  if (p25 === null || p50 === null || p75 === null) {
    return null
  }
  if (p25 < 0 || !(p25 <= p50 && p50 <= p75)) {
    return null
  }
  return { n, p25, p50, p75 }
}

function parseBucket(value: unknown): BenchmarkBucket | null {
  if (!isRecord(value)) {
    return null
  }
  const heroId = value.hero_id
  if (typeof heroId !== 'number' || !Number.isInteger(heroId) || heroId <= 0) {
    return null
  }
  if (!isLaneRole(value.lane_role)) {
    return null
  }
  if (!isRecord(value.metrics)) {
    return null
  }
  const metrics = {} as Record<BenchmarkMetricKey, BenchmarkMetricStats>
  for (const key of BENCHMARK_METRICS) {
    const stats = parseMetricStats(value.metrics[key])
    if (stats === null) {
      return null
    }
    metrics[key] = stats
  }
  return { hero_id: heroId, lane_role: value.lane_role, metrics }
}

/**
 * Разбор и валидация снапшота. Неизвестная структура отвергается целиком:
 * частично валидный снапшот использовать нельзя (риск неверных нормативов).
 */
export function parseBenchmarkSnapshot(raw: unknown): ParseResult<BenchmarkSnapshot> {
  if (!isRecord(raw)) {
    return { ok: false }
  }
  const { method_version, patch, generated_at, source, interval, thresholds, buckets } = raw
  if (typeof method_version !== 'string' || method_version.length === 0) {
    return { ok: false }
  }
  if (typeof patch !== 'string' || !/^\d+\.\d+$/.test(patch)) {
    return { ok: false }
  }
  if (typeof generated_at !== 'string' || Number.isNaN(Date.parse(generated_at))) {
    return { ok: false }
  }
  const rawPatchId = raw.patch_id
  if (
    rawPatchId !== null &&
    rawPatchId !== undefined &&
    (typeof rawPatchId !== 'number' || !Number.isInteger(rawPatchId) || rawPatchId < 0)
  ) {
    return { ok: false }
  }
  if (!isRecord(source) || typeof source.name !== 'string' || typeof source.attribution !== 'string') {
    return { ok: false }
  }
  if (!isRecord(interval) || typeof interval.minutes !== 'number' || typeof interval.label !== 'string') {
    return { ok: false }
  }
  if (
    !isRecord(thresholds) ||
    typeof thresholds.full !== 'number' ||
    typeof thresholds.medianOnly !== 'number' ||
    !(thresholds.medianOnly <= thresholds.full)
  ) {
    return { ok: false }
  }
  if (!Array.isArray(buckets)) {
    return { ok: false }
  }

  const parsed: BenchmarkBucket[] = []
  const seen = new Set<string>()
  for (const item of buckets) {
    const bucket = parseBucket(item)
    if (bucket === null) {
      return { ok: false }
    }
    const identity = `${bucket.hero_id}:${bucket.lane_role}`
    if (seen.has(identity)) {
      // Дубль бакета сделал бы выбор норматива неоднозначным.
      return { ok: false }
    }
    seen.add(identity)
    parsed.push(bucket)
  }

  return {
    ok: true,
    value: {
      method_version,
      source: {
        name: source.name,
        url: typeof source.url === 'string' ? source.url : '',
        dataset: typeof source.dataset === 'string' ? source.dataset : '',
        attribution: source.attribution,
      },
      generated_at,
      patch,
      patch_id: typeof rawPatchId === 'number' ? rawPatchId : null,
      interval: {
        minutes: interval.minutes,
        arrayIndex: Number(interval.arrayIndex ?? 0),
        label: interval.label,
      },
      thresholds: { full: thresholds.full, medianOnly: thresholds.medianOnly },
      bucket_count: parsed.length,
      buckets: parsed,
    },
  }
}

/** Результат выбора норматива: только проверенные состояния, без «примерных» значений. */
export type BenchmarkSelection =
  | { status: 'ready'; bucket: BenchmarkBucket }
  | { status: 'missing-role' }
  | { status: 'missing-patch' }
  | { status: 'patch-mismatch'; benchmarkPatch: string }
  /** Интервал отчёта не совпадает с интервалом снапшота (например, старый отчёт 10 минут). */
  | { status: 'interval-mismatch'; benchmarkInterval: number }
  | { status: 'no-benchmark' }

export interface BenchmarkQuery {
  heroId: number | null
  laneRole: number | null
  /** Числовой id патча матча (`patch` из OpenDota); `null` — патч не подтверждён. */
  patchId: number | null
  /** Длина интервала отчёта в минутах (10 — старые снимки, 15 — текущий). */
  intervalMinutes: number
}

/**
 * Выбор норматива. Патчи не смешиваются: при несовпадении возвращается
 * `patch-mismatch`, а не «ближайший» бакет.
 */
export function selectBenchmark(
  snapshot: BenchmarkSnapshot,
  query: BenchmarkQuery,
): BenchmarkSelection {
  if (!isLaneRole(query.laneRole)) {
    return { status: 'missing-role' }
  }
  if (query.patchId === null) {
    return { status: 'missing-patch' }
  }
  if (snapshot.patch_id === null) {
    // Снапшот без числового id патча: сопоставление не подтверждено.
    return { status: 'no-benchmark' }
  }
  if (query.patchId !== snapshot.patch_id) {
    return { status: 'patch-mismatch', benchmarkPatch: snapshot.patch }
  }
  // Интервалы должны совпадать: 10-минутное значение нельзя сравнивать с нормативом 15-й минуты.
  if (query.intervalMinutes !== snapshot.interval.minutes) {
    return { status: 'interval-mismatch', benchmarkInterval: snapshot.interval.minutes }
  }
  if (query.heroId === null) {
    return { status: 'no-benchmark' }
  }
  const bucket = snapshot.buckets.find(
    (item) => item.hero_id === query.heroId && item.lane_role === query.laneRole,
  )
  return bucket === undefined ? { status: 'no-benchmark' } : { status: 'ready', bucket }
}

/** Состояние сравнения по конкретной метрике. */
export type MetricComparisonStatus =
  /** n >= порога полной выборки: показываются медиана и квартили. */
  | 'full'
  /** medianOnly <= n < full: только медиана с предупреждением о малой выборке. */
  | 'median-only'
  /** n < medianOnly: сравнение не показывается. */
  | 'insufficient'
  /** В выборке нет наблюдений по этой метрике. */
  | 'no-sample'
  /** У игрока нет значения метрики (таймлайн отсутствует или короче 15 минут). */
  | 'missing-actual'

export interface MetricComparison {
  key: BenchmarkMetricKey
  status: MetricComparisonStatus
  /** Фактическое значение игрока на 15-й минуте (не подменяется нулём). */
  actual: number | null
  median: number | null
  p25: number | null
  p75: number | null
  /** Размер выборки именно для этой метрики. */
  sampleSize: number
  /** actual − median. Отрицательное значение — ниже медианы; это не оценка игры. */
  difference: number | null
  /** Разница в процентах от медианы (1 знак); `null`, если медиана 0 или нет данных. */
  differencePercent: number | null
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Сравнение одной метрики. Никаких выводов «хорошо/плохо»: только числа и статус.
 * Отсутствие нормы (малая выборка) не является ошибкой игрока.
 */
export function compareMetric(
  key: BenchmarkMetricKey,
  actual: number | null,
  stats: BenchmarkMetricStats,
  thresholds: { full: number; medianOnly: number },
): MetricComparison {
  const base = {
    key,
    actual,
    median: stats.p50,
    p25: stats.p25,
    p75: stats.p75,
    sampleSize: stats.n,
  }

  if (stats.n === 0 || stats.p50 === null) {
    return { ...base, status: 'no-sample', difference: null, differencePercent: null }
  }
  if (actual === null) {
    return { ...base, status: 'missing-actual', difference: null, differencePercent: null }
  }

  const difference = round1(actual - stats.p50)
  const differencePercent =
    stats.p50 === 0 ? null : round1(((actual - stats.p50) / stats.p50) * 100)

  if (stats.n >= thresholds.full) {
    return { ...base, status: 'full', difference, differencePercent }
  }
  if (stats.n >= thresholds.medianOnly) {
    return { ...base, status: 'median-only', difference, differencePercent }
  }
  return { ...base, status: 'insufficient', difference, differencePercent }
}

/** Фактические показатели игрока за первые 15 минут. */
export interface ActualLaningMetrics {
  lastHits: number | null
  gold: number | null
  xp: number | null
}

export interface LaningBenchmarkResult {
  status: BenchmarkSelection['status']
  /** Норматив, если он найден (иначе `null`). */
  bucket: BenchmarkBucket | null
  /** Сравнение по метрикам; `null`, если норматив недоступен. */
  metrics: Record<BenchmarkMetricKey, MetricComparison> | null
  /** Патч снапшота — для честной подписи «норматив за патч X». */
  benchmarkPatch: string
  /** Длина интервала снапшота в минутах (для сообщения о несовпадении). */
  benchmarkInterval: number
}

/**
 * Полное сравнение ранних показателей игрока с нормативом.
 * Ни при каком статусе не подставляет числа: отсутствие данных остаётся отсутствием.
 */
export function compareLaningWithBenchmark(
  snapshot: BenchmarkSnapshot,
  query: BenchmarkQuery,
  actual: ActualLaningMetrics,
): LaningBenchmarkResult {
  const selection = selectBenchmark(snapshot, query)
  if (selection.status !== 'ready') {
    return {
      status: selection.status,
      bucket: null,
      metrics: null,
      benchmarkPatch: snapshot.patch,
      benchmarkInterval: snapshot.interval.minutes,
    }
  }
  const metrics = {} as Record<BenchmarkMetricKey, MetricComparison>
  for (const key of BENCHMARK_METRICS) {
    metrics[key] = compareMetric(key, actual[key], selection.bucket.metrics[key], snapshot.thresholds)
  }
  return {
    status: 'ready',
    bucket: selection.bucket,
    metrics,
    benchmarkPatch: snapshot.patch,
    benchmarkInterval: snapshot.interval.minutes,
  }
}

/** Есть ли хотя бы одно метрическое сравнение, пригодное к показу. */
export function hasDisplayableComparison(result: LaningBenchmarkResult): boolean {
  if (result.metrics === null) {
    return false
  }
  return BENCHMARK_METRICS.some((key) => {
    const status = result.metrics?.[key].status
    return status === 'full' || status === 'median-only'
  })
}

