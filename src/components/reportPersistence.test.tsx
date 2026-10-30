import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ANALYSIS_RULES_VERSION } from '../lib/analysisRules'
import type { ReportSaveState } from '../lib/matchReportFlow'
import { buildPendingView, type MatchReportView, type ReportDbError } from '../lib/matchReports'
import { normalizeMatch } from '../lib/normalizeMatch'
import AnalysisReport from './AnalysisReport'
import ReportPersistenceNotice from './ReportPersistenceNotice'

/**
 * SSR-проверки панели состояния личного отчёта (Task 11).
 * Используется уже установленный `react-dom/server` — новых зависимостей нет.
 *
 * Ключевое требование: формулировка «сохранено» показывается только при
 * подтверждённой записи в базе, а сгенерированный, но не сохранённый отчёт
 * отображается с явным предупреждением.
 */

const RAW_MATCH = {
  match_id: 9007760151,
  duration: 2069,
  radiant_win: true,
  players: [
    {
      player_slot: 0,
      hero_id: 6,
      kills: 16,
      deaths: 3,
      assists: 15,
      last_hits: 238,
      lh_t: [0, 3, 7, 10, 11, 17, 23, 28, 33, 40, 47, 53, 57, 62, 70, 86],
      gold_t: [0, 287, 779, 1029, 1540, 1906, 2379, 2684, 3037, 3438, 3864, 4191, 4520, 4890, 5300, 5860],
      xp_t: [0, 118, 408, 765, 1068, 1306, 1792, 2074, 2380, 2661, 2907, 3201, 3501, 3820, 4150, 4512],
      kills_log: [{ time: 102 }],
      deaths_log: [{ time: 186 }],
      purchase_log: [{ time: 120, key: 'boots' }],
      lane_efficiency_pct: 78,
    },
    { player_slot: 128, hero_id: 11, kills: 1, deaths: 9, assists: 2 },
  ],
}

const USER_A = '11111111-1111-4111-8111-111111111111'
const MATCH_ID = '9007760151'

function makeFreshView(overrides: Partial<MatchReportView> = {}): MatchReportView {
  return {
    ...buildPendingView({
      userId: USER_A,
      requestedId: MATCH_ID,
      match: normalizeMatch(RAW_MATCH),
      fetchedAt: '2026-10-25T10:00:00.000Z',
    }),
    ...overrides,
  }
}

function makeSavedView(overrides: Partial<MatchReportView> = {}): MatchReportView {
  return makeFreshView({
    id: 'row-1',
    createdAt: '2026-10-25T10:00:05.000Z',
    updatedAt: '2026-10-25T10:00:05.000Z',
    ...overrides,
  })
}

const NETWORK_ERROR: ReportDbError = {
  kind: 'network',
  code: null,
  message: 'Не удалось связаться с базой данных Supabase.',
}

function renderNotice(
  view: MatchReportView,
  save: ReportSaveState,
  extra: Record<string, unknown> = {},
) {
  return renderToStaticMarkup(<ReportPersistenceNotice view={view} save={save} {...extra} />)
}

