import { describe, expect, it } from 'vitest'

import { ensureDetailedMatchData, type MatchParseDeps, type MatchParsePhase } from './matchParseFlow'
import { normalizeMatch } from './normalizeMatch'
import type { OpenDotaError } from './opendota'
import {
  PARSE_POLL_MAX_ATTEMPTS,
  createMemoryParseAttemptStore,
  type ParseAttemptStore,
  type ParseJobReading,
} from './replayParsing'

/**
 * Тесты автоматической обработки реплея (Task 14).
 *
 * Проверяются: запрос обработки только при неполных данных, ожидание задачи с
 * ограниченным опросом, повторная загрузка матча, все виды сбоев и лимитов,
 * защита от дубликатов, отмена при уходе со страницы и честный статус
 * «обработка не завершена». Сеть и Supabase не используются.
 */

const NOW = new Date('2026-10-30T12:00:00.000Z')
const MATCH_ID = '9007760151'
const TIMELINE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]

function rawPlayer(slot: number, withDetails: boolean) {
  return withDetails
    ? {
        player_slot: slot,
        lh_t: TIMELINE,
        gold_t: TIMELINE,
        xp_t: TIMELINE,
        kills_log: [],
        deaths_log: [],
        purchase_log: [{ time: 60, key: 'magic_wand' }],
      }
    : { player_slot: slot, last_hits: 12 }
}

function recentStartSeconds(): number {
  return Math.floor(NOW.getTime() / 1000) - 3600
}

type StatusStep = ParseJobReading | { error: OpenDotaError }

interface HarnessOptions {
  initialDetailed?: boolean
  startTimeSeconds?: number | null
  jobStatuses?: StatusStep[]
  refetchedDetailed?: boolean
  requestError?: OpenDotaError
  fetchError?: OpenDotaError
  store?: ParseAttemptStore | null
  signal?: AbortSignal
  onStatus?: (call: number) => void
  maxPollAttempts?: number
  budgetMs?: number
}

function makeHarness(options: HarnessOptions = {}) {
  const calls = { request: 0, status: 0, fetch: 0, sleeps: [] as number[] }
  const phases: MatchParsePhase[] = []
  const statuses: StatusStep[] = [...(options.jobStatuses ?? [{ kind: 'completed' }])]
  const initialDetailed = options.initialDetailed ?? false
  let clock = NOW.getTime()

  const raw = {
    match_id: 9007760151,
    duration: 2000,
    radiant_win: true,
    start_time:
      options.startTimeSeconds === undefined ? recentStartSeconds() : options.startTimeSeconds,
    players: [rawPlayer(0, initialDetailed), rawPlayer(128, initialDetailed)],
  }

  const deps: MatchParseDeps = {
    matchId: MATCH_ID,
    rawMatch: raw,
    match: normalizeMatch(raw),
    fetchMatch: async () => {
      calls.fetch += 1
      if (options.fetchError !== undefined) {
        return { ok: false, error: options.fetchError }
      }
      const detailed = options.refetchedDetailed ?? true
      return {
        ok: true,
        match: {
          ...raw,
          players: [rawPlayer(0, detailed), rawPlayer(128, detailed)],
        },
      }
    },
    requestParse: async () => {
      calls.request += 1
      if (options.requestError !== undefined) {
        return { ok: false, error: options.requestError }
      }
      return { ok: true, jobId: '614710125' }
    },
    fetchJobStatus: async () => {
      calls.status += 1
      options.onStatus?.(calls.status)
      const next = statuses.shift() ?? { kind: 'pending', status: 'in progress' }
      if ('error' in next) {
        return { ok: false, error: next.error }
      }
      return { ok: true, job: next }
    },
    now: () => new Date(clock),
    store: options.store === undefined ? createMemoryParseAttemptStore() : options.store,
    signal: options.signal,
    sleep: async (ms) => {
      calls.sleeps.push(ms)
      // Ожидание продвигает модельное время: бюджет и лимиты работают как в жизни.
      clock += ms
    },
    onPhase: (phase) => phases.push(phase),
    maxPollAttempts: options.maxPollAttempts,
    budgetMs: options.budgetMs,
  }

  return { deps, calls, phases }
}

