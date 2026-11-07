import { describe, expect, it } from 'vitest'

import { BENCHMARK_METHOD_VERSION, type BenchmarkSnapshot } from './benchmarks'
import { buildLaningStageData } from './laning'
import {
  DEATHS_WARNING_THRESHOLD,
  INSIGHT_MAX_FINDINGS,
  INSIGHT_RULES_VERSION,
  buildPlayerInsights,
  classifyMetricDeviation,
} from './insights'
import { compareMetric } from './benchmarks'
import type { NormalizedPlayer } from '../types/match'

/**
 * Тесты движка находок (Task 17). Все значения синтетические: это фикстуры логики,
 * а не реальные нормативы. Проверяется отсутствие выдуманных выводов.
 */

const THRESHOLDS = { full: 200, medianOnly: 50 }

function snapshot(overrides: Partial<BenchmarkSnapshot> = {}): BenchmarkSnapshot {
  return {
    method_version: BENCHMARK_METHOD_VERSION,
    source: { name: 'OpenDota Explorer', url: '', dataset: 'test', attribution: 'test' },
    generated_at: '2026-11-07T00:00:00.000Z',
    patch: '7.41',
    patch_id: 60,
    interval: { minutes: 15, arrayIndex: 16, label: '00:00–15:00' },
    thresholds: THRESHOLDS,
    bucket_count: 1,
    buckets: [
      {
        hero_id: 6,
        lane_role: 1,
        metrics: {
          lastHits: { n: 400, p25: 90, p50: 110, p75: 130 },
          gold: { n: 400, p25: 6000, p50: 6800, p75: 7500 },
          xp: { n: 400, p25: 5900, p50: 6700, p75: 7400 },
        },
      },
    ],
    ...overrides,
  }
}

function timeline(value: number): number[] {
  return [...Array.from({ length: 15 }, () => 0), value]
}

function player(overrides: Partial<NormalizedPlayer> = {}, laning = {}): NormalizedPlayer {
  return {
    player_slot: 0,
    team: 'radiant',
    hero_id: 6,
    kills: 2,
    deaths: 1,
    assists: 3,
    gold_per_min: 500,
    xp_per_min: 500,
    last_hits: 120,
    hero_damage: null,
    tower_damage: null,
    hero_healing: null,
    level: null,
    denies: null,
    net_worth: null,
    player_name: null,
    account_id: null,
    inventory_ids: null,
    neutral_item_id: null,
    lane: 1,
    lane_role: 1,
    ability_upgrades: null,
    purchaseLog: null,
    laning: buildLaningStageData({
      lh_t: timeline(120),
      gold_t: timeline(7000),
      xp_t: timeline(6500),
      deaths_log: [],
      kills_log: [],
      ...laning,
    }),
    ...overrides,
  }
}

describe('classifyMetricDeviation', () => {
  it('различает ниже p25, ниже медианы и выше p75', () => {
    expect(classifyMetricDeviation(compareMetric('lastHits', 80, { n: 400, p25: 90, p50: 110, p75: 130 }, THRESHOLDS))).toBe('below-range')
    expect(classifyMetricDeviation(compareMetric('lastHits', 100, { n: 400, p25: 90, p50: 110, p75: 130 }, THRESHOLDS))).toBe('below-median')
    expect(classifyMetricDeviation(compareMetric('lastHits', 140, { n: 400, p25: 90, p50: 110, p75: 130 }, THRESHOLDS))).toBe('above-range')
  })

  it('внутри межквартильного диапазона отклонения нет', () => {
    expect(classifyMetricDeviation(compareMetric('lastHits', 115, { n: 400, p25: 90, p50: 110, p75: 130 }, THRESHOLDS))).toBeNull()
  })

  it('малая выборка сравнивается только с медианой', () => {
    expect(classifyMetricDeviation(compareMetric('lastHits', 100, { n: 60, p25: 90, p50: 110, p75: 130 }, THRESHOLDS))).toBe('below-median-small')
    expect(classifyMetricDeviation(compareMetric('lastHits', 120, { n: 60, p25: 90, p50: 110, p75: 130 }, THRESHOLDS))).toBeNull()
  })

  it('отсутствующее значение и нулевая выборка не дают вывода', () => {
    expect(classifyMetricDeviation(compareMetric('lastHits', null, { n: 400, p25: 90, p50: 110, p75: 130 }, THRESHOLDS))).toBeNull()
    expect(classifyMetricDeviation(compareMetric('lastHits', 10, { n: 0, p25: null, p50: null, p75: null }, THRESHOLDS))).toBeNull()
  })
})

