import { describe, expect, it } from 'vitest'

import { ANALYSIS_RULES_VERSION } from './analysisRules'
import {
  NO_DATABASE_MESSAGE,
  loadOrCreatePersonalReport,
  retrySaveReport,
  unresolvedReportMessage,
  type MatchReportFlowDeps,
  type ReportSaveState,
} from './matchReportFlow'
import {
  buildReportInsert,
  createMatchReportsService,
  findStoredPlayerAnalysis,
  parseStoredMatchReport,
  type MatchReportInsert,
  type MatchReportView,
  type MatchReportsClient,
  type MatchReportsService,
  type ReportDbError,
} from './matchReports'
import { normalizeMatch } from './normalizeMatch'
import type { MatchParseOutcome } from './matchParseFlow'
import type { OpenDotaMatchResult } from './opendota'

/**
 * Тесты оркестрации личного отчёта (Task 11).
 *
 * Проверяются: первый анализ и сохранение, повторное открытие без запроса к OpenDota,
 * отсутствие дубликатов, гонки с UNIQUE (user_id, match_id), незавершённые и
 * повреждённые записи, гостевой режим, ожидание сессии, сбои базы и провайдера,
 * а также повторное сохранение по действию пользователя.
 *
 * Живые Supabase и OpenDota не используются: подменяются клиент таблицы и HTTP-клиент.
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
      lh_t: [0, 3, 7, 10, 11, 17, 23, 28, 33, 40, 47, 53, 58, 64, 70, 76, 82],
      gold_t: [0, 287, 779, 1029, 1540, 1906, 2379, 2684, 3037, 3438, 3864, 4210, 4580, 4940, 5310, 5680, 6040],
      xp_t: [0, 118, 408, 765, 1068, 1306, 1792, 2074, 2380, 2661, 2907, 3150, 3400, 3650, 3900, 4150, 4400],
      kills_log: [{ time: 102 }],
      deaths_log: [{ time: 186 }],
      purchase_log: [{ time: 120, key: 'boots' }],
      lane_efficiency_pct: 78,
    },
    {
      player_slot: 128,
      hero_id: 11,
      kills: 1,
      deaths: 9,
      assists: 2,
      lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 14, 16, 18, 20, 22, 24],
      gold_t: [0, 210, 480, 700, 950, 1180, 1400, 1650, 1900, 2150, 2380, 2600, 2820, 3050, 3270, 3500, 3720],
      xp_t: [0, 90, 260, 430, 610, 800, 990, 1180, 1370, 1560, 1750, 1940, 2130, 2320, 2510, 2700, 2890],
      kills_log: [],
      deaths_log: [{ time: 300 }],
      purchase_log: [{ time: 95, key: 'magic_wand' }],
    },
  ],
}

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const MATCH_ID = '9007760151'

interface FakeRow extends Record<string, unknown> {
  id: string
  user_id: string
  match_id: string
}

/** Подмена таблицы: UNIQUE (user_id, match_id), как в применённой схеме. */
function makeFakeClient() {
  const store = {
    rows: [] as FakeRow[],
    selectCalls: 0,
    insertCalls: 0,
    selectError: null as ReportDbError | null,
    insertError: null as ReportDbError | null,
    selectReturnsNull: false,
  }

  const client: MatchReportsClient = {
    async selectPersonalReport({ userId, matchId }) {
      store.selectCalls += 1
      if (store.selectError !== null) {
        return { data: null, error: store.selectError }
      }
      if (store.selectReturnsNull) {
        return { data: null, error: null }
      }
      const row = store.rows.find((item) => item.user_id === userId && item.match_id === matchId)
      return { data: row ?? null, error: null }
    },
    async insertPersonalReport(payload: MatchReportInsert) {
      store.insertCalls += 1
      if (store.insertError !== null) {
        return { data: null, error: store.insertError }
      }
      const duplicate = store.rows.some(
        (item) => item.user_id === payload.user_id && item.match_id === payload.match_id,
      )
      if (duplicate) {
        return {
          data: null,
          error: { kind: 'conflict', code: '23505', message: 'duplicate key value' },
        }
      }
      const row: FakeRow = {
        ...payload,
        id: `row-${store.rows.length + 1}`,
        created_at: '2026-10-25T10:00:00.000Z',
        updated_at: '2026-10-25T10:00:00.000Z',
      }
      store.rows.push(row)
      return { data: row, error: null }
    },
    async updatePersonalReport(payload: MatchReportInsert) {
      const index = store.rows.findIndex(
        (item) => item.user_id === payload.user_id && item.match_id === payload.match_id,
      )
      if (index === -1) {
        // Строки нет: обновление не подтверждено (сервис вернёт ошибку).
        return { data: null, error: null }
      }
      const updated: FakeRow = { ...store.rows[index], ...payload }
      store.rows[index] = updated
      return { data: updated, error: null }
    },
  }

  return { store, client }
}

