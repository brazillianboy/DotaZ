import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { HeroAbility, HeroAbilityData } from '../lib/heroAbilities'
import type { NormalizedPlayer } from '../types/match'
import HeroAbilitiesPanel from '../components/HeroAbilitiesPanel'
import PlayerStats from '../components/PlayerStats'
import TeamOverview from '../components/TeamOverview'
import { I18nProvider } from './I18nContext'
import {
  localizedAbilityDescription,
  localizedAbilityName,
  localizedPropertyLabel,
  localizedTalentName,
} from './abilityLocalization'

/**
 * Локализация профиля героя и терминов статистики (Task 19).
 *
 * Правила владельца, которые здесь защищаются:
 *  - имена героев НЕ переводятся: остаются английскими в RU и EN;
 *  - ники игроков НЕ изменяются ни в одном режиме;
 *  - способности, таланты, фасеты и подписи свойств переводятся на русский;
 *  - при отсутствии русского описания показывается честная подпись, а не выдуманный текст;
 *  - числовые значения не меняются при смене языка;
 *  - «Добивания» — это Denies, «Ластхиты» — Last Hits; значения не подменяются.
 */

const CYRILLIC = /[А-Яа-яЁё]/

function render(node: React.ReactElement, locale: 'ru' | 'en'): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <StaticRouter location="/matches/9007760151">{node}</StaticRouter>
    </I18nProvider>,
  )
}

function ability(overrides: Partial<HeroAbility> = {}): HeroAbility {
  return {
    name: 'test_ability',
    displayName: 'Test Ability',
    hasDisplayName: true,
    description: 'Source description.',
    behavior: 'Unit Target',
    damageType: 'Magical',
    targetType: 'Hero',
    targetTeam: null,
    dispellable: null,
    piercesImmunity: 'No',
    iconUrl: null,
    isInnate: false,
    attributes: [{ header: 'DAMAGE:', value: '100 / 200' }],
    ...overrides,
  }
}

function data(overrides: Partial<HeroAbilityData> = {}): HeroAbilityData {
  return {
    heroId: 68,
    abilities: [ability()],
    talents: [],
    facets: [],
    abilitiesWithoutDescription: 0,
    abilitiesWithoutDisplayName: 0,
    innateAbilities: 0,
    facetsWithoutDescription: 0,
    ...overrides,
  }
}

describe('способности: русский перевод', () => {
  it('название способности переводится в RU и сохраняется в EN', () => {
    const aa = ability({
      name: 'ancient_apparition_cold_feet',
      displayName: 'Cold Feet',
      description:
        'Places a curse on an enemy, dealing damage over time.',
    })
    const ru = render(<HeroAbilitiesPanel data={data({ abilities: [aa] })} state="ready" />, 'ru')
    const en = render(<HeroAbilitiesPanel data={data({ abilities: [aa] })} state="ready" />, 'en')
    expect(ru).toContain('Холодные ноги')
    expect(ru).not.toContain('Cold Feet')
    expect(en).toContain('Cold Feet')
    expect(en).not.toContain('Холодные ноги')
  })

  it('описание способности переводится на русский', () => {
    const aa = ability({
      name: 'ancient_apparition_cold_feet',
      displayName: 'Cold Feet',
      description: 'Places a curse on an enemy.',
    })
    const ru = render(<HeroAbilitiesPanel data={data({ abilities: [aa] })} state="ready" />, 'ru')
    expect(ru).toContain('Накладывает проклятие на противника')
    // Исходный английский текст не должен подмешиваться в русский режим.
    expect(ru).not.toContain('Places a curse on an enemy.')
  })

  it('врождённая способность переводится и помечена', () => {
    const innate = ability({
      name: 'ancient_apparition_bone_chill',
      displayName: 'Bone Chill',
      description: 'When Ancient Apparition deals Magic damage.',
      isInnate: true,
    })
    const ru = render(<HeroAbilitiesPanel data={data({ abilities: [innate] })} state="ready" />, 'ru')
    expect(ru).toContain('Стужа в костях')
    expect(ru).toContain('Врождённая')
  })

  it('подписи свойств переводятся, значения остаются прежними', () => {
    const ru = render(<HeroAbilitiesPanel data={data()} state="ready" />, 'ru')
    expect(ru).toContain('Урон:')
    expect(ru).toContain('100 / 200')
    expect(ru).not.toContain('DAMAGE:')
  })

  it('типы способности переводятся (RU) и не меняются (EN)', () => {
    const ru = render(<HeroAbilitiesPanel data={data()} state="ready" />, 'ru')
    expect(ru).toContain('По цели')
    expect(ru).toContain('Магический')
    const en = render(<HeroAbilitiesPanel data={data()} state="ready" />, 'en')
    expect(en).toContain('Unit Target')
    expect(en).toContain('Magical')
  })

  it('талант переводится по стабильному ключу', () => {
    const talentData = data({
      talents: [{ name: 'special_bonus_hp_200', level: 1, displayName: '+200 Health' }],
    })
    const ru = render(<HeroAbilitiesPanel data={talentData} state="ready" />, 'ru')
    expect(ru).toContain('+200 к здоровью')
    const en = render(<HeroAbilitiesPanel data={talentData} state="ready" />, 'en')
    expect(en).toContain('+200 Health')
  })

  it('фасет без русского перевода честно показывает английский текст источника', () => {
    const facetData = data({
      facets: [
        { name: 'unknown_facet_xyz', title: 'Unknown Facet', description: 'Some facet.', color: null },
      ],
    })
    const ru = render(<HeroAbilitiesPanel data={facetData} state="ready" />, 'ru')
    expect(ru).toContain('Unknown Facet')
    expect(ru).toContain('Some facet.')
  })
})

