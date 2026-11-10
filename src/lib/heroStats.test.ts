import { describe, expect, it } from 'vitest'

import {
  buildHeroStatsCatalog,
  computePickShare,
  computeWinRate,
  heroPickShare,
  heroRateMap,
  heroStatsEntry,
  parseHeroStatsRow,
} from './heroStats'

/**
 * Статистика героев (Task 19).
 *
 * Винрейт и доля выборов считаются только при валидных числителях и знаменателях:
 * при отсутствии данных возвращается `null`, а не «примерный» процент.
 */

function statRow(heroId: number, pubPick: number, pubWin: number): Record<string, unknown> {
  return {
    id: heroId,
    localized_name: `Hero ${heroId}`,
    primary_attr: 'str',
    attack_type: 'Melee',
    roles: ['Carry'],
    pub_pick: pubPick,
    pub_win: pubWin,
    turbo_picks: 10,
    turbo_wins: 5,
    pro_pick: 4,
    pro_win: 2,
    pro_ban: 7,
  }
}

describe('винрейт и доля выборов', () => {
  it('винрейт округляется до 0.01 и не делит на ноль', () => {
    expect(computeWinRate(55, 100)).toBe(55)
    expect(computeWinRate(1, 3)).toBe(33.33)
    expect(computeWinRate(0, 0)).toBeNull()
    expect(computeWinRate(5, 0)).toBeNull()
    expect(computeWinRate(101, 100)).toBeNull()
    expect(computeWinRate(-1, 100)).toBeNull()
    expect(computeWinRate(1.5, 100)).toBeNull()
  })

  it('доля выборов требует положительного знаменателя', () => {
    expect(computePickShare(50, 1000)).toBe(5)
    expect(computePickShare(0, 1000)).toBe(0)
    expect(computePickShare(50, 0)).toBeNull()
    expect(computePickShare(1001, 1000)).toBeNull()
  })
})

describe('разбор строки heroStats', () => {
  it('подтверждённая строка разбирается полностью', () => {
    const entry = parseHeroStatsRow(statRow(2, 1000, 550))
    expect(entry).not.toBeNull()
    expect(entry?.heroId).toBe(2)
    expect(entry?.pub).toEqual({ games: 1000, wins: 550, winRate: 55 })
    expect(entry?.turbo.winRate).toBe(50)
    expect(entry?.pro.bans).toBe(7)
    expect(entry?.ranks).toHaveLength(8)
  })

  it('неизвестный атрибут, пустое имя и отсутствие ID не принимаются', () => {
    expect(parseHeroStatsRow(null)).toBeNull()
    expect(parseHeroStatsRow({ ...statRow(2, 1, 1), primary_attr: 'speed' })).toBeNull()
    expect(parseHeroStatsRow({ ...statRow(2, 1, 1), localized_name: '' })).toBeNull()
    expect(parseHeroStatsRow({ ...statRow(2, 1, 1), id: 0 })).toBeNull()
  })

  it('отсутствующие счётчики не превращаются в проценты', () => {
    const raw = statRow(2, 0, 0)
    delete raw.pub_pick
    delete raw.pub_win
    const entry = parseHeroStatsRow(raw)
    expect(entry?.pub).toEqual({ games: 0, wins: 0, winRate: null })
  })
})

describe('каталог статистики и знаменатель доли выборов', () => {
  function catalogOf(count: number, pick: number) {
    return buildHeroStatsCatalog(
      Array.from({ length: count }, (_unused, index) => statRow(index + 1, pick, pick / 2)),
      '2026-11-08T00:00:00.000Z',
    )
  }

  it('каталог собирается, знаменатель равен сумме выборов', () => {
    const catalog = catalogOf(120, 1000)
    expect(catalog).not.toBeNull()
    expect(catalog?.entries.size).toBe(120)
    expect(catalog?.totals.pubPicks).toBe(120000)
    expect(heroPickShare(catalog, 1)).toBe(0.83)
    expect(heroStatsEntry(catalog, 1)?.pub.games).toBe(1000)
  })

  it('неполный ответ провайдера каталогом не считается', () => {
    expect(catalogOf(10, 1000)).toBeNull()
  })

  it('неизвестный герой не даёт ни записи, ни процента', () => {
    const catalog = catalogOf(120, 1000)
    expect(heroStatsEntry(catalog, 9999)).toBeNull()
    expect(heroPickShare(catalog, 9999)).toBeNull()
    expect(heroStatsEntry(null, 1)).toBeNull()
    expect(heroPickShare(null, 1)).toBeNull()
  })

  it('карта метрик совпадает с записями каталога', () => {
    const catalog = catalogOf(120, 1000)
    const rates = heroRateMap(catalog)
    expect(rates.size).toBe(120)
    expect(rates.get(1)).toEqual({ winRate: 50, pickRate: 0.83 })
    expect(heroRateMap(null).size).toBe(0)
  })
})
