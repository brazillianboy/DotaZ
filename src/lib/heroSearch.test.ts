import { describe, expect, it } from 'vitest'

import { heroCatalogEntries, type HeroCatalogEntry } from './heroes'
import { filterHeroes, matchesHeroQuery, sortHeroes, type HeroRateSnapshot } from './heroSearch'

/**
 * Поиск, фильтр и сортировка каталога героев (Task 19).
 *
 * Проверки идут по реальному проверенному справочнику (127 героев): поиск должен
 * находить героя по части имени и слову, атрибут — фильтровать, сортировка — не
 * терять героев и ставить отсутствующие метрики в конец.
 */

const ENTRIES = heroCatalogEntries()

function names(entries: readonly HeroCatalogEntry[]): string[] {
  return entries.map((entry) => entry.name)
}

describe('поиск героев', () => {
  it('справочник содержит всех героев и не пуст', () => {
    expect(ENTRIES.length).toBeGreaterThanOrEqual(120)
  })

  it('пустой запрос возвращает весь справочник', () => {
    expect(filterHeroes(ENTRIES, { query: '', attribute: 'any' })).toHaveLength(ENTRIES.length)
    expect(filterHeroes(ENTRIES, { query: '   ', attribute: 'any' })).toHaveLength(ENTRIES.length)
  })

  it('поиск по части имени не зависит от регистра', () => {
    const found = names(filterHeroes(ENTRIES, { query: 'anti', attribute: 'any' }))
    expect(found).toContain('Anti-Mage')
    expect(names(filterHeroes(ENTRIES, { query: 'ANTI-MAGE', attribute: 'any' }))).toContain(
      'Anti-Mage',
    )
  })

  it('поиск находит героя по второму слову имени', () => {
    const found = names(filterHeroes(ENTRIES, { query: 'ranger', attribute: 'any' }))
    expect(found).toContain('Drow Ranger')
  })

  it('несуществующий запрос даёт пустой список', () => {
    expect(filterHeroes(ENTRIES, { query: 'zzzz', attribute: 'any' })).toEqual([])
  })

  it('совпадение по имени проверяется на конкретной записи', () => {
    const antiMage = ENTRIES.find((entry) => entry.name === 'Anti-Mage')
    expect(antiMage).toBeDefined()
    expect(matchesHeroQuery(antiMage as HeroCatalogEntry, 'mage')).toBe(true)
    expect(matchesHeroQuery(antiMage as HeroCatalogEntry, 'axe')).toBe(false)
  })
})

describe('фильтр по основному атрибуту', () => {
  it('фильтр agi оставляет только ловкость', () => {
    const filtered = filterHeroes(ENTRIES, { query: '', attribute: 'agi' })
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((entry) => entry.primaryAttr === 'agi')).toBe(true)
    expect(names(filtered)).toContain('Anti-Mage')
  })

  it('фильтр и поиск работают вместе', () => {
    const filtered = filterHeroes(ENTRIES, { query: 'anti', attribute: 'agi' })
    expect(names(filtered)).toEqual(['Anti-Mage'])
    expect(filterHeroes(ENTRIES, { query: 'anti', attribute: 'int' })).toEqual([])
  })

  it('универсальный фильтр не смешивается с конкретным атрибутом', () => {
    const universal = filterHeroes(ENTRIES, { query: '', attribute: 'universal' })
    expect(universal.every((entry) => entry.primaryAttr === 'all')).toBe(true)
    expect(universal.length).toBeLessThan(ENTRIES.length)
  })
})

describe('сортировка каталога', () => {
  it('по имени порядок алфавитный и не теряет героев', () => {
    const sorted = sortHeroes(ENTRIES, 'name')
    expect(sorted).toHaveLength(ENTRIES.length)
    const list = names(sorted)
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b, 'en')))
  })

  it('по винрейту метрики идут по убыванию, герои без метрики — в конце', () => {
    const rates = new Map<number, HeroRateSnapshot>([
      [1, { winRate: 45, pickRate: 1 }],
      [2, { winRate: 55, pickRate: 2 }],
      [3, { winRate: null, pickRate: null }],
    ])
    const sorted = sortHeroes(ENTRIES, 'winRate', rates)
    expect(sorted).toHaveLength(ENTRIES.length)
    expect(sorted[0].heroId).toBe(2)
    expect(sorted[1].heroId).toBe(1)
    const metricMissing = (entry: HeroCatalogEntry): boolean => {
      const snapshot = rates.get(entry.heroId)
      return snapshot === undefined || snapshot.winRate === null
    }
    expect(sorted.slice(2).every(metricMissing)).toBe(true)
  })

  it('по доле выборов используется pickRate, без метрик остаётся алфавитный порядок', () => {
    const rates = new Map<number, HeroRateSnapshot>([
      [6, { winRate: 50, pickRate: 0.2 }],
      [11, { winRate: 49, pickRate: 3.4 }],
    ])
    const sorted = sortHeroes(ENTRIES, 'pickRate', rates)
    expect(sorted[0].heroId).toBe(11)
    expect(sorted[1].heroId).toBe(6)
    const plain = sortHeroes(ENTRIES, 'pickRate')
    expect(names(plain)).toEqual(names(sortHeroes(ENTRIES, 'name')))
  })
})
