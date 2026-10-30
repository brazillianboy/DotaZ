import { describe, expect, it } from 'vitest'

import { ANALYSIS_RULES_VERSION } from './analysisRules'
import {
  INVALID_REPORT_PAYLOAD_MESSAGE,
  INVALID_REPORT_ROW_MESSAGE,
  MATCH_REPORT_SNAPSHOT_VERSION,
  UNKNOWN_RULES_VERSION,
  buildAnalysisSnapshot,
  buildMatchSnapshot,
  buildPendingView,
  buildReportInsert,
  classifyReportDbError,
  createMatchReportsService,
  determineReportStatus,
  findStoredPlayerAnalysis,
  isSnapshotDetailed,
  parseStoredMatchReport,
  rulesVersionNotice,
  shouldRefreshStoredReport,
  type MatchReportInsert,
  type MatchReportsClient,
  type ReportDbError,
} from './matchReports'
import { normalizeMatch } from './normalizeMatch'
import type { NormalizedMatch } from '../types/match'

/**
 * Тесты слоя личных отчётов (Task 11): сборка снимков, сериализация, строгая
 * валидация сохранённых JSONB, статусы и классификация ошибок базы.
 *
 * Живая база не используется: сервис проверяется на in-memory подмене клиента,
 * которая ведёт себя как таблица с UNIQUE (user_id, match_id).
 */

const RAW_PLAYER_RADIANT = {
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
  kills_log: [{ time: 102 }, { time: 540 }],
  deaths_log: [{ time: 186 }],
  purchase_log: [{ time: 120, key: 'boots' }],
  lane_efficiency_pct: 78,
}

const RAW_PLAYER_DIRE = {
  player_slot: 128,
  hero_id: 11,
  kills: 1,
  deaths: 9,
  assists: 2,
  last_hits: 12,
  lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 15, 19, 24, 30, 41],
}

const RAW_MATCH = {
  match_id: 9007760151,
  duration: 2069,
  radiant_win: true,
  players: [RAW_PLAYER_RADIANT, RAW_PLAYER_DIRE],
}

function buildMatch(raw: unknown = RAW_MATCH): NormalizedMatch {
  return normalizeMatch(raw)
}

/** Полный (replay-derived) набор подробных полей участника для Task 14. */
const FULL_TIMELINE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]

function detailedPlayer(slot: number) {
  return {
    player_slot: slot,
    hero_id: 6,
    last_hits: 200,
    lh_t: FULL_TIMELINE,
    gold_t: FULL_TIMELINE,
    xp_t: FULL_TIMELINE,
    kills_log: [{ time: 120 }],
    deaths_log: [{ time: 300 }],
    purchase_log: [
      { time: 120, key: 'magic_wand' },
      { time: 400, key: 'power_treads' },
    ],
  }
}

const DETAILED_MATCH = {
  match_id: 9007760151,
  duration: 2069,
  radiant_win: true,
  players: [detailedPlayer(0), detailedPlayer(128)],
}

interface FakeRow extends Record<string, unknown> {
  id: string
  user_id: string
  match_id: string
}

