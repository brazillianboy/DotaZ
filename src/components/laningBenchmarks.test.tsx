import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '../i18n/I18nContext'
import { buildLaningStageData } from '../lib/laning'
import { BENCHMARK_METHOD_VERSION, type BenchmarkSnapshot } from '../lib/benchmarks'
import type { NormalizedPlayer } from '../types/match'
import LaningBenchmarks from './LaningBenchmarks'

/**
 * Проверки секции нормативов (Task 16): RU/EN и состояния недоступности.
 * Значения фикстуры синтетические и не выдаются за реальные нормативы.
 */

const CYRILLIC = /[А-Яа-яЁё]/

function makeSnapshot(): BenchmarkSnapshot {
  return {
    method_version: BENCHMARK_METHOD_VERSION,
    source: {
      name: 'OpenDota Explorer',
      url: 'https://api.opendota.com/api/explorer',
      dataset: 'test',
      attribution: 'OpenDota (opendota.com)',
    },
    generated_at: '2026-11-07T00:00:00.000Z',
    patch: '7.41',
    patch_id: 60,
    interval: { minutes: 15, arrayIndex: 16, label: '00:00–15:00' },
    thresholds: { full: 200, medianOnly: 50 },
    bucket_count: 1,
    buckets: [
      {
        hero_id: 6,
        lane_role: 1,
        metrics: {
          lastHits: { n: 400, p25: 90, p50: 110, p75: 130 },
          gold: { n: 400, p25: 6000, p50: 6800, p75: 7500 },
          xp: { n: 60, p25: 5500, p50: 6200, p75: 6900 },
        },
      },
    ],
  }
}

function makePlayer(laneRole: number | null = 1): NormalizedPlayer {
  return {
    player_slot: 0,
    team: 'radiant',
    hero_id: 6,
    kills: 1,
    deaths: 1,
    assists: 1,
    gold_per_min: 500,
    xp_per_min: 500,
    last_hits: 200,
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
    lane: 3,
    lane_role: laneRole,
    ability_upgrades: null,
    purchaseLog: null,
    laning: buildLaningStageData({
      lh_t: [...Array.from({ length: 15 }, () => 0), 120],
      gold_t: [...Array.from({ length: 15 }, () => 0), 7000],
      xp_t: [...Array.from({ length: 15 }, () => 0), 6000],
    }),
  }
}

function render(locale: 'ru' | 'en', props: Parameters<typeof LaningBenchmarks>[0]): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <LaningBenchmarks {...props} />
    </I18nProvider>,
  )
}

