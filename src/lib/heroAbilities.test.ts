import { describe, expect, it } from 'vitest'

import {
  parseAbility,
  parseHeroAbilityRecord,
  sanitizeAbilityText,
} from './heroAbilities'

/**
 * Способности, таланты и фасеты героя (Task 19).
 *
 * Проверяется то, что подтверждено живым ответом OpenDota: количество способностей
 * не предполагается равным четырём, врождённые помечаются `is_innate`, placeholder
 * `[object Object]` не считается описанием, устаревшие фасеты не показываются.
 */

function abilityDetails(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    dname: 'Test Ability',
    desc: 'Deals verified damage.',
    behavior: 'No Target',
    dmg_type: 'Magical',
    target_type: 'Hero',
    bkbpierce: 'No',
    img: '/apps/dota2/images/dota_react/abilities/test_ability.png',
    is_innate: false,
    attrib: [{ header: 'Damage', value: ['70', '140'] }],
    ...overrides,
  }
}

describe('разбор одной способности', () => {
  it('подтверждённые поля попадают в модель', () => {
    const ability = parseAbility('test_ability', abilityDetails())
    expect(ability).not.toBeNull()
    expect(ability?.displayName).toBe('Test Ability')
    expect(ability?.description).toBe('Deals verified damage.')
    expect(ability?.isInnate).toBe(false)
    expect(ability?.attributes).toEqual([{ header: 'Damage', value: '70 / 140' }])
    expect(ability?.iconUrl).toBe(
      'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/test_ability.png',
    )
  })

  it('врождённая способность отмечается по is_innate', () => {
    const innate = parseAbility('innate_ability', abilityDetails({ is_innate: true }))
    expect(innate?.isInnate).toBe(true)
    const regular = parseAbility('regular', abilityDetails())
    expect(regular?.isInnate).toBe(false)
  })

  it('placeholder и пустые строки не считаются описанием', () => {
    expect(parseAbility('a', abilityDetails({ desc: '[object Object]' }))?.description).toBeNull()
    expect(parseAbility('b', abilityDetails({ desc: '   ' }))?.description).toBeNull()
    expect(sanitizeAbilityText('[object Object]')).toBeNull()
    expect(sanitizeAbilityText('  text  ')).toBe('text')
  })

  it('неизвестная запись не выдумывается', () => {
    expect(parseAbility('missing', undefined)).toBeNull()
    expect(parseAbility('', abilityDetails())).toBeNull()
    expect(parseAbility('x', [1, 2])).toBeNull()
  })
})

describe('разбор записи героя', () => {
  function buildCatalog(names: string[], extra: Record<string, unknown> = {}) {
    const catalog: Record<string, unknown> = { ...extra }
    for (const name of names) {
      catalog[name] = abilityDetails({ dname: name })
    }
    return catalog
  }

  it('шесть способностей разбираются без предположения о четырёх', () => {
    const names = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']
    const data = parseHeroAbilityRecord(11, { abilities: names }, buildCatalog(names))
    expect(data?.abilities).toHaveLength(6)
    expect(data?.innateAbilities).toBe(0)
  })

  it('одиннадцать способностей и врождённые учитываются раздельно', () => {
    const names = Array.from({ length: 11 }, (_unused, index) => `kez_${index}`)
    const catalog = buildCatalog(names)
    catalog.kez_0 = abilityDetails({ dname: 'Innate', is_innate: true })
    const data = parseHeroAbilityRecord(145, { abilities: names }, catalog)
    expect(data?.abilities).toHaveLength(11)
    expect(data?.innateAbilities).toBe(1)
  })

  it('способности без описания считаются, но не скрываются', () => {
    const catalog = {
      with_desc: abilityDetails({ dname: 'With' }),
      without_desc: abilityDetails({ dname: 'Without', desc: '[object Object]' }),
    }
    const data = parseHeroAbilityRecord(86, { abilities: ['with_desc', 'without_desc'] }, catalog)
    expect(data?.abilities).toHaveLength(2)
    expect(data?.abilitiesWithoutDescription).toBe(1)
    expect(data?.abilities[1].description).toBeNull()
    expect(data?.abilities[1].displayName).toBe('Without')
  })

  it('устаревшие фасеты исключаются, активные остаются', () => {
    const catalog = buildCatalog(['a1'])
    const data = parseHeroAbilityRecord(
      86,
      {
        abilities: ['a1'],
        facets: [
          { name: 'facet_active', title: 'Active', description: 'Verified', deprecated: '0' },
          { name: 'facet_old', title: 'Old', description: 'Stale', deprecated: '1' },
        ],
      },
      catalog,
    )
    expect(data?.facets).toHaveLength(1)
    expect(data?.facets[0].name).toBe('facet_active')
    expect(data?.facets[0].description).toBe('Verified')
  })

  it('таланты: уровень из справочника, имя из каталога или запасное', () => {
    const catalog = buildCatalog(['a1'], {
      special_bonus_known: { dname: '+20 Movement Speed' },
    })
    const data = parseHeroAbilityRecord(
      86,
      {
        abilities: ['a1'],
        talents: [
          { name: 'special_bonus_known', level: 1 },
          { name: 'special_bonus_unknown', level: 4 },
          { name: '', level: 2 },
        ],
      },
      catalog,
    )
    expect(data?.talents).toHaveLength(2)
    expect(data?.talents[0]).toEqual({
      name: 'special_bonus_known',
      level: 1,
      displayName: '+20 Movement Speed',
    })
    expect(data?.talents[1].displayName).toBeNull()
  })

  it('пустая запись не превращается в пустую карточку героя', () => {
    expect(parseHeroAbilityRecord(86, {}, buildCatalog([]))).toBeNull()
    expect(parseHeroAbilityRecord(86, null, buildCatalog([]))).toBeNull()
  })
})
