import { describe, expect, it } from 'vitest'

import {
  HERO_MATCHUPS_LIMIT,
  HERO_MATCHUPS_MIN_GAMES,
  loadHeroMatchups,
  parseMatchupRow,
  parseMatchupRows,
  rankMatchups,
  resetHeroMatchupsCache,
  type MatchupRow,
} from './heroMatchups'

/**
 * Матчапы героя (Task 19).
 *
 * Проверяются: строгий разбор ответа OpenDota, порог выборки 100 матчей,
 * две непересекающиеся группы по пять соперников, детерминированные тай-брейки
 * и честные состояния при нехватке данных.
 */

function row(opponentId: number, games: number, wins: number): MatchupRow {
  return { opponentId, games, wins, winRate: Math.round((wins / games) * 10000) / 100 }
}

describe('разбор матчапов', () => {
  it('подтверждённая пара разбирается с винрейтом запрошенного героя', () => {
    expect(parseMatchupRow({ hero_id: 2, games_played: 200, wins: 120 })).toEqual({
      opponentId: 2,
      games: 200,
      wins: 120,
      winRate: 60,
    })
  })

  it('неизвестный соперник и некорректные числа не принимаются', () => {
    expect(parseMatchupRow({ hero_id: 99999, games_played: 200, wins: 100 })).toBeNull()
    expect(parseMatchupRow({ hero_id: 2, games_played: 0, wins: 0 })).toBeNull()
    expect(parseMatchupRow({ hero_id: 2, games_played: 200, wins: 201 })).toBeNull()
    expect(parseMatchupRow({ hero_id: 2, games_played: 200, wins: -1 })).toBeNull()
    expect(parseMatchupRow({ hero_id: 2, games_played: '200', wins: 100 })).toBeNull()
    expect(parseMatchupRow({ hero_id: 2.5, games_played: 200, wins: 100 })).toBeNull()
    expect(parseMatchupRow(null)).toBeNull()
    expect(parseMatchupRow([{ hero_id: 2 }])).toBeNull()
  })

  it('дубли соперника схлопываются в строку с большей выборкой', () => {
    const rows = parseMatchupRows([
      { hero_id: 2, games_played: 120, wins: 60 },
      { hero_id: 2, games_played: 300, wins: 150 },
      { hero_id: 3, games_played: 0, wins: 0 },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(row(2, 300, 150))
  })

  it('не массив на входе не имитируется пустым успехом', () => {
    expect(parseMatchupRows(null)).toEqual([])
    expect(parseMatchupRows({ hero_id: 2 })).toEqual([])
  })
})

describe('ранжирование матчапов', () => {
  it('пара с 99 матчами исключается, с 100 — попадает', () => {
    const ranked = rankMatchups([row(2, 99, 99), row(3, HERO_MATCHUPS_MIN_GAMES, 50)])
    expect(ranked.qualifiedCount).toBe(1)
    expect(ranked.strongest).toEqual([row(3, 100, 50)])
    expect(ranked.strongest.some((item) => item.opponentId === 2)).toBe(false)
  })

  it('строятся две группы по пять без пересечений', () => {
    const rows = Array.from({ length: 14 }, (_unused, index) =>
      row(index + 2, 200, 100 + index * 5),
    )
    const ranked = rankMatchups(rows)
    expect(ranked.strongest).toHaveLength(HERO_MATCHUPS_LIMIT)
    expect(ranked.weakest).toHaveLength(HERO_MATCHUPS_LIMIT)
    const overlap = ranked.strongest.filter((strong) =>
      ranked.weakest.some((weak) => weak.opponentId === strong.opponentId),
    )
    expect(overlap).toEqual([])
    expect(ranked.weakest[0].winRate).toBeLessThan(ranked.strongest[0].winRate)
    expect(ranked.limitedCoverage).toBe(false)
    expect(ranked.weakestLimited).toBe(false)
  })

  it('равный винрейт разрешается выборкой, затем ID соперника', () => {
    const ranked = rankMatchups([row(9, 200, 100), row(4, 400, 200), row(7, 200, 100)])
    expect(ranked.strongest.map((item) => item.opponentId)).toEqual([4, 7, 9])
  })

  it('без пар выше порога рейтинг не строится', () => {
    const ranked = rankMatchups([row(2, 98, 50), row(3, 40, 20)])
    expect(ranked).toEqual({
      strongest: [],
      weakest: [],
      qualifiedCount: 0,
      weakestLimited: true,
      limitedCoverage: true,
    })
  })

  it('при семи подходящих парах слабейшая группа короче пяти', () => {
    const rows = Array.from({ length: 7 }, (_unused, index) => row(index + 2, 150, 70 + index))
    const ranked = rankMatchups(rows)
    expect(ranked.strongest).toHaveLength(5)
    expect(ranked.weakest).toHaveLength(2)
    expect(ranked.weakestLimited).toBe(true)
    expect(ranked.limitedCoverage).toBe(true)
  })
})

describe('загрузка матчапов', () => {
  it('успешный ответ кешируется, сбой не кешируется как данные', async () => {
    resetHeroMatchupsCache()
    let calls = 0
    const fetcher = async (): Promise<unknown> => {
      calls += 1
      return [{ hero_id: 2, games_played: 150, wins: 80 }]
    }
    const first = await loadHeroMatchups(2, { fetcher })
    const second = await loadHeroMatchups(2, { fetcher })
    expect(first).toEqual([row(2, 150, 80)])
    expect(second).toEqual(first)
    expect(calls).toBe(1)
  })

  it('сбой провайдера возвращает null, а не пустой список', async () => {
    resetHeroMatchupsCache()
    const failing = async (): Promise<unknown> => null
    expect(await loadHeroMatchups(11, { fetcher: failing })).toBeNull()
  })

  it('некорректный ID героя не приводит к запросу', async () => {
    let called = false
    const fetcher = async (): Promise<unknown> => {
      called = true
      return []
    }
    expect(await loadHeroMatchups(0, { fetcher })).toBeNull()
    expect(await loadHeroMatchups(Number.NaN, { fetcher })).toBeNull()
    expect(called).toBe(false)
  })
})
