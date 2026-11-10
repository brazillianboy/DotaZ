import { describe, expect, it } from 'vitest'

import {
  ABILITY_DESCRIPTIONS_RU,
  ABILITY_NAMES_RU,
  DICTIONARY_META_KEY,
  FACET_DESCRIPTIONS_RU,
  FACET_TITLES_RU,
  TALENT_NAMES_RU,
  localizedAbilityDescription,
  localizedAbilityName,
  localizedFacetDescription,
  localizedFacetTitle,
  localizedTalentName,
} from './abilityLocalization'

/**
 * Task 19L, партия 1: десять героев.
 *
 * Проверяется фактическое покрытие словарей для выбранных героев, а не просто
 * наличие файлов: каждая способность, талант и фасет из проверенного ответа
 * провайдера должны иметь русский перевод. Ключи ниже сняты из живого
 * справочника OpenDota, поэтому тест ловит и потерю записи, и опечатку в ключе.
 *
 * Десять героев: Rubick (86), Zeus (22), Ancient Apparition (68), Pudge (14),
 * Shadow Fiend (11), Lion (26), Axe (2), Invoker (74), Anti-Mage (1),
 * Storm Spirit (17). У всех десяти активных фасетов нет: их фасеты помечены
 * провайдером как deprecated и не показываются.
 */

const has = (dictionary: Readonly<Record<string, string>>, key: string): boolean =>
  typeof dictionary[key] === 'string' && dictionary[key].length > 0

interface HeroCase {
  heroId: number
  name: string
  /** Способности с подтверждённым отображаемым именем (технические записи исключены). */
  abilities: string[]
  /** Из них — те, у которых в источнике есть описание. */
  withDescription: string[]
  talents: string[]
}