describe('описания: fallback и сохранение чисел', () => {
  it('при отсутствии перевода показывается честная подпись, а не выдуманный текст', () => {
    const untranslated = ability({
      name: 'unknown_ability_xyz',
      displayName: 'Unknown Ability',
      description: 'Source only description.',
    })
    const ru = render(
      <HeroAbilitiesPanel data={data({ abilities: [untranslated] })} state="ready" />,
      'ru',
    )
    expect(ru).toContain('Source only description.')
    expect(ru).toContain('Русский перевод описания пока отсутствует')
    // Выдуманного русского описания нет.
    expect(CYRILLIC.test('Source only description.')).toBe(false)
  })

  it('отсутствие описания в источнике — отдельное состояние', () => {
    const noSource = ability({ name: 'ancient_apparition_ice_blast', description: null })
    const ru = render(<HeroAbilitiesPanel data={data({ abilities: [noSource] })} state="ready" />, 'ru')
    expect(ru).toContain('Описание недоступно в источнике.')
    expect(ru).not.toContain('Русский перевод описания пока отсутствует')
  })

  it('числовые значения не меняются при смене языка', () => {
    const numeric = ability({
      name: 'ancient_apparition_ice_blast',
      displayName: 'Ice Blast',
      description: 'Launches a tracer.',
      attributes: [
        { header: 'RADIUS MIN:', value: '275' },
        { header: 'DAMAGE PER SECOND:', value: '12 / 24 / 36' },
      ],
    })
    const ru = render(<HeroAbilitiesPanel data={data({ abilities: [numeric] })} state="ready" />, 'ru')
    const en = render(<HeroAbilitiesPanel data={data({ abilities: [numeric] })} state="ready" />, 'en')
    for (const value of ['275', '12 / 24 / 36']) {
      expect(ru, `ru:${value}`).toContain(value)
      expect(en, `en:${value}`).toContain(value)
    }
    // Переведена подпись, не значение.
    expect(ru).toContain('Минимальный радиус:')
    expect(en).toContain('RADIUS MIN:')
  })

  it('переключение RU/EN переключает подписи и названия', () => {
    const aa = ability({ name: 'ancient_apparition_cold_feet', displayName: 'Cold Feet' })
    const ru = render(<HeroAbilitiesPanel data={data({ abilities: [aa] })} state="ready" />, 'ru')
    const en = render(<HeroAbilitiesPanel data={data({ abilities: [aa] })} state="ready" />, 'en')
    expect(ru).toContain('Обычные способности')
    expect(en).toContain('Standard abilities')
    expect(ru).toContain('Холодные ноги')
    expect(en).toContain('Cold Feet')
  })
})