/** Подмена HTTP-клиента OpenDota со счётчиком вызовов. */
function makeFakeFetch(
  responder: (matchId: string) => OpenDotaMatchResult | Promise<OpenDotaMatchResult> = () => ({
    ok: true,
    match: RAW_MATCH,
  }),
) {
  const calls: string[] = []
  return {
    calls,
    fetchMatch: async (matchId: string): Promise<OpenDotaMatchResult> => {
      calls.push(matchId)
      return responder(matchId)
    },
  }
}

/** Сервис с программируемыми ответами — для гонок, pending и повреждённых снимков. */
function makeServiceStub() {
  const calls = { select: 0, insert: 0, refresh: 0 }
  const selectQueue: Array<{ row: unknown | null; error?: ReportDbError }> = []
  const insertQueue: Array<{ row: unknown | null; error?: ReportDbError }> = []
  const refreshQueue: Array<{ row: unknown | null; error?: ReportDbError }> = []

  const service: MatchReportsService = {
    async getPersonalMatchReport() {
      calls.select += 1
      const next = selectQueue.shift() ?? { row: null }
      if (next.error !== undefined) {
        return { ok: false, error: next.error }
      }
      if (next.row === null) {
        return { ok: true, report: null }
      }
      const parsed = parseStoredMatchReport(next.row)
      if (!parsed.ok) {
        return {
          ok: false,
          error: { kind: 'invalid_payload', code: null, message: parsed.message },
        }
      }
      return { ok: true, report: parsed.view }
    },
    async savePersonalMatchReport() {
      calls.insert += 1
      const next = insertQueue.shift() ?? {
        row: null,
        error: {
          kind: 'unknown',
          code: null,
          message: 'нет запрограммированного ответа',
        } as ReportDbError,
      }
      if (next.error !== undefined) {
        return { ok: false, error: next.error }
      }
      const parsed = parseStoredMatchReport(next.row)
      if (!parsed.ok) {
        return {
          ok: false,
          error: { kind: 'invalid_payload', code: null, message: parsed.message },
        }
      }
      return { ok: true, report: parsed.view, created: true }
    },
    async refreshPersonalMatchReport() {
      calls.refresh += 1
      const next = refreshQueue.shift() ?? {
        row: null,
        error: {
          kind: 'unknown',
          code: null,
          message: 'нет запрограммированного ответа',
        } as ReportDbError,
      }
      if (next.error !== undefined) {
        return { ok: false, error: next.error }
      }
      const parsed = parseStoredMatchReport(next.row)
      if (!parsed.ok) {
        return {
          ok: false,
          error: { kind: 'invalid_payload', code: null, message: parsed.message },
        }
      }
      return { ok: true, report: parsed.view }
    },
  }

  return { calls, selectQueue, insertQueue, refreshQueue, service }
}

function makeDeps(overrides: Partial<MatchReportFlowDeps> = {}): MatchReportFlowDeps {
  return {
    authStatus: 'authenticated',
    userId: USER_A,
    service: null,
    fetchMatch: makeFakeFetch().fetchMatch,
    now: () => new Date('2026-10-25T10:00:00.000Z'),
    ...overrides,
  }
}

