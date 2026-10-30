import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { normalizeMatch } from '../lib/normalizeMatch'
import type { NormalizedPlayer } from '../types/match'
import LaneReport from './LaneReport'

/**
 * SSR-проверки компонента отчёта о ранней стадии (интервал 00:00–15:00).
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
  lh_t: [0, 3, 7, 10, 11, 17, 23, 28, 33, 40, 47, 53, 57, 62, 70, 86],
  gold_t: [0, 287, 779, 1029, 1540, 1906, 2379, 2684, 3037, 3438, 3864, 4191, 4520, 4890, 5300, 5860],
  xp_t: [0, 118, 408, 765, 1068, 1306, 1792, 2074, 2380, 2661, 2907, 3201, 3501, 3820, 4150, 4512],
  kills_log: [{ time: 102, key: 'npc_dota_hero_dark_seer' }],
  deaths_log: [{ time: 186, key: 'npc_dota_neutral' }],
  purchase_log: [
    { time: -89, key: 'tango' }, // предматчевая покупка — вне интервала
    { time: 60, key: 'branches' }, // компонент — показан
    { time: 120, key: 'boots' }, // компонент — показан
    { time: 200, key: 'tango' }, // обычный расходник — скрыт
    { time: 240, key: 'branches' }, // повторная покупка компонента — показана
    { time: 601, key: 'blink' }, // собранный предмет — показан
    { time: 700, key: 'bottle' }, // явное исключение — показано
  ],
  lane_efficiency_pct: 78,
}

function playerFrom(raw: unknown): NormalizedPlayer {
  return normalizeMatch({ players: [raw] }).players[0]
}

/** Ключи отображаемых покупок в порядке вывода (атрибут `data-item-key`). */
function displayedKeys(html: string): string[] {
  return [...html.matchAll(/data-item-key="([^"]+)"/g)].map((match) => match[1])
}

describe('LaneReport — полные данные', () => {
  it('показывает период, факты, эффективность и покупки интервала', () => {
    const html = renderToStaticMarkup(<LaneReport player={playerFrom(RAW_WITH_LANING)} />)

    expect(html).toContain('Стадия линии — 00:00–15:00')
    expect(html).toContain('Игрок — слот 0 · герой 6')
    // Поминутные показатели (индекс 15 — 15:00).
    expect(html).toContain('86')
    expect(html).toContain('5860')
    expect(html).toContain('4512')
    // События первых пятнадцати минут.
    expect(html).toContain('1')
    // Эффективность линии провайдера.
    expect(html).toContain('78 %')
    // Покупки: предматчевая (-89) исключена по времени, расходник (200) — по типу.
    expect(html).toContain('Покупки 00:00–15:00: 5')
    expect(html).toContain('OpenDota')
  })

  it('применяет ту же политику фильтрации, что и секция предметов за матч', () => {
    const html = renderToStaticMarkup(<LaneReport player={playerFrom(RAW_WITH_LANING)} />)

    // Компоненты, собранные предметы и явное исключение показаны.
    expect(html).toContain('branches')
    expect(html).toContain('boots')
    expect(html).toContain('blink')
    expect(html).toContain('bottle')
    // Обычный расходник скрыт и честно посчитан.
    expect(html).not.toContain('data-item-key="tango"')
    expect(html).toContain('Скрыто обычных расходников: 1')
  })

  it('сохраняет хронологический порядок и повторные покупки', () => {
    const html = renderToStaticMarkup(<LaneReport player={playerFrom(RAW_WITH_LANING)} />)

    expect(displayedKeys(html)).toEqual(['branches', 'boots', 'branches', 'blink', 'bottle'])
  })

  it('показывает компоненты, собранные предметы и исключения интервала, скрывая расходники', () => {
    const html = renderToStaticMarkup(
      <LaneReport
        player={playerFrom({
          player_slot: 0,
          purchase_log: [
            { time: 10, key: 'branches' },
            { time: 20, key: 'tango' },
            { time: 60, key: 'ultimate_scepter' },
            { time: 90, key: 'aghanims_shard' },
            { time: 120, key: 'cheese' },
            { time: 300, key: 'tpscroll' },
            { time: 400, key: 'mithril_hammer' },
          ],
        })}
      />,
    )

    // Компоненты (branches, mithril_hammer), собранные предметы (ultimate_scepter,
    // aghanims_shard) и исключение (cheese) показаны; расходники скрыты и посчитаны.
    expect(displayedKeys(html)).toEqual([
      'branches',
      'ultimate_scepter',
      'aghanims_shard',
      'cheese',
      'mithril_hammer',
    ])
    expect(html).toContain('Скрыто обычных расходников: 2')
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
    expect(html).toContain('Детальные данные ранней стадии для этого матча недоступны')
    // Статистика за матч не подставляется вместо поминутной.
    expect(html).not.toContain('200')
  })

  it('частичные данные: доступные факты показаны, отсутствующие — «Нет данных»', () => {
    const html = renderToStaticMarkup(
      <LaneReport
        player={playerFrom({
          player_slot: 0,
          gold_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1234, 1500, 1800, 2200, 2600, 3000],
          kills_log: [{ time: 300 }],
        })}
      />,
    )
    expect(html).toContain('3000')
    expect(html).toContain('Нет данных')
    expect(html).not.toContain('Детальные данные ранней стадии')
  })

  it('отсутствующий журнал покупок отличается от пустого', () => {
    const missing = renderToStaticMarkup(
      <LaneReport
        player={playerFrom({
          player_slot: 0,
          lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 47, 53, 57, 62, 70, 86],
        })}
      />,
    )
    expect(missing).toContain('Журнал покупок недоступен')

    const empty = renderToStaticMarkup(
      <LaneReport player={playerFrom({ player_slot: 0, purchase_log: [] })} />,
    )
    expect(empty).toContain('нет отображаемых предметов')
  })

  it('журнал только из обычных расходников даёт пустое состояние без выдуманных предметов', () => {
    const html = renderToStaticMarkup(
      <LaneReport
        player={playerFrom({
          player_slot: 0,
          purchase_log: [
            { time: 10, key: 'tango' },
            { time: 60, key: 'ward_observer' },
            { time: 90, key: 'tpscroll' },
          ],
        })}
      />,
    )

    expect(html).toContain('нет отображаемых предметов')
    expect(html).toContain('Скрыто обычных расходников: 3')
    expect(html).not.toContain('data-item-key=')
  })

  it('без выбранного игрока предлагает выбрать участника', () => {
    const html = renderToStaticMarkup(<LaneReport player={null} />)
    expect(html).toContain('Выберите участника')
  })
})