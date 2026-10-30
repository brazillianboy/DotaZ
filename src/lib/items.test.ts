import { describe, expect, it } from 'vitest'

import {
  ALWAYS_INCLUDED_ITEM_KEYS,
  BASIC_BOOTS_KEY,
  BOOTS_UPGRADE_ITEM_KEYS,
  BOTTLE_KEY,
  COMPLETED_ITEM_CATALOG,
  COMPONENT_ITEM_CATALOG,
  ITEM_NAME_OVERRIDES,
  ORDINARY_CONSUMABLE_KEYS,
  buildMatchItems,
  classifyPurchaseItem,
  filterEarlyGamePurchases,
  hasConfirmedBootsUpgrade,
  isAlwaysIncludedItem,
  isCompletedItem,
  isComponentItem,
  isDisplayedInEarlyGame,
  isDisplayedInFullMatch,
  isRecipeKey,
  isUnknownItemKey,
  itemDisplayName,
  itemIconUrl,
} from './items'

/**
 * Тесты фильтрации предметов (Task 14).
 *
 * Проверяются: словарь имён (сверен с живым справочником OpenDota), политика ранней
 * стадии 00:00–15:00, отдельная политика секции за весь матч, правило базовых
 * Boots of Speed с подтверждённым улучшением, хронологический порядок и сохранение
 * повторных покупок.
 */

const NO_BOOTS_UPGRADE = { hasBootsUpgrade: false }
const WITH_BOOTS_UPGRADE = { hasBootsUpgrade: true }

describe('Имена предметов (сверены с живым справочником OpenDota)', () => {
  it("показывает «Aghanim's Scepter» вместо ошибочного «Ultimate Scepter»", () => {
    expect(itemDisplayName('ultimate_scepter')).toBe("Aghanim's Scepter")
    expect(itemDisplayName('ultimate_scepter')).not.toBe('Ultimate Scepter')
  })

  it("строит иконку Aghanim's Scepter по проверенному пути CDN", () => {
    expect(itemIconUrl('ultimate_scepter')).toBe(
      'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ultimate_scepter.png',
    )
  })

  it('совпадает с dname провайдера для ключевых предметов', () => {
    const expected: Array<[string, string]> = [
      ['ultimate_scepter', "Aghanim's Scepter"],
      ['aghanims_shard', "Aghanim's Shard"],
      ['aghanims_shard_roshan', "Aghanim's Shard - Consumable"],
      ['blink', 'Blink Dagger'],
      ['boots', 'Boots of Speed'],
      ['power_treads', 'Power Treads'],
      ['phase_boots', 'Phase Boots'],
      ['arcane_boots', 'Arcane Boots'],
      ['tranquil_boots', 'Tranquil Boots'],
      ['travel_boots', 'Boots of Travel'],
      ['travel_boots_2', 'Boots of Travel 2'],
      ['guardian_greaves', 'Guardian Greaves'],
      ['boots_of_bearing', 'Boots of Bearing'],
      ['arcane_blink', 'Arcane Blink'],
      ['ancient_janggo', 'Drum of Endurance'],
      ['gungir', 'Gleipnir'],
      ['skadi', 'Eye of Skadi'],
      ['yasha_and_kaya', 'Yasha and Kaya'],
      ['sphere', "Linken's Sphere"],
      ['shivas_guard', "Shiva's Guard"],
      ['bottle', 'Bottle'],
      ['cheese', 'Cheese'],
      ['royale_with_cheese', 'Block of Cheese'],
      ['refresher_shard', 'Refresher Shard'],
    ]

    for (const [key, name] of expected) {
      expect(itemDisplayName(key), key).toBe(name)
    }
  })

  it('не содержит «мёртвых» ключей, которых нет у провайдера', () => {
    for (const key of [
      'bkb',
      'aghanims_scepter',
      'midas',
      'shadow_blade',
      'blink_dagger',
      'spirit_breaker',
      'drums_of_endurance',
      'eye_of_skadi',
      'gleipnir',
      'yasha_and_kasha',
      'skull_basher',
    ]) {
      expect(ITEM_NAME_OVERRIDES[key], key).toBeUndefined()
      expect(COMPONENT_ITEM_CATALOG, key).not.toContain(key)
      expect(COMPLETED_ITEM_CATALOG, key).not.toContain(key)
    }
  })
})