describe('ReportPersistenceNotice — состояния сохранения', () => {
  it('для сохранённого отчёта показывает, что OpenDota не запрашивалась', () => {
    const html = renderNotice(makeSavedView(), { kind: 'stored' })
    expect(html).toContain('Сохранённый отчёт')
    expect(html).toContain('OpenDota не запрашивалась')
    expect(html).toContain(`Версия правил анализа: <strong>${ANALYSIS_RULES_VERSION}</strong>`)
    expect(html).toContain('Источник данных: <strong>OpenDota</strong>')
    expect(html).toContain('row-1')
    expect(html).toContain('2026-10-25 10:00 UTC')
  })

  it('для нового отчёта сообщает, что он сохранён', () => {
    const html = renderNotice(makeSavedView(), { kind: 'saved' })
    expect(html).toContain('Новый отчёт сохранён')
    expect(html).toContain('сохранён в личной истории')
  })

  it('для гостевого режима честно сообщает, что отчёт не сохраняется', () => {
    const html = renderNotice(makeFreshView(), { kind: 'guest' }, {
      loginLink: <a href="/login">Войти в аккаунт</a>,
    })
    expect(html).toContain('Гостевой режим')
    expect(html).toContain('Отчёт не сохраняется')
    expect(html).toContain('Войти в аккаунт')
    expect(html).not.toContain('Новый отчёт сохранён')
    expect(html).not.toContain('Отчёт сохранён:')
  })

  it('при неудачном сохранении показывает предупреждение и путь повтора', () => {
    const html = renderNotice(makeFreshView(), { kind: 'save-failed', error: NETWORK_ERROR }, {
      onRetrySave: () => {},
    })
    expect(html).toContain('Отчёт не сохранён')
    expect(html).toContain('Отчёт сформирован, но сохранить его не удалось.')
    expect(html).toContain('Повторить сохранение')
    expect(html).not.toContain('Новый отчёт сохранён')
    expect(html).not.toContain('Отчёт сохранён:')
  })

  it('не показывает кнопку повтора, если повтор невозможен', () => {
    const html = renderNotice(makeFreshView(), { kind: 'save-failed', error: NETWORK_ERROR })
    expect(html).not.toContain('Повторить сохранение')
  })

  it('для частичного отчёта объясняет неполноту данных', () => {
    const view = makeSavedView({
      status: 'partial',
      limitations: [{ code: 'match.duration.missing', text: 'Длительность матча отсутствует.' }],
    })
    const html = renderNotice(view, { kind: 'saved' })
    expect(html).toContain('Частичный отчёт')
    expect(html).toContain('Ограничения сохранённых данных')
    expect(html).toContain('Длительность матча отсутствует.')
  })

  it('показывает фактическое уведомление о расхождении версий правил', () => {
    const html = renderNotice(makeSavedView({ rulesVersion: '0.9.0' }), { kind: 'stored' })
    expect(html).toContain('Отчёт сохранён с версией правил анализа 0.9.0')
    expect(html).toContain(`текущая версия правил — ${ANALYSIS_RULES_VERSION}`)
    expect(html).toContain('без пересчёта')
  })

  it('для незавершённой записи сообщает статус и отсутствие перезаписи', () => {
    const html = renderNotice(makeFreshView(), {
      kind: 'unresolved',
      status: 'pending',
      message: 'В базе уже есть незавершённая запись отчёта (статус: pending).',
    })
    expect(html).toContain('Незавершённая запись')
    expect(html).toContain('статус: pending')
    expect(html).not.toContain('Новый отчёт сохранён')
  })
})

describe('AnalysisReport — показ сохранённого анализа', () => {
  it('использует переданный сохранённый анализ, а не пересчитывает правила', () => {
    const view = makeSavedView()
    const stored = view.analyses[0].analysis
    const customAnalysis = {
      ...stored,
      rule_version: '0.9.0',
      observations: [
        {
          ...stored.observations[0],
          rule_version: '0.9.0',
          text: 'Сохранённое наблюдение из прошлой версии правил.',
        },
      ],
    }

    const html = renderToStaticMarkup(
      <AnalysisReport
        match={view.match}
        player={view.match.players[0]}
        analysis={customAnalysis}
      />,
    )

    expect(html).toContain('Версия правил анализа: 0.9.0')
    expect(html).toContain('Сохранённое наблюдение из прошлой версии правил.')
  })

  it('без переданного анализа продолжает рассчитывать наблюдения локально (Task 9)', () => {
    const view = makeSavedView()
    const html = renderToStaticMarkup(
      <AnalysisReport match={view.match} player={view.match.players[0]} />,
    )
    expect(html).toContain(`Версия правил анализа: ${ANALYSIS_RULES_VERSION}`)
    expect(html).toContain('Добивания к 15:00 (lh_t[15]) — 86.')
  })
})