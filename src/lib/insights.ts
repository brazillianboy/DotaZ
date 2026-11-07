import type { TranslationKey } from '../i18n/translations'
import type { NormalizedPlayer } from '../types/match'
import {
  compareLaningWithBenchmark,
  type BenchmarkMetricKey,
  type BenchmarkSnapshot,
  type MetricComparison,
} from './benchmarks'

/**
 * Находки и рекомендации по первым 15 минутам (Task 17).
 *
 * Принципы:
 *  - движок чистый и детерминированный: без сети, React, Supabase и текущего времени;
 *  - используются только подтверждённые факты матча и проверенные нормативы Task 16;
 *  - отклонение от медианы — статистическое наблюдение, а не доказанная ошибка;
 *  - отсутствие данных уменьшает конкретность, но не порождает выдуманных выводов;
 *  - приоритет отдаётся более сильным подтверждениям, дубли рекомендаций не выводятся.
 *
 * Версия правил Task 17 не совпадает с версией аналитики Task 9 (`1.1.0`) и
 * версией методики нормативов Task 16 (`1.0.0`): это независимые величины.
 */
export const INSIGHT_RULES_VERSION = '1.0.0'

/** Максимум находок в интерфейсе: защита от перегрузки предупреждениями. */
export const INSIGHT_MAX_FINDINGS = 4

/** Порог «несколько смертей» в первые 15 минут (продуктовое правило, не норма). */
export const DEATHS_WARNING_THRESHOLD = 3

export type InsightSeverity = 'info' | 'warning'
export type InsightEvidenceType = 'observed-event' | 'benchmark-deviation'
export type InsightCategory = 'farming' | 'last-hits' | 'gold' | 'xp' | 'deaths' | 'kills'

/** Числовые подтверждения находки: только фактические значения и метаданные нормативов. */
export interface InsightEvidence {
  /** Фактическое значение игрока (15-я минута или счётчик событий). */
  actual?: number
  benchmarkMedian?: number
  benchmarkP25?: number
  benchmarkP75?: number
  /** Размер выборки именно той метрики, с которой выполнено сравнение. */
  sampleSize?: number
  /** Количество подтверждённых событий (смерти, убийства). */
  count?: number
  /** Патч нормативов, с которым выполнено сравнение. */
  benchmarkPatch?: string
}

export interface PlayerInsight {
  /** Стабильный идентификатор правила (не переименовывать без смены версии правил). */
  id: string
  category: InsightCategory
  /**
   * Важность для интерфейса. Это НЕ статистическая достоверность: `warning`
   * означает «стоит посмотреть», а не «подтверждённая ошибка».
   */
  severity: InsightSeverity
  evidenceType: InsightEvidenceType
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  recommendationKey: TranslationKey
  /** Параметры подстановки в тексты (значения, медианы, патч). */
  params: Record<string, string | number>
  evidence: InsightEvidence
}

export interface PlayerInsights {
  /** `no-data` — нет данных ранней стадии для выбранного игрока. */
  status: 'ready' | 'no-data'
  findings: PlayerInsight[]
  /** Сколько находок не показано из-за лимита. */
  hiddenCount: number
  /** Использованы ли нормативы Task 16 (false — статистических сравнений нет). */
  benchmarkUsed: boolean
  /** Патч нормативов (для подписи), `null` если сравнение не выполнялось. */
  benchmarkPatch: string | null
  rulesVersion: string
}

/** Вид отклонения метрики от норматива. */
export type MetricDeviation = 'below-range' | 'below-median' | 'above-range' | 'below-median-small'

/**
 * Классификация одного сравнения. Возвращает `null`, если вывода нет:
 * недостаточно данных, нет норматива или показатель внутри типичного диапазона.
 */
export function classifyMetricDeviation(comparison: MetricComparison): MetricDeviation | null {
  if (comparison.status === 'full') {
    const { actual, p25, median, p75 } = comparison
    if (actual === null || p25 === null || median === null || p75 === null) {
      return null
    }
    if (actual < p25) return 'below-range'
    if (actual < median) return 'below-median'
    if (actual >= p75) return 'above-range'
    return null
  }
  if (comparison.status === 'median-only') {
    // Малая выборка: сравниваем только с медианой и не называем это диапазоном.
    if (comparison.actual === null || comparison.median === null) {
      return null
    }
    return comparison.actual < comparison.median ? 'below-median-small' : null
  }
  return null
}

/** Ключи заголовков: метрика → вид отклонения. */
const METRIC_TITLE: Record<BenchmarkMetricKey, Record<MetricDeviation, TranslationKey>> = {
  lastHits: {
    'below-range': 'insights.lh.belowRange.title',
    'below-median': 'insights.lh.belowMedian.title',
    'above-range': 'insights.lh.aboveRange.title',
    'below-median-small': 'insights.lh.belowMedian.title',
  },
  gold: {
    'below-range': 'insights.gold.belowRange.title',
    'below-median': 'insights.gold.belowMedian.title',
    'above-range': 'insights.gold.aboveRange.title',
    'below-median-small': 'insights.gold.belowMedian.title',
  },
  xp: {
    'below-range': 'insights.xp.belowRange.title',
    'below-median': 'insights.xp.belowMedian.title',
    'above-range': 'insights.xp.aboveRange.title',
    'below-median-small': 'insights.xp.belowMedian.title',
  },
}