/** Строка отчёта «как из базы» для программируемых ответов сервиса. */
function makeStoredRow(insert: MatchReportInsert, overrides: Record<string, unknown> = {}) {
  return {
    ...insert,
    id: 'row-existing',
    created_at: '2026-10-24T09:00:00.000Z',
    updated_at: '2026-10-24T09:30:00.000Z',
    ...overrides,
  }
}

function buildInsert(userId = USER_A): MatchReportInsert {
  return buildReportInsert({
    userId,
    requestedId: MATCH_ID,
    match: normalizeMatch(RAW_MATCH),
    fetchedAt: '2026-10-24T09:00:00.000Z',
  })
}

/**
 * Матч без подробных данных: у второго участника нет таймлайнов и журнала покупок.
 * Такой снимок соответствует отчёту, сохранённому до появления Task 14.
 */
const PARTIAL_RAW_MATCH = {
  ...RAW_MATCH,
  players: [
    RAW_MATCH.players[0],
    { player_slot: 128, hero_id: 11, kills: 1, deaths: 9, assists: 2, last_hits: 12 },
  ],
}

function buildPartialInsert(userId = USER_A): MatchReportInsert {
  return buildReportInsert({
    userId,
    requestedId: MATCH_ID,
    match: normalizeMatch(PARTIAL_RAW_MATCH),
    fetchedAt: '2026-10-24T09:00:00.000Z',
  })
}

/** Приведение результата к «report» с проверкой статуса. */
function expectReport(result: Awaited<ReturnType<typeof loadOrCreatePersonalReport>>): {
  view: MatchReportView
  save: ReportSaveState
} {
  expect(result.status).toBe('report')
  if (result.status !== 'report') {
    throw new Error('ожидался результат со статусом report')
  }
  return { view: result.view, save: result.save }
}

describe('первый анализ и сохранение отчёта', () => {
  it('получает матч, анализирует всех участников и сохраняет одну строку', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const fakeFetch = makeFakeFetch()

    const result = await loadOrCreatePersonalReport(
      makeDeps({ service, fetchMatch: fakeFetch.fetchMatch }),
      MATCH_ID,
    )
    const { view, save } = expectReport(result)

    expect(save.kind).toBe('saved')
    expect(view.id).toBe('row-1')
    expect(view.status).toBe('ready')
    expect(view.rulesVersion).toBe(ANALYSIS_RULES_VERSION)
    expect(view.fetchedAt).toBe('2026-10-25T10:00:00.000Z')
    expect(view.match.players).toHaveLength(2)
    expect(view.analyses).toHaveLength(2)
    expect(fakeFetch.calls).toEqual([MATCH_ID])
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0].match_id).toBe(MATCH_ID)
    expect(store.rows[0].status).toBe('ready')

    const payload = store.rows[0].match_payload as { match: { players: unknown[] } }
    const analysis = store.rows[0].analysis_payload as {
      players: unknown[]
      rules_version: string
    }
    expect(payload.match.players).toHaveLength(2)
    expect(analysis.players).toHaveLength(2)
    expect(analysis.rules_version).toBe(ANALYSIS_RULES_VERSION)
  })

  it('сохраняет частичный отчёт, когда данных провайдера недостаточно', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const fakeFetch = makeFakeFetch(() => ({
      ok: true,
      match: { match_id: 9007760151, players: [] },
    }))

    const result = await loadOrCreatePersonalReport(
      makeDeps({ service, fetchMatch: fakeFetch.fetchMatch }),
      MATCH_ID,
    )
    const { view, save } = expectReport(result)

    expect(save.kind).toBe('saved')
    expect(view.status).toBe('partial')
    expect(store.rows[0].status).toBe('partial')
    expect(view.limitations.map((item) => item.code)).toEqual(
      expect.arrayContaining(['match.duration.missing', 'players.empty']),
    )
  })

  it('показывает свежий анализ и честно сообщает, когда сохранение не удалось', async () => {
    const { store, client } = makeFakeClient()
    store.insertError = { kind: 'network', code: null, message: 'нет связи с базой' }
    const service = createMatchReportsService(client)

    const result = await loadOrCreatePersonalReport(makeDeps({ service }), MATCH_ID)
    const { view, save } = expectReport(result)

    expect(save.kind).toBe('save-failed')
    if (save.kind !== 'save-failed') {
      return
    }
    expect(save.error.kind).toBe('network')
    // Отчёт показан, но не выдаётся за сохранённый.
    expect(view.id).toBeNull()
    expect(view.analyses).toHaveLength(2)
    expect(store.rows).toHaveLength(0)
  })

  it('не создаёт отчёт при недоступности OpenDota', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const fakeFetch = makeFakeFetch(() => ({
      ok: false,
      error: { kind: 'rate_limited', status: 429, message: 'слишком много запросов' },
    }))

    const result = await loadOrCreatePersonalReport(
      makeDeps({ service, fetchMatch: fakeFetch.fetchMatch }),
      MATCH_ID,
    )

    expect(result.status).toBe('provider-error')
    expect(store.insertCalls).toBe(0)
    expect(store.rows).toHaveLength(0)
  })

  it('не создаёт отчёт при отмене запроса', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const fakeFetch = makeFakeFetch(() => ({
      ok: false,
      error: { kind: 'aborted', message: 'Запрос отменён.' },
    }))

    const result = await loadOrCreatePersonalReport(
      makeDeps({ service, fetchMatch: fakeFetch.fetchMatch }),
      MATCH_ID,
    )

    expect(result.status).toBe('aborted')
    expect(store.insertCalls).toBe(0)
  })
})

