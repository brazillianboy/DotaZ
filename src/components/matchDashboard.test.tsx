import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '../i18n/I18nContext'
import type { Locale } from '../i18n/translations'
import { normalizeMatch } from '../lib/normalizeMatch'
import AbilityBuild from './AbilityBuild'
import BuildingsMap from './BuildingsMap'
import MatchHeader from './MatchHeader'
import PlayerStats from './PlayerStats'
import TeamOverview from './TeamOverview'

/**
 * SSR-проверки дашборда отчёта матча (Task 15).
 *
 * Данные синтетические, но повторяют подтверждённую структуру ответа OpenDota
 * (счёт, режим, регион, битмаски зданий, ID инвентаря, ID способностей).
 * Проверяется отсутствие выдуманных значений и корректные состояния при неполных данных.
 */

const RADIANT_HEROES = [6, 1, 11, 2, 3]
const DIRE_HEROES = [4, 5, 7, 8, 9]

function makePlayer(index: number, side: 'radiant' | 'dire'): Record<string, unknown> {
  const slot = side === 'radiant' ? index : index + 128
  const heroes = side === 'radiant' ? RADIANT_HEROES : DIRE_HEROES
  return {
    player_slot: slot,
    hero_id: heroes[index],
    kills: 5,
    deaths: 2,
    assists: 7,
    gold_per_min: 500,
    xp_per_min: 600,
    last_hits: 150,
    denies: 10,
    level: 20,
    net_worth: 15000,
    hero_damage: 20000,
    tower_damage: 3000,
    hero_healing: 0,
    personaname: index === 0 ? 'Eris Greyrat' : `player-${slot}`,
    item_0: 63,
    item_1: 147,
    item_2: 0,
    ability_upgrades_arr: [5019, 343],
  }
}

const RAW_MATCH: Record<string, unknown> = {
  match_id: 9007760151,
  duration: 2069,
  radiant_win: true,
  radiant_score: 56,
  dire_score: 22,
  game_mode: 22,
  region: 3,
  start_time: 1789895287,
  tower_status_radiant: 1974,
  tower_status_dire: 0,
  barracks_status_radiant: 63,
  barracks_status_dire: 0,
  objectives: [
    { type: 'building_kill', time: 664, key: 'npc_dota_badguys_tower1_top' },
    { type: 'building_kill', time: 2070, key: 'npc_dota_badguys_fort' },
  ],
  players: [
    ...Array.from({ length: 5 }, (_, index) => makePlayer(index, 'radiant')),
    ...Array.from({ length: 5 }, (_, index) => makePlayer(index, 'dire')),
  ],
}

/*
 * Обёртка рендера: `I18nProvider` даёт локализацию, `StaticRouter` — контекст
 * маршрутизации. Он нужен потому, что `PlayerStats` и `TeamOverview` содержат
 * ссылки на профили героев (Task 19). Никаких утверждений это не ослабляет:
 * проверяемые значения по-прежнему берутся из разметки.
 */
function render(node: ReactElement, locale: Locale = 'ru'): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <StaticRouter location="/matches/9007760151">{node}</StaticRouter>
    </I18nProvider>,
  )
}

describe('MatchHeader — шапка матча', () => {
  it('показывает победителя, счёт, длительность, ID, режим, регион и источник', () => {
    const match = normalizeMatch(RAW_MATCH)
    const html = render(<MatchHeader match={match} requestedId="9007760151" />)

    expect(html).toContain('Победа Света')
    expect(html).toContain('56')
    expect(html).toContain('22')
    expect(html).toContain('34:29')
    expect(html).toContain('9007760151')
    expect(html).toContain('All Draft')
    expect(html).toContain('EUROPE')
    expect(html).toContain('OpenDota')
    expect(html).toContain('Счёт из подтверждённых полей OpenDota.')
  })

  it('не выдумывает победителя и счёт при отсутствии данных', () => {
    const match = normalizeMatch({ match_id: 1, duration: 60, players: [] })
    const html = render(<MatchHeader match={match} requestedId="1" />)

    expect(html).toContain('Победитель не подтверждён')
    expect(html).toContain('Счёт недоступен')
    expect(html).not.toContain('Победа Света')
    expect(html).not.toContain('Победа Тьмы')
  })

  it('локализует шапку на английский язык', () => {
    const match = normalizeMatch(RAW_MATCH)
    const html = render(<MatchHeader match={match} requestedId="9007760151" />, 'en')

    expect(html).toContain('Radiant Victory')
    expect(html).toContain('Match ID')
    expect(html).not.toMatch(/[А-Яа-яЁё]/)
  })
})

