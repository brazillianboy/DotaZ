import { describe, expect, it } from 'vitest'

import { buildAnalysisSnapshot, buildMatchSnapshot } from './matchReports'
import { createEmptyNormalizedMatch } from './normalizeMatch'
import {
  loadProgressReports,
  PROGRESS_PAGE_SIZE,
  type ProgressReportsListClient,
} from './progressFlow'
import type { ReportDbError } from './matchReports'
import type { NormalizedPlayer } from '../types/match'

/** Тесты оркестрации загрузки прогресса (Task 20) без реальной базы и сети. */

const USER_A = '11111111-1111-4111-8111-111111111111'
const SELF = 123

function makePlayer(overrides: Partial<NormalizedPlayer> = {}): NormalizedPlayer {
  return {
    player_slot: 0,
    team: 'radiant',
    hero_id: 1,
    kills: 5,
    deaths: 2,
    assists: 10,
    gold_per_min: 400,
    xp_per_min: 500,
    last_hits: 200,
    hero_damage: null,
    tower_damage: null,
    hero_healing: null,
    level: null,
    denies: null,
    net_worth: null,
    player_name: null,
    account_id: SELF,
    inventory_ids: null,
    neutral_item_id: null,
    lane: 1,
    lane_role: 1,
    ability_upgrades: null,
    purchaseLog: null,
    laning: {
      interval: { minutes: 15, label: '00:00–15:00' },
      lastHits: 40,
      gold: 3000,
      xp: 2500,
      killsFirst: 1,
      deathsFirst: 0,
      purchasesFirst: [],
      laneEfficiencyPct: null,
    },
    ...overrides,
  }
}

function makeValidRow(): unknown {
  const match = { ...createEmptyNormalizedMatch(), match_id: '1', duration: 1800, start_time: 100, radiant_win: true, players: [makePlayer()] }
  return {
    id: 'row-1',
    user_id: USER_A,
    match_id: '1',
    status: 'ready',
    match_payload: buildMatchSnapshot(match, '1'),
    analysis_payload: buildAnalysisSnapshot(match),
    rules_version: '1.1.0',
    source: 'OpenDota',
    fetched_at: null,
    created_at: null,
    updated_at: null,
  }
}

interface ClientState {
  calls: Array<{ userId: string; limit: number; offset: number }>
  data: unknown
  error: ReportDbError | null
}

function makeClient(data: unknown = [], error: ReportDbError | null = null) {
  const state: ClientState = { calls: [], data, error }
  const client: ProgressReportsListClient = {
    async selectPersonalReportsFull(params) {
      state.calls.push({ userId: params.userId, limit: params.limit, offset: params.offset })
      return { data: state.data, error: state.error }
    },
  }
  return { state, client }
}

describe('loadProgressReports — гейтинг состояния', () => {
  it('во время проверки сессии ждёт аутентификации', async () => {
    const { client } = makeClient()
    const result = await loadProgressReports({
      authStatus: 'loading',
      userId: null,
      selfAccountId: SELF,
      client,
    })
    expect(result).toEqual({ status: 'waiting-auth' })
  })

  it('для анонима возвращает signed-out, не обращаясь к клиенту', async () => {
    const { state, client } = makeClient()
    const result = await loadProgressReports({
      authStatus: 'anonymous',
      userId: null,
      selfAccountId: SELF,
      client,
    })
    expect(result).toEqual({ status: 'signed-out' })
    expect(state.calls).toHaveLength(0)
  })

  it('без Dota 2 account_id сообщает needs-steam', async () => {
    const { client } = makeClient()
    const result = await loadProgressReports({
      authStatus: 'authenticated',
      userId: USER_A,
      selfAccountId: null,
      client,
    })
    expect(result).toEqual({ status: 'needs-steam' })
  })

  it('без клиента Supabase сообщает no-database', async () => {
    const result = await loadProgressReports({
      authStatus: 'authenticated',
      userId: USER_A,
      selfAccountId: SELF,
      client: null,
    })
    expect(result).toEqual({ status: 'no-database' })
  })
})

describe('loadProgressReports — чтение собственных отчётов', () => {
  it('запрашивает отчёты только для текущего пользователя', async () => {
    const { state, client } = makeClient([makeValidRow()])
    const result = await loadProgressReports({
      authStatus: 'authenticated',
      userId: USER_A,
      selfAccountId: SELF,
      client,
    })
    expect(result.status).toBe('ok')
    expect(state.calls).toEqual([{ userId: USER_A, limit: PROGRESS_PAGE_SIZE, offset: 0 }])
  })

  it('пропускает повреждённые строки, не роняя загрузку', async () => {
    const { client } = makeClient([{}, makeValidRow()])
    const result = await loadProgressReports({
      authStatus: 'authenticated',
      userId: USER_A,
      selfAccountId: SELF,
      client,
    })
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.skippedInvalid).toBe(1)
      expect(result.reports).toHaveLength(1)
    }
  })

  it('передаёт ошибку базы как есть', async () => {
    const error: ReportDbError = { kind: 'network', code: '503', message: 'нет связи' }
    const { client } = makeClient([], error)
    const result = await loadProgressReports({
      authStatus: 'authenticated',
      userId: USER_A,
      selfAccountId: SELF,
      client,
    })
    expect(result).toEqual({ status: 'error', error })
  })

  it('неожиданный формат списка трактует как ошибку payload', async () => {
    const { client } = makeClient({ not: 'an array' })
    const result = await loadProgressReports({
      authStatus: 'authenticated',
      userId: USER_A,
      selfAccountId: SELF,
      client,
    })
    expect(result.status).toBe('error')
  })
})