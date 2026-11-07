import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import type { MatchReportInsert } from './matchReports'
import {
  HISTORY_REPORT_COLUMNS,
  MATCH_REPORTS_TABLE,
  createSupabaseHistoryReportsClient,
  createSupabaseMatchReportsClient,
} from './matchReportsSupabase'

/**
 * Security-регрессия адаптера Supabase (ревизия перед Task 16).
 *
 * Проверяется контракт, от которого зависит изоляция личных отчётов:
 *  - все запросы обращаются к `public.match_reports` и фильтруются по `user_id`;
 *  - обновление НИКОГДА не отправляет `user_id` и `match_id` в полезной нагрузке
 *    (иначе строку можно было бы «перенести» другому пользователю или на другой матч);
 *  - список истории не запрашивает тяжёлые payload-колонки;
 *  - сортировка и пагинация задаются на стороне базы.
 *
 * Тест использует локальную заглушку клиента (без сети и без живой БД) и не заменяет
 * живую проверку RLS (`supabase/inspection/rls_live_check.mjs`, статус `NOT RUN`).
 */

interface RecordedCall {
  method: string
  args: unknown[]
}

interface FakeResult {
  data: unknown
  error: unknown
}

function createFakeSupabase(result: FakeResult) {
  const calls: RecordedCall[] = []

  const builder = {
    select: (...args: unknown[]) => {
      calls.push({ method: 'select', args })
      return builder
    },
    insert: (...args: unknown[]) => {
      calls.push({ method: 'insert', args })
      return builder
    },
    update: (...args: unknown[]) => {
      calls.push({ method: 'update', args })
      return builder
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: 'eq', args })
      return builder
    },
    order: (...args: unknown[]) => {
      calls.push({ method: 'order', args })
      return builder
    },
    range: (...args: unknown[]) => {
      calls.push({ method: 'range', args })
      return builder
    },
    maybeSingle: () => {
      calls.push({ method: 'maybeSingle', args: [] })
      return Promise.resolve(result)
    },
    then: (onFulfilled: (value: FakeResult) => unknown) => Promise.resolve(result).then(onFulfilled),
  }

  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] })
      return builder
    },
  } as unknown as SupabaseClient

  return { client, calls }
}

function insertPayload(): MatchReportInsert {
  return {
    user_id: 'user-a',
    match_id: '9007760151',
    status: 'ready',
    match_payload: { snapshot_version: 2 },
    analysis_payload: { snapshot_version: 2 },
    rules_version: '1.1.0',
    source: 'OpenDota',
    fetched_at: '2026-11-07T00:00:00.000Z',
  } as unknown as MatchReportInsert
}

describe('Supabase-адаптер отчётов: контракт изоляции владельца', () => {
  it('читает отчёт только по паре (user_id, match_id) в таблице match_reports', async () => {
    const { client, calls } = createFakeSupabase({ data: null, error: null })
    const reports = createSupabaseMatchReportsClient(client)

    await reports.selectPersonalReport({ userId: 'user-a', matchId: '9007760151' })

    expect(calls[0]).toEqual({ method: 'from', args: [MATCH_REPORTS_TABLE] })
    const filters = calls.filter((call) => call.method === 'eq')
    expect(filters).toEqual([
      { method: 'eq', args: ['user_id', 'user-a'] },
      { method: 'eq', args: ['match_id', '9007760151'] },
    ])
    expect(calls.some((call) => call.method === 'maybeSingle')).toBe(true)
  })

  it('при обновлении не отправляет user_id и match_id в payload (неизменяемость владельца)', async () => {
    const { client, calls } = createFakeSupabase({ data: null, error: null })
    const reports = createSupabaseMatchReportsClient(client)

    await reports.updatePersonalReport(insertPayload())

    const updateCall = calls.find((call) => call.method === 'update')
    expect(updateCall).toBeDefined()
    const fields = updateCall?.args[0] as Record<string, unknown>
    expect(Object.keys(fields)).not.toContain('user_id')
    expect(Object.keys(fields)).not.toContain('match_id')
    // Содержимое отчёта при этом передаётся, а не теряется.
    expect(fields.status).toBe('ready')
    expect(fields.rules_version).toBe('1.1.0')

    // Владелец и матч задаются только фильтрами.
    const filters = calls.filter((call) => call.method === 'eq')
    expect(filters).toEqual([
      { method: 'eq', args: ['user_id', 'user-a'] },
      { method: 'eq', args: ['match_id', '9007760151'] },
    ])
  })

  it('вставка отчёта сохраняет владельца из полезной нагрузки в match_reports', async () => {
    const { client, calls } = createFakeSupabase({ data: null, error: null })
    const reports = createSupabaseMatchReportsClient(client)

    await reports.insertPersonalReport(insertPayload())

    expect(calls[0]).toEqual({ method: 'from', args: [MATCH_REPORTS_TABLE] })
    const insertCall = calls.find((call) => call.method === 'insert')
    const payload = insertCall?.args[0] as Record<string, unknown>
    expect(payload.user_id).toBe('user-a')
    expect(payload.match_id).toBe('9007760151')
  })

  it('история фильтруется по user_id, сортируется в базе и не грузит payload-колонки', async () => {
    const { client, calls } = createFakeSupabase({ data: [], error: null })
    const history = createSupabaseHistoryReportsClient(client)

    await history.selectPersonalReportList({ userId: 'user-a', limit: 20, offset: 40 })

    expect(calls[0]).toEqual({ method: 'from', args: [MATCH_REPORTS_TABLE] })
    expect(calls.filter((call) => call.method === 'eq')).toEqual([
      { method: 'eq', args: ['user_id', 'user-a'] },
    ])
    expect(calls.filter((call) => call.method === 'order')).toEqual([
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'order', args: ['id', { ascending: false }] },
    ])
    expect(calls.find((call) => call.method === 'range')?.args).toEqual([40, 59])

    const columns = calls.find((call) => call.method === 'select')?.args[0] as string
    expect(columns).toBe(HISTORY_REPORT_COLUMNS)
    expect(columns).not.toContain('analysis_payload')
    expect(columns).toContain('match_id')
  })
})
