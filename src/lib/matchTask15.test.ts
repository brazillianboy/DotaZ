import { describe, expect, it } from 'vitest'

import {
  ABILITY_ICON_BASE,
  TALENT_NAME_PREFIX,
  abilityEntry,
  buildAbilityCatalog,
  buildAbilityTimeline,
  resetAbilityCatalogCache,
} from './abilities'
import { heroCatalogSize, heroImageUrl, heroInfo, heroName, isKnownHero } from './heroes'
import { inventoryItem, inventoryItems, itemKeyFromId } from './inventory'
import {
  gameModeKey,
  gameModeSlug,
  matchAgeDays,
  matchScore,
  regionName,
  startTimeToIso,
} from './matchMeta'
import { normalizeMatch } from './normalizeMatch'

/**
 * Тесты справочников и метаданных Task 15: герои, инвентарь, режим/регион, счёт,
 * справочник способностей и последовательность прокачки.
 */

const ABILITY_IDS_FIXTURE = {
  '5019': 'drow_ranger_frost_arrows',
  '343': 'drow_ranger_multishot',
  '6027': 'special_bonus_attack_range_75',
}

const ABILITIES_FIXTURE = {
  drow_ranger_frost_arrows: { dname: 'Frost Arrows' },
  drow_ranger_multishot: { dname: 'Multishot' },
  special_bonus_attack_range_75: { dname: '+75 Attack Range' },
}

describe('Справочник героев', () => {
  it('содержит проверенный каталог и корректные портреты', () => {
    expect(heroCatalogSize()).toBe(127)
    expect(heroName(6)).toBe('Drow Ranger')
    expect(heroImageUrl(6)).toBe(
      'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/drow_ranger.png',
    )
    expect(isKnownHero(6)).toBe(true)
  })

  it('неизвестный герой не выдумывается и не даёт битой картинки', () => {
    expect(heroName(9999)).toBeNull()
    expect(heroImageUrl(9999)).toBeNull()
    expect(heroInfo(null)).toBeNull()
    expect(isKnownHero(null)).toBe(false)
  })
})

describe('Инвентарь: ID → предмет', () => {
  it('преобразует подтверждённые ID в предметы с именами и иконками', () => {
    expect(itemKeyFromId(63)).toBe('power_treads')
    expect(inventoryItem(108)?.name).toBe("Aghanim's Scepter")
    expect(inventoryItems([63, 147, 0, null])?.map((item) => item.key)).toEqual([
      'power_treads',
      'manta',
    ])
  })

  it('неизвестные и пустые ID не показываются', () => {
    expect(itemKeyFromId(999999)).toBeNull()
    expect(inventoryItem(0)).toBeNull()
    expect(inventoryItems(null)).toBeNull()
    expect(inventoryItems([])).toEqual([])
  })
})

describe('Метаданные матча', () => {
  it('берёт счёт из подтверждённых полей провайдера', () => {
    const match = normalizeMatch({ radiant_score: 56, dire_score: 22 })

    expect(matchScore(match)).toEqual({ radiant: 56, dire: 22, source: 'provider' })
  })

  it('считает счёт по игрокам только при полных данных 5 + 5', () => {
    const players = Array.from({ length: 10 }, (_, index) => ({
      player_slot: index < 5 ? index : index + 123,
      kills: 1,
    }))

    expect(matchScore(normalizeMatch({ players }))).toEqual({
      radiant: 5,
      dire: 5,
      source: 'players',
    })
    expect(matchScore(normalizeMatch({ players: players.slice(0, 9) }))).toEqual({
      radiant: null,
      dire: null,
      source: null,
    })
  })

  it('не считает счёт при неподтверждённых убийствах', () => {
    const players = Array.from({ length: 10 }, (_, index) => ({
      player_slot: index < 5 ? index : index + 123,
    }))

    expect(matchScore(normalizeMatch({ players })).source).toBeNull()
  })

  it('режим и регион берутся из проверенных справочников', () => {
    expect(gameModeKey(22)).toBe('game_mode_all_draft')
    expect(gameModeSlug(22)).toBe('all_draft')
    expect(gameModeSlug(1234)).toBeNull()
    expect(regionName(3)).toBe('EUROPE')
    expect(regionName(999)).toBeNull()
  })

  it('время начала и возраст не выдумываются', () => {
    expect(startTimeToIso(null)).toBeNull()
    expect(startTimeToIso(0)).toBeNull()
    expect(startTimeToIso(1789895287)?.startsWith('20')).toBe(true)
    expect(matchAgeDays(null, new Date())).toBeNull()
    // Возраст считается от переданного «сейчас» и не бывает отрицательным.
    expect(matchAgeDays(1000, new Date(1000 * 1000 + 5 * 24 * 60 * 60 * 1000))).toBe(5)
    expect(matchAgeDays(2000, new Date(1000 * 1000))).toBeNull()
  })
})