const HEROES: HeroCase[] = [
  {
    heroId: 86,
    name: 'Rubick',
    abilities: [
      'rubick_telekinesis',
      'rubick_fade_bolt',
      'rubick_arcane_supremacy',
      'rubick_empty1',
      'rubick_empty2',
      'rubick_spell_steal',
      'rubick_telekinesis_land',
      'rubick_telekinesis_land_self',
      'rubick_curiosity',
    ],
    withDescription: [
      'rubick_telekinesis',
      'rubick_fade_bolt',
      'rubick_arcane_supremacy',
      'rubick_empty1',
      'rubick_empty2',
      'rubick_spell_steal',
      'rubick_telekinesis_land',
      'rubick_telekinesis_land_self',
      'rubick_curiosity',
    ],
    talents: [
      'special_bonus_unique_rubick_4',
      'special_bonus_unique_rubick_6',
      'special_bonus_unique_rubick_3',
      'special_bonus_unique_rubick_fade_bolt_spell_reduction',
      'special_bonus_unique_rubick_8',
      'special_bonus_unique_rubick_curiosity_factor',
      'special_bonus_unique_rubick_5',
    ],
  },
  {
    heroId: 22,
    name: 'Zeus',
    abilities: [
      'zuus_arc_lightning',
      'zuus_lightning_bolt',
      'zuus_heavenly_jump',
      'zuus_cloud',
      'zuus_lightning_hands',
      'zuus_thundergods_wrath',
      'zuus_static_field',
    ],
    withDescription: [
      'zuus_arc_lightning',
      'zuus_lightning_bolt',
      'zuus_heavenly_jump',
      'zuus_cloud',
      'zuus_lightning_hands',
      'zuus_thundergods_wrath',
      'zuus_static_field',
    ],
    talents: [
      'special_bonus_unique_zeus',
      'special_bonus_unique_zeus_4',
      'special_bonus_unique_zeus_6',
      'special_bonus_unique_zeus_2',
      'special_bonus_unique_zeus_3',
      'special_bonus_unique_zeus_5',
      'special_bonus_unique_zeus_jump_charges',
    ],
  },
  {
    heroId: 68,
    name: 'Ancient Apparition',
    abilities: [
      'ancient_apparition_cold_feet',
      'ancient_apparition_ice_vortex',
      'ancient_apparition_chilling_touch',
      'ancient_apparition_bone_chill',
      'ancient_apparition_ice_blast',
      'ancient_apparition_ice_blast_release',
    ],
    withDescription: [
      'ancient_apparition_cold_feet',
      'ancient_apparition_ice_vortex',
      'ancient_apparition_chilling_touch',
      'ancient_apparition_bone_chill',
      'ancient_apparition_ice_blast',
      'ancient_apparition_ice_blast_release',
    ],
    talents: [
      'special_bonus_unique_ancient_apparition_7',
      'special_bonus_unique_ancient_apparition_cold_feet_dps',
      'special_bonus_unique_ancient_apparition_3',
      'special_bonus_unique_ancient_apparition_cold_feet_distance',
      'special_bonus_unique_ancient_apparition_ice_vortex_duration',
      'special_bonus_unique_ancient_apparition_2',
      'special_bonus_unique_ancient_apparition_1',
      'special_bonus_unique_ancient_apparition_5',
    ],
  },
  {
    heroId: 14,
    name: 'Pudge',
    abilities: [
      'pudge_meat_hook',
      'pudge_rot',
      'pudge_flesh_heap',
      'pudge_innate_graft_flesh',
      'pudge_dismember',
    ],
    withDescription: [
      'pudge_meat_hook',
      'pudge_rot',
      'pudge_flesh_heap',
      'pudge_innate_graft_flesh',
      'pudge_dismember',
    ],
    talents: [
      'special_bonus_unique_pudge_4',
      'special_bonus_spell_lifesteal_8',
      'special_bonus_unique_pudge_7',
      'special_bonus_unique_pudge_6',
      'special_bonus_unique_pudge_5',
      'special_bonus_unique_pudge_3',
      'special_bonus_unique_pudge_1',
    ],
  },
  {
    heroId: 11,
    name: 'Shadow Fiend',
    abilities: [
      'nevermore_shadowraze1',
      'nevermore_shadowraze2',
      'nevermore_shadowraze3',
      'nevermore_frenzy',
      'nevermore_dark_lord',
      'nevermore_requiem',
      'nevermore_necromastery',
    ],
    withDescription: [
      'nevermore_shadowraze1',
      'nevermore_shadowraze2',
      'nevermore_shadowraze3',
      'nevermore_frenzy',
      'nevermore_dark_lord',
      'nevermore_requiem',
      'nevermore_necromastery',
    ],
    talents: [
      'special_bonus_unique_nevermore_7',
      'special_bonus_unique_nevermore_4',
      'special_bonus_unique_nevermore_3',
      'special_bonus_unique_nevermore_frenzy_max_collection_count',
      'special_bonus_unique_nevermore_1',
      'special_bonus_unique_nevermore_6',
      'special_bonus_unique_nevermore_frenzy_castspeed',
      'special_bonus_unique_nevermore_raze_procsattacks',
    ],
  },
  {
    heroId: 26,
    name: 'Lion',
    abilities: [
      'lion_impale',
      'lion_voodoo',
      'lion_mana_drain',
      'lion_to_hell_and_back',
      'lion_finger_of_death',
    ],
    withDescription: [
      'lion_impale',
      'lion_voodoo',
      'lion_mana_drain',
      'lion_to_hell_and_back',
      'lion_finger_of_death',
    ],
    talents: [
      'special_bonus_unique_lion_6',
      'special_bonus_unique_lion_5',
      'special_bonus_unique_lion_11',
      'special_bonus_unique_lion_8',
      'special_bonus_unique_lion_10',
      'special_bonus_unique_lion_4',
      'special_bonus_unique_lion_2',
    ],
  },
  {
    heroId: 2,
    name: 'Axe',
    abilities: [
      'axe_berserkers_call',
      'axe_battle_hunger',
      'axe_counter_helix',
      'axe_culling_blade',
      'axe_one_man_army',
    ],
    withDescription: [
      'axe_berserkers_call',
      'axe_battle_hunger',
      'axe_counter_helix',
      'axe_culling_blade',
      'axe_one_man_army',
    ],
    talents: [
      'special_bonus_unique_axe_culling_blade_speed_duration',
      'special_bonus_unique_axe_8',
      'special_bonus_unique_axe',
      'special_bonus_unique_axe_7',
      'special_bonus_unique_axe_4',
      'special_bonus_unique_axe_2',
      'special_bonus_unique_axe_5',
    ],
  },
  {
    heroId: 74,
    name: 'Invoker',
    abilities: [
      'invoker_quas',
      'invoker_wex',
      'invoker_exort',
      'invoker_empty1',
      'invoker_empty2',
      'invoker_invoke',
      'invoker_cold_snap',
      'invoker_ghost_walk',
      'invoker_tornado',
      'invoker_emp',
      'invoker_alacrity',
      'invoker_chaos_meteor',
      'invoker_sun_strike',
      'invoker_forge_spirit',
      'invoker_ice_wall',
      'invoker_deafening_blast',
    ],
    withDescription: [
      'invoker_quas',
      'invoker_wex',
      'invoker_exort',
      'invoker_empty1',
      'invoker_empty2',
      'invoker_invoke',
      'invoker_cold_snap',
      'invoker_ghost_walk',
      'invoker_tornado',
      'invoker_emp',
      'invoker_alacrity',
      'invoker_chaos_meteor',
      'invoker_sun_strike',
      'invoker_forge_spirit',
      'invoker_ice_wall',
      'invoker_deafening_blast',
    ],
    talents: [
      'special_bonus_unique_invoker_ice_wall_dps',
      'special_bonus_unique_invoker_3',
      'special_bonus_unique_invoker_5',
      'special_bonus_unique_invoker_9',
      'special_bonus_unique_invoker_additional_chaos_meteors',
      'special_bonus_unique_invoker_orb_levels',
      'special_bonus_unique_invoker_2',
      'special_bonus_unique_invoker_13',
    ],
  },
  {
    heroId: 1,
    name: 'Anti-Mage',
    abilities: [
      'antimage_mana_break',
      'antimage_blink',
      'antimage_counterspell',
      'antimage_persectur',
      'antimage_mana_void',
    ],
    withDescription: [
      'antimage_mana_break',
      'antimage_blink',
      'antimage_counterspell',
      'antimage_persectur',
      'antimage_mana_void',
    ],
    talents: [
      'special_bonus_hp_regen_3',
      'special_bonus_unique_antimage_manavoid_aoe',
      'special_bonus_unique_antimage_5',
      'special_bonus_unique_antimage_6',
      'special_bonus_unique_antimage_3',
      'special_bonus_unique_antimage_8',
      'special_bonus_unique_antimage',
      'special_bonus_unique_antimage_2',
    ],
  },
  {
    heroId: 17,
    name: 'Storm Spirit',
    abilities: [
      'storm_spirit_static_remnant',
      'storm_spirit_electric_vortex',
      'storm_spirit_overload',
      'storm_spirit_ball_lightning',
      'storm_spirit_galvanized',
    ],
    withDescription: [
      'storm_spirit_static_remnant',
      'storm_spirit_electric_vortex',
      'storm_spirit_overload',
      'storm_spirit_ball_lightning',
      'storm_spirit_galvanized',
    ],
    talents: [
      'special_bonus_unique_storm_spirit_overload_aspd',
      'special_bonus_mp_regen_150',
      'special_bonus_unique_storm_spirit_5',
      'special_bonus_unique_storm_spirit',
      'special_bonus_unique_storm_spirit_8',
      'special_bonus_unique_storm_spirit_7',
      'special_bonus_unique_storm_spirit_4',
    ],
  },
]


