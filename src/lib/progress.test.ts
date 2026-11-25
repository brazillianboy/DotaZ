import { describe, expect, it } from 'vitest'

import type { MatchReportView } from './matchReports'
import { createEmptyNormalizedMatch } from './normalizeMatch'
import {
  buildComparison,
  buildSelfProgressReport,
  buildTrendSeries,
  chronologicalReports,
  computeKda,
  filterSelfReports,
  findRecurringObservations,
  metricValue,
  summarizeTrend,
  type SelfProgressReport,
} from './progress'
import type { AnalysisObservation, PlayerAnalysis } from '../types/analysis'
import type { LaningStageData, NormalizedPlayer } from '../types/match'

/** Тесты чистых расчётов прогресса (Task 20) без React, сети и Supabase. */

const SELF = 123

function makeLaning(overrides: Partial<LaningStageData> = {}): LaningStageData {
  return {
    interval: { minutes: 15, label: '00:00–15:00' },
    lastHits: 40,
    gold: 3000,
    xp: 2500,
    killsFirst: 1,
    deathsFirst: 0,
    purchasesFirst: [],
    laneEfficiencyPct: null,
    ...overrides,
  }
}

function makePlayer(overrides: Partial<NormalizedPlayer> = {}): NormalizedPlayer {
  return {
    player_slot: 0,
    team: 'radiant',
    hero_id: 1,
    kills: 5,
    deaths: 2,
    assists: 10,
    gold_per_min: 400,
    xp_per_min: 500,
    last_hits: 200,
    hero_damage: null,
    tower_damage: null,
    hero_healing: null,
    level: null,
    denies: null,
    net_worth: null,
    player_name: null,
    account_id: SELF,
    inventory_ids: null,
    neutral_item_id: null,
    lane: 1,
    lane_role: 1,
    ability_upgrades: null,
    purchaseLog: null,
    laning: makeLaning(),
    ...overrides,
  }
}

function makeObservation(overrides: Partial<AnalysisObservation> = {}): AnalysisObservation {
  return {
    rule_id: 'match.kda',
    rule_version: '1.1.0',
    player_slot: 0,
    metric: 'kda',
    period: 'весь матч',
    source: 'OpenDota',
    text: 'итог',
    evidence: [],
    limitations: [],
    ...overrides,
  }
}

function makeAnalysis(observations: AnalysisObservation[] = []): PlayerAnalysis {
  return {
    rule_version: '1.1.0',
    player_slot: 0,
    observations,
    recommendations: [],
    limitations: [],
    hasObservations: observations.length > 0,
    recommendationsNote: null,
  }
}

function makeView(
  playerOverrides: Partial<NormalizedPlayer> = {},
  viewOverrides: Partial<MatchReportView> = {},
  observations: AnalysisObservation[] = [],
): MatchReportView {
  const player = makePlayer(playerOverrides)
  return {
    id: 'row-1',
    userId: 'user-a',
    matchId: '123',
    status: 'ready',
    rulesVersion: '1.1.0',
    source: 'OpenDota',
    fetchedAt: null,
    createdAt: null,
    updatedAt: null,
    match: {
      ...createEmptyNormalizedMatch(),
      match_id: '123',
      duration: 1800,
      start_time: 1_700_000_000,
      radiant_win: true,
      patch: 60,
      players: [player],
    },
    analyses: [{ player_slot: 0, analysis: makeAnalysis(observations) }],
    limitations: [],
    ...viewOverrides,
  }
}

function makeReport(
  playerOverrides: Partial<NormalizedPlayer> = {},
  viewOverrides: Partial<MatchReportView> = {},
  observations: AnalysisObservation[] = [],
): SelfProgressReport {
  const result = buildSelfProgressReport(makeView(playerOverrides, viewOverrides, observations), SELF)
  if (!result.ok) {
    throw new Error('тестовая строка должна собираться в «свой» отчёт')
  }
  return result.report
}

describe('computeKda', () => {
  it('считает (убийства + ассисты) / смерти и округляет до 1 знака', () => {
    expect(computeKda(5, 2, 10)).toBe(7.5)
    expect(computeKda(1, 3, 2)).toBe(1)
  })

  it('при нуле смертей возвращает убийства + ассисты', () => {
    expect(computeKda(4, 0, 6)).toBe(10)
  })

  it('отсутствующие или некорректные значения дают null, а не ноль', () => {
    expect(computeKda(null, 2, 3)).toBeNull()
    expect(computeKda(1, null, 3)).toBeNull()
    expect(computeKda(1, 2, null)).toBeNull()
    expect(computeKda(-1, 2, 3)).toBeNull()
    expect(computeKda(1.5, 2, 3)).toBeNull()
  })
})