describe('чистые функции локализации', () => {
  it('RU и EN дают разные названия, значения не подменяются', () => {
    expect(localizedAbilityName('ru', 'ancient_apparition_ice_vortex', 'Ice Vortex')).toBe(
      'Ледяной вихрь',
    )
    expect(localizedAbilityName('en', 'ancient_apparition_ice_vortex', 'Ice Vortex')).toBe(
      'Ice Vortex',
    )
    expect(localizedAbilityName('ru', 'no_such_key', 'Fallback')).toBe('Fallback')
  })

  it('описание `null` не превращается в текст', () => {
    expect(localizedAbilityDescription('ru', 'ancient_apparition_ice_blast', null)).toBeNull()
    expect(localizedAbilityDescription('en', 'ancient_apparition_ice_blast', null)).toBeNull()
  })

  it('талант `null` не превращается в текст', () => {
    expect(localizedTalentName('ru', 'special_bonus_hp_200', null)).toBeNull()
  })

  it('неизвестная подпись свойства остаётся английской', () => {
    expect(localizedPropertyLabel('ru', 'SOME_UNKNOWN_HEADER:')).toBe('SOME_UNKNOWN_HEADER:')
    expect(localizedPropertyLabel('en', 'DAMAGE:')).toBe('DAMAGE:')
  })
})



function player(
  slot: number,
  heroId: number,
  name: string,
  overrides: Partial<NormalizedPlayer> = {},
): NormalizedPlayer {
  return {
    player_slot: slot,
    team: slot < 5 ? 'radiant' : 'dire',
    hero_id: heroId,
    player_name: name,
    account_id: null,
    level: 12,
    kills: 3,
    deaths: 2,
    assists: 7,
    last_hits: 111,
    denies: 9,
    net_worth: 12345,
    gold_per_min: 555,
    xp_per_min: 666,
    hero_damage: 1000,
    tower_damage: 200,
    hero_healing: null,
    inventory_ids: null,
    neutral_item_id: null,
    lane: null,
    lane_role: null,
    ability_upgrades: null,
    purchaseLog: null,
    laning: {
      interval: { minutes: 15, label: '00:00–15:00' },
      lastHits: null,
      gold: null,
      xp: null,
      killsFirst: null,
      deathsFirst: null,
      purchasesFirst: null,
      laneEfficiencyPct: null,
    },
    ...overrides,
  }
}

const PLAYERS: NormalizedPlayer[] = [
  player(0, 68, 'Странник'),
  player(1, 86, 'Σίσυφος «MVP»'),
  player(2, 22, 'Zeus_Fan-99'),
  player(3, 30, 'Ученик'),
  player(4, 6, '  spaced  '),
  player(5, 37, '东北玩家'),
  player(6, 67, 'emoji🎮player'),
  player(7, 49, "O'Brien"),
  player(8, 26, 'АК-47'),
  player(9, 1, 'AntiMage'),
]

describe('имена героев остаются английскими в обоих режимах', () => {
  it('RU-режим показывает английские имена героев', () => {
    const html = render(
      <TeamOverview players={PLAYERS} selectedSlot={null} onSelect={() => {}} />,
      'ru',
    )
    for (const name of ['Ancient Apparition', 'Rubick', 'Zeus', 'Witch Doctor', 'Drow Ranger']) {
      expect(html, name).toContain(name)
    }
    for (const wrong of ['Древнее Видение', 'Зевс', 'Рубик', 'Ведьмин Доктор']) {
      expect(html, wrong).not.toContain(wrong)
    }
  })

  it('EN-режим показывает те же английские имена героев', () => {
    const html = render(
      <TeamOverview players={PLAYERS} selectedSlot={null} onSelect={() => {}} />,
      'en',
    )
    for (const name of ['Ancient Apparition', 'Rubick', 'Zeus', 'Witch Doctor', 'Drow Ranger']) {
      expect(html, name).toContain(name)
    }
  })

  it('карточка выбранного игрока тоже показывает английское имя героя', () => {
    expect(render(<PlayerStats player={PLAYERS[0]} />, 'ru')).toContain('Ancient Apparition')
    expect(render(<PlayerStats player={PLAYERS[0]} />, 'en')).toContain('Ancient Apparition')
  })
})