/** Минимальная подмена таблицы: UNIQUE (user_id, match_id) соблюдается. */
function makeFakeClient() {
  const store = {
    rows: [] as FakeRow[],
    selectCalls: 0,
    insertCalls: 0,
    selectError: null as ReportDbError | null,
    insertError: null as ReportDbError | null,
  }

  const client: MatchReportsClient = {
    async selectPersonalReport({ userId, matchId }) {
      store.selectCalls += 1
      if (store.selectError !== null) {
        return { data: null, error: store.selectError }
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

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

describe('снимки отчёта: полнота и точность данных', () => {
  it('сохраняет ID матча точной строкой, включая очень большие значения', () => {
    const insert = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: '2026-10-25T10:00:00.000Z',
    })
    expect(insert.match_id).toBe('9007760151')
    expect(typeof insert.match_id).toBe('string')
    expect(insert.match_payload.match.match_id).toBe('9007760151')

    const huge = '18446744073709551615'
    const hugeInsert = buildReportInsert({
      userId: USER_A,
      requestedId: huge,
      match: buildMatch({ match_id: huge, duration: 10, radiant_win: true, players: [] }),
      fetchedAt: null,
    })
    expect(hugeInsert.match_id).toBe(huge)
    expect(hugeInsert.match_payload.match.match_id).toBe(huge)
  })

  it('сохраняет всех участников матча, а не только выбранного', () => {
    const insert = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: null,
    })
    const players = insert.match_payload.match.players
    expect(players).toHaveLength(2)
    expect(players.map((player) => player.player_slot)).toEqual([0, 128])
    expect(players[0].kills).toBe(16)
    expect(players[1].team).toBe('dire')
  })

  it('сохраняет анализ каждого участника с версией правил', () => {
    const snapshot = buildAnalysisSnapshot(buildMatch())
    expect(snapshot.rules_version).toBe(ANALYSIS_RULES_VERSION)
    expect(snapshot.players.map((item) => item.player_slot)).toEqual([0, 128])
    for (const item of snapshot.players) {
      expect(item.analysis.rule_version).toBe(ANALYSIS_RULES_VERSION)
      expect(Array.isArray(item.analysis.observations)).toBe(true)
      expect(Array.isArray(item.analysis.recommendations)).toBe(true)
      expect(item.analysis.limitations.length).toBeGreaterThan(0)
    }
    expect(snapshot.players[0].analysis.observations.length).toBeGreaterThan(0)
  })

  it('сохраняет отсутствующие показатели как null (без подстановки нулей)', () => {
    const match = buildMatch({
      match_id: 1,
      duration: 100,
      radiant_win: true,
      players: [{ player_slot: 0, kills: 0, deaths: 0, assists: 0, last_hits: 0 }],
    })
    const insert = buildReportInsert({ userId: USER_A, requestedId: '1', match, fetchedAt: null })
    const player = insert.match_payload.match.players[0]
    expect(player.kills).toBe(0)
    expect(player.last_hits).toBe(0)
    expect(player.hero_id).toBeNull()
    expect(player.gold_per_min).toBeNull()
    expect(player.laning.lastHits).toBeNull()
    expect(player.laning.purchasesFirst).toBeNull()
  })

  it('фиксирует версию правил и атрибуцию источника', () => {
    const insert = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: null,
    })
    expect(insert.rules_version).toBe(ANALYSIS_RULES_VERSION)
    expect(insert.analysis_payload.rules_version).toBe(ANALYSIS_RULES_VERSION)
    expect(insert.source).toBe('OpenDota')
  })

  it('сохраняет фактическое время получения данных и допускает его отсутствие', () => {
    const withTime = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: '2026-10-25T10:00:00.000Z',
    })
    expect(withTime.fetched_at).toBe('2026-10-25T10:00:00.000Z')

    const withoutTime = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: null,
    })
    expect(withoutTime.fetched_at).toBeNull()
  })

  it('присваивает статус partial, когда данных провайдера недостаточно', () => {
    const incomplete = buildMatch({ match_id: 1, duration: null, radiant_win: null, players: [] })
    const snapshot = buildMatchSnapshot(incomplete, '1')
    expect(determineReportStatus(snapshot, '1')).toBe('partial')
    expect(snapshot.limitations.map((item) => item.code)).toEqual(
      expect.arrayContaining(['match.duration.missing', 'match.winner.missing', 'players.empty']),
    )

    const complete = buildMatchSnapshot(buildMatch(), '9007760151')
    expect(determineReportStatus(complete, '9007760151')).toBe('ready')
  })

  it('не считает отчёт полным при расхождении ID матча с запрошенным', () => {
    const snapshot = buildMatchSnapshot(buildMatch(), '123')
    expect(determineReportStatus(snapshot, '123')).toBe('partial')
    expect(snapshot.limitations.map((item) => item.code)).toContain('match.id.mismatch')
  })

  it('формирует детерминированный снимок и переживает сериализацию JSON', () => {
    const match = buildMatch()
    const first = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match,
      fetchedAt: '2026-10-25T10:00:00.000Z',
    })
    const second = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match,
      fetchedAt: '2026-10-25T10:00:00.000Z',
    })
    expect(second).toEqual(first)

    const roundTripped = JSON.parse(JSON.stringify(first)) as MatchReportInsert
    expect(roundTripped).toEqual(first)
  })
})

/** Строка «как из базы»: сериализованный insert + метаданные. */
function makeStoredRow(insert: MatchReportInsert, overrides: Record<string, unknown> = {}) {
  return {
    ...insert,
    id: 'row-1',
    created_at: '2026-10-25T10:00:00.000Z',
    updated_at: '2026-10-25T10:05:00.000Z',
    ...overrides,
  }
}