describe('метрики матча и ранней стадии', () => {
  it('извлекает KDA, GPM, XPM и добивания из «своего» участника', () => {
    const report = makeReport()
    expect(metricValue(report, 'kda')).toBe(7.5)
    expect(metricValue(report, 'gpm')).toBe(400)
    expect(metricValue(report, 'xpm')).toBe(500)
    expect(metricValue(report, 'last_hits')).toBe(200)
  })

  it('не подменяет отсутствующие значения нулём', () => {
    const report = makeReport({ kills: null as unknown as number })
    expect(metricValue(report, 'kills')).toBeNull()
  })

  it('метрики 15 минут читаются только при интервале 00:00–15:00', () => {
    const report = makeReport()
    expect(metricValue(report, 'last_hits_15')).toBe(40)
    expect(metricValue(report, 'gold_15')).toBe(3000)
  })

  it('10-минутные значения не выдаются за 15-минутные (null, а не подмена)', () => {
    const legacy = makeReport({
      laning: makeLaning({ interval: { minutes: 10, label: '00:00–10:00' }, lastHits: 22 }),
    })
    expect(metricValue(legacy, 'last_hits_15')).toBeNull()
    expect(metricValue(legacy, 'last_hits')).toBe(200)
  })
})

describe('buildComparison', () => {
  it('строит строку значений по выбранным метрикам', () => {
    const report = makeReport()
    const rows = buildComparison([report], ['kills', 'gpm', 'last_hits_15'])
    expect(rows).toHaveLength(1)
    expect(rows[0].values.kills).toBe(5)
    expect(rows[0].values.gpm).toBe(400)
    expect(rows[0].values.last_hits_15).toBe(40)
  })
})

describe('хронологическая сортировка', () => {
  it('упорядочивает отчёты по дате матча, без даты — в конец', () => {
    const a = makeReport({}, { matchId: '1', match: { ...makeView().match, start_time: 100, match_id: '1' } })
    const b = makeReport({}, { matchId: '2', match: { ...makeView().match, start_time: 300, match_id: '2' } })
    const c = makeReport({}, { matchId: '3', match: { ...makeView().match, start_time: 200, match_id: '3' } })
    expect(chronologicalReports([a, b, c]).map((r) => r.matchId)).toEqual(['1', '3', '2'])
  })

  it('ряд тренда содержит только фактические замеры и не интерполирует', () => {
    const a = makeReport({ gold_per_min: 300 as number }, { matchId: '1' })
    const b = makeReport({ gold_per_min: null as unknown as number }, { matchId: '2' })
    const c = makeReport({ gold_per_min: 500 as number }, { matchId: '3' })
    const series = buildTrendSeries([a, b, c], 'gpm')
    expect(series.map((p) => p.matchId)).toEqual(['1', '3'])
  })
})

describe('filterSelfReports', () => {
  const mk = (heroId: number, laneRole: number, startTime: number): SelfProgressReport =>
    makeReport({}, {
      matchId: String(startTime),
      match: {
        ...makeView().match,
        players: [makePlayer({ hero_id: heroId, lane_role: laneRole })],
        start_time: startTime,
        match_id: String(startTime),
      },
    })

  const a = mk(1, 1, 100)
  const b = mk(2, 2, 200)
  const c = mk(1, 2, 300)

  it('фильтрует по герою, линии и периоду дат независимо друг от друга', () => {
    expect(filterSelfReports([a, b, c], { heroId: 1 }).map((r) => r.matchId)).toEqual(['100', '300'])
    expect(filterSelfReports([a, b, c], { laneRole: 2 }).map((r) => r.matchId)).toEqual(['200', '300'])
    expect(filterSelfReports([a, b, c], { from: 150, to: 250 }).map((r) => r.matchId)).toEqual(['200'])
  })

  it('комбинирует фильтры (герой + линия)', () => {
    expect(filterSelfReports([a, b, c], { heroId: 1, laneRole: 2 }).map((r) => r.matchId)).toEqual(['300'])
  })
})

