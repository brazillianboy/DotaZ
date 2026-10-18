import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { buildLaningStageData } from '../lib/laning'
import type { NormalizedMatch, NormalizedPlayer } from '../types/match'
import MatchSummary from './MatchSummary'
import PlayerSelector from './PlayerSelector'
import PlayerStats from './PlayerStats'

/**
 * Проверка рендеринга компонентов страницы матча (Task 7).
 * Используется статический SSR-рендеринг через уже установленный `react-dom/server` —
 * дополнительные зависимости (jsdom, testing-library) не добавляются.
 */

function makePlayer(overrides: Partial<Omit<NormalizedPlayer, 'laning'>> = {}): NormalizedPlayer {
  return {
    player_slot: 0,
    team: 'radiant',
    hero_id: 6,
    kills: 6,
    deaths: 8,
    assists: 18,
    gold_per_min: 619,
    xp_per_min: 786,
    last_hits: 238,
    laning: buildLaningStageData({}),
    ...overrides,
  }
}

function makeMatch(overrides: Partial<NormalizedMatch> = {}): NormalizedMatch {
  return {
    match_id: '9007760151',
    duration: 2069,
    radiant_win: true,
    players: [makePlayer()],
    ...overrides,
  }
}

describe('MatchSummary — рендеринг сводки', () => {
  it('показывает ID, длительность, победителя, количество участников и источник', () => {
    const html = renderToStaticMarkup(
      <MatchSummary match={makeMatch()} requestedId="9007760151" />,
    )
    expect(html).toContain('9007760151')
    expect(html).toContain('34:29')
    expect(html).toContain('2069')
    expect(html).toContain('Radiant')
    expect(html).toContain('OpenDota')
  })

  it('отсутствующие значения показывает как «Нет данных», а не как Dire', () => {
    const html = renderToStaticMarkup(
      <MatchSummary
        match={makeMatch({ match_id: null, duration: null, radiant_win: null, players: [] })}
        requestedId="1"
      />,
    )
    expect(html).toContain('Нет данных')
    expect(html).not.toContain('Dire')
  })

  it('нулевая длительность отображается как 0:00', () => {
    const html = renderToStaticMarkup(
      <MatchSummary match={makeMatch({ duration: 0 })} requestedId="1" />,
    )
    expect(html).toContain('0:00')
  })
})

describe('PlayerSelector — рендеринг и группировка', () => {
  it('группирует участников по сторонам и помечает выбранного', () => {
    const html = renderToStaticMarkup(
      <PlayerSelector
        players={[
          makePlayer({ player_slot: 0, team: 'radiant' }),
          makePlayer({ player_slot: 128, team: 'dire', hero_id: null }),
          makePlayer({ player_slot: 300, team: null }),
        ]}
        selectedSlot={128}
        onSelect={() => {}}
      />,
    )
    expect(html).toContain('Radiant')
    expect(html).toContain('Dire')
    expect(html).toContain('Команда не определена')
    expect(html).toContain('Игрок — слот 0 · герой 6')
    expect(html).toContain('Игрок — слот 128')
    expect(html).toContain('Выбран')
    expect(html).toContain('aria-pressed="true"')
  })

  it('пустой список участников показывает сообщение и не рендерит кнопки', () => {
    const html = renderToStaticMarkup(
      <PlayerSelector players={[]} selectedSlot={null} onSelect={() => {}} />,
    )
    expect(html).toContain('Данные об участниках отсутствуют.')
    expect(html).not.toContain('player-button')
  })
})

describe('PlayerStats — рендеринг статистики', () => {
  it('показывает K/D/A, GPM, XPM, last hits и слот', () => {
    const html = renderToStaticMarkup(<PlayerStats player={makePlayer()} />)
    expect(html).toContain('6 / 8 / 18')
    expect(html).toContain('619')
    expect(html).toContain('786')
    expect(html).toContain('238')
    expect(html).toContain('Radiant')
  })

  it('легитимные нули отображаются как 0', () => {
    const html = renderToStaticMarkup(
      <PlayerStats
        player={makePlayer({ kills: 0, deaths: 0, assists: 0, last_hits: 0, hero_id: 0 })}
      />,
    )
    expect(html).toContain('0 / 0 / 0')
  })

  it('отсутствующие значения показываются как «Нет данных» и прочерки', () => {
    const html = renderToStaticMarkup(
      <PlayerStats
        player={makePlayer({
          kills: 6,
          deaths: null,
          assists: 18,
          gold_per_min: null,
          xp_per_min: null,
          last_hits: null,
          hero_id: null,
        })}
      />,
    )
    expect(html).toContain('6 / — / 18')
    expect(html).toContain('Нет данных')
  })

  it('без выбранного игрока предлагает выбрать участника', () => {
    const html = renderToStaticMarkup(<PlayerStats player={null} />)
    expect(html).toContain('Выберите участника')
  })
})