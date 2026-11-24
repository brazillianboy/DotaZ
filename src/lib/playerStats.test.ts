import { describe, expect, it } from 'vitest'

import {
  buildActivityHeatmap,
  buildLaneDistribution,
  computeWinRate,
  heatmapYears,
  matchOutcome,
  mondayShift,
  sortHeroStats,
  topHeroStats,
  utcDateKey,
  type PlayerHeroStat,
} from './playerStats'

describe('Винрейт', () => {
  it('считает по формуле и округляет до 0,1 п.п.', () => {
    expect(computeWinRate(3, 1)).toBe(75)
    expect(computeWinRate(1, 3)).toBe(25)
    expect(computeWinRate(2, 3)).toBe(40)
    expect(computeWinRate(1, 1)).toBe(50)
  })

  it('округляет половины вверх', () => {
    expect(computeWinRate(2, 1)).toBe(66.7)
    expect(computeWinRate(1, 2)).toBe(33.3)
  })

  it('возвращает null при нуле подтверждённых матчей', () => {
    expect(computeWinRate(0, 0)).toBeNull()
  })

  it('возвращает null для отсутствующих и некорректных значений', () => {
    expect(computeWinRate(null, 5)).toBeNull()
    expect(computeWinRate(5, null)).toBeNull()
    expect(computeWinRate(-1, 5)).toBeNull()
    expect(computeWinRate(5, -1)).toBeNull()
    expect(computeWinRate(1.5, 3)).toBeNull()
  })
})

describe('Результат матча', () => {
  it('Radiant побеждает, когда radiant_win совпадает со слотом 0–4', () => {
    expect(matchOutcome(true, 0)).toBe('win')
    expect(matchOutcome(true, 4)).toBe('win')
    expect(matchOutcome(false, 0)).toBe('loss')
  })

  it('Dire (128–132) зеркален относительно radiant_win', () => {
    expect(matchOutcome(true, 128)).toBe('loss')
    expect(matchOutcome(false, 132)).toBe('win')
  })

  it('без radiant_win или с некорректным слотом результат неизвестен', () => {
    expect(matchOutcome(null, 0)).toBe('unknown')
    expect(matchOutcome(true, null)).toBe('unknown')
    expect(matchOutcome(true, 256)).toBe('unknown')
    expect(matchOutcome(true, -1)).toBe('unknown')
    expect(matchOutcome(false, 300)).toBe('unknown')
  })
})

describe('Сортировка героев', () => {
  const make = (heroId: number, games: number, wins: number): PlayerHeroStat => ({
    heroId,
    games,
    wins,
    winRatePercent: computeWinRate(wins, games - wins),
  })

  it('сортирует по количеству матчей, затем по победам, затем по hero_id', () => {
    const sorted = sortHeroStats([make(3, 5, 2), make(1, 5, 3), make(2, 9, 1)])
    expect(sorted.map((hero) => hero.heroId)).toEqual([2, 1, 3])
  })

  it('topHeroStats возвращает срез без изменения порядка', () => {
    const stats = [make(1, 1, 1), make(2, 5, 5), make(3, 9, 4)]
    expect(topHeroStats(stats, 2).map((hero) => hero.heroId)).toEqual([3, 2])
    expect(topHeroStats(stats, 0)).toEqual([])
  })
})

