import { describe, expect, it } from 'vitest'

import {
  HISTORY_MAX_PAGE_SIZE,
  HISTORY_PAGE_SIZE,
  INVALID_HISTORY_ROW_MESSAGE,
  compareHistoryItems,
  createHistoryReportsService,
  createRequestGuard,
  formatHistoryTimestamp,
  parseHistoryRow,
  parseRadiantWin,
  sortHistoryItems,
  type HistoryReportItem,
} from './historyReports'
import type { ReportDbError } from './matchReports'

/**
 * Тесты слоя истории (Task 12): строгая валидация метаданных, устойчивая сортировка,
 * ограничение выборки текущим пользователем, защита от устаревших ответов.
 *
 * Живая база не используется: клиент списка подменяется в памяти.
 */

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
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
  }
}

function makeItem(overrides: Record<string, unknown> = {}): HistoryReportItem {
  const parsed = parseHistoryRow(makeRow(overrides))
  if (!parsed.ok) {
    throw new Error('тестовая строка должна проходить валидацию')
  }
  return parsed.item
}

/** Подмена клиента списка с фиксацией параметров запроса. */
function makeFakeListClient(initialRows: unknown[]) {
  const state = {
    rows: initialRows,
    error: null as ReportDbError | null,
    calls: [] as Array<{ userId: string; limit: number; offset: number }>,
  }
  const client = {
    async selectPersonalReportList(params: { userId: string; limit: number; offset: number }) {
      state.calls.push({ ...params })
      return { data: state.error === null ? state.rows : null, error: state.error }
    },
  }
  return { state, client }
}

