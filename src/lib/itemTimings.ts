import { isLaneRole, type LaneRole } from './benchmarks'
import type { TimelineEntry } from './itemTimeline'

/**
 * Нормативы таймингов покупки предметов (Task 18).
 *
 * ВАЖНО: нормативы описывают игроков, которые КУПИЛИ предмет, а не всех игроков
 * героя. Медиана покупки не является «оптимальным» временем. Модуль чистый:
 * сравнение выполняется только с проверенным снапшотом, без сети и вычислений «на глаз».
 */
export const ITEM_TIMING_METHOD_VERSION = '1.0.0'

/** Runtime-путь снапшота (лежит вне бандла, как и нормативы Task 16). */
export const ITEM_TIMINGS_PATH = 'benchmarks/item-timings-7.41.json'

/**
 * Пороги выборки — продуктовые правила, а НЕ доказательство статистической значимости.
 *
 * Три разных порога решают разные задачи:
 *  - `store` — минимум наблюдений, чтобы бакет вообще попал в снапшот (генератор);
 *  - `full` — минимум наблюдений, чтобы показывать описательные квартили p25–p75;
 *  - `classify` — минимум наблюдений, чтобы присваивать класс «раньше/типично/позже».
 *
 * Требование владельца: при `n < 100` классификация невозможна. Поэтому порог
 * классификации не может быть понижен метаданными датасета — см. `effectiveClassifyThreshold`.
 */
export const ITEM_TIMING_MIN_STORE_SAMPLE = 30
export const ITEM_TIMING_MIN_PERCENTILE_SAMPLE = 100
export const ITEM_TIMING_MIN_CLASSIFY_SAMPLE = 100

export interface ItemTimingThresholds {
  /** Минимум наблюдений для сохранения бакета в датасете. */
  store: number
  /** Минимум наблюдений для показа квартилей p25–p75. */
  full: number
  /** Минимум наблюдений для классификации тайминга. */
  classify: number
  /**
   * Устаревшее поле снапшотов первой версии (`medianOnly`). Читается для
   * совместимости старых файлов и учитывается только вместе с полом `classify`.
   */
  medianOnly?: number
}

export const DEFAULT_ITEM_TIMING_THRESHOLDS: ItemTimingThresholds = {
  store: ITEM_TIMING_MIN_STORE_SAMPLE,
  full: ITEM_TIMING_MIN_PERCENTILE_SAMPLE,
  classify: ITEM_TIMING_MIN_CLASSIFY_SAMPLE,
}

/** Действующий порог показа квартилей: правило приложения нельзя понизить снапшотом. */
export function effectivePercentileThreshold(thresholds: ItemTimingThresholds): number {
  return Math.max(thresholds.full, ITEM_TIMING_MIN_PERCENTILE_SAMPLE)
}

/** Действующий порог классификации: `n < 100` никогда не классифицируется. */
export function effectiveClassifyThreshold(thresholds: ItemTimingThresholds): number {
  return Math.max(thresholds.classify, ITEM_TIMING_MIN_CLASSIFY_SAMPLE)
}

export interface ItemTimingStats {
  n: number
  p25: number | null
  p50: number | null
  p75: number | null
}

export interface ItemTimingBucket {
  hero_id: number
  lane_role: LaneRole
  /** Ключ предмета OpenDota. */
  item_key: string
  stats: ItemTimingStats
}

export interface ItemTimingSnapshot {
  method_version: string
  source: { name: string; url: string; dataset: string; attribution: string }
  generated_at: string
  patch: string
  patch_id: number | null
  thresholds: ItemTimingThresholds
  bucket_count: number
  buckets: ItemTimingBucket[]
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseStats(value: unknown): ItemTimingStats | null {
  if (!isRecord(value)) {
    return null
  }
  const n = value.n
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    return null
  }
  const p25 = toNumberOrNull(value.p25)
  const p50 = toNumberOrNull(value.p50)
  const p75 = toNumberOrNull(value.p75)
  if (n === 0) {
    return p25 === null && p50 === null && p75 === null
      ? { n: 0, p25: null, p50: null, p75: null }
      : null
  }
  if (p25 === null || p50 === null || p75 === null) {
    return null
  }
  // Время покупки отсчитывается от 0:00, но предматчевая закупка бывает отрицательной.
  if (!(p25 <= p50 && p50 <= p75)) {
    return null
  }
  return { n, p25, p50, p75 }
}

/**
 * Разбор порогов снапшота. Поддерживаются обе схемы:
 *  - текущая: `{ store, full, classify }`;
 *  - первая версия: `{ full, medianOnly }` — `medianOnly` читается как `classify`,
 *    а недостающие `store`/`classify` берутся из продуктовых значений по умолчанию.
 * Отсутствие порогов и нечисловые значения отвергаются: молча угадывать порог нельзя.
 */
