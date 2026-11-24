import { describe, expect, it } from 'vitest'

import {
  createOpenDotaPlayerService,
  parseHeroStats,
  parseLaneCounts,
  parsePlayerMatchFeed,
  parsePlayerRecord,
  parseRecentMatches,
} from './opendotaPlayer'
import { MATCHES_MAX_RECORDS } from './playerStats'

describe('parsePlayerRecord (wl)', () => {
  it('читает win/lose в победы/поражения и итог', () => {
    const record = parsePlayerRecord({ win: 11_521, lose: 10_707 })
    expect(record).toMatchObject({ wins: 11_521, losses: 10_707, total: 22_228 })
    expect(record?.winRatePercent).toBe(51.8)
  })

  it('нулевой ответ — подтверждённое отсутствие матчей, а не ошибка', () => {
    const record = parsePlayerRecord({ win: 0, lose: 0 })
    expect(record).toMatchObject({ wins: 0, losses: 0, total: 0, winRatePercent: null })
  })

  it('отвергает повреждённые значения', () => {
    expect(parsePlayerRecord(null)).toBeNull()
    expect(parsePlayerRecord([])).toBeNull()
    expect(parsePlayerRecord({ win: 'x', lose: 1 })).toBeNull()
    expect(parsePlayerRecord({ win: -1, lose: 1 })).toBeNull()
  })
})

describe('parseRecentMatches', () => {
  const validEntry = {
    match_id: 9095565720,
    player_slot: 128,
    radiant_win: false,
    hero_id: 97,
    start_time: 1795017226,
    duration: 1922,
    kills: 10,
    deaths: 2,
    assists: 14,
    lane_role: 2,
  }

  it('читает матч и выводит результат Dire', () => {
    const section = parseRecentMatches([validEntry])
    expect(section?.skipped).toBe(0)
    const match = section?.matches[0]
    expect(match?.matchId).toBe('9095565720')
    expect(match?.heroId).toBe(97)
    expect(match?.outcome).toBe('win')
    expect(match?.kills).toBe(10)
    expect(match?.durationSeconds).toBe(1922)
    expect(match?.laneRole).toBe(2)
  })

  it('пропускает записи без match_id или start_time и считает их', () => {
    const section = parseRecentMatches([{ hero_id: 1, radiant_win: true, player_slot: 0 }, validEntry])
    expect(section?.matches.length).toBe(1)
    expect(section?.skipped).toBe(1)
  })

  it('пустой или не-массивный ответ — null', () => {
    expect(parseRecentMatches([])).toEqual({ matches: [], skipped: 0 })
    expect(parseRecentMatches({})).toBeNull()
  })
})

describe('parseHeroStats', () => {
  it('читает статистику и отбрасывает нулевые/несогласованные записи', () => {
    const stats = parseHeroStats([
      { hero_id: 39, games: 1548, win: 835 },
      { hero_id: 13, games: 0, win: 0 },
      { hero_id: 11, games: 5, win: 6 },
      { hero_id: 97, games: 10, win: 3 },
    ])
    expect(stats?.map((hero) => hero.heroId)).toEqual([39, 97])
    expect(stats?.[0]?.winRatePercent).toBe(53.9)
  })

  it('не-массив — null', () => {
    expect(parseHeroStats({})).toBeNull()
  })
})

describe('parseLaneCounts', () => {
  it('читает только разрез lane_role и отбрасывает мусор', () => {
    const counts = parseLaneCounts({
      game_mode: { 1: { games: 2, win: 1 } },
      lane_role: {
        '0': { games: 15339, win: 8142 },
        '1': { games: 873, win: 421 },
        nope: { games: 5, win: 5 },
      },
    })
    expect(counts?.get(0)).toEqual({ games: 15339, wins: 8142 })
    expect(counts?.get(1)).toEqual({ games: 873, wins: 421 })
    expect(counts?.size).toBe(2)
  })

  it('не-объект или отсутствующий lane_role — null', () => {
    expect(parseLaneCounts(null)).toBeNull()
    expect(parseLaneCounts({})).toBeNull()
  })
})

describe('parsePlayerMatchFeed', () => {
  it('читает match_id/start_time и пропускает повреждённые записи', () => {
    const items = parsePlayerMatchFeed([
      { match_id: 1, start_time: 1795017226 },
      { match_id: 2, start_time: 'bad' },
      { match_id: 3 },
      'x',
    ])
    expect(items?.map((item) => item.matchId)).toEqual(['1'])
    expect(items?.[0]?.startTime).toBe('2026-11-18T15:53:46.000Z')
  })

  it('не-массив — null', () => {
    expect(parsePlayerMatchFeed({})).toBeNull()
  })
})