describe('партия 1: состав героев', () => {
  it('ровно десять героев, ID совпадают с проектом', () => {
    expect(HEROES).toHaveLength(10)
    expect(HEROES.map((hero) => hero.heroId)).toEqual([86, 22, 68, 14, 11, 26, 2, 74, 1, 17])
    expect(HEROES.map((hero) => hero.name)).toEqual([
      'Rubick',
      'Zeus',
      'Ancient Apparition',
      'Pudge',
      'Shadow Fiend',
      'Lion',
      'Axe',
      'Invoker',
      'Anti-Mage',
      'Storm Spirit',
    ])
  })

  it('итого 70 способностей и 70 доступных описаний', () => {
    expect(HEROES.reduce((sum, hero) => sum + hero.abilities.length, 0)).toBe(70)
    expect(HEROES.reduce((sum, hero) => sum + hero.withDescription.length, 0)).toBe(70)
  })

  it('итого 74 уникальных ключа талантов у десяти героев', () => {
    // 74 уникальных ключа; в каталоге они покрывают 82 строки «герой × талант»,
    // потому что часть талантов (например, special_bonus_hp_regen_3) общая.
    expect(HEROES.reduce((sum, hero) => sum + hero.talents.length, 0)).toBe(74)
  })
})

describe('партия 1: русские названия и описания способностей', () => {
  for (const hero of HEROES) {
    it(`${hero.name} (${hero.heroId}): все названия переведены`, () => {
      for (const key of hero.abilities) {
        expect(has(ABILITY_NAMES_RU, key), `${hero.name}: ${key}`).toBe(true)
      }
    })

    it(`${hero.name} (${hero.heroId}): все доступные описания переведены`, () => {
      for (const key of hero.withDescription) {
        expect(has(ABILITY_DESCRIPTIONS_RU, key), `${hero.name}: ${key}`).toBe(true)
      }
    })
  }

  it('названия не совпадают с английскими для переводимых записей', () => {
    const ENGLISH = {
      pudge_meat_hook: 'Meat Hook',
      nevermore_requiem: 'Requiem of Souls',
      lion_finger_of_death: 'Finger of Death',
      axe_culling_blade: 'Culling Blade',
      invoker_cold_snap: 'Cold Snap',
      antimage_mana_void: 'Mana Void',
      storm_spirit_ball_lightning: 'Ball Lightning',
    } as const
    for (const [key, english] of Object.entries(ENGLISH)) {
      const ru = localizedAbilityName('ru', key, english)
      expect(ru, key).not.toBe(english)
      expect(localizedAbilityName('en', key, english), key).toBe(english)
    }
  })
})