describe('повторное открытие и запрет дубликатов', () => {
  it('повторно использует сохранённый снимок без запроса к OpenDota', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const fakeFetch = makeFakeFetch()
    const deps = makeDeps({ service, fetchMatch: fakeFetch.fetchMatch })

    const first = expectReport(await loadOrCreatePersonalReport(deps, MATCH_ID))
    const second = expectReport(await loadOrCreatePersonalReport(deps, MATCH_ID))

    expect(first.save.kind).toBe('saved')
    expect(second.save.kind).toBe('stored')
    // Повторное открытие не обращается к провайдеру и не создаёт новую строку.
    expect(fakeFetch.calls).toEqual([MATCH_ID])
    expect(store.insertCalls).toBe(1)
    expect(store.rows).toHaveLength(1)
    expect(second.view.id).toBe(first.view.id)
    expect(second.view.fetchedAt).toBe(first.view.fetchedAt)
    expect(second.view.rulesVersion).toBe(first.view.rulesVersion)
    expect(second.view.createdAt).toBe(first.view.createdAt)
    expect(second.view.updatedAt).toBe(first.view.updatedAt)
  })

  it('показывает сохранённые наблюдения без пересчёта правил', async () => {
    const { client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const deps = makeDeps({ service })

    const first = expectReport(await loadOrCreatePersonalReport(deps, MATCH_ID))
    const second = expectReport(await loadOrCreatePersonalReport(deps, MATCH_ID))

    expect(JSON.stringify(second.view.analyses)).toBe(JSON.stringify(first.view.analyses))
    expect(second.view.analyses[0].analysis.rule_version).toBe(ANALYSIS_RULES_VERSION)
    expect(second.view.analyses[0].analysis.observations.length).toBeGreaterThan(0)
  })

  it('хранит один и тот же матч у разных пользователей отдельными строками', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)

    const resultA = expectReport(
      await loadOrCreatePersonalReport(makeDeps({ service, userId: USER_A }), MATCH_ID),
    )
    const resultB = expectReport(
      await loadOrCreatePersonalReport(makeDeps({ service, userId: USER_B }), MATCH_ID),
    )

    expect(store.rows).toHaveLength(2)
    expect(resultA.view.id).not.toBe(resultB.view.id)
    expect(store.rows.map((row) => row.user_id).sort()).toEqual([USER_A, USER_B].sort())
    expect(store.rows.every((row) => row.match_id === MATCH_ID)).toBe(true)
    // Второй пользователь не видит чужой отчёт: его чтение вернуло только свою строку.
    expect(resultB.view.userId).toBe(USER_B)
  })

  it('смена матча не переиспользует состояние предыдущего матча', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const fakeFetch = makeFakeFetch((matchId) => ({
      ok: true,
      match: { ...RAW_MATCH, match_id: Number(matchId) },
    }))
    const deps = makeDeps({ service, fetchMatch: fakeFetch.fetchMatch })

    const first = expectReport(await loadOrCreatePersonalReport(deps, '9007760151'))
    const second = expectReport(await loadOrCreatePersonalReport(deps, '9007760152'))

    expect(fakeFetch.calls).toEqual(['9007760151', '9007760152'])
    expect(first.view.matchId).toBe('9007760151')
    expect(second.view.matchId).toBe('9007760152')
    expect(store.rows).toHaveLength(2)
  })

  it('смена выбранного игрока не вызывает ни запросов, ни записей', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const fakeFetch = makeFakeFetch()
    const { view } = expectReport(
      await loadOrCreatePersonalReport(
        makeDeps({ service, fetchMatch: fakeFetch.fetchMatch }),
        MATCH_ID,
      ),
    )

    const callsBefore = { fetch: fakeFetch.calls.length, select: store.selectCalls, insert: store.insertCalls }
    // Выбор участника — чистая операция над снимком отчёта.
    expect(findStoredPlayerAnalysis(view, 0)?.player_slot).toBe(0)
    expect(findStoredPlayerAnalysis(view, 128)?.player_slot).toBe(128)

    expect(fakeFetch.calls.length).toBe(callsBefore.fetch)
    expect(store.selectCalls).toBe(callsBefore.select)
    expect(store.insertCalls).toBe(callsBefore.insert)
  })
})

