import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '../i18n/I18nContext'
import type { ItemTimingSnapshot } from '../lib/itemTimings'
import { ITEM_TIMING_METHOD_VERSION } from '../lib/itemTimings'
import { buildLaningStageData } from '../lib/laning'
import type { NormalizedPlayer } from '../types/match'
import ItemTimings from './ItemTimings'

/**
 * Проверки секции таймингов (Task 18): раскладка «предмет слева — статистика справа»,
 * графическая шкала, порог выборки 100 и локализация. Значения синтетические.
 */

const CYRILLIC = /[А-Яа-яЁё]/

function snapshot(overrides: Partial<ItemTimingSnapshot> = {}): ItemTimingSnapshot {
  return {
    method_version: ITEM_TIMING_METHOD_VERSION,
    source: { name: 'OpenDota Explorer', url: '', dataset: 'test', attribution: 'OpenDota' },
    generated_at: '2026-11-07T00:00:00.000Z',
    patch: '7.41',
    patch_id: 60,
    thresholds: { store: 30, full: 100, classify: 100 },
    bucket_count: 1,
    buckets: [
      {
        hero_id: 6,
        lane_role: 1,
        item_key: 'blink',
        stats: { n: 200, p25: 600, p50: 750, p75: 900 },
      },
    ],
    ...overrides,
  }
}

function player(
  purchaseLog: NormalizedPlayer['purchaseLog'],
  overrides: Partial<NormalizedPlayer> = {},
): NormalizedPlayer {
  return {
    player_slot: 0,
    team: 'radiant',
    hero_id: 6,
    kills: 1,
    deaths: 1,
    assists: 2,
    gold_per_min: 500,
    xp_per_min: 500,
    last_hits: 100,
    hero_damage: null,
    tower_damage: null,
    hero_healing: null,
    level: null,
    denies: null,
    net_worth: null,
    player_name: null,
    account_id: null,
    inventory_ids: null,
    neutral_item_id: null,
    lane: 1,
    lane_role: 1,
    ability_upgrades: null,
    purchaseLog,
    laning: buildLaningStageData({}),
    ...overrides,
  }
}

const LOG = [
  { time: 120, key: 'boots' },
  { time: 700, key: 'blink' },
  { time: 40, key: 'tango' },
]

function render(locale: 'ru' | 'en', props: Parameters<typeof ItemTimings>[0]): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <ItemTimings {...props} />
    </I18nProvider>,
  )
}

/** Разбивает разметку на строки-контейнеры предметов. */
function rows(html: string): string[] {
  return html.split('<li class="item-timeline__item"').slice(1)
}

function rowFor(html: string, itemKey: string): string {
  const row = rows(html).find((chunk) => chunk.includes(`data-item-key="${itemKey}"`))
  if (row === undefined) {
    throw new Error(`строка предмета ${itemKey} не найдена`)
  }
  return row
}

describe('ItemTimings — состояния и локализация', () => {
  it('в русской локали показывает таймлайн и пояснение об отсутствии нормативов', () => {
    const html = render('ru', { player: player(LOG), patch: 60, snapshot: null })
    expect(html).toContain('Анализ покупки предметов')
    expect(html).toContain('Blink Dagger')
    expect(html).toContain('куплено 11:40')
    expect(html).toContain('Сравнение с нормативами таймингов недоступно')
    expect(html).toContain('Скрыто обычных расходников')
    // Без снапшота шкалы нет и шумных per-row пояснений тоже.
    expect(html).not.toContain('item-timing-scale')
    expect(html).not.toContain('Нет норматива')
  })

  it('в английской локали не содержит кириллицы', () => {
    const html = render('en', { player: player(LOG), patch: 60, snapshot: snapshot() })
    expect(html).toContain('Item Purchase Timing Analysis')
    expect(html).toContain('Blink Dagger')
    expect(html).toContain('Timing scale:')
    expect(html).not.toMatch(CYRILLIC)
  })

  it('без журнала покупок сообщает о недоступности', () => {
    const html = render('ru', { player: player(null), patch: 60, snapshot: snapshot() })
    expect(html).toContain('Журнал покупок недоступен')
  })

  it('пустой журнал отличается от отсутствующего', () => {
    const html = render('ru', { player: player([]), patch: 60, snapshot: snapshot() })
    expect(html).toContain('В журнале покупок нет событий')
  })
})

