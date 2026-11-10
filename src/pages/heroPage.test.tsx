import { describe, expect, it } from 'vitest'

import { parseHeroRouteId } from './HeroPage'

/**
 * Маршрут профиля героя (Task 19): принимается только ID из проверенного
 * справочника — иначе страница показывает состояние «герой не найден».
 */
describe('параметр маршрута /heroes/:heroId', () => {
  it('известный герой разбирается', () => {
    expect(parseHeroRouteId('86')).toBe(86)
    expect(parseHeroRouteId('1')).toBe(1)
  })

  it('неизвестный и нечисловой ID не принимаются', () => {
    expect(parseHeroRouteId('9999')).toBeNull()
    expect(parseHeroRouteId('86abc')).toBeNull()
    expect(parseHeroRouteId('-1')).toBeNull()
    expect(parseHeroRouteId('0')).toBeNull()
    expect(parseHeroRouteId('1.5')).toBeNull()
    expect(parseHeroRouteId(undefined)).toBeNull()
  })
})