describe('TeamOverview — таблицы команд', () => {
  it('выводит по пять игроков в каждой команде с подтверждёнными показателями', () => {
    const match = normalizeMatch(RAW_MATCH)
    const html = render(
      <TeamOverview players={match.players} selectedSlot={0} onSelect={() => {}} />,
    )

    expect(html.match(/class="team-table__row/g)?.length).toBe(10)
    expect(html).toContain('Drow Ranger')
    expect(html).toContain('Anti-Mage')
    expect(html).toContain('Eris Greyrat')
    // Названия героев обеих сторон подставляются из проверенного справочника.
    expect(html).toContain('Bloodseeker')
    expect(html).toContain('Power Treads')
    expect(html).toContain(
      'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/power_treads.png',
    )
    // Выбранная строка подсвечивается фоном и рамкой; текстового бейджа в строке нет.
    expect(html).toContain('team-table__row--selected')
    expect(html).not.toContain('team-table__selected')
  })

  it('использует нейтральные подписи для неизвестного игрока и героя', () => {
    const match = normalizeMatch({
      players: [
        { player_slot: 0, hero_id: 9999, kills: 1 },
        { player_slot: 128, hero_id: null },
      ],
    })
    const html = render(
      <TeamOverview players={match.players} selectedSlot={null} onSelect={() => {}} />,
    )

    expect(html).toContain('Неизвестный игрок')
    expect(html).toContain('герой #9999')
    expect(html).toContain('team-table__portrait--empty')
  })

  it('показывает прочерк для отсутствующих показателей и сообщение об инвентаре', () => {
    const match = normalizeMatch({ players: [{ player_slot: 0, hero_id: 6, kills: 1 }] })
    const html = render(
      <TeamOverview players={match.players} selectedSlot={null} onSelect={() => {}} />,
    )

    expect(html).toContain('—')
    expect(html).toContain('Инвентарь недоступен')
  })

  it('выбор игрока доступен с клавиатуры (кнопка с aria-pressed)', () => {
    const match = normalizeMatch(RAW_MATCH)
    const html = render(
      <TeamOverview players={match.players} selectedSlot={0} onSelect={() => {}} />,
    )

    expect(html).toContain('<button')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-label="Eris Greyrat · Drow Ranger"')
  })

  it('обрезает длинные имена и подписывает подтверждённое время покупки на иконке', () => {
    const match = normalizeMatch({
      players: [
        {
          player_slot: 0,
          hero_id: 6,
          personaname: 'Очень длинное имя игрока, которое не должно наезжать на соседние колонки',
          item_0: 63,
          item_1: 147,
          purchase_log: [{ time: 592, key: 'power_treads' }],
        },
      ],
    })
    const html = render(
      <TeamOverview players={match.players} selectedSlot={null} onSelect={() => {}} />,
    )

    // Полное имя остаётся доступным в подсказке, визуально строка обрезается средствами CSS.
    expect(html).toContain('title="Очень длинное имя игрока')
    // Размер слота предмета фиксирован (42×42) и не сжимается колонками.
    expect(html.match(/class="item-slot"/g)?.length).toBe(2)
    expect(html.match(/width="42"/g)?.length).toBe(2)
    expect(html.match(/height="42"/g)?.length).toBe(2)
    // Время показывается только у предмета с подтверждённой покупкой (09:52).
    expect(html.match(/item-slot__time/g)?.length).toBe(1)
    expect(html).toContain('data-item-time="592"')
    expect(html).toContain('data-item-time="none"')
    expect(html).toContain('09:52')
    expect(html).toContain('Power Treads · 09:52')
  })

  it('не подставляет время, если покупка предмета не подтверждена', () => {
    const match = normalizeMatch({
      players: [{ player_slot: 0, hero_id: 6, item_0: 63, purchase_log: [] }],
    })
    const html = render(
      <TeamOverview players={match.players} selectedSlot={null} onSelect={() => {}} />,
    )

    expect(html).toContain('data-item-key="power_treads"')
    expect(html).toContain('data-item-time="none"')
    expect(html).not.toContain('item-slot__time')
  })

  it('показывает подтверждённую покупку на нулевой секунде как 00:00', () => {
    const match = normalizeMatch({
      players: [
        { player_slot: 0, hero_id: 6, item_0: 63, purchase_log: [{ time: 0, key: 'power_treads' }] },
      ],
    })
    const html = render(
      <TeamOverview players={match.players} selectedSlot={null} onSelect={() => {}} />,
    )

    // 0 — это подтверждённое событие, а не отсутствие времени: плашка показывается.
    expect(html).toContain('data-item-time="0"')
    expect(html).toContain('item-slot__time')
    expect(html).toContain('>00:00<')
    expect(html).toContain('Power Treads · 00:00')
  })

  it('не превращает предматчевую покупку (отрицательное время) в 00:00', () => {
    const match = normalizeMatch({
      players: [
        {
          player_slot: 0,
          hero_id: 6,
          item_0: 63,
          purchase_log: [{ time: -90, key: 'power_treads' }],
        },
      ],
    })
    const html = render(
      <TeamOverview players={match.players} selectedSlot={null} onSelect={() => {}} />,
    )

    expect(html).toContain('data-item-time="-90"')
    expect(html).toContain('-01:30')
    expect(html).toContain('Power Treads · -01:30')
    expect(html).not.toContain('00:00')
  })

  it('выстраивает предметы инвентаря в хронологическом порядке покупки', () => {
    const match = normalizeMatch({
      players: [
        {
          player_slot: 0,
          hero_id: 6,
          // Порядок слотов инвентаря не хронологический: поздний предмет стоит первым.
          item_0: 147,
          item_1: 63,
          item_2: 36,
          purchase_log: [
            { time: 1686, key: 'manta' },
            { time: 592, key: 'power_treads' },
            { time: 300, key: 'magic_wand' },
          ],
        },
      ],
    })
    const html = render(
      <TeamOverview players={match.players} selectedSlot={null} onSelect={() => {}} />,
    )
    const order = (html.match(/data-item-key="[a-z_]+"/g) ?? []).map((entry) =>
      entry.replace('data-item-key="', '').replace('"', ''),
    )

    expect(order).toEqual(['magic_wand', 'power_treads', 'manta'])
    // Время остаётся привязано к своему предмету, а не к позиции в списке.
    expect(html).toContain('data-item-key="magic_wand" data-item-time="300"')
    expect(html).toContain('data-item-key="power_treads" data-item-time="592"')
    expect(html).toContain('data-item-key="manta" data-item-time="1686"')
    expect(html).toContain('05:00')
    expect(html).toContain('09:52')
    expect(html).toContain('28:06')
  })
})

describe('PlayerStats — карточка выбранного игрока', () => {
  it('показывает героя, метрики и не подставляет чужие значения', () => {
    const match = normalizeMatch(RAW_MATCH)
    const html = render(<PlayerStats player={match.players[0]} />)
    const unknown = render(<PlayerStats player={match.players[1]} />)

    expect(html).toContain('Drow Ranger')
    expect(html).toContain('ЗПМ')
    expect(html).toContain('Урон героям')
    expect(unknown).not.toContain('undefined')
  })

  it('без выбранного игрока предлагает выбрать участника', () => {
    expect(render(<PlayerStats player={null} />)).toContain('Выберите участника')
  })
})

describe('AbilityBuild — прокачка способностей', () => {
  it('без записи прокачки показывает недоступность', () => {
    const match = normalizeMatch({ players: [{ player_slot: 0, hero_id: 6 }] })
    const html = render(
      <AbilityBuild players={match.players} selectedSlot={null} onSelect={() => {}} />,
    )

    expect(html).toContain('Прокачка способностей')
    expect(html).toContain('Запись прокачки способностей отсутствует')
  })

  it('показывает уровни и ID способностей до загрузки справочника', () => {
    const match = normalizeMatch({
      players: [{ player_slot: 0, hero_id: 6, ability_upgrades_arr: [5019, 343] }],
    })
    const html = render(
      <AbilityBuild players={match.players} selectedSlot={0} onSelect={() => {}} />,
    )

    expect(html).toContain('Загружаем справочник способностей')
    expect(html).toContain('Уровень 1')
    expect(html).toContain('Уровень 2')
    expect(html).toContain('Неизвестная способность #5019')
    expect(html).toContain('ability-player--selected')
  })

  it('переводит заголовки прокачки на английский язык', () => {
    const match = normalizeMatch({
      players: [{ player_slot: 0, hero_id: 6, ability_upgrades_arr: [5019] }],
    })
    const html = render(
      <AbilityBuild players={match.players} selectedSlot={null} onSelect={() => {}} />,
      'en',
    )

    expect(html).toContain('Ability build')
    expect(html).toContain('Unknown ability #5019')
    expect(html).not.toMatch(/[А-Яа-яЁё]/)
  })

  it('держит шкалу прокачки в прокручиваемом контейнере без длинных подписей', () => {
    const match = normalizeMatch({
      players: [{ player_slot: 0, hero_id: 6, ability_upgrades_arr: [5019, 343] }],
    })
    const html = render(
      <AbilityBuild players={match.players} selectedSlot={0} onSelect={() => {}} />,
    )

    // Шкала прокручивается на узких экранах; список талантов появляется только при их наличии.
    expect(html).toContain('ability-steps-scroll')
    expect(html).toContain('Уровень 1')
    expect(html).not.toContain('ability-talents')
  })
})

describe('BuildingsMap — карта зданий', () => {
  it('ставит изображение карты владельца в квадратный контейнер и наносит маркеры поверх', () => {
    const match = normalizeMatch(RAW_MATCH)
    const html = render(<BuildingsMap match={match} />)

    expect(html).toContain('Карта зданий')
    // Изображение — строго по пути владельца; контейнер держит квадратную пропорцию.
    expect(html).toContain('src="/images/dotaz-map-clean.png"')
    expect(html).toContain('buildings__map-frame')
    expect(html).toContain('buildings__map-image')
    expect(html).toContain('buildings__markers')
    // 11 башен + 6 бараков + трон на каждую сторону = 36 маркеров.
    expect(html.match(/data-map-building-id=/g)?.length).toBe(36)
    expect(html.match(/data-map-kind="tower"/g)?.length).toBe(22)
    expect(html.match(/data-map-kind="barracks"/g)?.length).toBe(12)
    expect(html.match(/data-map-kind="ancient"/g)?.length).toBe(2)
    expect(html).toContain('data-map-building-id="radiant-tower-1-top"')
    expect(html).toContain('data-map-side="radiant"')
    expect(html).toContain('data-map-side="dire"')
    // Маркеры — кнопки: доступны с клавиатуры и имеют полную подпись.
    expect(html).toContain('<button')
    expect(html).toContain('aria-label="Тьма · Башня T1 · верх · Разрушено · разрушено на 11:04"')
  })

  it('держит маркеры внутри карты и различает состояния без выдуманного времени', () => {
    const match = normalizeMatch(RAW_MATCH)
    const html = render(<BuildingsMap match={match} />)
    const positions = html.match(/style="left:[\d.]+%;top:[\d.]+%"/g) ?? []

    // Координаты заданы в процентах от размеров изображения, поэтому всегда внутри карты.
    expect(positions.length).toBe(36)
    for (const position of positions) {
      const parsed = /left:([\d.]+)%;top:([\d.]+)%/.exec(position)
      expect(parsed).not.toBeNull()
      expect(Number(parsed?.[1])).toBeGreaterThanOrEqual(0)
      expect(Number(parsed?.[1])).toBeLessThanOrEqual(100)
      expect(Number(parsed?.[2])).toBeGreaterThanOrEqual(0)
      expect(Number(parsed?.[2])).toBeLessThanOrEqual(100)
    }

    // Состояния из битмасок: разрушено 21 строение, стоит 15 (данные матча 9007760151).
    expect(html.match(/data-map-state="destroyed"/g)?.length).toBe(21)
    expect(html.match(/data-map-state="standing"/g)?.length).toBe(15)
    // Состояние передаётся формой и перечёркиванием, а не только цветом.
    expect(html).toContain('map-marker__glyph')
    expect(html).toContain('map-marker__cross')
    expect(html).toContain('map-marker--radiant')
    expect(html).toContain('map-marker--dire')
    // Подтверждённое время разрушения показывается только там, где есть событие.
    expect(html).toContain('разрушено на 11:04')
    expect(html).not.toContain('Свет · Башня T1 · верх · Разрушено · разрушено на')
  })

  it('показывает легенду и короткую сводку, а подробную разбивку — в раскрываемом блоке', () => {
    const match = normalizeMatch(RAW_MATCH)
    const html = render(<BuildingsMap match={match} />)

    expect(html).toContain('Легенда')
    expect(html).toContain('Radiant — зелёные маркеры, Dire — красные.')
    expect(html).toContain('Сводка по зданиям')
    expect(html).toContain('data-team-counters="radiant"')
    expect(html).toContain('data-team-counters="dire"')
    expect(html).toContain('Стоит:')
    // Подробная разбивка по линиям и ярусам остаётся доступной, но не загромождает секцию.
    expect(html).toContain('<details')
    expect(html).toContain('buildings-table')
    expect(html).toContain('База')
    expect(html).toContain('data-building-state="destroyed"')
    expect(html).toContain('Технические подробности')
    // Схема линий больше не рисуется: фон — изображение владельца.
    expect(html).not.toContain('map-jungle--north')
    expect(html).not.toContain('map-river')
  })

  it('без данных о зданиях сообщает о недоступности, а не рисует разрушения', () => {
    const match = normalizeMatch({ match_id: 1 })
    const html = render(<BuildingsMap match={match} />)

    expect(html).toContain('Данные о состоянии зданий отсутствуют')
    expect(html).not.toContain('map-marker--destroyed')
  })

  it('переводит подписи карты на английский язык', () => {
    const match = normalizeMatch(RAW_MATCH)
    const html = render(<BuildingsMap match={match} />, 'en')

    expect(html).toContain('Buildings map')
    expect(html).toContain('Destroyed')
    expect(html).toContain('Tier 1 tower · top')
    expect(html).toContain('Building summary')
    expect(html).toContain('Radiant — green markers, Dire — red markers.')
    expect(html).toContain('Dota 2 map with building positions')
    expect(html).not.toMatch(/[А-Яа-яЁё]/)
  })
})