describe('гонки, незавершённые и повреждённые записи', () => {
  it('при конфликте уникальности читает запись победителя и не перезаписывает её', async () => {
    const { calls, selectQueue, insertQueue, service } = makeServiceStub()
    const existing = makeStoredRow(buildInsert())
    selectQueue.push({ row: null })
    insertQueue.push({
      row: null,
      error: { kind: 'conflict', code: '23505', message: 'duplicate key value' },
    })
    selectQueue.push({ row: existing })

    const fakeFetch = makeFakeFetch()
    const { view, save } = expectReport(
      await loadOrCreatePersonalReport(
        makeDeps({ service, fetchMatch: fakeFetch.fetchMatch }),
        MATCH_ID,
      ),
    )

    expect(save.kind).toBe('conflict-resolved')
    expect(view.id).toBe('row-existing')
    expect(view.createdAt).toBe('2026-10-24T09:00:00.000Z')
    expect(view.fetchedAt).toBe(buildInsert().fetched_at)
    expect(calls.insert).toBe(1)
    expect(calls.select).toBe(2)
    expect(fakeFetch.calls).toEqual([MATCH_ID])
  })

  it('не подтверждает сохранение, если строка исчезла после конфликта', async () => {
    const { selectQueue, insertQueue, service } = makeServiceStub()
    selectQueue.push({ row: null })
    insertQueue.push({
      row: null,
      error: { kind: 'conflict', code: '23505', message: 'duplicate key value' },
    })
    selectQueue.push({ row: null })

    const { view, save } = expectReport(
      await loadOrCreatePersonalReport(makeDeps({ service }), MATCH_ID),
    )
    expect(save.kind).toBe('save-failed')
    expect(view.id).toBeNull()
  })

  it('не перезаписывает незавершённую запись (pending) и показывает свежий расчёт', async () => {
    const { calls, selectQueue, service } = makeServiceStub()
    selectQueue.push({
      row: makeStoredRow(buildInsert(), {
        status: 'pending',
        match_payload: null,
        analysis_payload: null,
        rules_version: null,
      }),
    })

    const { view, save } = expectReport(
      await loadOrCreatePersonalReport(makeDeps({ service }), MATCH_ID),
    )
    expect(save.kind).toBe('unresolved')
    if (save.kind !== 'unresolved') {
      return
    }
    expect(save.status).toBe('pending')
    expect(save.message).toBe(unresolvedReportMessage('pending'))
    expect(calls.insert).toBe(0)
    expect(view.id).toBeNull()
    expect(view.analyses).toHaveLength(2)
  })

  it('не перезаписывает запись со статусом error', async () => {
    const { calls, selectQueue, service } = makeServiceStub()
    selectQueue.push({
      row: makeStoredRow(buildInsert(), {
        status: 'error',
        match_payload: null,
        analysis_payload: null,
        rules_version: null,
      }),
    })

    const { save } = expectReport(await loadOrCreatePersonalReport(makeDeps({ service }), MATCH_ID))
    expect(save.kind).toBe('unresolved')
    if (save.kind !== 'unresolved') {
      return
    }
    expect(save.status).toBe('error')
    expect(calls.insert).toBe(0)
  })

  it('сообщает о повреждённом сохранённом отчёте и не обращается к провайдеру', async () => {
    const { calls, selectQueue, service } = makeServiceStub()
    selectQueue.push({
      row: { ...makeStoredRow(buildInsert()), match_payload: { snapshot_version: 99 } },
    })
    const fakeFetch = makeFakeFetch()

    const result = await loadOrCreatePersonalReport(
      makeDeps({ service, fetchMatch: fakeFetch.fetchMatch }),
      MATCH_ID,
    )

    expect(result.status).toBe('invalid-stored-report')
    if (result.status !== 'invalid-stored-report') {
      return
    }
    expect(result.message).toContain('повреждён')
    expect(fakeFetch.calls).toEqual([])
    expect(calls.insert).toBe(0)
  })

  it('не сохраняет отчёт вслепую, если чтение базы не удалось', async () => {
    const { calls, selectQueue, service } = makeServiceStub()
    selectQueue.push({ row: null, error: { kind: 'network', code: null, message: 'нет связи' } })
    const fakeFetch = makeFakeFetch()

    const { view, save } = expectReport(
      await loadOrCreatePersonalReport(
        makeDeps({ service, fetchMatch: fakeFetch.fetchMatch }),
        MATCH_ID,
      ),
    )
    expect(save.kind).toBe('database-error')
    if (save.kind !== 'database-error') {
      return
    }
    expect(save.error.kind).toBe('network')
    expect(calls.insert).toBe(0)
    expect(fakeFetch.calls).toEqual([MATCH_ID])
    expect(view.id).toBeNull()
  })
})