function parseThresholds(value: unknown): ItemTimingThresholds | null {
  if (!isRecord(value)) {
    return null
  }
  const full = value.full
  if (typeof full !== 'number' || !Number.isFinite(full) || full <= 0) {
    return null
  }
  const legacy = value.medianOnly
  const legacyClassify =
    typeof legacy === 'number' && Number.isFinite(legacy) ? legacy : null
  const classifyRaw = value.classify
  const classify =
    typeof classifyRaw === 'number' && Number.isFinite(classifyRaw)
      ? classifyRaw
      : (legacyClassify ?? ITEM_TIMING_MIN_CLASSIFY_SAMPLE)
  const storeRaw = value.store
  const store =
    typeof storeRaw === 'number' && Number.isFinite(storeRaw)
      ? storeRaw
      : ITEM_TIMING_MIN_STORE_SAMPLE
  if (store < 1 || !(store <= full)) {
    return null
  }
  const thresholds: ItemTimingThresholds = { store, full, classify }
  if (legacyClassify !== null) {
    thresholds.medianOnly = legacyClassify
  }
  return thresholds
}

/** Строгая валидация снапшота: частично корректные данные не используются. */
export function parseItemTimingSnapshot(raw: unknown): ParseResult<ItemTimingSnapshot> {
  if (!isRecord(raw)) {
    return { ok: false }
  }
  const { method_version, patch, generated_at, source, thresholds, buckets } = raw
  if (typeof method_version !== 'string' || method_version.length === 0) {
    return { ok: false }
  }
  if (typeof patch !== 'string' || !/^\d+\.\d+$/.test(patch)) {
    return { ok: false }
  }
  if (typeof generated_at !== 'string' || Number.isNaN(Date.parse(generated_at))) {
    return { ok: false }
  }
  if (!isRecord(source) || typeof source.name !== 'string' || typeof source.attribution !== 'string') {
    return { ok: false }
  }
  const parsedThresholds = parseThresholds(thresholds)
  if (parsedThresholds === null) {
    return { ok: false }
  }
  const rawPatchId = raw.patch_id
  if (
    rawPatchId !== null &&
    rawPatchId !== undefined &&
    (typeof rawPatchId !== 'number' || !Number.isInteger(rawPatchId))
  ) {
    return { ok: false }
  }
  if (!Array.isArray(buckets)) {
    return { ok: false }
  }

  const parsed: ItemTimingBucket[] = []
  const seen = new Set<string>()
  for (const item of buckets) {
    if (!isRecord(item)) {
      return { ok: false }
    }
    const heroId = item.hero_id
    if (typeof heroId !== 'number' || !Number.isInteger(heroId) || heroId <= 0) {
      return { ok: false }
    }
    if (!isLaneRole(item.lane_role)) {
      return { ok: false }
    }
    if (typeof item.item_key !== 'string' || item.item_key.length === 0) {
      return { ok: false }
    }
    const stats = parseStats(item.stats)
    if (stats === null) {
      return { ok: false }
    }
    const identity = `${heroId}:${item.lane_role}:${item.item_key}`
    if (seen.has(identity)) {
      return { ok: false }
    }
    seen.add(identity)
    parsed.push({ hero_id: heroId, lane_role: item.lane_role, item_key: item.item_key, stats })
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
      thresholds: parsedThresholds,
      bucket_count: parsed.length,
      buckets: parsed,
    },
  }
}

export type ItemTimingSelection =
  | { status: 'ready'; bucket: ItemTimingBucket }
  | { status: 'missing-role' }
  | { status: 'missing-patch' }
  | { status: 'patch-mismatch'; benchmarkPatch: string }
  | { status: 'no-benchmark' }

export interface ItemTimingQuery {
  heroId: number | null
  laneRole: number | null
  patchId: number | null
  itemKey: string
}

/** Выбор норматива: патчи и роли не смешиваются. */
export function selectItemTiming(
  snapshot: ItemTimingSnapshot,
  query: ItemTimingQuery,
): ItemTimingSelection {
  if (!isLaneRole(query.laneRole)) {
    return { status: 'missing-role' }
  }
  if (query.patchId === null) {
    return { status: 'missing-patch' }
  }
  if (snapshot.patch_id === null) {
    return { status: 'no-benchmark' }
  }
  if (query.patchId !== snapshot.patch_id) {
    return { status: 'patch-mismatch', benchmarkPatch: snapshot.patch }
  }
  if (query.heroId === null || query.itemKey.length === 0) {
    return { status: 'no-benchmark' }
  }
  const bucket = snapshot.buckets.find(
    (item) =>
      item.hero_id === query.heroId &&
      item.lane_role === query.laneRole &&
      item.item_key === query.itemKey,
  )
  return bucket === undefined ? { status: 'no-benchmark' } : { status: 'ready', bucket }
}

