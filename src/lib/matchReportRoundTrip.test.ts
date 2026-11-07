import { describe, expect, it } from 'vitest'

import {
  BENCHMARK_METHOD_VERSION,
  compareLaningWithBenchmark,
  type BenchmarkSnapshot,
} from './benchmarks'
import { MATCH_REPORT_SNAPSHOT_VERSION, buildReportInsert, parseStoredMatchReport } from './matchReports'
import { normalizeMatch } from './normalizeMatch'

/**
 * Round-trip сохранённого отчёта (Task 16).
 *
 * Проверяется, что новые поля (`patch`, `lane`, `lane_role`) переживают запись и
 * чтение, снимок остаётся версии 2, а отчёты прежних форматов читаются безопасно
 * и никогда не сравниваются с 15-минутными нормативами.
 */

const TIMELINE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 120]

const RAW_MATCH = {
  match_id: 9007760151,
  duration: 2069,
  radiant_win: true,
  patch: 60,
  players: [
    {
      player_slot: 0,
      hero_id: 6,
      kills: 5,
      deaths: 1,
      assists: 3,
      gold_per_min: 600,
      xp_per_min: 700,
      last_hits: 200,
      lane: 3,
      lane_role: 1,
      lh_t: TIMELINE,
      gold_t: TIMELINE,
      xp_t: TIMELINE,
      kills_log: [],
      deaths_log: [],
      purchase_log: [],
    },
  ],
}

function makeInsert() {
  return buildReportInsert({
    userId: 'user-a',
    requestedId: '9007760151',
    match: normalizeMatch(RAW_MATCH),
    fetchedAt: '2026-11-07T00:00:00.000Z',
  })
}

function makeRow(insert: ReturnType<typeof buildReportInsert>) {
  return {
    id: 'row-1',
    user_id: insert.user_id,
    match_id: insert.match_id,
    status: insert.status,
    match_payload: insert.match_payload,
    analysis_payload: insert.analysis_payload,
    rules_version: insert.rules_version,
    source: insert.source,
    fetched_at: insert.fetched_at,
    created_at: '2026-11-07T00:00:00.000Z',
    updated_at: '2026-11-07T00:00:00.000Z',
  }
}

/** Снапшот нормативов 15-й минуты — только для проверки несовпадения интервала. */
function benchmarkSnapshot(): BenchmarkSnapshot {
  return {
    method_version: BENCHMARK_METHOD_VERSION,
    source: { name: 'OpenDota Explorer', url: '', dataset: 'test', attribution: 'test' },
    generated_at: '2026-11-07T00:00:00.000Z',
    patch: '7.41',
    patch_id: 60,
    interval: { minutes: 15, arrayIndex: 16, label: '00:00–15:00' },
    thresholds: { full: 200, medianOnly: 50 },
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
  }
}

describe('round-trip отчёта: новые поля Task 16', () => {
  it('сохраняет патч, линию и lane_role без смены версии снимка', () => {
    const insert = makeInsert()
    expect(insert.match_payload.snapshot_version).toBe(MATCH_REPORT_SNAPSHOT_VERSION)
    expect(MATCH_REPORT_SNAPSHOT_VERSION).toBe(2)

    const parsed = parseStoredMatchReport(makeRow(insert))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.view.match.patch).toBe(60)
    const player = parsed.view.match.players[0]
    expect(player.lane).toBe(3)
    expect(player.lane_role).toBe(1)
    expect(player.laning.interval.minutes).toBe(15)
    expect(player.laning.lastHits).toBe(120)
  })

  it('снимок v2 без новых полей читается, поля становятся null', () => {
    const insert = makeInsert()
    const payload = JSON.parse(JSON.stringify(insert.match_payload)) as Record<string, any>
    delete payload.match.patch
    payload.match.players = payload.match.players.map((player: Record<string, any>) => {
      const copy = { ...player }
      delete copy.lane
      delete copy.lane_role
      return copy
    })

    const parsed = parseStoredMatchReport({ ...makeRow(insert), match_payload: payload })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.view.match.patch).toBeNull()
    expect(parsed.view.match.players[0].lane).toBeNull()
    expect(parsed.view.match.players[0].lane_role).toBeNull()
    expect(parsed.view.match.players[0].laning.interval.minutes).toBe(15)
  })
})

/** Приводит снимок к legacy-формату v1: 10-минутные поля и отсутствие новых. */
function toLegacyPayload(insert: ReturnType<typeof buildReportInsert>): Record<string, any> {
  const payload = JSON.parse(JSON.stringify(insert.match_payload)) as Record<string, any>
  delete payload.match.patch
  payload.match.players = payload.match.players.map((player: Record<string, any>) => ({
    ...player,
    lane: undefined,
    lane_role: undefined,
    laning: {
      lastHitsAt10: 40,
      goldAt10: 3000,
      xpAt10: 2500,
      killsFirst10: 1,
      deathsFirst10: 0,
      purchasesFirst10: [],
      laneEfficiencyPct: null,
    },
  }))
  return payload
}

describe('legacy-отчёты (10 минут)', () => {
  it('читаются как 10-минутные, без выдуманных полей', () => {
    const insert = makeInsert()
    const parsed = parseStoredMatchReport({
      ...makeRow(insert),
      match_payload: toLegacyPayload(insert),
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const player = parsed.view.match.players[0]
    expect(player.laning.interval.minutes).toBe(10)
    expect(player.laning.interval.label).toBe('00:00–10:00')
    expect(player.laning.lastHits).toBe(40)
    expect(player.lane).toBeNull()
    expect(player.lane_role).toBeNull()
    expect(parsed.view.match.patch).toBeNull()
  })

  it('никогда не сравниваются с 15-минутными нормативами', () => {
    const insert = makeInsert()
    const parsed = parseStoredMatchReport({
      ...makeRow(insert),
      match_payload: toLegacyPayload(insert),
    })
    if (!parsed.ok) throw new Error('legacy-снимок не разобран')
    const player = parsed.view.match.players[0]

    const result = compareLaningWithBenchmark(
      benchmarkSnapshot(),
      {
        heroId: player.hero_id,
        laneRole: player.lane_role,
        patchId: parsed.view.match.patch,
        intervalMinutes: player.laning.interval.minutes,
      },
      { lastHits: player.laning.lastHits, gold: player.laning.gold, xp: player.laning.xp },
    )
    // Причина отказа — неизвестная линия и/или неизвестный патч, но никогда не «ready».
    expect(result.status).not.toBe('ready')
    expect(result.metrics).toBeNull()
  })
})