describe('сессия, гостевой режим и повторное сохранение', () => {
  it('не выполняет чтение и запись, пока состояние сессии неизвестно', async () => {
    const { calls, service } = makeServiceStub()
    const fakeFetch = makeFakeFetch()

    const result = await loadOrCreatePersonalReport(
      makeDeps({ service, authStatus: 'loading', userId: null, fetchMatch: fakeFetch.fetchMatch }),
      MATCH_ID,
    )

    expect(result.status).toBe('waiting-auth')
    expect(fakeFetch.calls).toEqual([])
    expect(calls.select).toBe(0)
    expect(calls.insert).toBe(0)
  })

  it('в гостевом режиме показывает анализ, но ничего не сохраняет', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const fakeFetch = makeFakeFetch()

    const { view, save } = expectReport(
      await loadOrCreatePersonalReport(
        makeDeps({
          service,
          authStatus: 'anonymous',
          userId: null,
          fetchMatch: fakeFetch.fetchMatch,
        }),
        MATCH_ID,
      ),
    )

    expect(save.kind).toBe('guest')
    expect(view.id).toBeNull()
    expect(store.selectCalls).toBe(0)
    expect(store.insertCalls).toBe(0)
    expect(store.rows).toHaveLength(0)
  })

  it('сообщает, что сохранение недоступно, когда Supabase не настроен', async () => {
    const { view, save } = expectReport(
      await loadOrCreatePersonalReport(makeDeps({ service: null }), MATCH_ID),
    )
    expect(save.kind).toBe('no-database')
    if (save.kind !== 'no-database') {
      return
    }
    expect(save.message).toBe(NO_DATABASE_MESSAGE)
    expect(view.id).toBeNull()
  })

  it('честно сообщает об истёкшей сессии при записи', async () => {
    const { store, client } = makeFakeClient()
    store.insertError = { kind: 'session', code: 'PGRST301', message: 'JWT expired' }
    const service = createMatchReportsService(client)

    const { view, save } = expectReport(
      await loadOrCreatePersonalReport(makeDeps({ service }), MATCH_ID),
    )
    expect(save.kind).toBe('save-failed')
    if (save.kind !== 'save-failed') {
      return
    }
    expect(save.error.kind).toBe('session')
    expect(view.id).toBeNull()
  })

  it('повторное сохранение по действию пользователя не запрашивает OpenDota снова', async () => {
    const { store, client } = makeFakeClient()
    store.insertError = { kind: 'network', code: null, message: 'нет связи' }
    const service = createMatchReportsService(client)
    const fakeFetch = makeFakeFetch()
    const deps = makeDeps({ service, fetchMatch: fakeFetch.fetchMatch })

    const first = expectReport(await loadOrCreatePersonalReport(deps, MATCH_ID))
    expect(first.save.kind).toBe('save-failed')

    store.insertError = null
    const retried = await retrySaveReport(deps, first.view)

    expect(retried.save.kind).toBe('saved')
    expect(retried.view.id).toBe('row-1')
    expect(fakeFetch.calls).toEqual([MATCH_ID])
    expect(store.rows).toHaveLength(1)
  })

  it('повторное сохранение не перезаписывает существующий отчёт', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const deps = makeDeps({ service })

    const first = expectReport(await loadOrCreatePersonalReport(deps, MATCH_ID))
    const retried = await retrySaveReport(deps, {
      ...first.view,
      id: null,
      createdAt: null,
      updatedAt: null,
    })

    expect(retried.save.kind).toBe('conflict-resolved')
    expect(retried.view.id).toBe(first.view.id)
    expect(store.rows).toHaveLength(1)
  })

  it('повторное сохранение в гостевом режиме ничего не пишет', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const deps = makeDeps({ service, authStatus: 'anonymous', userId: null })
    const { view } = expectReport(await loadOrCreatePersonalReport(deps, MATCH_ID))

    const retried = await retrySaveReport(deps, view)
    expect(retried.save.kind).toBe('guest')
    expect(store.insertCalls).toBe(0)
  })
})

