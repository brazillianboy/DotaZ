import { describe, expect, it } from 'vitest'

import type { OpenDotaError } from './opendota'
import type { OpenDotaPlayerService, SectionResult } from './opendotaPlayer'
import { createPlayerProfileLoader } from './playerProfile'
import type { PlayerRecord } from './playerStats'

const RECORD: PlayerRecord = { wins: 3, losses: 1, total: 4, winRatePercent: 75 }

function ok<T>(value: T): SectionResult<T> {
  return { ok: true, value }
}

function fail(kind: OpenDotaError['kind']): SectionResult<never> {
  return { ok: false, error: { kind, message: 'ошибка' } }
}

function baseService(): OpenDotaPlayerService {
  return {
    fetchRecord: async () => ok(RECORD),
    fetchRecentMatches: async () =>
      ok({ matches: [{ matchId: '1', heroId: 1, outcome: 'win', kills: 1, deaths: 2, assists: 3, durationSeconds: 1800, startTime: '2026-11-18T00:00:00.000Z', laneRole: 2 }], skipped: 0 }),
    fetchHeroStats: async () => ok([{ heroId: 39, games: 5, wins: 3, winRatePercent: 60 }]),
    fetchLaneCounts: async () => ok(new Map([[2, { games: 40, wins: 20 }]])),
    fetchMatchesWindow: async () =>
      ok({ items: [{ matchId: '909', startTime: '2026-11-18T00:00:00.000Z' }], truncated: false, oldestMatchTime: '2026-11-18T00:00:00.000Z' }),
  }
}

describe('createPlayerProfileLoader', () => {
  it('собирает данные и считает производные метрики', async () => {
    const loader = createPlayerProfileLoader(baseService(), { now: () => 0 })
    const result = await loader.load(70388657)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.data.record?.total).toBe(4)
      expect(result.data.heroes?.length).toBe(1)
      expect(result.data.history?.items.length).toBe(1)
      expect(result.data.history?.truncated).toBe(false)
      expect(result.data.lanes?.knownGames).toBe(40)
      expect(result.data.lanes?.examined).toBe(40)
    }
  })

  it('частичный сбой оставляет другие секции доступными', async () => {
    const service = baseService()
    service.fetchRecord = async () => fail('forbidden')
    const loader = createPlayerProfileLoader(service, { now: () => 0 })
    const result = await loader.load(70388657)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.data.record).toBeNull()
      expect(result.data.errors.record?.kind).toBe('forbidden')
      expect(result.data.heroes?.length).toBe(1)
    }
  })

  it('полный сбой помечается как unavailable и не кэшируется как данные', async () => {
    const service = baseService()
    service.fetchRecord = async () => fail('network')
    service.fetchRecentMatches = async () => fail('network')
    service.fetchHeroStats = async () => fail('network')
    service.fetchLaneCounts = async () => fail('network')
    service.fetchMatchesWindow = async () => fail('network')
    const loader = createPlayerProfileLoader(service, { now: () => 0 })
    const result = await loader.load(70388657)
    expect(result.status).toBe('unavailable')
  })

  it('возвращает aborted при заранее отменённом сигнале', async () => {
    const loader = createPlayerProfileLoader(baseService(), { now: () => 0 })
    const controller = new AbortController()
    controller.abort()
    const result = await loader.load(70388657, { signal: controller.signal })
    expect(result.status).toBe('aborted')
  })

  it('кэширует ответ и отдаёт из кэша повторный запрос', async () => {
    let calls = 0
    const service = baseService()
    service.fetchRecord = async () => {
      calls += 1
      return ok(RECORD)
    }
    let now = 0
    const loader = createPlayerProfileLoader(service, { now: () => now })
    await loader.load(70388657)
    const second = await loader.load(70388657)
    expect(second.status).toBe('ok')
    if (second.status === 'ok') expect(second.fromCache).toBe(true)
    expect(calls).toBe(1)

    // После истечения TTL кэш перечитывается.
    now = 70_000
    await loader.load(70388657)
    expect(calls).toBe(2)
  })

  it('отбрасывает устаревший ответ при смене аккаунта', async () => {
    let resolveA!: (value: SectionResult<PlayerRecord>) => void
    const pendingA = new Promise<SectionResult<PlayerRecord>>((resolve) => {
      resolveA = resolve
    })
    const service = baseService()
    service.fetchRecord = async (accountId) => {
      if (accountId === 111) {
        return pendingA
      }
      return ok(RECORD)
    }
    const loader = createPlayerProfileLoader(service, { now: () => 0 })

    const first = loader.load(111)
    const second = await loader.load(222)
    resolveA(ok(RECORD))
    const settledFirst = await first

    expect(second.status).toBe('ok')
    expect(settledFirst.status).toBe('stale')
  })

  it('отклоняет некорректный account id', async () => {
    const loader = createPlayerProfileLoader(baseService(), { now: () => 0 })
    expect((await loader.load(-1)).status).toBe('invalid-account')
    expect((await loader.load(1.5)).status).toBe('invalid-account')
  })

  it('оборванная история матчей окна помечается как частичная', async () => {
    const NOW = Date.parse('2026-11-18T12:00:00.000Z')

    const truncated = baseService()
    truncated.fetchMatchesWindow = async () =>
      ok({
        items: [{ matchId: '1', startTime: '2026-11-15T00:00:00.000Z' }],
        truncated: true,
        oldestMatchTime: '2026-11-15T00:00:00.000Z',
      })
    const loaderA = createPlayerProfileLoader(truncated, { now: () => NOW })
    const resultA = await loaderA.load(70388657)
    expect(resultA.status).toBe('ok')
    if (resultA.status === 'ok') {
      expect(resultA.data.history?.truncated).toBe(true)
      expect(resultA.data.history?.oldestMatchTime).toBe('2026-11-15T00:00:00.000Z')
    }

    const complete = baseService()
    complete.fetchMatchesWindow = async () =>
      ok({
        items: [{ matchId: '1', startTime: '2026-11-15T00:00:00.000Z' }],
        truncated: false,
        oldestMatchTime: '2026-11-15T00:00:00.000Z',
      })
    const loaderB = createPlayerProfileLoader(complete, { now: () => NOW })
    const resultB = await loaderB.load(70388657)
    expect(resultB.status).toBe('ok')
    if (resultB.status === 'ok') {
      expect(resultB.data.history?.truncated).toBe(false)
    }
  })
})