describe('Справочник способностей и прокачка', () => {
  it('строит справочник из ответов OpenDota и различает таланты', () => {
    const catalog = buildAbilityCatalog(ABILITY_IDS_FIXTURE, ABILITIES_FIXTURE)

    expect(catalog).not.toBeNull()
    expect(abilityEntry(catalog, 5019)?.displayName).toBe('Frost Arrows')
    expect(abilityEntry(catalog, 5019)?.iconUrl).toBe(
      `${ABILITY_ICON_BASE}/drow_ranger_frost_arrows.png`,
    )
    expect(abilityEntry(catalog, 6027)?.isTalent).toBe(true)
    expect(abilityEntry(catalog, 6027)?.iconUrl).toBeNull()
    expect(abilityEntry(catalog, 6027)?.displayName).toBe('+75 Attack Range')
    expect(TALENT_NAME_PREFIX).toBe('special_bonus_')
  })

  it('отклоняет некорректные ответы справочника', () => {
    expect(buildAbilityCatalog(null, ABILITIES_FIXTURE)).toBeNull()
    expect(buildAbilityCatalog({ '0': 'x' }, ABILITIES_FIXTURE)).toBeNull()
    // Неизвестное название в справочнике названий → показывается внутреннее имя.
    expect(buildAbilityCatalog({ '1': 'nope' }, {})?.byId.get(1)?.displayName).toBe('nope')
  })

  it('сохраняет точный порядок, уровни и признак таланта', () => {
    const catalog = buildAbilityCatalog(ABILITY_IDS_FIXTURE, ABILITIES_FIXTURE)
    const timeline = buildAbilityTimeline([5019, 343, 5019, 6027, 5019], catalog)

    expect(timeline?.map((step) => [step.level, step.name])).toEqual([
      [1, 'drow_ranger_frost_arrows'],
      [2, 'drow_ranger_multishot'],
      [3, 'drow_ranger_frost_arrows'],
      [4, 'special_bonus_attack_range_75'],
      [5, 'drow_ranger_frost_arrows'],
    ])
    expect(timeline?.[3].isTalent).toBe(true)
    expect(timeline?.[0].isTalent).toBe(false)
  })

  it('неизвестный ID показывается без названия и иконки', () => {
    const catalog = buildAbilityCatalog(ABILITY_IDS_FIXTURE, ABILITIES_FIXTURE)
    const timeline = buildAbilityTimeline([999999], catalog)

    expect(timeline?.[0]).toEqual({
      level: 1,
      abilityId: 999999,
      name: null,
      displayName: null,
      iconUrl: null,
      isTalent: false,
    })
  })

  it('отсутствие записи → null, пустая запись → пустой список', () => {
    expect(buildAbilityTimeline(null, null)).toBeNull()
    expect(buildAbilityTimeline([], null)).toEqual([])
  })

  it('кэш справочника сбрасывается (повторная загрузка возможна)', () => {
    resetAbilityCatalogCache()
    expect(abilityEntry(null, 5019)).toBeNull()
  })
})