describe('валидация метаданных строки истории', () => {
  it('принимает корректную строку и сохраняет ID матча точной строкой', () => {
    const parsed = parseHistoryRow(makeRow({ match_id: '18446744073709551615' }))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    expect(parsed.item.matchId).toBe('18446744073709551615')
    expect(typeof parsed.item.matchId).toBe('string')
    expect(parsed.item.status).toBe('ready')
    expect(parsed.item.source).toBe('OpenDota')
    expect(parsed.item.rulesVersion).toBe('1.0.0')
    expect(parsed.item.radiantWin).toBe(true)
  })

  it('различает результат матча, строковое представление и отсутствие данных', () => {
    expect(parseRadiantWin(true)).toBe(true)
    expect(parseRadiantWin(false)).toBe(false)
    expect(parseRadiantWin('true')).toBe(true)
    expect(parseRadiantWin('false')).toBe(false)
    expect(parseRadiantWin(null)).toBeNull()
    expect(parseRadiantWin(undefined)).toBeNull()
    expect(parseRadiantWin('нет')).toBeNull()
    expect(parseRadiantWin(1)).toBeNull()
  })

  it('сохраняет отсутствие даты как null (без выдумывания значений)', () => {
    const parsed = parseHistoryRow(
      makeRow({ created_at: null, fetched_at: null, rules_version: null }),
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    expect(parsed.item.createdAt).toBeNull()
    expect(parsed.item.fetchedAt).toBeNull()
    expect(parsed.item.rulesVersion).toBeNull()
  })

  it('отклоняет повреждённые метаданные', () => {
    expect(parseHistoryRow(null)).toEqual({
      ok: false,
      reason: 'invalid_row',
      message: INVALID_HISTORY_ROW_MESSAGE,
    })
    expect(parseHistoryRow(makeRow({ match_id: 'abc' })).ok).toBe(false)
    expect(parseHistoryRow(makeRow({ match_id: '' })).ok).toBe(false)
    expect(parseHistoryRow(makeRow({ status: 'unknown' })).ok).toBe(false)
    expect(parseHistoryRow(makeRow({ id: '' })).ok).toBe(false)
    expect(parseHistoryRow(makeRow({ user_id: null })).ok).toBe(false)
    expect(parseHistoryRow(makeRow({ source: null })).ok).toBe(false)
    expect(parseHistoryRow(makeRow({ created_at: 42 })).ok).toBe(false)
  })
})

describe('сортировка истории', () => {
  it('ставит новые отчёты первыми', () => {
    const older = makeItem({ id: 'row-old', created_at: '2026-10-20T09:00:00.000Z' })
    const newer = makeItem({ id: 'row-new', created_at: '2026-10-22T09:00:00.000Z' })
    expect(sortHistoryItems([older, newer]).map((item) => item.id)).toEqual(['row-new', 'row-old'])
  })

  it('обеспечивает устойчивый порядок при одинаковых датах', () => {
    const first = makeItem({ id: 'row-a', created_at: '2026-10-21T09:00:00.000Z' })
    const second = makeItem({ id: 'row-b', created_at: '2026-10-21T09:00:00.000Z' })
    const third = makeItem({ id: 'row-c', created_at: '2026-10-21T09:00:00.000Z' })
    const order = sortHistoryItems([first, third, second]).map((item) => item.id)
    expect(order).toEqual(['row-c', 'row-b', 'row-a'])
    // Повторная сортировка даёт тот же результат (детерминизм).
    expect(sortHistoryItems([second, first, third]).map((item) => item.id)).toEqual(order)
  })

  it('переносит записи без даты в конец и не изменяет входной массив', () => {
    const dated = makeItem({ id: 'row-dated', created_at: '2026-10-21T09:00:00.000Z' })
    const undated = makeItem({ id: 'row-undated', created_at: null })
    const input = [undated, dated]
    expect(sortHistoryItems(input).map((item) => item.id)).toEqual(['row-dated', 'row-undated'])
    expect(input.map((item) => item.id)).toEqual(['row-undated', 'row-dated'])
  })

  it('поддерживает порядок «сначала старые»', () => {
    const older = makeItem({ id: 'row-old', created_at: '2026-10-20T09:00:00.000Z' })
    const newer = makeItem({ id: 'row-new', created_at: '2026-10-22T09:00:00.000Z' })
    expect(sortHistoryItems([older, newer], 'oldest').map((item) => item.id)).toEqual([
      'row-old',
      'row-new',
    ])
    expect(compareHistoryItems(newer, older)).toBeLessThan(0)
  })

  it('форматирует дату в UTC и сохраняет некорректное значение как есть', () => {
    expect(formatHistoryTimestamp('2026-10-21T09:30:00.000Z')).toBe('2026-10-21 09:30 UTC')
    expect(formatHistoryTimestamp(null)).toBeNull()
    expect(formatHistoryTimestamp('не дата')).toBe('не дата')
  })
})

describe('защита от устаревших ответов', () => {
  it('применяет только ответ последнего запроса', () => {
    const guard = createRequestGuard()
    const first = guard.begin()
    const second = guard.begin()
    expect(guard.isCurrent(first)).toBe(false)
    expect(guard.isCurrent(second)).toBe(true)
  })

  it('инвалидирует запросы при смене аккаунта, выходе или размонтировании', () => {
    const guard = createRequestGuard()
    const token = guard.begin()
    guard.invalidate()
    expect(guard.isCurrent(token)).toBe(false)
  })
})

describe('сервис истории: выборка только своих отчётов', () => {
  it('запрашивает список строго для текущего пользователя одной страницей', async () => {
    const rows = [
      makeRow({ id: 'row-2', created_at: '2026-10-22T09:00:00.000Z' }),
      makeRow({ id: 'row-1', created_at: '2026-10-21T09:00:00.000Z' }),
    ]
    const { state, client } = makeFakeListClient(rows)
    const service = createHistoryReportsService(client)

    const result = await service.listPersonalMatchReports({ userId: USER_A })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.items.map((item) => item.id)).toEqual(['row-2', 'row-1'])
    expect(result.skippedCount).toBe(0)
    // Один запрос на страницу и обязательное ограничение по владельцу.
    expect(state.calls).toEqual([{ userId: USER_A, limit: HISTORY_PAGE_SIZE, offset: 0 }])
  })

  it('пропускает повреждённые и чужие строки, не роняя список', async () => {
    const rows = [
      makeRow({ id: 'row-ok' }),
      makeRow({ id: 'row-foreign', user_id: USER_B }),
      { id: 'row-broken', match_id: 'abc' },
      null,
    ]
    const { client } = makeFakeListClient(rows)
    const service = createHistoryReportsService(client)

    const result = await service.listPersonalMatchReports({ userId: USER_A })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.items.map((item) => item.id)).toEqual(['row-ok'])
    expect(result.skippedCount).toBe(3)
  })

  it('передаёт limit и offset для постраничной догрузки', async () => {
    const { state, client } = makeFakeListClient([makeRow()])
    const service = createHistoryReportsService(client)

    await service.listPersonalMatchReports({ userId: USER_A, limit: 10, offset: 20 })

    expect(state.calls).toEqual([{ userId: USER_A, limit: 10, offset: 20 }])
  })

  it('нормализует некорректные параметры страницы', async () => {
    const { state, client } = makeFakeListClient([makeRow()])
    const service = createHistoryReportsService(client)

    await service.listPersonalMatchReports({ userId: USER_A, limit: 0, offset: -5 })
    await service.listPersonalMatchReports({ userId: USER_A, limit: 10_000 })

    expect(state.calls[0]).toEqual({ userId: USER_A, limit: HISTORY_PAGE_SIZE, offset: 0 })
    expect(state.calls[1]).toEqual({ userId: USER_A, limit: HISTORY_MAX_PAGE_SIZE, offset: 0 })
  })

  it('возвращает пустой список без ошибки, когда отчётов нет', async () => {
    const { client } = makeFakeListClient([])
    const service = createHistoryReportsService(client)

    const result = await service.listPersonalMatchReports({ userId: USER_A })

    expect(result).toEqual({ ok: true, items: [], skippedCount: 0 })
  })

  it('передаёт ошибку базы данных, не превращая её в «пустую историю»', async () => {
    const { state, client } = makeFakeListClient([makeRow()])
    state.error = { kind: 'permission', code: '42501', message: 'нет прав' }
    const service = createHistoryReportsService(client)

    const result = await service.listPersonalMatchReports({ userId: USER_A })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error.kind).toBe('permission')
  })

  it('сообщает о неожиданном формате ответа', async () => {
    const client = {
      async selectPersonalReportList() {
        return { data: 'не массив', error: null }
      },
    }
    const service = createHistoryReportsService(client)

    const result = await service.listPersonalMatchReports({ userId: USER_A })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error.kind).toBe('invalid_payload')
  })
})