describe('Политика ранней стадии 00:00–15:00', () => {
  it('включает компоненты, собранные предметы и явные исключения', () => {
    for (const key of [
      'branches',
      'circlet',
      'gloves',
      'boots',
      'magic_stick',
      'mithril_hammer',
      'magic_wand',
      'power_treads',
      'blink',
      'black_king_bar',
      'ultimate_scepter',
      'bottle',
      'aghanims_shard',
      'refresher_shard',
      'cheese',
      'royale_with_cheese',
    ]) {
      expect(isDisplayedInEarlyGame(key), key).toBe(true)
    }
  })

  it('исключает обычные расходники, варды, дым, даст и TP, а также рецепты', () => {
    for (const key of [
      'tango',
      'clarity',
      'flask',
      'enchanted_mango',
      'faerie_fire',
      'ward_observer',
      'ward_sentry',
      'smoke_of_deceit',
      'dust',
      'tpscroll',
      'recipe_magic_wand',
      'blink_recipe',
    ]) {
      expect(isDisplayedInEarlyGame(key), key).toBe(false)
    }
  })

  it('показывает неклассифицированные ключи (безопасный фолбэк)', () => {
    expect(isDisplayedInEarlyGame('unknown_future_item')).toBe(true)
    expect(isUnknownItemKey('unknown_future_item')).toBe(true)
    expect(isDisplayedInEarlyGame('')).toBe(false)
  })

  it('сохраняет хронологический порядок и повторные покупки', () => {
    const log = [
      { time: 10, key: 'branches' },
      { time: 20, key: 'tango' },
      { time: 30, key: 'branches' },
      { time: 40, key: 'ward_observer' },
      { time: 50, key: 'blink' },
    ]

    expect(filterEarlyGamePurchases(log)).toEqual([
      { time: 10, key: 'branches' },
      { time: 30, key: 'branches' },
      { time: 50, key: 'blink' },
    ])
  })

  it('различает отсутствующий журнал (null) и журнал без отображаемых предметов ([])', () => {
    expect(filterEarlyGamePurchases(null)).toBeNull()
    expect(filterEarlyGamePurchases([{ time: 10, key: 'tango' }])).toEqual([])
  })
})

describe('Политика секции за весь матч', () => {
  it('показывает только собранные предметы, Bottle и базовые сапоги без улучшения', () => {
    for (const key of [
      'magic_wand',
      'power_treads',
      'arcane_boots',
      'blink',
      'black_king_bar',
      'ultimate_scepter',
      'aghanims_shard',
    ]) {
      expect(isDisplayedInFullMatch(key, NO_BOOTS_UPGRADE), key).toBe(true)
    }
    expect(isDisplayedInFullMatch(BOTTLE_KEY, NO_BOOTS_UPGRADE)).toBe(true)
    expect(isDisplayedInFullMatch(BASIC_BOOTS_KEY, NO_BOOTS_UPGRADE)).toBe(true)
  })

  it('скрывает компоненты, расходники, рецепты и исключения ранней стадии', () => {
    for (const key of [
      'branches',
      'gloves',
      'mithril_hammer',
      'magic_stick',
      'circlet',
      'pavise',
      'tango',
      'clarity',
      'ward_observer',
      'dust',
      'smoke_of_deceit',
      'tpscroll',
      'recipe_magic_wand',
      'refresher_shard',
      'cheese',
      'royale_with_cheese',
    ]) {
      expect(isDisplayedInFullMatch(key, NO_BOOTS_UPGRADE), key).toBe(false)
    }
  })

  it('скрывает неклассифицированные ключи (консервативный фолбэк)', () => {
    expect(isDisplayedInFullMatch('unknown_future_item', NO_BOOTS_UPGRADE)).toBe(false)
    expect(isDisplayedInFullMatch('', NO_BOOTS_UPGRADE)).toBe(false)
  })

  it('скрывает базовые сапоги при подтверждённом улучшении', () => {
    expect(isDisplayedInFullMatch(BASIC_BOOTS_KEY, WITH_BOOTS_UPGRADE)).toBe(false)
  })

  it('распознаёт все подтверждённые апгрейды базовых сапог', () => {
    expect(BOOTS_UPGRADE_ITEM_KEYS).toEqual([
      'power_treads',
      'phase_boots',
      'arcane_boots',
      'tranquil_boots',
      'travel_boots',
      'travel_boots_2',
      'guardian_greaves',
      'boots_of_bearing',
    ])
    for (const key of BOOTS_UPGRADE_ITEM_KEYS) {
      expect(hasConfirmedBootsUpgrade([{ time: 100, key }]), key).toBe(true)
      expect(isCompletedItem(key), key).toBe(true)
    }
    expect(hasConfirmedBootsUpgrade([{ time: 100, key: 'branches' }])).toBe(false)
  })
})

