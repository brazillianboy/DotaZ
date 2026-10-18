import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RECOMMENDATIONS_UNAVAILABLE_NOTE } from '../lib/analysisRules'
import { normalizeMatch } from '../lib/normalizeMatch'
import type { NormalizedMatch } from '../types/match'
import AnalysisReport from './AnalysisReport'
import EvidenceList from './EvidenceList'
import RecommendationsList from './RecommendationsList'
import ReportLimitations from './ReportLimitations'
import { analyzePlayer } from '../lib/analysisRules'

/**
 * SSR-проверки компонентов анализа (Task 9).
 * Используется уже установленный `react-dom/server` — новых зависимостей нет.
 */

const RAW_PLAYER = {
  player_slot: 0,
  hero_id: 6,
  kills: 16,
  deaths: 3,
  assists: 15,
  last_hits: 238,
  lh_t: [0, 3, 7, 10, 11, 17, 23, 28, 33, 40, 47],
  gold_t: [0, 287, 779, 1029, 1540, 1906, 2379, 2684, 3037, 3438, 3864],
  xp_t: [0, 118, 408, 765, 1068, 1306, 1792, 2074, 2380, 2661, 2907],
  kills_log: [{ time: 102 }, { time: 540 }],
  deaths_log: [{ time: 186 }],
  purchase_log: [{ time: 120, key: 'boots' }],
  lane_efficiency_pct: 78,
}

function buildMatch(playersRaw: unknown[]): NormalizedMatch {
  return normalizeMatch({ match_id: 9007760151, duration: 2069, radiant_win: true, players: playersRaw })
}

describe('EvidenceList — наблюдения и подтверждения', () => {
  it('рендерит текст, метку «Наблюдение, не оценка», источник, период и подтверждения', () => {
    const match = buildMatch([RAW_PLAYER])
    const analysis = analyzePlayer(match, match.players[0])
    const html = renderToStaticMarkup(<EvidenceList observations={analysis.observations} />)

    expect(html).toContain('Наблюдения')
    expect(html).toContain('Наблюдение, не оценка')
    expect(html).toContain('Источник: OpenDota')
    expect(html).toContain('Период: 00:00–10:00')
    expect(html).toContain('Период: весь матч')
    // Тексты наблюдений и подтверждения
    expect(html).toContain('Добивания к 10:00 (lh_t[10]) — 47.')
    expect(html).toContain('lh_t[10]')
    expect(html).toContain('3864')
    expect(html).toContain('lane_efficiency_pct')
  })

  it('без наблюдений показывает сообщение о недостатке данных', () => {
    const html = renderToStaticMarkup(<EvidenceList observations={[]} />)
    expect(html).toContain('Недостаточно данных для достоверной оценки.')
  })
})

describe('RecommendationsList — отсутствие неподтверждённых советов', () => {
  it('при пустом списке показывает честное пояснение', () => {
    const html = renderToStaticMarkup(
      <RecommendationsList recommendations={[]} note={RECOMMENDATIONS_UNAVAILABLE_NOTE} />,
    )
    expect(html).toContain('Рекомендации')
    expect(html).toContain('нормы героя и роли')
    expect(html).not.toContain('рекомендуется')
  })
})

describe('ReportLimitations — ограничения анализа', () => {
  it('рендерит список ограничений', () => {
    const match = buildMatch([{ player_slot: 0, kills: 1, deaths: 2, assists: 3 }])
    const analysis = analyzePlayer(match, match.players[0])
    const html = renderToStaticMarkup(<ReportLimitations limitations={analysis.limitations} />)
    expect(html).toContain('Ограничения анализа')
    expect(html).toContain('Нормы героя и роли не подтверждены')
    expect(html).toContain('Журналы событий первых десяти минут')
  })
})

describe('AnalysisReport — контейнер секции анализа', () => {
  it('без выбранного игрока предлагает выбрать участника', () => {
    const match = buildMatch([RAW_PLAYER])
    const html = renderToStaticMarkup(<AnalysisReport match={match} player={null} />)
    expect(html).toContain('Выберите участника')
  })

  it('показывает версию правил и все три секции', () => {
    const match = buildMatch([RAW_PLAYER])
    const html = renderToStaticMarkup(<AnalysisReport match={match} player={match.players[0]} />)
    expect(html).toContain('Версия правил анализа: 1.0.0')
    expect(html).toContain('Наблюдения')
    expect(html).toContain('Рекомендации')
    expect(html).toContain('Ограничения анализа')
  })

  it('обновляет содержимое при выборе другого игрока', () => {
    const match = buildMatch([
      RAW_PLAYER,
      { player_slot: 128, kills: 1, deaths: 9, assists: 2, lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12] },
    ])
    const radiantHtml = renderToStaticMarkup(
      <AnalysisReport match={match} player={match.players[0]} />,
    )
    const direHtml = renderToStaticMarkup(
      <AnalysisReport match={match} player={match.players[1]} />,
    )
    expect(radiantHtml).toContain('— 47.')
    expect(direHtml).toContain('— 12.')
    expect(radiantHtml).not.toBe(direHtml)
  })

  it('не содержит оценочных формулировок', () => {
    const match = buildMatch([RAW_PLAYER])
    const html = renderToStaticMarkup(<AnalysisReport match={match} player={match.players[0]} />)
    const lower = html.toLowerCase()
    for (const forbidden of ['хорош', 'плох', 'ошибк', 'провал', 'успешн']) {
      expect(lower).not.toContain(forbidden)
    }
  })
})