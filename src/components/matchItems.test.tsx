import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '../i18n/I18nContext'
import { normalizeMatch } from '../lib/normalizeMatch'
import type { NormalizedPlayer } from '../types/match'
import MatchItems from './MatchItems'

/**
 * SSR-проверки секции предметов за матч (Task 14).
 *
 * Проверяются: политика секции за весь матч (только собранные предметы, Bottle и
 * базовые Boots of Speed без подтверждённого улучшения), скрытие компонентов,
 * расходников, рецептов и исключений ранней стадии, корректное имя Aghanim's Scepter,
 * локализация RU/EN, пустые состояния и отчёт старого формата.
 */

const RAW_PLAYER = {
  player_slot: 0,
  hero_id: 6,
  purchase_log: [
    { time: -89, key: 'tango' }, // расходник — скрыт
    { time: -80, key: 'branches' }, // компонент — скрыт в секции за матч
    { time: 0, key: 'ward_observer' }, // расходник — скрыт
    { time: 120, key: 'boots' }, // базовые сапоги — скрыты (есть улучшение)
    { time: 140, key: 'recipe_magic_wand' }, // рецепт — скрыт
    { time: 200, key: 'magic_wand' }, // собранный предмет — показан
    { time: 400, key: 'power_treads' }, // апгрейд базовых сапог — показан
    { time: 590, key: 'blink' }, // собранный предмет — показан
    { time: 700, key: 'bottle' }, // Bottle — показан
    { time: 900, key: 'cheese' }, // исключение ранней стадии — скрыто
    { time: 1200, key: 'dragon_lance' }, // собранный предмет — показан
    { time: 1800, key: 'black_king_bar' }, // собранный предмет — показан
    { time: 2400, key: 'ultimate_scepter' }, // Aghanim's Scepter — показан
  ],
}

function playerFrom(raw: unknown): NormalizedPlayer {
  return normalizeMatch({ players: [raw] }).players[0]
}

function render(player: NormalizedPlayer | null, locale: 'ru' | 'en'): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <MatchItems player={player} />
    </I18nProvider>,
  )
}

/** Ключи предметов в порядке вывода (атрибут `data-item-key`). */
function displayedKeys(html: string): string[] {
  return [...html.matchAll(/data-item-key="([^"]+)"/g)].map((match) => match[1])
}

describe('MatchItems — предметы за матч', () => {
  it('показывает значимые предметы с иконкой, именем и временем первой покупки', () => {
    const html = render(playerFrom(RAW_PLAYER), 'ru')

    expect(html).toContain('Предметы за матч')
    expect(html).toContain('Magic Wand')
    expect(html).toContain('Power Treads')
    expect(html).toContain('Blink Dagger')
    expect(html).toContain('Bottle')
    expect(html).toContain('Dragon Lance')
    expect(html).toContain('Black King Bar')
    // Иконки — статические изображения CDN Dota 2.
    expect(html).toContain(
      'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blink.png',
    )
    // Время первой покупки в формате MM:SS.
    expect(html).toContain('3:20')
    expect(html).toContain('9:50')
  })

  it("показывает Aghanim's Scepter вместо «Ultimate Scepter»", () => {
    const ru = render(playerFrom(RAW_PLAYER), 'ru')
    const en = render(playerFrom(RAW_PLAYER), 'en')

    expect(ru).toContain("Aghanim&#x27;s Scepter")
    expect(en).toContain("Aghanim&#x27;s Scepter")
    expect(ru).not.toContain('Ultimate Scepter')
    expect(en).not.toContain('Ultimate Scepter')
    expect(ru).toContain(
      'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ultimate_scepter.png',
    )
  })

  it('скрывает компоненты, обычные расходники, рецепты и исключения ранней стадии', () => {
    const html = render(playerFrom(RAW_PLAYER), 'ru')

    for (const key of ['branches', 'boots', 'ward_observer', 'recipe_magic_wand', 'cheese']) {
      expect(html, key).not.toContain(`data-item-key="${key}"`)
    }
    // Проверяются именно чипы предметов, а не текст пояснений (в них названия упомянуты).
    expect(html).not.toContain('item-chip__name">Iron Branch<')
    expect(html).not.toContain('item-chip__name">Boots of Speed<')
    expect(html).not.toContain('item-chip__name">Observer Ward<')
    expect(html).not.toContain('item-chip__name">Cheese<')
  })

  it('сохраняет хронологический порядок и время первой покупки', () => {
    const html = render(playerFrom(RAW_PLAYER), 'ru')

    expect(displayedKeys(html)).toEqual([
      'magic_wand',
      'power_treads',
      'blink',
      'bottle',
      'dragon_lance',
      'black_king_bar',
      'ultimate_scepter',
    ])
  })

  it('локализует заголовок и подписи в английской версии', () => {
    const ru = render(playerFrom(RAW_PLAYER), 'ru')
    const en = render(playerFrom(RAW_PLAYER), 'en')

    expect(en).toContain('Items for the Match')
    expect(en).not.toContain('Предметы за матч')
    // Названия предметов — оригинальные (справочник локализованных имён не используется).
    for (const name of ['Magic Wand', 'Blink Dagger', 'Power Treads']) {
      expect(ru).toContain(name)
      expect(en).toContain(name)
    }
    expect(en).not.toMatch(/[А-Яа-яЁё]/)
  })
})