/**
 * Класс тайминга: раньше p25, в диапазоне p25–p75, позже p75, недостаточная выборка.
 * Это описание статистики, а не оценка «ошибка/не ошибка».
 */
export type ItemTimingClass = 'early' | 'typical' | 'late' | 'insufficient' | 'no-sample'

export interface ItemTimingComparison {
  itemKey: string
  timingClass: ItemTimingClass
  /** Подтверждённое время покупки у игрока (секунды от начала матча). */
  actualSeconds: number
  median: number | null
  p25: number | null
  p75: number | null
  sampleSize: number
  /** Фактическое время − медиана (секунды, 1 знак). Отрицательное — раньше медианы. */
  differenceSeconds: number | null
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Классификация одного тайминга по статистике покупок. */
/**
 * Классификация одного тайминга по статистике покупок.
 *
 * Требование владельца: классы «раньше/типично/позже» не появляются при `n < 100`.
 * Порог берётся как максимум из метаданных снапшота и продуктового пола, поэтому
 * датасет не может его понизить. Это описание статистики, а не оценка «ошибка».
 */
export function classifyItemTiming(
  actualSeconds: number,
  stats: ItemTimingStats,
  thresholds: ItemTimingThresholds = DEFAULT_ITEM_TIMING_THRESHOLDS,
): ItemTimingComparison['timingClass'] {
  if (stats.n === 0 || stats.p50 === null) {
    return 'no-sample'
  }
  if (!Number.isFinite(actualSeconds) || stats.n < effectiveClassifyThreshold(thresholds)) {
    return 'insufficient'
  }
  if (stats.p25 === null || stats.p75 === null) {
    return 'insufficient'
  }
  if (actualSeconds < stats.p25) {
    return 'early'
  }
  if (actualSeconds > stats.p75) {
    return 'late'
  }
  return 'typical'
}

/**
 * Сравнение таймингов для значимых покупок таймлайна. Повторные покупки одного
 * предмета сравниваются один раз — по первой подтверждённой покупке.
 */
export function compareItemTimings(
  entries: TimelineEntry[],
  snapshot: ItemTimingSnapshot,
  query: Omit<ItemTimingQuery, 'itemKey'>,
): Map<string, ItemTimingComparison> {
  const result = new Map<string, ItemTimingComparison>()
  for (const entry of entries) {
    if (!entry.comparable || entry.occurrence !== 1 || result.has(entry.key)) {
      continue
    }
    const selection = selectItemTiming(snapshot, { ...query, itemKey: entry.key })
    if (selection.status !== 'ready') {
      continue
    }
    const stats = selection.bucket.stats
    const timingClass = classifyItemTiming(
      entry.timeSeconds,
      stats,
      snapshot.thresholds,
    )
    result.set(entry.key, {
      itemKey: entry.key,
      timingClass,
      actualSeconds: entry.timeSeconds,
      median: stats.p50,
      p25: stats.p25,
      p75: stats.p75,
      sampleSize: stats.n,
      differenceSeconds: stats.p50 === null ? null : round1(entry.timeSeconds - stats.p50),
    })
  }
  return result
}

let cache: ItemTimingSnapshot | null | undefined

/** URL снапшота с учётом `BASE_URL` (деплой в подкаталоге). */
export function itemTimingsUrl(baseUrl: string = import.meta.env.BASE_URL ?? '/'): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${base}${ITEM_TIMINGS_PATH}`
}

export interface LoadItemTimingsOptions {
  fetchImpl?: typeof fetch
  baseUrl?: string
}

/**
 * Загрузка снапшота таймингов во время выполнения. Отсутствие файла (404),
 * сетевая ошибка или невалидный JSON дают `null` — сравнение отключается,
 * а фактические тайминги продолжают отображаться.
 */
export async function loadItemTimingSnapshot(
  options: LoadItemTimingsOptions = {},
): Promise<ItemTimingSnapshot | null> {
  if (cache !== undefined) {
    return cache
  }
  const doFetch = options.fetchImpl ?? fetch
  try {
    const response = await doFetch(itemTimingsUrl(options.baseUrl), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      cache = null
      return cache
    }
    const payload: unknown = await response.json()
    const parsed = parseItemTimingSnapshot(payload)
    cache = parsed.ok ? parsed.value : null
  } catch {
    cache = null
  }
  return cache
}

/** Сброс кеша (тесты). */
export function resetItemTimingSnapshotCache(): void {
  cache = undefined
}

