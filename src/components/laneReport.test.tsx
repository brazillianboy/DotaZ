import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { normalizeMatch } from '../lib/normalizeMatch'
import type { NormalizedPlayer } from '../types/match'
import LaneReport from './LaneReport'

/**
 * SSR-проверки компонента отчёта о стадии линии (Task 8).
 * Используется уже установленный `react-dom/server` — новых зависимостей нет.
 */

/** Синтетическая запись игрока с расширенными полями (только для тестов). */
const RAW_WITH_LANING = {
  player_slot: 0,
  hero_id: 6,
  kills: 16,
  deaths: 3,
  assists: 15,
  gold_per_min: 619,
  xp_per_min: 786,
  last_hits: 238,
  lh_t: [0, 3, 7, 10, 11, 17, 23, 28, 33, 40, 47],
  gold_t: [0, 287, 779, 1029, 1540, 1906, 2379, 2684, 3037, 3438, 3864],
  xp_t: [0, 118, 408, 765, 1068, 1306, 1792, 2074, 2380, 2661, 2907],
  kills_log: [{ time: 102, key: 'npc_dota_hero_dark_seer' }],
  deaths_log: [{ time: 186, key: 'npc_dota_neutral' }],
  purchase_log: [
    { time: -89, key: 'magic_wand' },
    { time: 120, key: 'boots' },
    { time: 601, key: 'blink' },
  ],
  lane_efficiency_pct: 78,
}

function playerFrom(raw: unknown): NormalizedPlayer {
  return normalizeMatch({ players: [raw] }).players[0]
}

describe('LaneReport — полные данные', () => {
  it('показывает период, факты, эффективность и покупки интервала', () => {
    const html = renderToStaticMarkup(<LaneReport player={playerFrom(RAW_WITH_LANING)} />)

    expect(html).toContain('Стадия линии — 00:00–10:00')
    expect(html).toContain('Игрок — слот 0 · герой 6')
    // Поминутные показатели (индекс 10).
    expect(html).toContain('47')
    expect(html).toContain('3864')
    expect(html).toContain('2907')
    // События первых десяти минут.
    expect(html).toContain('1')
    // Эффективность линии провайдера.
    expect(html).toContain('78 %')
    // Покупки: предматчевая (-89) и после 10:00 (601) исключены.
    expect(html).toContain('Покупки 00:00–10:00: 1')
    expect(html).toContain('boots')
    expect(html).not.toContain('magic_wand')
    expect(html).not.toContain('blink')
    expect(html).toContain('OpenDota')
  })

  it('не содержит оценочных формулировок о качестве линии', () => {
    const html = renderToStaticMarkup(<LaneReport player={playerFrom(RAW_WITH_LANING)} />)
    const lower = html.toLowerCase()
    for (const forbidden of ['хорош', 'плох', 'ошибк', 'провал', 'успешн', 'рекоменд']) {
      expect(lower).not.toContain(forbidden)
    }
  })
})

describe('LaneReport — отсутствующие и частичные данные', () => {
  it('без расширенных полей сообщает о недоступности детальных данных', () => {
    const html = renderToStaticMarkup(
      <LaneReport player={playerFrom({ player_slot: 0, kills: 5, last_hits: 200 })} />,
    )
    expect(html).toContain('Детальные данные стадии линии для этого матча недоступны')
    // Статистика за матч не подставляется вместо поминутной.
    expect(html).not.toContain('200')
  })

  it('частичные данные: доступные факты показаны, отсутствующие — «Нет данных»', () => {
    const html = renderToStaticMarkup(
      <LaneReport
        player={playerFrom({
          player_slot: 0,
          gold_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1234],
          kills_log: [{ time: 300 }],
        })}
      />,
    )
    expect(html).toContain('1234')
    expect(html).toContain('Нет данных')
    expect(html).not.toContain('Детальные данные стадии линии')
  })

  it('отсутствующий журнал покупок отличается от пустого', () => {
    const missing = renderToStaticMarkup(
      <LaneReport
        player={playerFrom({
          player_slot: 0,
          lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 47],
        })}
      />,
    )
    expect(missing).toContain('Журнал покупок недоступен')

    const empty = renderToStaticMarkup(
      <LaneReport player={playerFrom({ player_slot: 0, purchase_log: [] })} />,
    )
    expect(empty).toContain('покупок нет (журнал получен)')
  })

  it('без выбранного игрока предлагает выбрать участника', () => {
    const html = renderToStaticMarkup(<LaneReport player={null} />)
    expect(html).toContain('Выберите участника')
  })
})