describe('валидация сохранённого отчёта', () => {
  const insert = buildReportInsert({
    userId: USER_A,
    requestedId: '9007760151',
    match: buildMatch(),
    fetchedAt: '2026-10-25T10:00:00.000Z',
  })
  const stored = JSON.parse(JSON.stringify(makeStoredRow(insert))) as Record<string, unknown>

  it('принимает корректный снимок и восстанавливает все данные', () => {
    expect((stored.match_payload as { snapshot_version: number }).snapshot_version).toBe(
      MATCH_REPORT_SNAPSHOT_VERSION,
    )
    const parsed = parseStoredMatchReport(stored)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    expect(parsed.view.id).toBe('row-1')
    expect(parsed.view.userId).toBe(USER_A)
    expect(parsed.view.matchId).toBe('9007760151')
    expect(parsed.view.status).toBe('ready')
    expect(parsed.view.rulesVersion).toBe(ANALYSIS_RULES_VERSION)
    expect(parsed.view.match.players).toHaveLength(2)
    expect(parsed.view.analyses).toHaveLength(2)
    expect(parsed.view.match.players[0].laning.lastHits).toBe(86)
  })

  it('отклоняет снимок с неизвестной версией формата', () => {
    const parsed = parseStoredMatchReport({
      ...stored,
      match_payload: { ...(stored.match_payload as object), snapshot_version: 99 },
    })
    expect(parsed).toEqual({
      ok: false,
      reason: 'invalid_payload',
      message: INVALID_REPORT_PAYLOAD_MESSAGE,
    })
  })

  it('отклоняет повреждённый payload (players не массив)', () => {
    const parsed = parseStoredMatchReport({
      ...stored,
      match_payload: {
        ...(stored.match_payload as { match: object }),
        match: { ...(stored.match_payload as { match: object }).match, players: 'нет' },
      },
    })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) {
      return
    }
    expect(parsed.reason).toBe('invalid_payload')
  })

  it('отклоняет неизвестный статус и недопустимый ID матча', () => {
    expect(parseStoredMatchReport({ ...stored, status: 'unknown' })).toEqual({
      ok: false,
      reason: 'invalid_row',
      message: INVALID_REPORT_ROW_MESSAGE,
    })
    expect(parseStoredMatchReport({ ...stored, match_id: 'не-число' })).toEqual({
      ok: false,
      reason: 'invalid_row',
      message: INVALID_REPORT_ROW_MESSAGE,
    })
  })

  it('отклоняет расхождение версии правил между строкой и снимком', () => {
    const parsed = parseStoredMatchReport({ ...stored, rules_version: '0.9.0' })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) {
      return
    }
    expect(parsed.reason).toBe('invalid_payload')
  })

  it('не принимает null или строку вместо записи отчёта', () => {
    expect(parseStoredMatchReport(null).ok).toBe(false)
    expect(parseStoredMatchReport('строка').ok).toBe(false)
  })

  it('распознаёт незавершённую запись с NULL-payload как незавершённую, а не повреждённую', () => {
    const parsed = parseStoredMatchReport({
      ...stored,
      status: 'pending',
      match_payload: null,
      analysis_payload: null,
      rules_version: null,
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    expect(parsed.view.status).toBe('pending')
    expect(parsed.view.analyses).toEqual([])
    expect(parsed.view.match.players).toEqual([])
    expect(parsed.view.rulesVersion).toBe(UNKNOWN_RULES_VERSION)
    expect(parsed.view.limitations.map((item) => item.code)).toEqual([
      'report.match_payload.missing',
      'report.analysis_payload.missing',
    ])
  })

  it('не принимает готовый отчёт без payload', () => {
    const parsed = parseStoredMatchReport({
      ...stored,
      match_payload: null,
      analysis_payload: null,
    })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) {
      return
    }
    expect(parsed.reason).toBe('invalid_payload')
  })
})

