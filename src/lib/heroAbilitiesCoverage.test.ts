import { describe, expect, it } from 'vitest'

import {
  ABILITY_ICON_CDN,
  innateAbilities,
  parseAbility,
  parseHeroAbilityRecord,
  standardAbilities,
} from './heroAbilities'

/**
 * Покрытие актуальных способностей, талантов и фасетов (Task 19).
 *
 * Аудит живого справочника (2026-11-09) показал: описания есть у 1006 из 3084 записей
 * каталога, но это относится ко всем записям, включая устаревшие и служебные. Реальное
 * покрытие игровых способностей героев каталога — 753 из 866 (86.95 %), иконки — 866 из
 * 866. Поэтому здесь проверяется не «сырая» доля каталога, а поведение разбора:
 * отсутствие описания/имени не скрывает способность и не выдумывает текст.
 */

function details(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    dname: 'Verified Ability',
    desc: 'Verified description.',
    behavior: 'No Target',
    dmg_type: 'Magical',
    target_type: 'Hero',
    bkbpierce: 'No',
    img: '/apps/dota2/images/dota_react/abilities/verified.png',
    is_innate: false,
    attrib: [{ header: 'Damage', value: ['10', '20'] }],
    ...overrides,
  }
}

/** Собирает каталог деталей по именам способностей с возможностью переопределения. */
function catalogOf(
  names: string[],
  overrides: Record<string, Record<string, unknown>> = {},
): Record<string, unknown> {
  const catalog: Record<string, unknown> = {}
  for (const name of names) {
    catalog[name] = details(overrides[name] ?? {})
  }
  return catalog
}

/** Запись героя из `/api/constants/hero_abilities` только со списком способностей. */
function record(names: string[]): Record<string, unknown> {
  return { abilities: names }
}

describe('имя способности из справочника', () => {
  it('подтверждённое dname считается отображаемым именем', () => {
    const ability = parseAbility('rubick_fade_bolt', details({ dname: 'Fade Bolt' }))
    expect(ability?.hasDisplayName).toBe(true)
    expect(ability?.displayName).toBe('Fade Bolt')
  })

  it('без dname остаётся техническое имя и ставится флаг его отсутствия', () => {
    const ability = parseAbility('muerta_parting_shot', details({ dname: undefined }))
    expect(ability?.hasDisplayName).toBe(false)
    expect(ability?.displayName).toBe('muerta_parting_shot')
  })

  it('сломанный placeholder вместо имени не считается именем', () => {
    const ability = parseAbility('broken', details({ dname: '[object Object]' }))
    expect(ability?.hasDisplayName).toBe(false)
    expect(ability?.displayName).toBe('broken')
  })
})

describe('иконки способностей', () => {
  it('подтверждённый img превращается в абсолютный адрес CDN', () => {
    const ability = parseAbility('verified', details())
    expect(ability?.iconUrl).toBe(
      `${ABILITY_ICON_CDN}/apps/dota2/images/dota_react/abilities/verified.png`,
    )
  })

  it('без img адрес детерминированно строится по имени, а не подменяется чужим', () => {
    const ability = parseAbility('fallback_icon', details({ img: null }))
    expect(ability?.iconUrl).toBe(
      `${ABILITY_ICON_CDN}/apps/dota2/images/dota_react/abilities/fallback_icon.png`,
    )
  })

  it('иконка не появляется у несуществующей способности', () => {
    expect(parseAbility('missing', undefined)).toBeNull()
  })
})