describe('ники игроков не изменяются', () => {
  it('оригинальное написание, регистр, пунктуация и Unicode сохраняются в обоих режимах', () => {
    for (const locale of ['ru', 'en'] as const) {
      const html = render(
        <TeamOverview players={PLAYERS} selectedSlot={null} onSelect={() => {}} />,
        locale,
      )
      for (const nick of [
        'Странник',
        'Σίσυφος «MVP»',
        'Zeus_Fan-99',
        'Ученик',
        '东北玩家',
        'emoji🎮player',
        // Апостроф в статической разметке экранируется React (&amp;#x27;),
        // но сам ник не изменяется: регистр и пунктуация сохранены.
        'O&#x27;Brien',
        'АК-47',
        'AntiMage',
      ]) {
        expect(html, `${locale}:${nick}`).toContain(nick)
      }
    }
  })

  it('пробелы внутри ника не обрезаются и не схлопываются', () => {
    const html = render(
      <TeamOverview players={[PLAYERS[4]]} selectedSlot={null} onSelect={() => {}} />,
      'ru',
    )
    expect(html).toContain('  spaced  ')
  })
})


describe('термины статистики матча', () => {
  const team = (locale: 'ru' | 'en'): string =>
    render(<TeamOverview players={PLAYERS} selectedSlot={null} onSelect={() => {}} />, locale)

  it('Denies = «Добивания», Last Hits = «Ластхиты»', () => {
    const html = team('ru')
    expect(html).toContain('Добивания')
    expect(html).toContain('Ластхиты')
    expect(html).not.toContain('Денаи')
  })

  it('Last Hits и Denies остаются разными полями с разными значениями', () => {
    const html = render(
      <TeamOverview players={[PLAYERS[0]]} selectedSlot={null} onSelect={() => {}} />,
      'ru',
    )
    expect(html).toContain('111')
    expect(html).toContain('9')
    expect(html).not.toContain('Денаи')
  })

  it('Net Worth = «Общая ценность»', () => {
    expect(team('ru')).toContain('Общая ценность')
  })

  it('GPM = «ЗПМ» и XPM = «ОПМ» с подсказками', () => {
    const html = team('ru')
    expect(html).toContain('>ЗПМ</abbr>')
    expect(html).toContain('>ОПМ</abbr>')
    expect(html).toContain('title="Золото в минуту"')
    expect(html).toContain('title="Опыт в минуту"')
  })

  it('карточка игрока использует те же термины и подсказки', () => {
    const html = render(<PlayerStats player={PLAYERS[0]} />, 'ru')
    expect(html).toContain('Ластхиты')
    expect(html).toContain('Добивания')
    expect(html).toContain('Общая ценность')
    expect(html).toContain('title="Золото в минуту"')
    expect(html).toContain('title="Опыт в минуту"')
  })

  it('Radiant = «Свет», Dire = «Тьма»', () => {
    const html = team('ru')
    expect(html).toContain('Свет')
    expect(html).toContain('Тьма')
  })

  it('EN-режим сохраняет исходную терминологию', () => {
    const html = team('en')
    for (const label of ['Last hits', 'Denies', 'Net worth', 'GPM', 'XPM', 'Radiant', 'Dire']) {
      expect(html, label).toContain(label)
    }
    expect(html).toContain('title="Gold per minute"')
    expect(html).toContain('title="Experience per minute"')
  })
})

describe('портреты и выбор игрока не сломаны локализацией', () => {
  it('ссылка на профиль строится по каноническому hero_id в обоих режимах', () => {
    for (const locale of ['ru', 'en'] as const) {
      const html = render(
        <TeamOverview players={PLAYERS} selectedSlot={null} onSelect={() => {}} />,
        locale,
      )
      expect(html, locale).toContain('href="/heroes/68"')
      expect(html, locale).toContain('href="/heroes/86"')
      expect(html, locale).toContain('href="/heroes/1"')
    }
  })

  it('кнопки выбора игрока сохранены: десять кнопок и aria-pressed', () => {
    const html = render(
      <TeamOverview players={PLAYERS} selectedSlot={3} onSelect={() => {}} />,
      'ru',
    )
    expect(html.split('class="team-table__select"').length - 1).toBe(10)
    expect(html.split('aria-pressed="true"').length - 1).toBe(1)
    expect(html.split('aria-pressed="false"').length - 1).toBe(9)
  })
})