describe('LaningBenchmarks — отображение', () => {
  it('в русской локали показывает факт, медиану, квартили и выборку', () => {
    const html = render('ru', { player: makePlayer(), patch: 60, snapshot: makeSnapshot() })
    expect(html).toContain('LH к 15:00')
    expect(html).toContain('Медиана')
    expect(html).toContain('110')
    expect(html).toContain('90')
    expect(html).toContain('130')
    expect(html).toContain('400')
    expect(html).toContain('7.41')
    // Заголовок показывает интервал нормативов, а не устаревшую метку 10 минут.
    expect(html).toContain('00:00–15:00')
    expect(html).not.toContain('00:00–10:00')
  })

  it('в английской локали не содержит кириллицы', () => {
    const html = render('en', { player: makePlayer(), patch: 60, snapshot: makeSnapshot() })
    expect(html).toContain('LH at 15:00')
    expect(html).toContain('Median')
    expect(html).toContain('First 15-Minute Benchmarks')
    expect(html).toContain('00:00–15:00')
    expect(html).not.toContain('00:00–10:00')
    expect(html).not.toMatch(CYRILLIC)
  })

  it('без снапшота показывает честное отсутствие нормативов', () => {
    const html = render('ru', { player: makePlayer(), patch: 60, snapshot: null })
    expect(html).toContain('Нормативы недоступны')
    // Даже без данных заголовок не должен вводить в заблуждение про 10 минут.
    expect(html).toContain('00:00–15:00')
    expect(html).not.toContain('00:00–10:00')
  })

  it('при чужом патче не показывает числа норматива', () => {
    const html = render('ru', { player: makePlayer(), patch: 59, snapshot: makeSnapshot() })
    expect(html).toContain('другому патчу')
    expect(html).not.toContain('Медиана')
  })

  it('без линии показывает состояние «линия не определена»', () => {
    const html = render('ru', { player: makePlayer(null), patch: 60, snapshot: makeSnapshot() })
    expect(html).toContain('Линия игрока не определена')
  })

  it('старый отчёт за 10 минут показывает отказ вместо ложного сравнения', () => {
    const player = makePlayer()
    const legacy = {
      ...player,
      laning: { ...player.laning, interval: { minutes: 10, label: '00:00–10:00' } },
    }
    const html = render('ru', { player: legacy, patch: 60, snapshot: makeSnapshot() })
    expect(html).toContain('сравнение не выполняется')
    expect(html).not.toContain('Медиана')
    // Заголовок описывает интервал нормативов (15 минут), а отказ — интервал отчёта (10 минут).
    expect(html).toContain('00:00–15:00')
    expect(html).toContain('00:00–10:00')
  })

  it('малая выборка по метрике не выдаёт кварталы', () => {
    const html = render('ru', { player: makePlayer(), patch: 60, snapshot: makeSnapshot() })
    expect(html).toContain('медиана (малая выборка)')
  })

/**
 * Регрессия мобильного переполнения (2026-11-09).
 *
 * Таблица нормативов задаёт минимальную ширину около 483 px из-за `white-space: nowrap`,
 * поэтому без контейнера прокрутки документ переполнялся по горизонтали на ~390 px.
 * Проверяется, что таблица обёрнута в тот же `.table-scroll`, что и остальные таблицы
 * отчёта, что колонки и значения не изменились и что обёртка не скрывает данные.
 */
describe('LaningBenchmarks — контейнер горизонтальной прокрутки', () => {
  function countOf(html: string, needle: string): number {
    return html.split(needle).length - 1
  }

  it('таблица обёрнута в .table-scroll перед собой', () => {
    const html = render('ru', { player: makePlayer(), patch: 60, snapshot: makeSnapshot() })
    expect(html).toContain('<div class="table-scroll"><table class="bench-table">')
    expect(html).toContain('</table></div>')
    // Ровно один контейнер прокрутки на секцию: без вложенных дублей.
    expect(countOf(html, 'class="table-scroll"')).toBe(1)
    expect(countOf(html, 'class="bench-table"')).toBe(1)
  })

  it('все шесть колонок нормативов сохранены', () => {
    const html = render('ru', { player: makePlayer(), patch: 60, snapshot: makeSnapshot() })
    expect(countOf(html, 'scope="col"')).toBe(6)
    for (const label of ['Показатель', 'Факт', 'Медиана', 'p25–p75', 'Разница', 'Выборка']) {
      expect(html).toContain(label)
    }
    // Строки метрик остались на месте (три ключа BENCHMARK_METRICS).
    expect(countOf(html, 'data-metric=')).toBe(3)
  })

  it('значения нормативов не изменились обёрткой', () => {
    const html = render('ru', { player: makePlayer(), patch: 60, snapshot: makeSnapshot() })
    expect(html).toContain('110') // медиана LH
    expect(html).toContain('90') // p25
    expect(html).toContain('130') // p75
    expect(html).toContain('400') // размер выборки
  })

  it('обёртка не скрывает таблицу от пользователя и от скринридера', () => {
    const html = render('ru', { player: makePlayer(), patch: 60, snapshot: makeSnapshot() })
    // Контейнер прокрутки не должен быть скрыт, отключён от AT или обрезан без прокрутки.
    expect(html).not.toContain('aria-hidden="true"><table class="bench-table"')
    expect(html).not.toMatch(/class="table-scroll"[^>]*style=/)
    expect(html).not.toMatch(/class="table-scroll"[^>]*hidden/)
    // Семантика таблицы сохранена.
    expect(html).toContain('<thead>')
    expect(html).toContain('<tbody>')
    expect(countOf(html, 'scope="row"')).toBe(3)
  })

  it('английская версия тоже использует контейнер прокрутки', () => {
    const html = render('en', { player: makePlayer(), patch: 60, snapshot: makeSnapshot() })
    expect(html).toContain('<div class="table-scroll"><table class="bench-table">')
    expect(html).not.toMatch(CYRILLIC)
  })

  it('без нормативов контейнер прокрутки не создаётся', () => {
    const html = render('ru', { player: makePlayer(), patch: 60, snapshot: null })
    expect(html).not.toContain('class="table-scroll"')
    expect(html).not.toContain('class="bench-table"')
    expect(html).toContain('Нормативы недоступны')
  })

  it('при чужом патче таблица не рендерится и обёртки нет', () => {
    const html = render('ru', { player: makePlayer(), patch: 59, snapshot: makeSnapshot() })
    expect(html).not.toContain('class="table-scroll"')
    expect(html).toContain('другому патчу')
  })
})

})