function openDotaError(kind: OpenDotaError['kind']): OpenDotaError {
  return { kind, message: kind }
}

describe('запрос обработки только при необходимости', () => {
  it('запрашивает обработку, когда подробных данных нет, и возвращает обновлённый матч', async () => {
    const { deps, calls, phases } = makeHarness({ initialDetailed: false })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('parsed')
    if (outcome.kind === 'parsed') {
      expect(outcome.jobId).toBe('614710125')
      expect(outcome.match.players[0].purchaseLog).not.toBeNull()
      expect(outcome.match.players[0].laning.gold).not.toBeNull()
    }
    expect(calls.request).toBe(1)
    expect(calls.status).toBe(1)
    expect(calls.fetch).toBe(1)
    expect(phases).toEqual(['inspecting-data', 'requesting-parse', 'waiting-parse', 'refetching'])
  })

  it('не запрашивает обработку и не ходит в сеть, когда данные уже полные', async () => {
    const { deps, calls } = makeHarness({ initialDetailed: true })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('not-needed')
    expect(calls.request).toBe(0)
    expect(calls.status).toBe(0)
    expect(calls.fetch).toBe(0)
  })

  it('не запрашивает обработку для матчей старше окна хранения реплея', async () => {
    const old = Math.floor(NOW.getTime() / 1000) - 30 * 24 * 60 * 60
    const { deps, calls } = makeHarness({ initialDetailed: false, startTimeSeconds: old })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome).toEqual({ kind: 'replay-unavailable', reason: 'expired', match: deps.match })
    expect(calls.request).toBe(0)
  })

  it('обрабатывает матч без времени начала, не отказываясь от попытки', async () => {
    const { deps, calls } = makeHarness({ initialDetailed: false, startTimeSeconds: null })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('parsed')
    expect(calls.request).toBe(1)
  })
})

describe('жизненный цикл задачи обработки', () => {
  it('пережидает ожидание задачи и подтверждает успех после повторной загрузки', async () => {
    const { deps, calls } = makeHarness({
      jobStatuses: [
        { kind: 'pending', status: 'pending' },
        { kind: 'pending', status: 'in progress' },
        { kind: 'completed' },
      ],
    })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('parsed')
    expect(calls.status).toBe(3)
    expect(calls.sleeps).toEqual([4000, 8000])
  })

  it('не объявляет успех, если после обработки подробные данные всё ещё неполные', async () => {
    const { deps } = makeHarness({ refetchedDetailed: false })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') {
      expect(outcome.reason).toBe('incomplete')
    }
  })

  it('сообщает о сбое задачи обработки и разрешает новую попытку позже', async () => {
    const store = createMemoryParseAttemptStore()
    const first = makeHarness({ jobStatuses: [{ kind: 'failed' }], store })

    const outcome = await ensureDetailedMatchData(first.deps)

    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') {
      expect(outcome.reason).toBe('provider')
    }
    // Запись о неудачной задаче удалена: следующий визит может запросить обработку снова.
    expect(store.read(MATCH_ID)).toBeNull()
    const second = makeHarness({ store })
    await ensureDetailedMatchData(second.deps)
    expect(second.calls.request).toBe(1)
  })

  it('трактует исчезнувшую задачу как недоступный реплей, а не как успех', async () => {
    const { deps } = makeHarness({ jobStatuses: [{ kind: 'missing' }, { kind: 'missing' }] })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome).toEqual({ kind: 'replay-unavailable', reason: 'unknown', match: deps.match })
  })

  it('сообщает о сбое повторной загрузки матча', async () => {
    const { deps } = makeHarness({ fetchError: openDotaError('server_error') })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') {
      expect(outcome.reason).toBe('provider')
    }
  })

  it('считает отказ доступа к обработке недоступным реплеем', async () => {
    const { deps } = makeHarness({ requestError: openDotaError('forbidden') })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('replay-unavailable')
    if (outcome.kind === 'replay-unavailable') {
      expect(outcome.reason).toBe('denied')
    }
  })

  it('сообщает об ограничении частоты запросов без повторных попыток', async () => {
    const { deps, calls } = makeHarness({ requestError: openDotaError('rate_limited') })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') {
      expect(outcome.reason).toBe('rate-limited')
    }
    expect(calls.request).toBe(1)
    expect(calls.status).toBe(0)
  })
})