describe('Распределение по линиям (полная история)', () => {
  it('строит доли только по ролям 1–4 и отделяет бакет 0', () => {
    const counts = new Map<number, { games: number; wins: number }>([
      [0, { games: 100, wins: 40 }],
      [1, { games: 30, wins: 20 }],
      [2, { games: 70, wins: 21 }],
      [5, { games: 999, wins: 999 }],
    ])
    const result = buildLaneDistribution(counts, 250)
    expect(result).not.toBeNull()
    expect(result?.knownGames).toBe(100)
    expect(result?.undeterminedGames).toBe(100)
    expect(result?.undeterminedPercent).toBe(50)
    expect(result?.examined).toBe(200)
    expect(result?.total).toBe(250)
    expect(result?.sufficient).toBe(true)
    expect(result?.rows.map((row) => row.laneRole)).toEqual([1, 2])
    // Доли считаются от всей обследованной популяции (200), а не только от 100.
    expect(result?.rows[0]?.sharePercent).toBe(15)
    expect(result?.rows[1]?.sharePercent).toBe(35)
  })

  it('помечает выборку недостаточной ниже порога', () => {
    const counts = new Map<number, { games: number; wins: number }>([[1, { games: 3, wins: 1 }]])
    const result = buildLaneDistribution(counts, null)
    expect(result?.sufficient).toBe(false)
    expect(result?.total).toBeNull()
  })

  it('null остаётся null', () => {
    expect(buildLaneDistribution(null, null)).toBeNull()
  })
})

describe('Тепловая карта активности (GitHub-стиль)', () => {
  const NOW = new Date('2026-11-18T12:00:00.000Z')

  it('раскладывает матчи по неделям-столбцам с понедельника', () => {
    const heat = buildActivityHeatmap(
      [
        { matchId: '1', startTime: '2026-11-18T10:00:00.000Z' },
        { matchId: '2', startTime: '2026-11-18T08:00:00.000Z' },
        { matchId: '3', startTime: '2026-01-02T00:00:00.000Z' },
        { matchId: null, startTime: null },
      ],
      { year: 2026, now: NOW, truncated: false, coverageStartSeconds: 0 },
    )
    expect(heat.year).toBe(2026)
    // «Сейчас» — 2026-11-18, поэтому год обрезан до текущей даты: будущих дней
    // нет, и столбцов получается меньше полного года (полный год — 52–53).
    expect(heat.weeks.length).toBeGreaterThanOrEqual(46)
    expect(heat.totalMatches).toBe(3)
    const nov18 = heat.weeks.flat().find((cell) => cell?.dateKey === '2026-11-18')
    expect(nov18?.matches).toBe(2)
  })

  it('дедуплицирует по match_id', () => {
    const heat = buildActivityHeatmap(
      [
        { matchId: '1', startTime: '2026-11-18T10:00:00.000Z' },
        { matchId: '1', startTime: '2026-11-18T10:00:00.000Z' },
      ],
      { year: 2026, now: NOW, truncated: false, coverageStartSeconds: 0 },
    )
    expect(heat.totalMatches).toBe(1)
  })

  it('помечает дни вне покрытия как недоступные, а не как ноль', () => {
    const coverageStart = Date.parse('2026-11-10T00:00:00.000Z') / 1000
    const heat = buildActivityHeatmap(
      [{ matchId: '1', startTime: '2026-11-15T00:00:00.000Z' }],
      { year: 2026, now: NOW, truncated: true, coverageStartSeconds: coverageStart },
    )
    const nov9 = heat.weeks.flat().find((cell) => cell?.dateKey === '2026-11-09')
    const nov15 = heat.weeks.flat().find((cell) => cell?.dateKey === '2026-11-15')
    expect(nov9?.available).toBe(false)
    expect(nov15?.available).toBe(true)
  })

  it('heatmapYears возвращает годы по убыванию, включая текущий', () => {
    const years = heatmapYears(
      [{ startTime: '2024-03-03T00:00:00.000Z' }, { startTime: '2026-01-01T00:00:00.000Z' }],
      NOW,
    )
    expect(years).toEqual([2026, 2024])
  })

  it('mondayShift и utcDateKey работают по UTC', () => {
    expect(mondayShift('2026-11-16')).toBe(0)
    expect(mondayShift('2026-11-18')).toBe(2)
    expect(utcDateKey(Date.parse('2026-11-18T12:00:00.000Z') / 1000)).toBe('2026-11-18')
  })
})