describe('fetchMatchesWindow (пагинация, дедупликация, rate-limit)', () => {
  function offsetFetch(handlers: Record<string, () => unknown[]>) {
    return (async (input: string) => {
      const offset = String(input).match(/offset=(\d+)/)?.[1] ?? '0'
      const body = handlers[offset] ? handlers[offset]() : []
      return { ok: true, status: 200, json: async () => body }
    }) as unknown as typeof fetch
  }

  it('останавливается на неполной странице и не обрезает историю', async () => {
    const service = createOpenDotaPlayerService(
      offsetFetch({
        '0': () => [{ match_id: 1, start_time: 1795017226 }, { match_id: 2, start_time: 1795017000 }],
      }),
    )
    const result = await service.fetchMatchesWindow(70388657, { daysBack: 90 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.items.map((item) => item.matchId).sort()).toEqual(['1', '2'])
      expect(result.value.truncated).toBe(false)
    }
  })

  it('листает полные страницы, дедуплицирует и останавливается на короткой странице', async () => {
    const page = (base: number) =>
      Array.from({ length: 100 }, (_, i) => ({ match_id: base + i, start_time: 1795017226 - i }))
    const service = createOpenDotaPlayerService(
      offsetFetch({
        '0': () => page(1), // матчи 1..100
        '100': () => page(99), // матчи 99..198 (99 и 100 — дубли)
      }),
    )
    const result = await service.fetchMatchesWindow(70388657, { daysBack: 90 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      // 100 + 98 новых; дубли 99/100 отброшены.
      expect(result.value.items.length).toBe(198)
      expect(new Set(result.value.items.map((item) => item.matchId)).size).toBe(198)
      expect(result.value.truncated).toBe(false)
    }
  })

  it('обрывает пагинацию по лимиту записей и помечает truncated', async () => {
    let nextId = 1
    const service = createOpenDotaPlayerService(
      (async () => ({
        ok: true,
        status: 200,
        json: async () =>
          Array.from({ length: 100 }, () => ({ match_id: nextId++, start_time: 1795017226 })),
      })) as unknown as typeof fetch,
    )
    const result = await service.fetchMatchesWindow(70388657, { daysBack: 90 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.items.length).toBe(MATCHES_MAX_RECORDS)
      expect(result.value.truncated).toBe(true)
    }
  })

  it('повторяет запрос после rate-limit (429)', async () => {
    let calls = 0
    const service = createOpenDotaPlayerService(
      (async () => {
        calls += 1
        if (calls === 1) {
          return { ok: false, status: 429, json: async () => ({}) }
        }
        return {
          ok: true,
          status: 200,
          json: async () => [{ match_id: 1, start_time: 1795017226 }],
        }
      }) as unknown as typeof fetch,
    )
    const result = await service.fetchMatchesWindow(70388657, { daysBack: 90 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.items.map((item) => item.matchId)).toEqual(['1'])
    }
    expect(calls).toBe(2)
  }, 5000)
})

describe('createOpenDotaPlayerService (фейковый fetch, без сети)', () => {
  function fakeFetch(routes: Record<string, { body: unknown; status?: number }>) {
    return (async (input: string) => {
      const routeKey = Object.keys(routes).find((key) => input.includes(key))
      if (routeKey === undefined) {
        return { ok: false, status: 404, json: async () => ({}) }
      }
      const route = routes[routeKey]
      const status = route.status ?? 200
      return { ok: status < 400, status, json: async () => route.body }
    }) as unknown as typeof fetch
  }

  it('собирает четыре секции и разбирает ответы', async () => {
    const service = createOpenDotaPlayerService(
      fakeFetch({
        '/wl': { body: { win: 10, lose: 2 } },
        '/recentMatches': {
          body: [{ match_id: 1, hero_id: 39, start_time: 1795017226, player_slot: 0, radiant_win: true }],
        },
        '/heroes': { body: [{ hero_id: 39, games: 5, win: 3 }] },
        '/counts': { body: { lane_role: { 2: { games: 40, win: 20 } } } },
      }),
    )

    const record = await service.fetchRecord(70388657)
    expect(record.ok && record.value.total).toBe(12)

    const recent = await service.fetchRecentMatches(70388657)
    expect(recent.ok && recent.value.matches[0]?.outcome).toBe('win')

    const heroes = await service.fetchHeroStats(70388657)
    expect(heroes.ok && heroes.value[0]?.heroId).toBe(39)

    const lanes = await service.fetchLaneCounts(70388657)
    expect(lanes.ok && lanes.value.get(2)?.games).toBe(40)
  })

  it('классифицирует статусы ошибок', async () => {
    const service = createOpenDotaPlayerService(
      fakeFetch({
        '/wl': { body: {}, status: 404 },
        '/recentMatches': { body: [], status: 403 },
        '/heroes': { body: [], status: 429 },
        '/counts': { body: {}, status: 500 },
      }),
    )
    const recordError = await service.fetchRecord(1)
    if (!recordError.ok) expect(recordError.error.kind).toBe('not_found')
    const recent = await service.fetchRecentMatches(1)
    if (!recent.ok) expect(recent.error.kind).toBe('forbidden')
    const heroes = await service.fetchHeroStats(1)
    if (!heroes.ok) expect(heroes.error.kind).toBe('rate_limited')
    const lanes = await service.fetchLaneCounts(1)
    if (!lanes.ok) expect(lanes.error.kind).toBe('server_error')
  })
})