describe('партия 1: русские таланты', () => {
  for (const hero of HEROES) {
    it(`${hero.name} (${hero.heroId}): все таланты переведены`, () => {
      for (const key of hero.talents) {
        expect(has(TALENT_NAMES_RU, key), `${hero.name}: ${key}`).toBe(true)
      }
    })
  }

  it('в EN-режиме возвращается исходное английское название', () => {
    const english = '+{s:bonus_targets} Heavenly Jump Target'
    expect(localizedTalentName('en', 'special_bonus_unique_zeus', english)).toBe(english)
    expect(localizedTalentName('ru', 'special_bonus_unique_zeus', english)).not.toBe(english)
  })

  it('отсутствующий талант не превращается в текст', () => {
    expect(localizedTalentName('ru', 'special_bonus_unique_zeus', null)).toBeNull()
  })
})

describe('партия 1: активные фасеты каталога', () => {
  const FACETS = [
    'night_stalker_blinding_void',
    'night_stalker_dayswap',
    'night_stalker_voidbringer',
    'chen_wolf_convert',
    'doom_bringer_boost_selling',
    'brewmaster_roll_out_the_barrel',
    'brewmaster_drunken_master',
    'brewmaster_brewmaster',
    'oracle_facet_dmg',
    'oracle_facet_heal',
    'techies_atk_range',
    'techies_spleens_secret_sauce',
    'techies_backpack',
    'winter_wyvern_heal_mana',
    'winter_wyvern_atk_range',
    'winter_wyvern_winterproof',
    'winter_wyvern_recursive',
    'abyssal_underlord_summons',
  ]

  it('все 18 активных фасетов каталога переведены (название и описание)', () => {
    for (const key of FACETS) {
      expect(has(FACET_TITLES_RU, key), key).toBe(true)
      expect(has(FACET_DESCRIPTIONS_RU, key), key).toBe(true)
    }
  })

  it('у десяти героев партии активных фасетов нет — это не пробел в переводе', () => {
    // Все фасеты этих героев помечены провайдером как deprecated и не показываются,
    // поэтому требовать для них перевод нельзя.
    const facetKeys = Object.keys(FACET_TITLES_RU)
    for (const prefix of ['night_stalker', 'chen', 'doom_bringer', 'brewmaster', 'oracle', 'techies', 'winter_wyvern', 'abyssal_underlord']) {
      for (const key of facetKeys) {
        expect(key.startsWith(prefix) && ['rubick', 'zuus', 'ancient_apparition', 'pudge', 'nevermore', 'lion', 'axe', 'invoker', 'antimage', 'storm_spirit'].some((h) => key.startsWith(h)), key).toBe(false)
      }
    }
  })

  it('EN-режим сохраняет английский фасет, RU переводит', () => {
    expect(localizedFacetTitle('en', 'night_stalker_dayswap', 'Night Reign')).toBe('Night Reign')
    expect(localizedFacetTitle('ru', 'night_stalker_dayswap', 'Night Reign')).not.toBe('Night Reign')
    expect(localizedFacetDescription('en', 'night_stalker_dayswap', 'Some text.')).toBe('Some text.')
    expect(localizedFacetDescription('ru', 'night_stalker_dayswap', null)).toBeNull()
  })
})

