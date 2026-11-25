import type {
  AnalysisLimitation,
  AnalysisObservation,
} from '../types/analysis'
import type { NormalizedPlayer } from '../types/match'
import {
  findStoredPlayerAnalysis,
  USABLE_REPORT_STATUSES,
  type MatchReportView,
} from './matchReports'
import { LANING_INTERVAL_MINUTES } from './laning'

/**
 * Расчёты прогресса игрока (Task 20): чистый модуль без React, Supabase и сети.
 *
 * Данные приходят из сохранённых личных отчётов (`match_payload` / `analysis_payload`),
 * которые уже проверены парсером `matchReports.ts`. Здесь ничего не пересчитывается и
 * не выдумывается: отсутствующее значение остаётся `null` и не превращается в ноль.
 *
 * Все определения ниже — часть методики:
 *  - «свой» участник определяется по совпадению `player.account_id` с Dota 2
 *    `account_id` текущего пользователя (производным от проверенного SteamID64);
 *  - KDA = (убийства + ассисты) / смерти; при 0 смертей KDA приравнивается к
 *    (убийства + ассисты) — смертей нет, знаменатель не делим на ноль;
 *  - тренд сравнивает первый и последний фактические замеры, а не интерполирует;
 *  - направление «улучшение/ухудшение» зависит от метрики (выше-лучше / ниже-лучше).
 */

/** Один «свой» отчёт: пользователь в одном сохранённом матче. */
export interface SelfProgressReport {
  /** Внутренний идентификатор строки отчёта. */
  id: string
  /** ID матча — точная строка. */
  matchId: string
  /** Версия правил анализа на момент сохранения. */
  rulesVersion: string
  /** Дата сохранения отчёта (ISO) либо `null`. */
  createdAt: string | null
  /** Время начала матча (unix, секунды) либо `null`. */
  startTime: number | null
  /** Длительность матча в секундах либо `null`. */
  duration: number | null
  /** Победили ли Radiant; `null`, если неизвестно. */
  radiantWin: boolean | null
  /** Числовой id патча, при наличии. */
  patch: number | null
  /** Свой участник (найден по `account_id`). */
  player: NormalizedPlayer
  /** Наблюдения своего участника из сохранённого снимка анализа. */
  observations: AnalysisObservation[]
  /** Ограничения анализа своего участника. */
  limitations: AnalysisLimitation[]
}

export type SelfReportBuildResult =
  | { ok: true; report: SelfProgressReport }
  | { ok: false; reason: 'not-usable' | 'no-self-account' }

/**
 * Сборка «своего» отчёта из проверенного `MatchReportView`.
 *
 * Участник ищется строго по одному совпадению `account_id`: ноль или несколько
 * совпадений означают, что «себя» в этом матче определить нельзя, и отчёт честно
 * пропускается, а не подменяется чужим участником.
 */