describe('MatchItems — базовые сапоги и состояния без данных', () => {
  it('показывает базовые Boots of Speed, если улучшения в журнале нет', () => {
    const player = playerFrom({
      player_slot: 0,
      purchase_log: [
        { time: 100, key: 'boots' },
        { time: 300, key: 'branches' },
      ],
    })
    const html = render(player, 'ru')

    expect(displayedKeys(html)).toEqual(['boots'])
    expect(html).toContain('Boots of Speed')
  })

  it('скрывает базовые сапоги при улучшении в Power Treads', () => {
    const player = playerFrom({
      player_slot: 0,
      purchase_log: [
        { time: 100, key: 'boots' },
        { time: 400, key: 'power_treads' },
      ],
    })
    const html = render(player, 'ru')

    expect(displayedKeys(html)).toEqual(['power_treads'])
    expect(html).not.toContain('item-chip__name">Boots of Speed<')
  })

  it('скрывает базовые сапоги при улучшении в Arcane Boots', () => {
    const player = playerFrom({
      player_slot: 0,
      purchase_log: [
        { time: 100, key: 'boots' },
        { time: 400, key: 'arcane_boots' },
      ],
    })
    const html = render(player, 'ru')

    expect(displayedKeys(html)).toEqual(['arcane_boots'])
  })

  it('показывает Bottle, но скрывает Refresher Shard и Block of Cheese', () => {
    const player = playerFrom({
      player_slot: 0,
      purchase_log: [
        { time: 10, key: 'tango' },
        { time: 700, key: 'bottle' },
        { time: 800, key: 'refresher_shard' },
        { time: 900, key: 'royale_with_cheese' },
      ],
    })
    const html = render(player, 'ru')

    expect(displayedKeys(html)).toEqual(['bottle'])
    expect(html).not.toContain('item-chip__name">Refresher Shard<')
    expect(html).not.toContain('item-chip__name">Block of Cheese<')
  })

  it('без выбранного игрока предлагает выбрать участника', () => {
    expect(render(null, 'ru')).toContain('Выберите участника')
    expect(render(null, 'en')).toContain('Select a participant')
  })

  it('без журнала покупок сообщает о недоступности секции', () => {
    const player = playerFrom({ player_slot: 0, kills: 1 })
    const html = render(player, 'ru')
    expect(html).toContain('Журнал покупок за матч недоступен')
    expect(html).not.toContain('item-chip')
  })

  it('для отчёта старого формата показывает отдельное пояснение', () => {
    const player = playerFrom(RAW_PLAYER)
    const legacy: NormalizedPlayer = {
      ...player,
      purchaseLog: null,
      laning: { ...player.laning, interval: { minutes: 10, label: '00:00–10:00' } },
    }
    const html = render(legacy, 'ru')
    expect(html).toContain('Сохранённый отчёт старого формата')
    expect(html).not.toContain('item-chip')
  })

  it('при журнале только из расходников, компонентов и рецептов показывает пустое состояние', () => {
    const player = playerFrom({
      player_slot: 0,
      purchase_log: [
        { time: 10, key: 'tango' },
        { time: 20, key: 'branches' },
        { time: 30, key: 'branches_recipe' },
        { time: 40, key: 'magic_stick' },
      ],
    })
    const html = render(player, 'ru')
    expect(html).toContain('Значимых приобретений не зафиксировано')
    expect(html).not.toContain('item-chip')
  })
})