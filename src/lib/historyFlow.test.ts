import { describe, expect, it } from 'vitest'

import {
  HISTORY_NO_DATABASE_MESSAGE,
  isOpenableHistoryItem,
  loadHistoryPage,
  type HistoryFlowDeps,
} from './historyFlow'
import {
  createHistoryReportsService,
  parseHistoryRow,
  type HistoryListResult,
  type HistoryReportItem,
  type HistoryReportsService,
} from './historyReports'
import type { ReportDbError } from './matchReports'

/**
 * Тесты оркестрации истории (Task 12): состояния страницы, ограничение выборки
 * текущим пользователем, постраничная догрузка и обработка ошибок.
 *
 * Живая база и OpenDota не используются: сервис подменяется в памяти.
 */

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

function makeItem(overrides: Record<string, unknown> = {}): HistoryReportItem {
  const parsed = parseHistoryRow({
    id: 'row-1',
    user_id: USER_A,
    match_id: '9007760151',
    status: 'ready',
    source: 'OpenDota',
    rules_version: '1.0.0',
    created_at: '2026-10-21T09:30:00.000Z',
    fetched_at: '2026-10-21T09:29:00.000Z',
    radiant_win: true,
    ...overrides,
  })
  if (!parsed.ok) {
    throw new Error('тестовая строка должна проходить валидацию')
  }
  return parsed.item
}

/** Подмена сервиса истории: фиксирует параметры и возвращает заданный результат. */
function makeFakeService(result?: HistoryListResult) {
  const state = {
    calls: [] as Array<{ userId: string; limit?: number; offset?: number }>,
    result:
      result ?? ({ ok: true, items: [makeItem()], skippedCount: 0 } as HistoryListResult),
  }
  const service: HistoryReportsService = {
    async listPersonalMatchReports(params) {
      state.calls.push({ userId: params.userId, limit: params.limit, offset: params.offset })
      return state.result
    },
  }
  return { state, service }
}

function makeDeps(overrides: Partial<HistoryFlowDeps> = {}): HistoryFlowDeps {
  return {
    authStatus: 'authenticated',
    userId: USER_A,
    service: null,
    ...overrides,
  }
}