export function buildSelfProgressReport(
  view: MatchReportView,
  selfAccountId: number,
): SelfReportBuildResult {
  if (!USABLE_REPORT_STATUSES.includes(view.status)) {
    return { ok: false, reason: 'not-usable' }
  }
  const candidates = view.match.players.filter(
    (player) => player.account_id !== null && player.account_id === selfAccountId,
  )
  if (candidates.length !== 1) {
    return { ok: false, reason: 'no-self-account' }
  }
  const player = candidates[0]
  const analysis = findStoredPlayerAnalysis(view, player.player_slot)
  return {
    ok: true,
    report: {
      id: view.id ?? `${view.matchId}`,
      matchId: view.matchId,
      rulesVersion: view.rulesVersion,
      createdAt: view.createdAt,
      startTime: view.match.start_time,
      duration: view.match.duration,
      radiantWin: view.match.radiant_win,
      patch: view.match.patch,
      player,
      observations: analysis === null ? [] : analysis.observations,
      limitations: analysis === null ? [] : analysis.limitations,
    },
  }
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * KDA = (убийства + ассисты) / смерти.
 * При нуле смертей (деление на ноль невозможно) KDA считается равным
 * (убийства + ассисты). Некорректные или отсутствующие значения дают `null`.
 */
export function computeKda(
  kills: number | null,
  deaths: number | null,
  assists: number | null,
): number | null {
  if (kills === null || deaths === null || assists === null) {
    return null
  }
  if (
    !Number.isInteger(kills) ||
    !Number.isInteger(deaths) ||
    !Number.isInteger(assists) ||
    kills < 0 ||
    deaths < 0 ||
    assists < 0
  ) {
    return null
  }
  const involvement = kills + assists
  if (deaths === 0) {
    return involvement
  }
  return round1(involvement / deaths)
}

/** Метрики всего матча (из `NormalizedPlayer`). */
export const MATCH_METRIC_KEYS = [
  'kills',
  'deaths',
  'assists',
  'kda',
  'gpm',
  'xpm',
  'last_hits',
  'denies',
  'net_worth',
  'level',
] as const

/** Метрики первых 15 минут (из `player.laning`). */
export const LANING_METRIC_KEYS = [
  'last_hits_15',
  'gold_15',
  'xp_15',
  'kills_15',
  'deaths_15',
] as const

export type MatchMetricKey = (typeof MATCH_METRIC_KEYS)[number]
export type LaningMetricKey = (typeof LANING_METRIC_KEYS)[number]
export type ProgressMetricKey = MatchMetricKey | LaningMetricKey

/** Направление, осмысленное с точки зрения «хорошо/плохо». */
export type MetricGoodWhen = 'higher' | 'lower'

export interface ProgressMetricDef {
  key: ProgressMetricKey
  kind: 'match' | 'laning'
  /** «выше — лучше» (kills, gpm, …) либо «ниже — лучше» (deaths). */
  goodWhen: MetricGoodWhen
  extract: (player: NormalizedPlayer) => number | null
  /** Точность вывода (число знаков после запятой). */
  decimals: number
}

function kdaOf(player: NormalizedPlayer): number | null {
  return computeKda(player.kills, player.deaths, player.assists)
}

/**
 * Значение ранней стадии только для интервала 00:00–15:00.
 *
 * Снимки старого формата (интервал 00:00–10:00) хранят в `laning.*` именно
 * 10-минутные значения. Выдавать их за 15-минутные нельзя: при несовпадении
 * интервала значение честно возвращается как `null`, а не подменяется.
 */
function laningValue(player: NormalizedPlayer, value: number | null): number | null {
  if (player.laning.interval.minutes !== LANING_INTERVAL_MINUTES) {
    return null
  }
  return value
}

/** Определения всех сравниваемых метрик. */
export const PROGRESS_METRICS: readonly ProgressMetricDef[] = [
  { key: 'kills', kind: 'match', goodWhen: 'higher', extract: (p) => p.kills, decimals: 0 },
  { key: 'deaths', kind: 'match', goodWhen: 'lower', extract: (p) => p.deaths, decimals: 0 },
  { key: 'assists', kind: 'match', goodWhen: 'higher', extract: (p) => p.assists, decimals: 0 },
  { key: 'kda', kind: 'match', goodWhen: 'higher', extract: kdaOf, decimals: 1 },
  { key: 'gpm', kind: 'match', goodWhen: 'higher', extract: (p) => p.gold_per_min, decimals: 0 },
  { key: 'xpm', kind: 'match', goodWhen: 'higher', extract: (p) => p.xp_per_min, decimals: 0 },
  { key: 'last_hits', kind: 'match', goodWhen: 'higher', extract: (p) => p.last_hits, decimals: 0 },
  { key: 'denies', kind: 'match', goodWhen: 'higher', extract: (p) => p.denies, decimals: 0 },
  { key: 'net_worth', kind: 'match', goodWhen: 'higher', extract: (p) => p.net_worth, decimals: 0 },
  { key: 'level', kind: 'match', goodWhen: 'higher', extract: (p) => p.level, decimals: 0 },
  { key: 'last_hits_15', kind: 'laning', goodWhen: 'higher', extract: (p) => laningValue(p, p.laning.lastHits), decimals: 0 },
  { key: 'gold_15', kind: 'laning', goodWhen: 'higher', extract: (p) => laningValue(p, p.laning.gold), decimals: 0 },
  { key: 'xp_15', kind: 'laning', goodWhen: 'higher', extract: (p) => laningValue(p, p.laning.xp), decimals: 0 },
  { key: 'kills_15', kind: 'laning', goodWhen: 'higher', extract: (p) => laningValue(p, p.laning.killsFirst), decimals: 0 },
  { key: 'deaths_15', kind: 'laning', goodWhen: 'lower', extract: (p) => laningValue(p, p.laning.deathsFirst), decimals: 0 },
]

export function metricDef(key: ProgressMetricKey): ProgressMetricDef {
  const def = PROGRESS_METRICS.find((candidate) => candidate.key === key)
  if (def === undefined) {
    throw new Error(`Unknown progress metric: ${key}`)
  }
  return def
}

/** Значение метрики для конкретного отчёта; отсутствующее значение — `null`. */
export function metricValue(report: SelfProgressReport, key: ProgressMetricKey): number | null {
  return metricDef(key).extract(report.player)
}

/** Значения метрик для сравнения (строка = один отчёт). */
export type ComparisonValues = Partial<Record<ProgressMetricKey, number | null>>

export interface ComparisonRow {
  report: SelfProgressReport
  values: ComparisonValues
}

/** Строки сравнения по выбранным метрикам для выбранных отчётов. */
export function buildComparison(
  reports: readonly SelfProgressReport[],
  keys: readonly ProgressMetricKey[],
): ComparisonRow[] {
  return reports.map((report) => {
    const values: ComparisonValues = {}
    for (const key of keys) {
      values[key] = metricValue(report, key)
    }
    return { report, values }
  })
}

export interface TrendPoint {
  matchId: string
  date: number | null
  value: number
}

export function compareTime(a: number | null, b: number | null): number {
  if (a === null && b === null) {
    return 0
  }
  if (a === null) {
    return 1
  }
  if (b === null) {
    return -1
  }
  return a - b
}

/**
 * Хронологический ряд фактических значений метрики (по возрастанию даты).
 * Точки без даты уходят в конец; интерполяция не выполняется — пропущенные замеры
 * не заполняются выдуманными значениями.
 */
export function buildTrendSeries(
  reports: readonly SelfProgressReport[],
  key: ProgressMetricKey,
): TrendPoint[] {
  const extract = metricDef(key).extract
  const points: TrendPoint[] = []
  for (const report of reports) {
    const value = extract(report.player)
    if (value === null) {
      continue
    }
    points.push({ matchId: report.matchId, date: report.startTime, value })
  }
  return points.sort((a, b) => {
    const byTime = compareTime(a.date, b.date)
    if (byTime !== 0) {
      return byTime
    }
    return a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0
  })
}

/** Хронологически отсортированная копия отчётов (без даты — в конец). */
export function chronologicalReports(
  reports: readonly SelfProgressReport[],
): SelfProgressReport[] {
  return [...reports].sort((a, b) => {
    const byTime = compareTime(a.startTime, b.startTime)
    if (byTime !== 0) {
      return byTime
    }
    return a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0
  })
}

export type TrendDirection = 'improved' | 'declined' | 'stable'

export type TrendSummary =
  | { status: 'insufficient'; count: number }
  | {
      status: 'measured'
      direction: TrendDirection
      count: number
      first: TrendPoint
      last: TrendPoint
      delta: number
    }

export interface TrendSummaryOptions {
  /** Минимальное число фактических замеров для вывода о тренде. */
  minSamples?: number
  /** Относительный порог, ниже которого сдвиг считается «стабильным» (по умолчанию 5 %). */
  stabilityThreshold?: number
}

function directionForDelta(
  firstValue: number,
  delta: number,
  goodWhen: MetricGoodWhen,
  threshold: number,
): TrendDirection {
  const absFirst = Math.abs(firstValue)
  if (absFirst > 0 && Math.abs(delta) / absFirst < threshold) {
    return 'stable'
  }
  if (absFirst === 0 && delta === 0) {
    return 'stable'
  }
  const towardGood = goodWhen === 'higher' ? delta > 0 : delta < 0
  return towardGood ? 'improved' : 'declined'
}

/**
 * Итог тренда метрики: сравнение первого и последнего фактического замера.
 *
 * `insufficient` — замеров меньше `minSamples`, вывод не делается.
 * «Улучшение»/«ухудшение» учитывает направление метрики (для смертей «ниже — лучше»).
 * Положительный числовой тренд не объявляется исправлением конкретной ошибки.
 */
export function summarizeTrend(
  reports: readonly SelfProgressReport[],
  key: ProgressMetricKey,
  options: TrendSummaryOptions = {},
): TrendSummary {
  const minSamples = options.minSamples ?? 3
  const threshold = options.stabilityThreshold ?? 0.05
  const series = buildTrendSeries(reports, key)
  if (series.length < minSamples) {
    return { status: 'insufficient', count: series.length }
  }
  const first = series[0]
  const last = series[series.length - 1]
  const delta = round1(last.value - first.value)
  return {
    status: 'measured',
    direction: directionForDelta(first.value, delta, metricDef(key).goodWhen, threshold),
    count: series.length,
    first,
    last,
    delta,
  }
}

export interface ProgressFilter {
  heroId?: number | null
  laneRole?: number | null
  /** Нижняя граница периода по `start_time` (unix, секунды). */
  from?: number | null
  /** Верхняя граница периода по `start_time` (unix, секунды). */
  to?: number | null
}

/** Фильтрация по герою, классу линии и периоду дат. */
export function filterSelfReports(
  reports: readonly SelfProgressReport[],
  filter: ProgressFilter,
): SelfProgressReport[] {
  return reports.filter((report) => {
    if (filter.heroId !== undefined && filter.heroId !== null) {
      if (report.player.hero_id !== filter.heroId) {
        return false
      }
    }
    if (filter.laneRole !== undefined && filter.laneRole !== null) {
      if (report.player.lane_role !== filter.laneRole) {
        return false
      }
    }
    if (filter.from !== undefined && filter.from !== null) {
      if (report.startTime === null || report.startTime < filter.from) {
        return false
      }
    }
    if (filter.to !== undefined && filter.to !== null) {
      if (report.startTime === null || report.startTime > filter.to) {
        return false
      }
    }
    return true
  })
}

export interface RecurringObservationGroup {
  ruleId: string
  /** Единая версия правил; `null`, если в выборке наблюдения разных версий. */
  ruleVersion: string | null
  metric: string
  period: string
  /** В скольких матчах встречалось. */
  count: number
  /** Сколько отчётов было обследовано (база выборки). */
  totalMatches: number
  matchIds: string[]
  /** Наблюдения другой версии правил (исключены как несопоставимые). */
  excludedByVersion: number
  /** Встречаемость в первой половине хронологического периода. */
  firstHalfCount: number
  /** Встречаемость во второй половине хронологического периода. */
  secondHalfCount: number
  /** true — частоту между половинами можно сопоставлять (есть временные точки). */
  frequencyComparable: boolean
}

export interface RecurringObservationOptions {
  /** Минимальное число матчей, чтобы наблюдение считалось повторяющимся. */
  minOccurrences?: number
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort()
}

/**
 * Повторяющиеся наблюдения по стабильному `rule_id` (Task 17; существующие
 * сохранённые наблюдения, без новых аналитических выводов).
 *
 * Наблюдения одной версии правил с одинаковым `rule_id` считаются сопоставимыми;
 * наблюдения другой версии не смешиваются и учитываются отдельно (`excludedByVersion`).
 * Для сравнения частоты отчёты делятся хронологически на две половины (по `start_time`).
 */
export function findRecurringObservations(
  reports: readonly SelfProgressReport[],
  options: RecurringObservationOptions = {},
): RecurringObservationGroup[] {
  const minOccurrences = options.minOccurrences ?? 2

  interface Acc {
    count: number
    matchIds: Set<string>
    ruleVersions: Set<string>
    firstObs: AnalysisObservation
    excludedByVersion: number
  }

  const groups = new Map<string, Acc>()
  for (const report of reports) {
    const seen = new Set<string>()
    for (const obs of report.observations) {
      if (seen.has(obs.rule_id)) {
        continue
      }
      seen.add(obs.rule_id)
      const existing = groups.get(obs.rule_id)
      if (existing === undefined) {
        groups.set(obs.rule_id, {
          count: 1,
          matchIds: new Set([report.matchId]),
          ruleVersions: new Set([obs.rule_version]),
          firstObs: obs,
          excludedByVersion: 0,
        })
        continue
      }
      if (!existing.ruleVersions.has(obs.rule_version)) {
        existing.excludedByVersion += 1
        continue
      }
      existing.count += 1
      existing.matchIds.add(report.matchId)
    }
  }

  const chronological = chronologicalReports(reports)
  const half = Math.floor(chronological.length / 2)
  const firstHalf = new Set(chronological.slice(0, half).map((r) => r.matchId))
  const knownDateCount = reports.filter((r) => r.startTime !== null).length

  const result: RecurringObservationGroup[] = []
  for (const [ruleId, acc] of groups) {
    if (acc.count < minOccurrences) {
      continue
    }
    const matchIds = uniqueSorted([...acc.matchIds])
    let firstHalfCount = 0
    let secondHalfCount = 0
    for (const matchId of matchIds) {
      if (firstHalf.has(matchId)) {
        firstHalfCount += 1
      } else {
        secondHalfCount += 1
      }
    }
    result.push({
      ruleId,
      ruleVersion: acc.ruleVersions.size === 1 ? acc.firstObs.rule_version : null,
      metric: acc.firstObs.metric,
      period: acc.firstObs.period,
      count: acc.count,
      totalMatches: reports.length,
      matchIds: matchIds,
      excludedByVersion: acc.excludedByVersion,
      firstHalfCount,
      secondHalfCount,
      frequencyComparable: knownDateCount >= 2 && chronological.length >= 2,
    })
  }

  return result.sort((a, b) => b.count - a.count || (a.ruleId < b.ruleId ? -1 : 1))
}