const METRIC_DESCRIPTION: Record<BenchmarkMetricKey, TranslationKey> = {
  lastHits: 'insights.metric.lastHits.description',
  gold: 'insights.metric.gold.description',
  xp: 'insights.metric.xp.description',
}

const METRIC_RECOMMENDATION: Record<BenchmarkMetricKey, TranslationKey> = {
  lastHits: 'insights.metric.lastHits.recommendation',
  gold: 'insights.metric.gold.recommendation',
  xp: 'insights.metric.xp.recommendation',
}

const METRIC_CATEGORY: Record<BenchmarkMetricKey, InsightCategory> = {
  lastHits: 'last-hits',
  gold: 'gold',
  xp: 'xp',
}

function metricParams(
  comparison: MetricComparison,
  patch: string,
  small: boolean,
): Record<string, string | number> {
  const params: Record<string, string | number> = { patch }
  if (comparison.actual !== null) params.actual = comparison.actual
  if (comparison.median !== null) params.median = comparison.median
  if (comparison.p25 !== null) params.p25 = comparison.p25
  if (comparison.p75 !== null) params.p75 = comparison.p75
  params.sample = comparison.sampleSize
  params.small = small ? 1 : 0
  return params
}

function metricEvidence(comparison: MetricComparison, patch: string): InsightEvidence {
  const evidence: InsightEvidence = { sampleSize: comparison.sampleSize, benchmarkPatch: patch }
  if (comparison.actual !== null) evidence.actual = comparison.actual
  if (comparison.median !== null) evidence.benchmarkMedian = comparison.median
  if (comparison.p25 !== null) evidence.benchmarkP25 = comparison.p25
  if (comparison.p75 !== null) evidence.benchmarkP75 = comparison.p75
  return evidence
}

/**
 * Находка по одной метрике. `warning` ставится только при явном выходе ниже p25
 * на полной выборке; малая выборка и «ниже медианы» остаются информационными.
 */
export function buildMetricInsight(
  key: BenchmarkMetricKey,
  comparison: MetricComparison,
  patch: string,
): PlayerInsight | null {
  const deviation = classifyMetricDeviation(comparison)
  if (deviation === null) {
    return null
  }
  const small = comparison.status === 'median-only'
  return {
    id: `insights.${key}.${deviation}`,
    category: METRIC_CATEGORY[key],
    severity: deviation === 'below-range' && !small ? 'warning' : 'info',
    evidenceType: 'benchmark-deviation',
    titleKey: METRIC_TITLE[key][deviation],
    descriptionKey: METRIC_DESCRIPTION[key],
    recommendationKey: METRIC_RECOMMENDATION[key],
    params: metricParams(comparison, patch, small),
    evidence: metricEvidence(comparison, patch),
  }
}

/**
 * Объединённая находка «фарм»: LH и золото одновременно ниже p25.
 * Группировка не даёт выдать связанные показатели за две отдельные ошибки.
 */
export function buildFarmingInsight(
  lastHits: MetricComparison,
  gold: MetricComparison,
  patch: string,
): PlayerInsight {
  const sampleSize = Math.min(lastHits.sampleSize, gold.sampleSize)
  return {
    id: 'insights.farming.below-range',
    category: 'farming',
    severity: 'warning',
    evidenceType: 'benchmark-deviation',
    titleKey: 'insights.farming.title',
    descriptionKey: 'insights.farming.description',
    recommendationKey: 'insights.farming.recommendation',
    params: {
      patch,
      lhActual: lastHits.actual ?? '',
      lhMedian: lastHits.median ?? '',
      goldActual: gold.actual ?? '',
      goldMedian: gold.median ?? '',
      sample: sampleSize,
    },
    evidence: {
      actual: lastHits.actual ?? undefined,
      benchmarkMedian: lastHits.median ?? undefined,
      benchmarkP25: lastHits.p25 ?? undefined,
      benchmarkP75: lastHits.p75 ?? undefined,
      sampleSize,
      benchmarkPatch: patch,
    },
  }
}

/**
 * Находки по подтверждённым событиям матча (без нормативов): смерти и убийства
 * в первые 15 минут. Причины событий в данных отсутствуют, поэтому они не
 * называются «ошибками позиционирования» и подобными.
 */