describe('summarizeTrend', () => {
  it('при недостаточном числе замеров честно сообщает insufficient', () => {
    const report = makeReport()
    const result = summarizeTrend([report], 'gpm')
    expect(result).toEqual({ status: 'insufficient', count: 1 })
  })

  it('определяет улучшение для метрики «выше — лучше»', () => {
    const a = makeReport({ gold_per_min: 300 as number }, { matchId: '1' })
    const b = makeReport({ gold_per_min: 400 as number }, { matchId: '2' })
    const c = makeReport({ gold_per_min: 500 as number }, { matchId: '3' })
    const result = summarizeTrend([a, b, c], 'gpm')
    expect(result.status).toBe('measured')
    if (result.status === 'measured') {
      expect(result.direction).toBe('improved')
      expect(result.count).toBe(3)
      expect(result.delta).toBe(200)
    }
  })

  it('определяет ухудшение для смертей («ниже — лучше»)', () => {
    const a = makeReport({ deaths: 2 as number }, { matchId: '1' })
    const b = makeReport({ deaths: 5 as number }, { matchId: '2' })
    const c = makeReport({ deaths: 9 as number }, { matchId: '3' })
    const result = summarizeTrend([a, b, c], 'deaths')
    expect(result.status).toBe('measured')
    if (result.status === 'measured') {
      expect(result.direction).toBe('declined')
    }
  })

  it('малый относительный сдвиг трактуется как «без изменений»', () => {
    const a = makeReport({ gold_per_min: 500 as number }, { matchId: '1' })
    const b = makeReport({ gold_per_min: 505 as number }, { matchId: '2' })
    const c = makeReport({ gold_per_min: 507 as number }, { matchId: '3' })
    const result = summarizeTrend([a, b, c], 'gpm')
    expect(result.status).toBe('measured')
    if (result.status === 'measured') {
      expect(result.direction).toBe('stable')
    }
  })
})

describe('findRecurringObservations', () => {
  function obsFor(ruleId: string, ruleVersion = '1.1.0'): AnalysisObservation {
    return makeObservation({ rule_id: ruleId, rule_version: ruleVersion })
  }

  function reportWith(matchId: string, startTime: number, obs: AnalysisObservation[]): SelfProgressReport {
    return makeReport({}, { matchId, match: { ...makeView().match, match_id: matchId, start_time: startTime } }, obs)
  }

  it('находит повторяющееся наблюдение и указывает число вхождений и выборку', () => {
    const reports = [
      reportWith('1', 100, [obsFor('match.kda')]),
      reportWith('2', 200, [obsFor('match.kda')]),
      reportWith('3', 300, []),
    ]
    const groups = findRecurringObservations(reports)
    expect(groups).toHaveLength(1)
    expect(groups[0].ruleId).toBe('match.kda')
    expect(groups[0].count).toBe(2)
    expect(groups[0].totalMatches).toBe(3)
    expect(groups[0].matchIds).toEqual(['1', '2'])
  })

  it('не считает повторяющимся наблюдение только одного матча', () => {
    const reports = [reportWith('1', 100, [obsFor('match.kda')])]
    expect(findRecurringObservations(reports)).toEqual([])
  })

  it('отделяет наблюдения другой версии правил как несопоставимые', () => {
    const reports = [
      reportWith('1', 100, [obsFor('match.kda', '1.1.0')]),
      reportWith('2', 200, [obsFor('match.kda', '1.1.0')]),
      reportWith('3', 300, [obsFor('match.kda', '1.0.0')]),
    ]
    const groups = findRecurringObservations(reports)
    expect(groups).toHaveLength(1)
    expect(groups[0].count).toBe(2)
    expect(groups[0].excludedByVersion).toBe(1)
    expect(groups[0].ruleVersion).toBe('1.1.0')
  })

  it('считает частоту по хронологическим половинам периода', () => {
    const reports = [
      reportWith('1', 100, [obsFor('match.kda')]),
      reportWith('2', 200, [obsFor('match.kda')]),
      reportWith('3', 300, [obsFor('match.kda')]),
    ]
    const groups = findRecurringObservations(reports)
    expect(groups[0].frequencyComparable).toBe(true)
    expect(groups[0].firstHalfCount).toBe(1)
    expect(groups[0].secondHalfCount).toBe(2)
  })
})

describe('buildSelfProgressReport', () => {
  it('пропускает незавершённый отчёт как неиспользуемый', () => {
    const result = buildSelfProgressReport(makeView({}, { status: 'pending' }), SELF)
    expect(result).toEqual({ ok: false, reason: 'not-usable' })
  })

  it('пропускает матч, где нет своего участника по account_id', () => {
    const foreign = makePlayer({ account_id: 999 })
    const view = makeView({}, { match: { ...makeView().match, players: [foreign] } })
    const result = buildSelfProgressReport(view, SELF)
    expect(result).toEqual({ ok: false, reason: 'no-self-account' })
  })

  it('принимает частичный отчёт и подтягивает наблюдения своего участника', () => {
    const obs = [makeObservation({ rule_id: 'laning.last_hits_at_15', metric: 'last_hits_at_15' })]
    const result = buildSelfProgressReport(makeView({}, { status: 'partial' }, obs), SELF)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.report.observations).toHaveLength(1)
      expect(result.report.observations[0].rule_id).toBe('laning.last_hits_at_15')
    }
  })

  it('не выдумывает участника, если совпадений account_id больше одного', () => {
    const twin = makePlayer({ player_slot: 1 })
    const view = makeView({}, { match: { ...makeView().match, players: [makePlayer(), twin] } })
    expect(buildSelfProgressReport(view, SELF)).toEqual({ ok: false, reason: 'no-self-account' })
  })
})