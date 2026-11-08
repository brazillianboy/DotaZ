import { describe, expect, it } from 'vitest'

import { heroCatalogSize, heroInfo, heroName, isKnownHero } from './heroes'

/**
 * Регрессия на идентичность героев (Task 18).
 *
 * Сверено с живым справочником OpenDota `GET /api/heroes` (08.11.2026):
 * `85 → Undying`, `86 → Rubick`. В прошлом отчёте эти ID были перепутаны,
 * поэтому соответствие зафиксировано тестом: код и данные ошибки не содержали,
 * но теперь расхождение не сможет появиться незаметно.
 */
describe('справочник героев — идентичность ID', () => {
  it('85 — Undying, 86 — Rubick', () => {
    expect(heroName(85)).toBe('Undying')
    expect(heroName(86)).toBe('Rubick')
    expect(heroInfo(85)?.slug).toBe('undying.png')
    expect(heroInfo(86)?.slug).toBe('rubick.png')
  })

  it('контрольные ID совпадают с OpenDota', () => {
    expect(heroName(1)).toBe('Anti-Mage')
    expect(heroName(2)).toBe('Axe')
    expect(heroName(6)).toBe('Drow Ranger')
    expect(heroName(99)).toBe('Bristleback')
    expect(heroName(106)).toBe('Ember Spirit')
    expect(heroName(123)).toBe('Hoodwink')
  })

  it('справочник содержит героев патча, неизвестные ID не выдумываются', () => {
    expect(heroCatalogSize()).toBeGreaterThanOrEqual(120)
    expect(isKnownHero(85)).toBe(true)
    expect(isKnownHero(86)).toBe(true)
    expect(heroName(9999)).toBeNull()
    expect(heroInfo(null)).toBeNull()
  })
})