export function buildEventInsights(player: NormalizedPlayer): PlayerInsight[] {
  const findings: PlayerInsight[] = []
  const interval = player.laning.interval.label

  const deaths = player.laning.deathsFirst
  if (deaths !== null && deaths > 0) {
    const multiple = deaths >= DEATHS_WARNING_THRESHOLD
    findings.push({
      id: multiple ? 'insights.deaths.multiple' : 'insights.deaths.single',
      category: 'deaths',
      severity: multiple ? 'warning' : 'info',
      evidenceType: 'observed-event',
      titleKey: multiple ? 'insights.deaths.warning.title' : 'insights.deaths.info.title',
      descriptionKey: 'insights.deaths.description',
      recommendationKey: 'insights.deaths.recommendation',
      params: { count: deaths, interval },
      evidence: { count: deaths, actual: deaths },
    })
  }

  const kills = player.laning.killsFirst
  if (kills !== null && kills > 0) {
    findings.push({
      id: 'insights.kills.participation',
      category: 'kills',
      severity: 'info',
      evidenceType: 'observed-event',
      titleKey: 'insights.kills.title',
      descriptionKey: 'insights.kills.description',
      recommendationKey: 'insights.kills.recommendation',
      params: { count: kills, interval },
      evidence: { count: kills },
    })
  }

  return findings
}

/** Порядок вывода: сначала предупреждения, затем наблюдения; внутри — по категории. */
const CATEGORY_ORDER: Record<InsightCategory, number> = {
  farming: 0,
  deaths: 1,
  'last-hits': 2,
  gold: 3,
  xp: 4,
  kills: 5,
}

function insightWeight(insight: PlayerInsight): number {
  return (insight.severity === 'warning' ? 0 : 10) + CATEGORY_ORDER[insight.category]
}

function compareInsights(a: PlayerInsight, b: PlayerInsight): number {
  return insightWeight(a) - insightWeight(b) || a.id.localeCompare(b.id)
}

export interface BuildInsightsParams {
  /** Выбранный пользователем участник (только он анализируется). */
  player: NormalizedPlayer | null
  /** Числовой id патча матча — сравнение строго в пределах патча. */
  patchId: number | null
  /** Нормативы Task 16; `null` — статистические сравнения недоступны. */
  benchmark: BenchmarkSnapshot | null
}

/**
 * Сборка находок для выбранного игрока.
 *
 * Порядок: извлечение фактов → сравнение с нормативами (если есть) → правила →
 * группировка → приоритизация и лимит. Сетевых запросов нет, оценок «плохо/хорошо» нет.
 */
export function buildPlayerInsights({
  player,
  patchId,
  benchmark,
}: BuildInsightsParams): PlayerInsights {
  const empty: PlayerInsights = {
    status: 'no-data',
    findings: [],
    hiddenCount: 0,
    benchmarkUsed: false,
    benchmarkPatch: null,
    rulesVersion: INSIGHT_RULES_VERSION,
  }
  if (player === null) {
    return empty
  }

  const laning = player.laning
  const hasFacts =
    laning.lastHits !== null ||
    laning.gold !== null ||
    laning.xp !== null ||
    laning.deathsFirst !== null ||
    laning.killsFirst !== null
  if (!hasFacts) {
    return empty
  }

  const collected: PlayerInsight[] = []
  let benchmarkUsed = false
  let benchmarkPatch: string | null = null

  if (benchmark !== null) {
    const comparison = compareLaningWithBenchmark(
      benchmark,
      {
        heroId: player.hero_id,
        laneRole: player.lane_role,
        patchId,
        intervalMinutes: laning.interval.minutes,
      },
      { lastHits: laning.lastHits, gold: laning.gold, xp: laning.xp },
    )
    if (comparison.status === 'ready' && comparison.metrics !== null) {
      benchmarkUsed = true
      benchmarkPatch = benchmark.patch
      const lastHits = comparison.metrics.lastHits
      const gold = comparison.metrics.gold
      const xp = comparison.metrics.xp

      // Группировка: LH и золото одновременно ниже p25 — одна находка вместо двух.
      const groupFarming =
        classifyMetricDeviation(lastHits) === 'below-range' &&
        classifyMetricDeviation(gold) === 'below-range'
      if (groupFarming) {
        collected.push(buildFarmingInsight(lastHits, gold, benchmark.patch))
      } else {
        const lhInsight = buildMetricInsight('lastHits', lastHits, benchmark.patch)
        if (lhInsight !== null) collected.push(lhInsight)
        const goldInsight = buildMetricInsight('gold', gold, benchmark.patch)
        if (goldInsight !== null) collected.push(goldInsight)
      }

      const xpInsight = buildMetricInsight('xp', xp, benchmark.patch)
      if (xpInsight !== null) collected.push(xpInsight)
    }
  }

  collected.push(...buildEventInsights(player))
  const sorted = [...collected].sort(compareInsights)
  const findings = sorted.slice(0, INSIGHT_MAX_FINDINGS)

  return {
    status: 'ready',
    findings,
    hiddenCount: sorted.length - findings.length,
    benchmarkUsed,
    benchmarkPatch,
    rulesVersion: INSIGHT_RULES_VERSION,
  }
}