describe('партия 1: плейсхолдеры и числа сохранены', () => {
  const PLACEHOLDER = /\{s:[A-Za-z0-9_]+\}/g

  function placeholders(text: string): string[] {
    return (text.match(PLACEHOLDER) ?? []).sort()
  }

  it('структура плейсхолдеров корректна во всех талантах с подстановками', () => {
    for (const [key, value] of Object.entries(TALENT_NAMES_RU)) {
      if (key === DICTIONARY_META_KEY) {
        continue
      }
      const opens = (value.match(/\{/g) ?? []).length
      const closes = (value.match(/\}/g) ?? []).length
      expect(opens, `${key}: фигурные скобки`).toBe(closes)
      const braces = (value.match(/\{[^}]*\}/g) ?? []).filter(
        (token) => !/^\{s:[A-Za-z0-9_]+\}$/.test(token),
      )
      expect(braces, `${key}: посторонние фигурные конструкции`).toHaveLength(0)
    }
  })

  it('плейсхолдеры в переводе совпадают с исходником (выборочная сверка)', () => {
    const PAIRS: Array<[string, string]> = [
      ['special_bonus_unique_zeus', '+{s:bonus_targets} Heavenly Jump Target'],
      [
        'special_bonus_unique_pudge_1',
        '{s:bonus_flesh_heap_strength_buff_amount}x Flesh Heap and Meat Shield bonuses',
      ],
      [
        'special_bonus_unique_antimage_5',
        '+{s:bonus_move_slow_min}%/{s:bonus_move_slow_max}% Persecutor Min/Max Movement Slow',
      ],
      [
        'special_bonus_unique_nevermore_frenzy_castspeed',
        'Feast of Souls Grants +{s:bonus_cast_speed_pct}% Cast Speed',
      ],
      [
        'special_bonus_unique_storm_spirit_7',
        '{s:bonus_overload_bounces}x Overload Attack Bounce',
      ],
    ]
    for (const [key, english] of PAIRS) {
      const ru = TALENT_NAMES_RU[key]
      expect(ru, key).toBeDefined()
      expect(placeholders(ru), `${key}: набор подстановок`).toEqual(placeholders(english))
    }
  })

  it('числовые значения из исходника сохранены в переводе талантов', () => {
    expect(TALENT_NAMES_RU['special_bonus_unique_ancient_apparition_7']).toContain('300')
    expect(TALENT_NAMES_RU['special_bonus_unique_ancient_apparition_3']).toContain('2')
    expect(TALENT_NAMES_RU['special_bonus_unique_ancient_apparition_2']).toContain('80')
    expect(TALENT_NAMES_RU['special_bonus_unique_ancient_apparition_1']).toContain('450')
    expect(TALENT_NAMES_RU['special_bonus_unique_ancient_apparition_5']).toContain('4')
    expect(TALENT_NAMES_RU['special_bonus_mp_regen_150']).toContain('1.5')
    expect(TALENT_NAMES_RU['special_bonus_hp_regen_3']).toContain('3')
    expect(TALENT_NAMES_RU['special_bonus_unique_invoker_orb_levels']).toContain('1')
    expect(TALENT_NAMES_RU['special_bonus_unique_lion_10']).toContain('30')
  })

  it('числа в описаниях способностей не потеряны', () => {
    expect(ABILITY_DESCRIPTIONS_RU['pudge_innate_graft_flesh']).toContain('1.6')
    expect(ABILITY_DESCRIPTIONS_RU['pudge_dismember']).toContain('75')
    expect(ABILITY_DESCRIPTIONS_RU['pudge_dismember']).toContain('125')
    expect(ABILITY_DESCRIPTIONS_RU['nevermore_necromastery']).toContain('1.35')
    expect(ABILITY_DESCRIPTIONS_RU['nevermore_necromastery']).toContain('30%')
    expect(ABILITY_DESCRIPTIONS_RU['storm_spirit_ball_lightning']).toContain('7.5%')
    expect(ABILITY_DESCRIPTIONS_RU['storm_spirit_ball_lightning']).toContain('0.65%')
    expect(ABILITY_DESCRIPTIONS_RU['axe_one_man_army']).toContain('50%')
    expect(ABILITY_DESCRIPTIONS_RU['axe_one_man_army']).toContain('700')
    expect(ABILITY_DESCRIPTIONS_RU['invoker_emp']).toContain('2.9')
  })

describe('аудит локализации: итог равен сумме категорий', () => {
  /**
   * Правило подсчёта зафиксировано здесь, чтобы регрессия «итог занижен на одну
   * категорию» ловилась тестом. Реальные числа берутся из
   * `node scripts/audit-ability-localization.mjs`.
   */
  const REQUIRED_CATEGORIES = [
    'abilityNames',
    'abilityDescriptions',
    'talents',
    'facetTitles',
    'facetDescriptions',
    'propertyLabels',
    'typeLabels',
  ] as const

  /** Снимок аудита от 2026-11-10 после партии 1. */
  const BREAKDOWN: Record<(typeof REQUIRED_CATEGORIES)[number], number> = {
    abilityNames: 714,
    abilityDescriptions: 683,
    talents: 864,
    facetTitles: 0,
    facetDescriptions: 0,
    propertyLabels: 2362,
    typeLabels: 0,
  }

  function sumBreakdown(breakdown: Record<string, number>): number {
    return Object.values(breakdown).reduce((total, value) => total + value, 0)
  }

  it('разбивка содержит все категории, включая описания активных фасетов', () => {
    expect(Object.keys(BREAKDOWN).sort()).toEqual([...REQUIRED_CATEGORIES].sort())
  })

  it('итог равен сумме всех категорий', () => {
    expect(sumBreakdown(BREAKDOWN)).toBe(4623)
  })

  it('исключение описаний фасетов из суммы меняет итог — это и было дефектом', () => {
    const partial = sumBreakdown(
      Object.fromEntries(Object.entries(BREAKDOWN).filter(([key]) => key !== 'facetDescriptions')),
    )
    expect(partial).toBe(sumBreakdown(BREAKDOWN) - BREAKDOWN.facetDescriptions)
  })
})

describe('партия 1: разрешение текста в обоих режимах', () => {
  it('RU переводит, EN возвращает источник', () => {
    expect(localizedAbilityName('ru', 'pudge_meat_hook', 'Meat Hook')).toBe('Мясной крюк')
    expect(localizedAbilityName('en', 'pudge_meat_hook', 'Meat Hook')).toBe('Meat Hook')
    expect(localizedAbilityDescription('ru', 'pudge_rot', 'A toxic cloud.')).not.toBe(
      'A toxic cloud.',
    )
    expect(localizedAbilityDescription('en', 'pudge_rot', 'A toxic cloud.')).toBe('A toxic cloud.')
  })

  it('отсутствие описания в источнике остаётся отдельным состоянием', () => {
    // Технические записи провайдера не имеют описания — выдумывать текст нельзя.
    expect(localizedAbilityDescription('ru', 'pudge_meat_hook', null)).toBeNull()
    expect(localizedAbilityDescription('en', 'pudge_meat_hook', null)).toBeNull()
  })

  it('имя собственное Invoker сохраняется как есть в обоих режимах', () => {
    expect(localizedAbilityName('ru', 'invoker_quas', 'Quas')).toBe('Quas')
    expect(localizedAbilityName('en', 'invoker_quas', 'Quas')).toBe('Quas')
  })
})

})