describe('группировка способностей по подтверждённому признаку', () => {
  it('обычные и врождённые группы не пересекаются и покрывают весь список', () => {
    const names = ['a1', 'a2', 'a3', 'a4', 'innate_a']
    const catalog = catalogOf(names, { innate_a: { is_innate: true } })
    const data = parseHeroAbilityRecord(86, record(names), catalog)
    expect(data).not.toBeNull()
    if (data === null) {
      return
    }
    const regular = standardAbilities(data)
    const innate = innateAbilities(data)
    expect(regular).toHaveLength(4)
    expect(innate).toHaveLength(1)
    expect(regular.length + innate.length).toBe(data.abilities.length)
    const overlap = regular.filter((ability) => innate.some((other) => other.name === ability.name))
    expect(overlap).toHaveLength(0)
    expect(innate[0].name).toBe('innate_a')
  })

  it('герой без врождённых способностей даёт пустую врождённую группу', () => {
    const names = ['a1', 'a2', 'a3', 'a4']
    const data = parseHeroAbilityRecord(1, record(names), catalogOf(names))
    expect(data).not.toBeNull()
    if (data === null) {
      return
    }
    expect(innateAbilities(data)).toHaveLength(0)
    expect(standardAbilities(data)).toHaveLength(4)
    expect(data.innateAbilities).toBe(0)
  })

  it('нестандартное количество способностей не усекается и не дополняется', () => {
    for (const count of [4, 6, 9, 11, 14]) {
      const names = Array.from({ length: count }, (_unused, index) => `ability_${index}`)
      const data = parseHeroAbilityRecord(145, record(names), catalogOf(names))
      expect(data?.abilities).toHaveLength(count)
      expect(data?.innateAbilities).toBe(0)
      expect(standardAbilities(data!).length).toBe(count)
    }
  })

  it('способность без описания попадает в счётчик, но остаётся в группе', () => {
    const names = ['with_desc', 'without_desc']
    const catalog = catalogOf(names, { without_desc: { desc: '[object Object]' } })
    const data = parseHeroAbilityRecord(138, record(names), catalog)
    expect(data?.abilitiesWithoutDescription).toBe(1)
    expect(data?.abilities).toHaveLength(2)
    expect(standardAbilities(data!)).toHaveLength(2)
  })

  it('способности без dname считаются отдельно', () => {
    const names = ['named', 'unnamed']
    const catalog = catalogOf(names, { unnamed: { dname: undefined } })
    const data = parseHeroAbilityRecord(138, record(names), catalog)
    expect(data?.abilitiesWithoutDisplayName).toBe(1)
    expect(data?.abilities).toHaveLength(2)
  })
})

describe('таланты и фасеты', () => {
  it('активные фасеты без описания считаются, но не отбрасываются', () => {
    const data = parseHeroAbilityRecord(
      86,
      {
        abilities: ['a1'],
        facets: [
          { name: 'facet_with', title: 'With', description: 'Verified', deprecated: '0' },
          { name: 'facet_without', title: 'Without', description: '[object Object]', deprecated: '0' },
          { name: 'facet_gone', title: 'Gone', description: 'Old', deprecated: '1' },
        ],
      },
      catalogOf(['a1']),
    )
    expect(data?.facets).toHaveLength(2)
    expect(data?.facetsWithoutDescription).toBe(1)
    expect(data?.facets.map((facet) => facet.name)).toEqual(['facet_with', 'facet_without'])
  })

  it('устаревший фасет не попадает ни в список, ни в счётчик описаний', () => {
    const data = parseHeroAbilityRecord(
      86,
      {
        abilities: ['a1'],
        facets: [{ name: 'old', title: 'Old', description: null, deprecated: '1' }],
      },
      catalogOf(['a1']),
    )
    expect(data?.facets).toHaveLength(0)
    expect(data?.facetsWithoutDescription).toBe(0)
  })

  it('талант без подтверждённого целого уровня не принимается', () => {
    const catalog = catalogOf(['a1'])
    catalog.special_bonus_a = details({ dname: '+20 Movement Speed' })
    const data = parseHeroAbilityRecord(
      86,
      {
        abilities: ['a1'],
        talents: [
          { name: 'special_bonus_a', level: 2 },
          { name: 'special_bonus_b', level: '3' },
          { name: 'special_bonus_c' },
        ],
      },
      catalog,
    )
    expect(data?.talents).toHaveLength(1)
    expect(data?.talents[0]).toEqual({
      name: 'special_bonus_a',
      level: 2,
      displayName: '+20 Movement Speed',
    })
  })
})