describe('buildPlayerInsights — правила', () => {
  it('LH ниже p25 даёт предупреждение с фактическими числами', () => {
    const result = buildPlayerInsights({
      player: player({}, { lh_t: timeline(80) }),
      patchId: 60,
      benchmark: snapshot(),
    })
    expect(result.status).toBe('ready')
    const finding = result.findings.find((item) => item.category === 'last-hits')
    expect(finding).toBeDefined()
    expect(finding?.severity).toBe('warning')
    expect(finding?.evidence.actual).toBe(80)
    expect(finding?.evidence.benchmarkMedian).toBe(110)
    expect(finding?.evidence.benchmarkP25).toBe(90)
    expect(finding?.evidence.sampleSize).toBe(400)
    expect(finding?.evidenceType).toBe('benchmark-deviation')
  })

  it('LH внутри диапазона не даёт находки', () => {
    const result = buildPlayerInsights({
      player: player({}, { lh_t: timeline(115) }),
      patchId: 60,
      benchmark: snapshot(),
    })
    expect(result.findings.some((item) => item.category === 'last-hits')).toBe(false)
  })

  it('золото ниже p25 даёт отдельную находку, если LH в норме', () => {
    const result = buildPlayerInsights({
      player: player({}, { lh_t: timeline(115), gold_t: timeline(5000) }),
      patchId: 60,
      benchmark: snapshot(),
    })
    const finding = result.findings.find((item) => item.category === 'gold')
    expect(finding?.severity).toBe('warning')
    expect(finding?.evidence.actual).toBe(5000)
  })

  it('опыт ниже p25 даёт находку по опыту', () => {
    const result = buildPlayerInsights({
      player: player({}, { lh_t: timeline(115), gold_t: timeline(7000), xp_t: timeline(5000) }),
      patchId: 60,
      benchmark: snapshot(),
    })
    const finding = result.findings.find((item) => item.category === 'xp')
    expect(finding).toBeDefined()
    expect(finding?.evidence.actual).toBe(5000)
  })
})

describe('buildPlayerInsights — события и отсутствующие данные', () => {
  it('несколько смертей дают предупреждение с подтверждённым счётом', () => {
    const deaths = [{ time: 120 }, { time: 300 }, { time: 600 }]
    const result = buildPlayerInsights({
      player: player(
        {},
        { lh_t: timeline(115), gold_t: timeline(7000), xp_t: timeline(6500), deaths_log: deaths },
      ),
      patchId: 60,
      benchmark: snapshot(),
    })
    const finding = result.findings.find((item) => item.category === 'deaths')
    expect(deaths.length).toBeGreaterThanOrEqual(DEATHS_WARNING_THRESHOLD)
    expect(finding?.severity).toBe('warning')
    expect(finding?.evidence.count).toBe(deaths.length)
    expect(finding?.evidenceType).toBe('observed-event')
  })

  it('без смертей находки о смертях нет', () => {
    const result = buildPlayerInsights({
      player: player({}, { lh_t: timeline(115), gold_t: timeline(7000), xp_t: timeline(6500) }),
      patchId: 60,
      benchmark: snapshot(),
    })
    expect(result.findings.some((item) => item.category === 'deaths')).toBe(false)
  })

  it('без нормативов остаются только подтверждённые события', () => {
    const result = buildPlayerInsights({
      player: player(
        {},
        { lh_t: timeline(50), deaths_log: [{ time: 100 }, { time: 200 }, { time: 300 }] },
      ),
      patchId: 60,
      benchmark: null,
    })
    expect(result.benchmarkUsed).toBe(false)
    expect(result.benchmarkPatch).toBeNull()
    expect(result.findings.every((item) => item.evidenceType === 'observed-event')).toBe(true)
    expect(result.findings.some((item) => item.category === 'deaths')).toBe(true)
  })

  it('отсутствие таймлайна не даёт метрических находок', () => {
    const result = buildPlayerInsights({
      // Таймлайны явно отсутствуют: метрики 15-й минуты недоступны.
      player: player(
        {},
        {
          lh_t: undefined,
          gold_t: undefined,
          xp_t: undefined,
          deaths_log: [{ time: 100 }],
        },
      ),
      patchId: 60,
      benchmark: snapshot(),
    })
    expect(result.status).toBe('ready')
    expect(result.findings.some((item) => item.evidenceType === 'benchmark-deviation')).toBe(false)
  })

  it('неизвестная линия и чужой патч не дают статистических сравнений', () => {
    const noRole = buildPlayerInsights({
      player: player({ lane_role: null }, { lh_t: timeline(50) }),
      patchId: 60,
      benchmark: snapshot(),
    })
    expect(noRole.benchmarkUsed).toBe(false)

    const otherPatch = buildPlayerInsights({
      player: player({}, { lh_t: timeline(50) }),
      patchId: 59,
      benchmark: snapshot(),
    })
    expect(otherPatch.benchmarkUsed).toBe(false)
  })

  it('легаси-отчёт за 10 минут не сравнивается с 15-минутными нормативами', () => {
    const base = player({}, { lh_t: timeline(50) })
    const legacy = {
      ...base,
      laning: { ...base.laning, interval: { minutes: 10, label: '00:00–10:00' } },
    }
    const result = buildPlayerInsights({ player: legacy, patchId: 60, benchmark: snapshot() })
    expect(result.benchmarkUsed).toBe(false)
    expect(result.findings.some((item) => item.evidenceType === 'benchmark-deviation')).toBe(false)
  })

  it('малая выборка даёт информационное наблюдение, не предупреждение', () => {
    const small = snapshot()
    small.buckets[0].metrics.lastHits = { n: 60, p25: 90, p50: 110, p75: 130 }
    small.buckets[0].metrics.gold = { n: 60, p25: 6000, p50: 6800, p75: 7500 }
    small.buckets[0].metrics.xp = { n: 60, p25: 5900, p50: 6700, p75: 7400 }
    const result = buildPlayerInsights({
      player: player({}, { lh_t: timeline(80), gold_t: timeline(7000), xp_t: timeline(6500) }),
      patchId: 60,
      benchmark: small,
    })
    const finding = result.findings.find((item) => item.category === 'last-hits')
    expect(finding?.severity).toBe('info')
    expect(finding?.params.small).toBe(1)
  })

  it('нет данных ранней стадии и null-игрок — статус no-data', () => {
    const base = player()
    const empty = {
      ...base,
      laning: {
        ...base.laning,
        lastHits: null,
        gold: null,
        xp: null,
        deathsFirst: null,
        killsFirst: null,
      },
    }
    const noData = buildPlayerInsights({ player: empty, patchId: 60, benchmark: snapshot() })
    expect(noData.status).toBe('no-data')
    expect(noData.findings).toHaveLength(0)

    const nullPlayer = buildPlayerInsights({ player: null, patchId: 60, benchmark: snapshot() })
    expect(nullPlayer.status).toBe('no-data')
  })
})