describe('Предметы за матч: сборка списка', () => {
  it('показывает собранные предметы, Bottle и базовые сапоги без улучшения', () => {
    const items = buildMatchItems([
      { time: -80, key: 'branches' },
      { time: 120, key: 'boots' },
      { time: 200, key: 'magic_wand' },
      { time: 700, key: 'bottle' },
      { time: 900, key: 'cheese' },
      { time: 1200, key: 'dragon_lance' },
      { time: 2400, key: 'ultimate_scepter' },
    ])

    expect(items?.map((item) => item.key)).toEqual([
      'boots',
      'magic_wand',
      'bottle',
      'dragon_lance',
      'ultimate_scepter',
    ])
    expect(items?.find((item) => item.key === 'boots')?.name).toBe('Boots of Speed')
    expect(items?.find((item) => item.key === 'ultimate_scepter')?.name).toBe("Aghanim's Scepter")
  })

  it('скрывает базовые сапоги и показывает апгрейд (Power Treads)', () => {
    const items = buildMatchItems([
      { time: 120, key: 'boots' },
      { time: 400, key: 'power_treads' },
    ])

    expect(items?.map((item) => item.key)).toEqual(['power_treads'])
  })

  it('скрывает базовые сапоги при улучшении в Arcane Boots', () => {
    const items = buildMatchItems([
      { time: 100, key: 'boots' },
      { time: 500, key: 'arcane_boots' },
    ])

    expect(items?.map((item) => item.key)).toEqual(['arcane_boots'])
  })

  it('показывает базовые сапоги, если улучшения в журнале нет', () => {
    const items = buildMatchItems([
      { time: 100, key: 'boots' },
      { time: 300, key: 'branches' },
    ])

    expect(items?.map((item) => item.key)).toEqual(['boots'])
  })

  it('берёт время первой покупки и сортирует по времени', () => {
    const items = buildMatchItems([
      { time: 1500, key: 'black_king_bar' },
      { time: 700, key: 'blink' },
      { time: 900, key: 'blink' },
      { time: 100, key: 'magic_wand' },
    ])

    expect(items?.map((item) => item.key)).toEqual(['magic_wand', 'blink', 'black_king_bar'])
    expect(items?.find((item) => item.key === 'blink')?.time).toBe(700)
  })

  it('возвращает null без журнала и пустой список, если значимых предметов нет', () => {
    expect(buildMatchItems(null)).toBeNull()
    expect(
      buildMatchItems([
        { time: 10, key: 'tango' },
        { time: 20, key: 'branches' },
        { time: 30, key: 'branches_recipe' },
      ]),
    ).toEqual([])
  })

  it('не изменяет исходный журнал покупок', () => {
    const log = [
      { time: 120, key: 'boots' },
      { time: 400, key: 'power_treads' },
      { time: 500, key: 'tango' },
    ]
    const snapshot = JSON.stringify(log)

    buildMatchItems(log)
    filterEarlyGamePurchases(log)

    expect(JSON.stringify(log)).toBe(snapshot)
  })
})

describe('Классификация и каталоги', () => {
  it('различает категории предметов', () => {
    expect(classifyPurchaseItem('branches')).toBe('component')
    expect(classifyPurchaseItem('blink')).toBe('completed')
    expect(classifyPurchaseItem('tango')).toBe('consumable')
    expect(classifyPurchaseItem('recipe_blink')).toBe('recipe')
    expect(classifyPurchaseItem('bottle')).toBe('included-exception')
    expect(classifyPurchaseItem('unknown_future_item')).toBe('unclassified')
  })

  it('сохраняет хелперы классификации', () => {
    expect(isComponentItem('branches')).toBe(true)
    expect(isCompletedItem('ultimate_scepter')).toBe(true)
    expect(isAlwaysIncludedItem('cheese')).toBe(true)
    expect(isRecipeKey('blink_recipe')).toBe(true)
  })

  it('не содержит дубликатов и пересечений между каталогами', () => {
    expect(new Set(COMPONENT_ITEM_CATALOG).size).toBe(COMPONENT_ITEM_CATALOG.length)
    expect(new Set(COMPLETED_ITEM_CATALOG).size).toBe(COMPLETED_ITEM_CATALOG.length)

    const overlap = COMPONENT_ITEM_CATALOG.filter((key) => COMPLETED_ITEM_CATALOG.includes(key))
    expect(overlap).toEqual([])
  })

  it('не содержит исключений и расходников внутри каталогов', () => {
    for (const key of [...ALWAYS_INCLUDED_ITEM_KEYS, ...ORDINARY_CONSUMABLE_KEYS]) {
      expect(COMPONENT_ITEM_CATALOG, key).not.toContain(key)
      expect(COMPLETED_ITEM_CATALOG, key).not.toContain(key)
    }
  })
})