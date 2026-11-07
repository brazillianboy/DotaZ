import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '../i18n/I18nContext'
import { BENCHMARK_METHOD_VERSION, type BenchmarkSnapshot } from '../lib/benchmarks'
import { buildLaningStageData } from '../lib/laning'
import type { NormalizedPlayer } from '../types/match'
import PlayerInsights from './PlayerInsights'

/**
 * Проверки секции «Анализ ошибок и рекомендации» (Task 17): RU/EN и состояния.
 * Значения фикстуры синтетические и не выдаются за реальные нормативы.
 */

const CYRILLIC = /[А-Яа-яЁё]/

function snapshot(): BenchmarkSnapshot {
  return {
    method_version: BENCHMARK_METHOD_VERSION,
    source: { name: 'OpenDota Explorer', url: '', dataset: 'test', attribution: 'OpenDota' },
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
          xp: { n: 400, p25: 5900, p50: 6700, p75: 7400 },
        },
      },
    ],
  }
}

function timeline(value: number): number[] {
  return [...Array.from({ length: 15 }, () => 0), value]
}

function player(lh = 80, deaths: { time: number }[] = []): NormalizedPlayer {
  return {
    player_slot: 0,
    team: 'radiant',
    hero_id: 6,
    kills: 1,
    deaths: deaths.length,
    assists: 2,
    gold_per_min: 500,
    xp_per_min: 500,
    last_hits: lh,
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
    purchaseLog: null,
    laning: buildLaningStageData({
      lh_t: timeline(lh),
      gold_t: timeline(7000),
      xp_t: timeline(6800),
      deaths_log: deaths,
      kills_log: [],
    }),
  }
}

function render(locale: 'ru' | 'en', props: Parameters<typeof PlayerInsights>[0]): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <PlayerInsights {...props} />
    </I18nProvider>,
  )
}

describe('PlayerInsights — отображение', () => {
  it('в русской локали показывает находку, числа, источник и рекомендацию', () => {
    const html = render('ru', { player: player(80), patch: 60, snapshot: snapshot() })
    expect(html).toContain('Анализ ошибок и рекомендации')
    expect(html).toContain('Добивания ниже типичного диапазона')
    expect(html).toContain('80')
    expect(html).toContain('110')
    expect(html).toContain('Рекомендация')
    expect(html).toContain('OpenDota')
    expect(html).toContain('7.41')
  })

  it('в английской локали не содержит кириллицы', () => {
    const html = render('en', { player: player(80), patch: 60, snapshot: snapshot() })
    expect(html).toContain('Performance Insights &amp; Recommendations')
    expect(html).toContain('Last hits below the typical range')
    expect(html).not.toMatch(CYRILLIC)
  })

  it('без нормативов показывает пояснение и только события', () => {
    const html = render('ru', {
      player: player(80, [{ time: 100 }, { time: 200 }, { time: 300 }]),
      patch: 60,
      snapshot: null,
    })
    expect(html).toContain('Статистические сравнения недоступны')
    expect(html).toContain('Несколько смертей')
    expect(html).not.toContain('Добивания ниже типичного диапазона')
  })

  it('без данных игрока сообщает о недоступности анализа', () => {
    const html = render('ru', { player: null, patch: 60, snapshot: snapshot() })
    expect(html).toContain('Анализ недоступен')
  })

  it('без находок сообщает, что проблем не обнаружено', () => {
    const html = render('ru', { player: player(115), patch: 60, snapshot: snapshot() })
    expect(html).toContain('Поддерживаемых проблем не обнаружено')
  })
})