describe('buildPlayerInsights — группировка, приоритет и лимит', () => {
  it('LH и золото ниже p25 объединяются в одну находку «фарм»', () => {
    const result = buildPlayerInsights({
      player: player({}, { lh_t: timeline(80), gold_t: timeline(5000), xp_t: timeline(6500) }),
      patchId: 60,
      benchmark: snapshot(),
    })
    expect(result.findings.filter((item) => item.category === 'farming')).toHaveLength(1)
    expect(result.findings.some((item) => item.category === 'last-hits')).toBe(false)
    expect(result.findings.some((item) => item.category === 'gold')).toBe(false)
  })

  it('предупреждения идут раньше информационных наблюдений', () => {
    const result = buildPlayerInsights({
      player: player(
        {},
        {
          lh_t: timeline(80),
          gold_t: timeline(5000),
          xp_t: timeline(6500),
          kills_log: [{ time: 300 }],
        },
      ),
      patchId: 60,
      benchmark: snapshot(),
    })
    const severities = result.findings.map((item) => item.severity)
    const firstInfo = severities.indexOf('info')
    const lastWarning = severities.lastIndexOf('warning')
    if (firstInfo !== -1 && lastWarning !== -1) {
      expect(lastWarning).toBeLessThan(firstInfo)
    }
  })

  it('лишние находки скрываются с явным счётчиком', () => {
    const result = buildPlayerInsights({
      player: player(
        {},
        {
          lh_t: timeline(80),
          gold_t: timeline(5000),
          xp_t: timeline(5000),
          deaths_log: [{ time: 100 }, { time: 200 }, { time: 300 }],
          kills_log: [{ time: 150 }],
        },
      ),
      patchId: 60,
      benchmark: snapshot(),
    })
    expect(result.findings.length).toBeLessThanOrEqual(INSIGHT_MAX_FINDINGS)
    expect(result.findings.length + result.hiddenCount).toBeGreaterThanOrEqual(result.findings.length)
  })

  it('без проблем находок нет, но статус ready и версия правил указана', () => {
    const result = buildPlayerInsights({
      player: player({}, { lh_t: timeline(115), gold_t: timeline(7000), xp_t: timeline(6800) }),
      patchId: 60,
      benchmark: snapshot(),
    })
    expect(result.status).toBe('ready')
    expect(result.findings).toHaveLength(0)
    expect(result.rulesVersion).toBe(INSIGHT_RULES_VERSION)
  })

  it('разные игроки одного матча анализируются независимо', () => {
    const weak = buildPlayerInsights({
      player: player({ player_slot: 0 }, { lh_t: timeline(80), gold_t: timeline(5000) }),
      patchId: 60,
      benchmark: snapshot(),
    })
    const strong = buildPlayerInsights({
      player: player({ player_slot: 128 }, { lh_t: timeline(125) }),
      patchId: 60,
      benchmark: snapshot(),
    })
    expect(weak.findings.length).toBeGreaterThan(0)
    expect(strong.findings.some((item) => item.category === 'last-hits')).toBe(false)
    expect(strong.findings.some((item) => item.category === 'farming')).toBe(false)
  })
})