describe('сервис личных отчётов и ошибки базы', () => {
  it('возвращает null, когда личного отчёта нет', async () => {
    const { client, store } = makeFakeClient()
    const service = createMatchReportsService(client)
    const result = await service.getPersonalMatchReport({ userId: USER_A, matchId: '9007760151' })
    expect(result).toEqual({ ok: true, report: null })
    expect(store.selectCalls).toBe(1)
  })

  it('сохраняет отчёт и возвращает подтверждённый снимок', async () => {
    const { client, store } = makeFakeClient()
    const service = createMatchReportsService(client)
    const insert = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: null,
    })
    const saved = await service.savePersonalMatchReport(insert)
    expect(saved.ok).toBe(true)
    if (!saved.ok) {
      return
    }
    expect(saved.created).toBe(true)
    expect(saved.report.id).toBe('row-1')
    expect(store.rows).toHaveLength(1)
  })

  it('не превращает ошибку прав в «отчёт не найден»', async () => {
    const { client, store } = makeFakeClient()
    store.selectError = { kind: 'permission', code: '42501', message: 'нет прав' }
    const service = createMatchReportsService(client)
    const result = await service.getPersonalMatchReport({ userId: USER_A, matchId: '9007760151' })
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error.kind).toBe('permission')
  })

  it('отклоняет чужую строку, если она попала в выборку', async () => {
    const insert = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: null,
    })
    const foreignRow = {
      id: 'row-x',
      user_id: USER_B,
      match_id: '9007760151',
      status: 'ready',
      rules_version: insert.rules_version,
      fetched_at: null,
      created_at: null,
      updated_at: null,
      source: 'OpenDota',
      match_payload: insert.match_payload,
      analysis_payload: insert.analysis_payload,
    }
    // Клиент, ошибочно вернувший чужую строку: сервис обязан её отклонить.
    const wrongClient: MatchReportsClient = {
      async selectPersonalReport() {
        return { data: foreignRow, error: null }
      },
      async insertPersonalReport() {
        return { data: null, error: { kind: 'unknown', code: null, message: 'не используется' } }
      },
      async updatePersonalReport() {
        return { data: null, error: { kind: 'unknown', code: null, message: 'не используется' } }
      },
    }
    const service = createMatchReportsService(wrongClient)

    const result = await service.getPersonalMatchReport({ userId: USER_A, matchId: '9007760151' })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error.kind).toBe('permission')
  })

  it('сообщает о конфликте уникальности при повторной вставке', async () => {
    const { client } = makeFakeClient()
    const service = createMatchReportsService(client)
    const insert = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: null,
    })
    await service.savePersonalMatchReport(insert)
    const second = await service.savePersonalMatchReport(insert)
    expect(second.ok).toBe(false)
    if (second.ok) {
      return
    }
    expect(second.error.kind).toBe('conflict')
    expect(second.error.code).toBe('23505')
  })

  it('различает права, сессию, сеть, конфликт и неизвестную ошибку', () => {
    expect(classifyReportDbError({ code: '42501', message: 'permission denied' }).kind).toBe(
      'permission',
    )
    expect(classifyReportDbError({ status: 403 }).kind).toBe('permission')
    expect(classifyReportDbError({ code: 'PGRST301', message: 'JWT expired' }).kind).toBe('session')
    expect(classifyReportDbError({ status: 401 }).kind).toBe('session')
    expect(classifyReportDbError(new TypeError('Failed to fetch')).kind).toBe('network')
    expect(classifyReportDbError({ code: '23505' }).kind).toBe('conflict')
    expect(classifyReportDbError({ message: 'нечто иное' }).kind).toBe('unknown')
    expect(classifyReportDbError(undefined).kind).toBe('unknown')
  })
})

describe('вспомогательные функции отчёта', () => {
  it('находит сохранённый анализ участника без пересчёта правил', () => {
    const view = buildPendingView({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: null,
    })
    expect(findStoredPlayerAnalysis(view, 0)?.player_slot).toBe(0)
    expect(findStoredPlayerAnalysis(view, 128)?.player_slot).toBe(128)
    expect(findStoredPlayerAnalysis(view, 55)).toBeNull()
    expect(findStoredPlayerAnalysis(view, null)).toBeNull()
  })

  it('формирует фактическое уведомление о расхождении версий правил', () => {
    expect(rulesVersionNotice(ANALYSIS_RULES_VERSION, ANALYSIS_RULES_VERSION)).toBeNull()
    const notice = rulesVersionNotice('0.9.0', ANALYSIS_RULES_VERSION)
    expect(notice).toContain('0.9.0')
    expect(notice).toContain('без пересчёта')
  })

  it('«свежий» отчёт не выглядит сохранённым', () => {
    const view = buildPendingView({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: null,
    })
    expect(view.id).toBeNull()
    expect(view.createdAt).toBeNull()
    expect(view.updatedAt).toBeNull()
    expect(view.analyses).toHaveLength(2)
    // Незавершённость записи в базе не подмешивается в свежий расчёт.
    expect(view.limitations.map((item) => item.code)).not.toContain('report.match_payload.missing')
    expect(view.limitations.map((item) => item.code)).not.toContain('report.analysis_payload.missing')
  })
})