describe('автоматическая обработка реплея и обновление отчёта (Task 14)', () => {
  it('не блокирует обработку реплея сохранённым отчётом без подробных данных', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    await service.savePersonalMatchReport(buildPartialInsert())
    const fakeFetch = makeFakeFetch()
    const parseCalls: string[] = []
    const outcomes: MatchParseOutcome[] = []

    const result = await loadOrCreatePersonalReport(
      makeDeps({
        service,
        fetchMatch: fakeFetch.fetchMatch,
        parseDetailedData: async ({ matchId }) => {
          parseCalls.push(matchId)
          return { kind: 'parsed', match: normalizeMatch(RAW_MATCH), jobId: '99' }
        },
        onParseOutcome: (outcome) => outcomes.push(outcome),
      }),
      MATCH_ID,
    )
    const { view, save } = expectReport(result)

    expect(parseCalls).toEqual([MATCH_ID])
    expect(save.kind).toBe('refreshed')
    expect(view.id).toBe('row-1')
    // Обновлена ровно одна (своя) строка, дубликатов нет.
    expect(store.rows).toHaveLength(1)
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0].kind).toBe('parsed')
  })

  it('использует подробный сохранённый отчёт без запросов к сети', async () => {
    const { client } = makeFakeClient()
    const service = createMatchReportsService(client)
    await service.savePersonalMatchReport(buildInsert())
    const fakeFetch = makeFakeFetch()
    let parseCalls = 0

    const result = await loadOrCreatePersonalReport(
      makeDeps({
        service,
        fetchMatch: fakeFetch.fetchMatch,
        parseDetailedData: async ({ match }) => {
          parseCalls += 1
          return { kind: 'not-needed', match }
        },
      }),
      MATCH_ID,
    )
    const { save } = expectReport(result)

    expect(save.kind).toBe('stored')
    expect(parseCalls).toBe(0)
    expect(fakeFetch.calls).toEqual([])
  })

  it('оставляет сохранённый отчёт без изменений, когда обработка недоступна', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    await service.savePersonalMatchReport(buildPartialInsert())

    const result = await loadOrCreatePersonalReport(
      makeDeps({
        service,
        // Данные остались неполными: реплей недоступен, подробностей нет.
        fetchMatch: makeFakeFetch(() => ({ ok: true, match: PARTIAL_RAW_MATCH })).fetchMatch,
        parseDetailedData: async ({ match }) => ({
          kind: 'replay-unavailable',
          reason: 'expired',
          match,
        }),
      }),
      MATCH_ID,
    )
    const { view, save } = expectReport(result)

    expect(save.kind).toBe('refresh-skipped')
    if (save.kind === 'refresh-skipped') {
      expect(save.reason).toBe('not-detailed')
    }
    expect(view.id).toBe('row-1')
    expect(store.rows).toHaveLength(1)
  })

  it('не объявляет обновление успешным при сбое базы и не теряет прежний отчёт', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)
    await service.savePersonalMatchReport(buildPartialInsert())
    const failing: MatchReportsService = {
      ...service,
      async refreshPersonalMatchReport() {
        return {
          ok: false,
          error: { kind: 'network', code: null, message: 'нет сети' },
        }
      },
    }

    const result = await loadOrCreatePersonalReport(
      makeDeps({
        service: failing,
        fetchMatch: makeFakeFetch().fetchMatch,
        parseDetailedData: async () => ({
          kind: 'parsed',
          match: normalizeMatch(RAW_MATCH),
          jobId: '99',
        }),
      }),
      MATCH_ID,
    )
    const { view, save } = expectReport(result)

    expect(save.kind).toBe('refresh-failed')
    expect(view.id).toBe('row-1')
    expect(store.rows).toHaveLength(1)
  })

  it('прекращает работу при уходе со страницы во время обработки реплея', async () => {
    const controller = new AbortController()

    const result = await loadOrCreatePersonalReport(
      makeDeps({
        service: createMatchReportsService(makeFakeClient().client),
        parseDetailedData: async () => {
          controller.abort()
          return { kind: 'aborted' }
        },
      }),
      MATCH_ID,
      controller.signal,
    )

    expect(result.status).toBe('aborted')
  })

  it('не запрашивает обработку повторно, если сохранённый отчёт уже подробный', async () => {
    const { client } = makeFakeClient()
    const service = createMatchReportsService(client)
    await service.savePersonalMatchReport(buildInsert())
    let parseCalls = 0

    for (let index = 0; index < 2; index += 1) {
      await loadOrCreatePersonalReport(
        makeDeps({
          service,
          fetchMatch: makeFakeFetch().fetchMatch,
          parseDetailedData: async ({ match }) => {
            parseCalls += 1
            return { kind: 'not-needed', match }
          },
        }),
        MATCH_ID,
      )
    }

    expect(parseCalls).toBe(0)
  })
})