describe('состояния страницы истории', () => {
  it('не читает данные, пока состояние сессии неизвестно', async () => {
    const { state, service } = makeFakeService()
    const result = await loadHistoryPage(
      makeDeps({ authStatus: 'loading', userId: null, service }),
    )
    expect(result.status).toBe('waiting-auth')
    expect(state.calls).toEqual([])
  })

  it('для гостя не выполняет ни одного запроса к базе', async () => {
    const { state, service } = makeFakeService()
    const result = await loadHistoryPage(
      makeDeps({ authStatus: 'anonymous', userId: null, service }),
    )
    expect(result.status).toBe('signed-out')
    expect(state.calls).toEqual([])
  })

  it('честно сообщает, когда Supabase не настроен', async () => {
    const result = await loadHistoryPage(makeDeps({ service: null }))
    expect(result).toEqual({ status: 'no-database', message: HISTORY_NO_DATABASE_MESSAGE })
  })

  it('возвращает список отчётов и признак возможной догрузки', async () => {
    const items = [makeItem({ id: 'row-1' }), makeItem({ id: 'row-2' })]
    const { state, service } = makeFakeService({ ok: true, items, skippedCount: 1 })

    const result = await loadHistoryPage(makeDeps({ service, pageSize: 2 }), 0)

    expect(result.status).toBe('list')
    if (result.status !== 'list') {
      return
    }
    expect(result.items).toHaveLength(2)
    expect(result.hasMore).toBe(true) // вернулась полная страница
    expect(result.skippedCount).toBe(1)
    expect(result.offset).toBe(0)
    expect(state.calls).toEqual([{ userId: USER_A, limit: 2, offset: 0 }])
  })

  it('не обещает догрузку, когда страница вернулась неполной', async () => {
    const { service } = makeFakeService({ ok: true, items: [makeItem()], skippedCount: 0 })
    const result = await loadHistoryPage(makeDeps({ service, pageSize: 20 }))
    expect(result.status).toBe('list')
    if (result.status !== 'list') {
      return
    }
    expect(result.hasMore).toBe(false)
  })

  it('возвращает пустой список без ошибки', async () => {
    const { service } = makeFakeService({ ok: true, items: [], skippedCount: 0 })
    const result = await loadHistoryPage(makeDeps({ service }))
    expect(result.status).toBe('list')
    if (result.status !== 'list') {
      return
    }
    expect(result.items).toEqual([])
    expect(result.hasMore).toBe(false)
  })

  it('передаёт ошибку базы данных как состояние ошибки', async () => {
    const error: ReportDbError = { kind: 'network', code: null, message: 'нет связи' }
    const { service } = makeFakeService({ ok: false, error })
    const result = await loadHistoryPage(makeDeps({ service }))
    expect(result).toEqual({ status: 'error', error })
  })

  it('запрашивает только отчёты текущего пользователя', async () => {
    const { state, service } = makeFakeService()
    await loadHistoryPage(makeDeps({ service, userId: USER_A }))
    await loadHistoryPage(makeDeps({ service, userId: USER_B }))
    expect(state.calls.map((call) => call.userId)).toEqual([USER_A, USER_B])
  })

  it('поддерживает постраничную догрузку через offset', async () => {
    const { state, service } = makeFakeService({ ok: true, items: [makeItem()], skippedCount: 0 })
    const result = await loadHistoryPage(makeDeps({ service, pageSize: 20 }), 20)
    expect(result.status).toBe('list')
    if (result.status !== 'list') {
      return
    }
    expect(result.offset).toBe(20)
    expect(state.calls).toEqual([{ userId: USER_A, limit: 20, offset: 20 }])
  })
})

describe('правила открытия сохранённого отчёта', () => {
  it('открывает готовые отчёты и не открывает незавершённые', () => {
    expect(isOpenableHistoryItem(makeItem({ status: 'ready' }))).toBe(true)
    expect(isOpenableHistoryItem(makeItem({ status: 'partial' }))).toBe(true)
    expect(isOpenableHistoryItem(makeItem({ status: 'pending' }))).toBe(false)
    expect(isOpenableHistoryItem(makeItem({ status: 'error' }))).toBe(false)
  })
})

describe('история только читает данные', () => {
  it('набор зависимостей ограничен чтением: ни провайдера, ни записей', async () => {
    const { state, service } = makeFakeService()
    const deps = makeDeps({ service })

    expect(Object.keys(deps).sort()).toEqual(['authStatus', 'service', 'userId'])
    await loadHistoryPage(deps)

    expect(state.calls).toHaveLength(1)
    expect('insertPersonalReport' in service).toBe(false)
    expect('savePersonalMatchReport' in service).toBe(false)
  })

  it('делает ровно один запрос на страницу (без N+1)', async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      id: `row-${index}`,
      user_id: USER_A,
      match_id: `900776015${index}`,
      status: 'ready',
      source: 'OpenDota',
      rules_version: '1.0.0',
      created_at: `2026-10-2${index}T09:00:00.000Z`,
      fetched_at: null,
      radiant_win: null,
    }))
    const calls: Array<{ userId: string; limit: number; offset: number }> = []
    const service = createHistoryReportsService({
      async selectPersonalReportList(params) {
        calls.push({ ...params })
        return { data: rows, error: null }
      },
    })

    const result = await loadHistoryPage(makeDeps({ service, pageSize: 5 }))

    expect(result.status).toBe('list')
    if (result.status !== 'list') {
      return
    }
    expect(result.items).toHaveLength(5)
    expect(calls).toHaveLength(1)
  })
})