describe('ItemTimings — статистика справа и шкала', () => {
  const html = render('ru', { player: player(LOG), patch: 60, snapshot: snapshot() })

  it('показывает медиану, диапазон, выборку и класс в контейнере предмета', () => {
    const row = rowFor(html, 'blink')
    expect(row).toContain('item-timeline__stats')
    expect(row).toContain('медиана')
    expect(row).toContain('12:30')
    expect(row).toContain('диапазон')
    expect(row).toContain('10:00–15:00')
    expect(row).toContain('выборка')
    expect(row).toContain('200')
    expect(row).toContain('в типичном диапазоне')
    expect(row).toContain('куплено 11:40')
  })

  it('статистика не приписывается другому предмету', () => {
    const bootsRow = rowFor(html, 'boots')
    expect(bootsRow).toContain('куплено 02:00')
    expect(bootsRow).not.toContain('12:30')
    expect(bootsRow).not.toContain('медиана')
    expect(bootsRow).not.toContain('item-timing-scale')
    expect(bootsRow).toContain('Нет норматива для этого героя, линии и патча')
  })

  it('строит шкалу с доступным текстовым описанием', () => {
    const row = rowFor(html, 'blink')
    expect(row).toContain('role="img"')
    expect(row).toContain('Шкала тайминга: покупка 11:40; медиана 12:30')
    expect(row).toContain('типичный диапазон 10:00–15:00')
    expect(row).toContain('выборка 200 наблюдений')
    expect(row).toContain('покупка внутри типичного диапазона')
  })

  it('рисует зону p25–p75, маркер медианы и маркер покупки', () => {
    const row = rowFor(html, 'blink')
    expect(row).toContain('item-timing-scale__range')
    expect(row).toContain('item-timing-scale__median')
    expect(row).toContain('item-timing-scale__actual')
    const positions = [...row.matchAll(/left:([\d.]+)%/g)].map((match) => Number(match[1]))
    expect(positions.length).toBeGreaterThanOrEqual(3)
    expect(Math.min(...positions)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...positions)).toBeLessThanOrEqual(100)
    const width = /width:([\d.]+)%/.exec(row)
    expect(width).not.toBeNull()
    expect(Number(width?.[1])).toBeGreaterThan(0)
    expect(Number(width?.[1])).toBeLessThanOrEqual(100)
  })

  it('показывает подписи оси и легенду без наведения мыши', () => {
    const row = rowFor(html, 'blink')
    expect(row).toContain('item-timing-scale__axis')
    expect(row).toContain('item-timing-scale__legend')
    expect(row).toContain('p25–p75')
  })
})

describe('ItemTimings — порог выборки и отсутствие нормативов', () => {
  it('при n = 99 не классифицирует и не рисует шкалу', () => {
    const small = snapshot({
      buckets: [
        {
          hero_id: 6,
          lane_role: 1,
          item_key: 'blink',
          stats: { n: 99, p25: 600, p50: 750, p75: 900 },
        },
      ],
    })
    const html = render('ru', { player: player(LOG), patch: 60, snapshot: small })
    const row = rowFor(html, 'blink')
    expect(row).not.toContain('item-timing-scale')
    expect(row).not.toContain('12:30')
    expect(row).not.toContain('в типичном диапазоне')
    expect(row).not.toContain('раньше типичного')
    expect(row).not.toContain('позже типичного')
    expect(row).toContain('Выборка 99 наблюдений меньше порога 100')
    expect(row).toContain('куплено 11:40')
  })

  it('при n = 100 классифицирует и рисует шкалу', () => {
    const exact = snapshot({
      buckets: [
        {
          hero_id: 6,
          lane_role: 1,
          item_key: 'blink',
          stats: { n: 100, p25: 600, p50: 750, p75: 900 },
        },
      ],
    })
    const html = render('ru', { player: player(LOG), patch: 60, snapshot: exact })
    const row = rowFor(html, 'blink')
    expect(row).toContain('item-timing-scale')
    expect(row).toContain('в типичном диапазоне')
  })

  it('ранняя и поздняя покупки получают разные классы и позиции маркера', () => {
    const early = render('ru', {
      player: player([{ time: 300, key: 'blink' }]),
      patch: 60,
      snapshot: snapshot(),
    })
    const late = render('ru', {
      player: player([{ time: 1200, key: 'blink' }]),
      patch: 60,
      snapshot: snapshot(),
    })
    expect(rowFor(early, 'blink')).toContain('раньше типичного')
    expect(rowFor(early, 'blink')).toContain('data-position="before-range"')
    expect(rowFor(late, 'blink')).toContain('позже типичного')
    expect(rowFor(late, 'blink')).toContain('data-position="after-range"')
  })

  it('чужой патч не сравнивается с нормативами', () => {
    const html = render('ru', { player: player(LOG), patch: 59, snapshot: snapshot() })
    const row = rowFor(html, 'blink')
    expect(row).not.toContain('в типичном диапазоне')
    expect(row).not.toContain('item-timing-scale')
  })

  it('выбранный игрок не получает чужой норматив', () => {
    const html = render('ru', {
      player: player(LOG, { hero_id: 11, lane_role: 2 }),
      patch: 60,
      snapshot: snapshot(),
    })
    for (const row of rows(html)) {
      expect(row).not.toContain('item-timing-scale')
      expect(row).not.toContain('медиана')
    }
  })

  it('повторная покупка не переиспользует норматив первой', () => {
    const repeated = render('ru', {
      player: player([
        { time: 700, key: 'blink' },
        { time: 1500, key: 'blink' },
      ]),
      patch: 60,
      snapshot: snapshot(),
    })
    const blinkRows = rows(repeated).filter((row) => row.includes('data-item-key="blink"'))
    expect(blinkRows).toHaveLength(2)
    expect(blinkRows[0]).toContain('item-timing-scale')
    expect(blinkRows[0]).not.toContain('Повторная покупка')
    expect(blinkRows[1]).toContain('покупка №2')
    expect(blinkRows[1]).not.toContain('item-timing-scale')
    expect(blinkRows[1]).not.toContain('медиана')
    expect(blinkRows[1]).toContain('Повторная покупка')
    expect(rows(repeated).filter((row) => row.includes('item-timing-scale'))).toHaveLength(1)
  })
})

