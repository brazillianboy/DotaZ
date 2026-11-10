import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '../i18n/I18nContext'
import type { NormalizedPlayer } from '../types/match'
import PlayerStats from './PlayerStats'
import TeamOverview from './TeamOverview'

/**
 * Переходы к профилям героев со страницы матча (Task 19).
 *
 * Ссылка строится только по каноническому `hero_id` из справочника, живёт рядом с
 * кнопкой выбора игрока (не внутри неё) и не меняет поведение выбора.
 */

const CYRILLIC = /[А-Яа-яЁё]/

const HERO_IDS = [86, 85, 1, 2, 6, 99, 106, 123, 11, 9999]

function player(slot: number, heroId: number): NormalizedPlayer {
  return {
    player_slot: slot,
    team: slot < 5 ? 'radiant' : 'dire',
    hero_id: heroId,
    player_name: `Player ${slot}`,
    account_id: null,
    level: 10,
    kills: 1,
    deaths: 2,
    assists: 3,
    last_hits: 100,
    denies: 5,
    net_worth: 10000,
    gold_per_min: 500,
    xp_per_min: 600,
    hero_damage: 12000,
    tower_damage: 1000,
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
  }
}

const PLAYERS: NormalizedPlayer[] = Array.from({ length: 10 }, (_unused, index) =>
  player(index, index === 9 ? 9999 : HERO_IDS[index]),
)

function render(node: ReactElement, locale: 'ru' | 'en'): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <StaticRouter location="/matches/1">{node}</StaticRouter>
    </I18nProvider>,
  )
}

function countOf(html: string, needle: string): number {
  return html.split(needle).length - 1
}

describe('таблица игроков — ссылки на профили героев', () => {
  it('все десять строк остаются на месте и выбираемыми', () => {
    const html = render(
      <TeamOverview players={PLAYERS} selectedSlot={3} onSelect={() => {}} />,
      'ru',
    )
    expect(countOf(html, 'class="team-table__select"')).toBe(10)
    expect(countOf(html, 'aria-pressed="true"')).toBe(1)
    expect(countOf(html, 'aria-pressed="false"')).toBe(9)
  })

  it('ссылка ведёт на канонический ID героя (Рубик — 86)', () => {
    const html = render(
      <TeamOverview players={PLAYERS} selectedSlot={null} onSelect={() => {}} />,
      'ru',
    )
    expect(html).toContain('href="/heroes/86"')
    expect(html).toContain('href="/heroes/85"')
    expect(html).toContain('href="/heroes/1"')
  })

  it('неизвестный герой не получает ссылку и не даёт битого адреса', () => {
    const html = render(
      <TeamOverview players={PLAYERS} selectedSlot={null} onSelect={() => {}} />,
      'ru',
    )
    expect(html).not.toContain('href="/heroes/9999"')
    expect(countOf(html, 'class="team-table__profile"')).toBe(9)
  })

  it('ссылка не вложена в кнопку выбора и имеет доступное имя', () => {
    const html = render(
      <TeamOverview players={PLAYERS.slice(0, 5)} selectedSlot={0} onSelect={() => {}} />,
      'ru',
    )
    expect(html).toContain('Открыть профиль героя · Rubick')
    expect(html).toContain('</button><a class="team-table__profile"')
  })

  it('английская версия без кириллицы', () => {
    const html = render(
      <TeamOverview players={PLAYERS.slice(0, 5)} selectedSlot={null} onSelect={() => {}} />,
      'en',
    )
    expect(html).toContain('Open hero profile · Rubick')
    expect(CYRILLIC.test(html)).toBe(false)
  })
})

describe('панель выбранного игрока — ссылка на профиль героя', () => {
  it('ссылка присутствует и ведёт на канонический ID', () => {
    const html = render(<PlayerStats player={PLAYERS[0]} />, 'ru')
    expect(html).toContain('href="/heroes/86"')
    expect(html).toContain('Профиль героя')
  })

  it('без выбранного игрока ссылки нет', () => {
    const html = render(<PlayerStats player={null} />, 'ru')
    expect(html).not.toContain('href="/heroes/')
    expect(countOf(html, 'class="match-stats panel"')).toBe(1)
  })

  it('неизвестный герой не даёт ссылку', () => {
    const html = render(<PlayerStats player={PLAYERS[9]} />, 'ru')
    expect(html).not.toContain('href="/heroes/9999"')
  })
})