describe('Обратная совместимость снимков (интервал 10 → 15 минут)', () => {
  /**
   * Приводит снимок текущего формата к формату версии 1: 10-минутные поля
   * (`…At10`/`…First10`), без интервала и без журнала покупок за матч.
   */
  function toLegacyV1(payload: unknown): Record<string, unknown> {
    const snapshot = payload as {
      match: { players: Record<string, unknown>[] }
      [key: string]: unknown
    }
    return {
      ...snapshot,
      snapshot_version: 1,
      match: {
        ...snapshot.match,
        players: snapshot.match.players.map((player) => {
          const { purchaseLog, laning, ...rest } = player as {
            purchaseLog?: unknown
            laning: Record<string, unknown>
            [key: string]: unknown
          }
          return {
            ...rest,
            laning: {
              lastHitsAt10: laning.lastHits,
              goldAt10: laning.gold,
              xpAt10: laning.xp,
              killsFirst10: laning.killsFirst,
              deathsFirst10: laning.deathsFirst,
              purchasesFirst10: laning.purchasesFirst,
              laneEfficiencyPct: laning.laneEfficiencyPct,
            },
          }
        }),
      },
    }
  }

  function legacyRow(): Record<string, unknown> {
    const insert = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: null,
    })
    const stored = JSON.parse(JSON.stringify(makeStoredRow(insert))) as Record<string, unknown>
    return {
      ...stored,
      match_payload: toLegacyV1(stored.match_payload),
      analysis_payload: {
        ...(stored.analysis_payload as Record<string, unknown>),
        snapshot_version: 1,
      },
    }
  }

  it('читает снимок версии 1 без перезаписи данных в базе', () => {
    const parsed = parseStoredMatchReport(legacyRow())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    const player = parsed.view.match.players[0]
    // 10-минутные значения сохранены как есть, но помечены интервалом 10 минут.
    expect(player.laning.interval).toEqual({ minutes: 10, label: '00:00–10:00' })
    expect(player.laning.lastHits).toBe(86)
    expect(player.laning.gold).toBe(5860)
    // Журнал покупок за матч в старом формате отсутствует — секция предметов
    // покажет пояснение, а не выдуманные данные.
    expect(player.purchaseLog).toBeNull()
  })

  it('новые снимки записываются в версии 2 с интервалом и журналом покупок', () => {
    const insert = buildReportInsert({
      userId: USER_A,
      requestedId: '9007760151',
      match: buildMatch(),
      fetchedAt: null,
    })
    expect(insert.match_payload.snapshot_version).toBe(MATCH_REPORT_SNAPSHOT_VERSION)
    expect(MATCH_REPORT_SNAPSHOT_VERSION).toBe(2)
    const player = insert.match_payload.match.players[0]
    expect(player.laning.interval).toEqual({ minutes: 15, label: '00:00–15:00' })
    expect(player.purchaseLog).toEqual([{ time: 120, key: 'boots' }])
  })

  it('по-прежнему отклоняет снимок с неизвестной версией', () => {
    const row = legacyRow()
    const parsed = parseStoredMatchReport({
      ...row,
      match_payload: { ...(row.match_payload as object), snapshot_version: 99 },
    })
    expect(parsed.ok).toBe(false)
  })
})