describe('ограничения опроса и защита от дубликатов', () => {
  it('останавливает опрос по лимиту попыток и сохраняет честный статус', async () => {
    const store = createMemoryParseAttemptStore()
    const { deps, calls } = makeHarness({ store, jobStatuses: [] })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('pending')
    if (outcome.kind === 'pending') {
      expect(outcome.jobId).toBe('614710125')
    }
    expect(calls.status).toBeLessThanOrEqual(PARSE_POLL_MAX_ATTEMPTS)
    expect(calls.request).toBe(1)
    // Запись сохранена: наблюдение продолжится при следующем открытии страницы.
    expect(store.read(MATCH_ID)?.jobId).toBe('614710125')
  })

  it('переиспользует активную задачу вместо нового запроса обработки', async () => {
    const store = createMemoryParseAttemptStore()
    const first = makeHarness({ store, jobStatuses: [] })
    await ensureDetailedMatchData(first.deps)
    expect(first.calls.request).toBe(1)

    const second = makeHarness({ store, jobStatuses: [] })
    const outcome = await ensureDetailedMatchData(second.deps)

    expect(outcome.kind).toBe('pending')
    expect(second.calls.request).toBe(0)
    expect(second.calls.status).toBeGreaterThan(0)
  })

  it('не создаёт дубликаты при повторном открытии того же матча', async () => {
    const store = createMemoryParseAttemptStore()
    const harness = makeHarness({ store, jobStatuses: [] })
    await ensureDetailedMatchData(harness.deps)
    await ensureDetailedMatchData(harness.deps)

    expect(harness.calls.request).toBe(1)
  })

  it('прекращает запросы после исчерпания лимита попыток на матч', async () => {
    const store = createMemoryParseAttemptStore()
    store.write({ matchId: MATCH_ID, jobId: '77', requestedAtMs: 0, requests: 2 })
    const { deps, calls } = makeHarness({ store })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('pending')
    if (outcome.kind === 'pending') {
      expect(outcome.jobId).toBe('77')
    }
    expect(calls.request).toBe(0)
    expect(calls.status).toBe(0)
  })

  it('прекращает опрос при уходе со страницы и сохраняет статус задачи', async () => {
    const store = createMemoryParseAttemptStore()
    const controller = new AbortController()
    const { deps, calls } = makeHarness({
      store,
      signal: controller.signal,
      jobStatuses: [],
      onStatus: () => controller.abort(),
    })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('aborted')
    expect(calls.status).toBe(1)
    expect(store.read(MATCH_ID)?.jobId).toBe('614710125')
  })

  it('ограничивает суммарное время ожидания бюджетом', async () => {
    const { deps, calls } = makeHarness({ jobStatuses: [], budgetMs: 12000 })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('pending')
    // Бюджет 12 с: после ожиданий 4 с и 8 с цикл прекращается.
    expect(calls.status).toBe(2)
    expect(calls.sleeps).toEqual([4000, 8000])
  })

  it('переживает одиночные сетевые сбои при опросе, но не зацикливается', async () => {
    const { deps, calls } = makeHarness({
      jobStatuses: [
        { error: openDotaError('network') },
        { error: openDotaError('timeout') },
        { kind: 'completed' },
      ],
    })

    const outcome = await ensureDetailedMatchData(deps)

    expect(outcome.kind).toBe('parsed')
    expect(calls.status).toBe(3)
    expect(calls.sleeps).toEqual([4000, 8000])
  })
})