describe('детальность снимка и обновление отчёта подробными данными (Task 14)', () => {
  const requestedId = '9007760151'

  function viewOf(raw: unknown) {
    return buildPendingView({
      userId: USER_A,
      requestedId,
      match: normalizeMatch(raw),
      fetchedAt: '2026-10-25T10:00:00.000Z',
    })
  }

  it('считает детальным только снимок с журналом покупок и таймлайнами у всех участников', () => {
    expect(isSnapshotDetailed(viewOf(DETAILED_MATCH))).toBe(true)
    expect(isSnapshotDetailed(viewOf(RAW_MATCH))).toBe(false)
  })

  it('обновляет отчёт только при подтверждённом улучшении данных', () => {
    const storedPartial = viewOf(RAW_MATCH)
    const freshDetailed = viewOf(DETAILED_MATCH)

    // Улучшение: раньше подробностей не было, теперь есть.
    expect(shouldRefreshStoredReport(storedPartial, freshDetailed)).toBeNull()
    // Сохранённый отчёт уже подробный: перезапись не нужна.
    expect(shouldRefreshStoredReport(freshDetailed, freshDetailed)).toBe('stored-detailed')
    // Новые данные не детальные: перезаписи нет.
    expect(shouldRefreshStoredReport(storedPartial, viewOf(RAW_MATCH))).toBe('not-detailed')
    // Незавершённая запись не обновляется автоматически.
    expect(
      shouldRefreshStoredReport({ ...storedPartial, status: 'pending' }, freshDetailed),
    ).toBe('not-usable')
    // Данные хуже сохранённых (меньше участников) не принимаются.
    const onePlayer = viewOf({ ...DETAILED_MATCH, players: [detailedPlayer(0)] })
    expect(shouldRefreshStoredReport(storedPartial, onePlayer)).toBe('worse-data')
    // Другой матч не может заменить сохранённый отчёт.
    expect(
      shouldRefreshStoredReport(storedPartial, { ...freshDetailed, matchId: '111' }),
    ).toBe('worse-data')
  })

  it('обновляет только собственную строку и не создаёт дубликатов', async () => {
    const { store, client } = makeFakeClient()
    const service = createMatchReportsService(client)

    const first = buildReportInsert({
      userId: USER_A,
      requestedId,
      match: normalizeMatch(RAW_MATCH),
      fetchedAt: '2026-10-25T10:00:00.000Z',
    })
    await service.savePersonalMatchReport(first)
    expect(store.rows).toHaveLength(1)

    const detailed = buildReportInsert({
      userId: USER_A,
      requestedId,
      match: normalizeMatch(DETAILED_MATCH),
      fetchedAt: '2026-10-26T10:00:00.000Z',
    })
    const refreshed = await service.refreshPersonalMatchReport(detailed)

    expect(refreshed.ok).toBe(true)
    if (refreshed.ok) {
      expect(refreshed.report.matchId).toBe(requestedId)
      expect(isSnapshotDetailed(refreshed.report)).toBe(true)
    }
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0].user_id).toBe(USER_A)
  })

  it('не объявляет успех, если строка не обновлена базой', async () => {
    const { client } = makeFakeClient()
    const service = createMatchReportsService(client)

    const refreshed = await service.refreshPersonalMatchReport(
      buildReportInsert({
        userId: USER_A,
        requestedId,
        match: normalizeMatch(DETAILED_MATCH),
        fetchedAt: null,
      }),
    )

    expect(refreshed.ok).toBe(false)
    if (!refreshed.ok) {
      expect(refreshed.error.kind).toBe('invalid_payload')
    }
  })

  it('отклоняет чужую строку и строку другого матча', async () => {
    const ownRow = buildReportInsert({
      userId: USER_A,
      requestedId,
      match: normalizeMatch(RAW_MATCH),
      fetchedAt: null,
    })
    const foreignRow = {
      ...buildReportInsert({
        userId: USER_B,
        requestedId,
        match: normalizeMatch(RAW_MATCH),
        fetchedAt: null,
      }),
      id: 'row-foreign',
      created_at: null,
      updated_at: null,
    }
    const otherMatchRow = {
      ...ownRow,
      match_id: '1234567890',
      id: 'row-other',
      created_at: null,
      updated_at: null,
    }

    const foreignClient: MatchReportsClient = {
      async selectPersonalReport() {
        return { data: null, error: null }
      },
      async insertPersonalReport() {
        return { data: null, error: { kind: 'unknown', code: null, message: 'не используется' } }
      },
      async updatePersonalReport() {
        return { data: foreignRow, error: null }
      },
    }
    const foreignResult = await createMatchReportsService(
      foreignClient,
    ).refreshPersonalMatchReport(ownRow)
    expect(foreignResult.ok).toBe(false)
    if (!foreignResult.ok) {
      expect(foreignResult.error.kind).toBe('permission')
    }

    const otherMatchClient: MatchReportsClient = {
      async selectPersonalReport() {
        return { data: null, error: null }
      },
      async insertPersonalReport() {
        return { data: null, error: { kind: 'unknown', code: null, message: 'не используется' } }
      },
      async updatePersonalReport() {
        return { data: otherMatchRow, error: null }
      },
    }
    const otherMatchResult = await createMatchReportsService(
      otherMatchClient,
    ).refreshPersonalMatchReport(ownRow)
    expect(otherMatchResult.ok).toBe(false)
    if (!otherMatchResult.ok) {
      expect(otherMatchResult.error.kind).toBe('invalid_payload')
    }
  })
})