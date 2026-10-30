import { describe, expect, it } from 'vitest'

import { normalizeMatch } from './normalizeMatch'
import {
  PARSE_ATTEMPT_STORAGE_PREFIX,
  PARSE_POLL_INITIAL_DELAY_MS,
  PARSE_POLL_MAX_DELAY_MS,
  createBrowserParseAttemptStore,
  createMemoryParseAttemptStore,
  decideParseAction,
  inspectDetailedData,
  isAttemptActive,
  isReplayLikelyExpired,
  parsePollDelayMs,
  readMatchStartTime,
  readParseJob,
  readParseJobId,
  shouldContinuePolling,
} from './replayParsing'

/**
 * Тесты правил автоматической обработки реплея (Task 14).
 *
 * Сеть не используется: проверяются только чистые правила — полнота подробных
 * данных, разбор ответов о задаче, окно доступности реплея, лимиты опроса и
 * решения о запросе (включая защиту от дубликатов и бесконечных циклов).
 */

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

function matchWith(playerCount: number, withDetails: boolean) {
  const players: unknown[] = []
  for (let index = 0; index < playerCount; index += 1) {
    players.push(rawPlayer(index < 5 ? index : index + 123, withDetails))
  }
  return normalizeMatch({
    match_id: 9007760151,
    duration: 2000,
    radiant_win: true,
    players,
  })
}

describe('полнота подробных данных', () => {
  it('считает матч подробным, когда у всех участников есть журнал покупок и таймлайны', () => {
    const inspection = inspectDetailedData(matchWith(4, true))
    expect(inspection.players).toBe(4)
    expect(inspection.playersWithPurchaseLog).toBe(4)
    expect(inspection.playersWithLaneTimeline).toBe(4)
    expect(inspection.missing).toEqual([])
    expect(inspection.detailed).toBe(true)
  })

  it('фиксирует отсутствие журнала покупок и таймлайнов без подмены нулями', () => {
    const inspection = inspectDetailedData(matchWith(4, false))
    expect(inspection.playersWithPurchaseLog).toBe(0)
    expect(inspection.playersWithLaneTimeline).toBe(0)
    expect(inspection.missing).toEqual(['purchase_log', 'lane_timeline'])
    expect(inspection.detailed).toBe(false)
  })

  it('не считает матч подробным, если подробности есть только у части участников', () => {
    const match = normalizeMatch({
      match_id: 1,
      duration: 100,
      radiant_win: true,
      players: [rawPlayer(0, true), rawPlayer(128, false)],
    })
    const inspection = inspectDetailedData(match)
    expect(inspection.players).toBe(2)
    expect(inspection.playersWithPurchaseLog).toBe(1)
    expect(inspection.detailed).toBe(false)
  })

  it('пустой матч не считается подробным', () => {
    const inspection = inspectDetailedData(matchWith(0, true))
    expect(inspection.players).toBe(0)
    expect(inspection.missing).toEqual(['purchase_log', 'lane_timeline'])
  })
})

describe('разбор ответов OpenDota о задаче обработки', () => {
  it('читает идентификатор задачи числом и строкой, отклоняя некорректные значения', () => {
    expect(readParseJobId({ job: { jobId: 614710125 } })).toBe('614710125')
    expect(readParseJobId({ job: { jobId: '42' } })).toBe('42')
    expect(readParseJobId({ job: { jobId: 0 } })).toBeNull()
    expect(readParseJobId({ job: { jobId: -1 } })).toBeNull()
    expect(readParseJobId({ job: {} })).toBeNull()
    expect(readParseJobId({})).toBeNull()
    expect(readParseJobId(null)).toBeNull()
  })

  it('различает ожидание, завершение, сбой, отсутствие и некорректный ответ', () => {
    expect(readParseJob(null)).toEqual({ kind: 'missing' })
    expect(readParseJob({ job: { status: 'pending' } })).toEqual({
      kind: 'pending',
      status: 'pending',
    })
    expect(readParseJob({ job: { status: 'in progress' } })).toEqual({
      kind: 'pending',
      status: 'in progress',
    })
    expect(readParseJob({ job: { status: 'completed' } })).toEqual({ kind: 'completed' })
    expect(readParseJob({ job: { status: 'failed' } })).toEqual({ kind: 'failed' })
    expect(readParseJob({ job: { status: 'unknown-status' } })).toEqual({ kind: 'invalid' })
    expect(readParseJob({ job: {} })).toEqual({ kind: 'invalid' })
    expect(readParseJob('не объект')).toEqual({ kind: 'invalid' })
  })
})

describe('окно доступности реплея и ограничения опроса', () => {
  const now = new Date('2026-10-30T12:00:00.000Z')

  it('считает реплей недоступным только для матчей старше окна хранения', () => {
    const tenDaysAgo = Math.floor(now.getTime() / 1000) - 10 * 24 * 60 * 60
    const twentyDaysAgo = Math.floor(now.getTime() / 1000) - 20 * 24 * 60 * 60
    expect(isReplayLikelyExpired(tenDaysAgo, now)).toBe(false)
    expect(isReplayLikelyExpired(twentyDaysAgo, now)).toBe(true)
    // Отсутствие времени начала не трактуется как отказ от попытки.
    expect(isReplayLikelyExpired(null, now)).toBe(false)
  })

  it('читает время начала матча только из корректного значения', () => {
    expect(readMatchStartTime({ start_time: 1700000000 })).toBe(1700000000)
    expect(readMatchStartTime({ start_time: 0 })).toBeNull()
    expect(readMatchStartTime({ start_time: '1700000000' })).toBeNull()
    expect(readMatchStartTime(null)).toBeNull()
  })

  it('наращивает задержку опроса с потолком', () => {
    expect(parsePollDelayMs(1)).toBe(PARSE_POLL_INITIAL_DELAY_MS)
    expect(parsePollDelayMs(2)).toBe(8000)
    expect(parsePollDelayMs(3)).toBe(PARSE_POLL_MAX_DELAY_MS)
    expect(parsePollDelayMs(9)).toBe(PARSE_POLL_MAX_DELAY_MS)
    expect(parsePollDelayMs(0)).toBe(PARSE_POLL_INITIAL_DELAY_MS)
  })

  it('ограничивает опрос числом попыток и общим бюджетом времени', () => {
    expect(shouldContinuePolling({ attempts: 0, elapsedMs: 0 })).toBe(true)
    expect(shouldContinuePolling({ attempts: 7, elapsedMs: 1000 })).toBe(true)
    expect(shouldContinuePolling({ attempts: 8, elapsedMs: 1000 })).toBe(false)
    expect(shouldContinuePolling({ attempts: 1, elapsedMs: 90001 })).toBe(false)
  })
})

describe('хранилище записей о задачах обработки', () => {
  function fakeStorage() {
    const data = new Map<string, string>()
    return {
      data,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      },
      removeItem: (key: string) => {
        data.delete(key)
      },
    } as unknown as Storage
  }

  it('сохраняет, читает и очищает запись в памяти', () => {
    const store = createMemoryParseAttemptStore()
    expect(store.read('9007760151')).toBeNull()
    store.write({ matchId: '9007760151', jobId: '5', requestedAtMs: 1000, requests: 1 })
    expect(store.read('9007760151')).toEqual({
      matchId: '9007760151',
      jobId: '5',
      requestedAtMs: 1000,
      requests: 1,
    })
    store.clear('9007760151')
    expect(store.read('9007760151')).toBeNull()
  })

  it('переиспользует запись из localStorage и игнорирует повреждённые данные', () => {
    const storage = fakeStorage()
    const store = createBrowserParseAttemptStore(storage)
    store.write({ matchId: '77', jobId: '9', requestedAtMs: 5, requests: 1 })
    expect(storage.data.get(PARSE_ATTEMPT_STORAGE_PREFIX + '77')).toContain('"jobId":"9"')
    expect(store.read('77')?.jobId).toBe('9')

    storage.data.set(PARSE_ATTEMPT_STORAGE_PREFIX + '77', '{не json')
    expect(store.read('77')).toBeNull()

    storage.data.set(PARSE_ATTEMPT_STORAGE_PREFIX + '77', JSON.stringify({ matchId: '78' }))
    expect(store.read('77')).toBeNull()
  })

  it('работает без localStorage и не падает на ошибках доступа', () => {
    const store = createBrowserParseAttemptStore(null)
    store.write({ matchId: '1', jobId: '2', requestedAtMs: 3, requests: 1 })
    expect(store.read('1')?.jobId).toBe('2')

    const throwing = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    } as unknown as Storage
    const safe = createBrowserParseAttemptStore(throwing)
    expect(safe.read('1')).toBeNull()
    expect(() =>
      safe.write({ matchId: '1', jobId: '2', requestedAtMs: 3, requests: 1 }),
    ).not.toThrow()
    expect(() => safe.clear('1')).not.toThrow()
  })

  it('считает запись активной только внутри срока жизни', () => {
    const record = { matchId: '1', jobId: '2', requestedAtMs: 1000, requests: 1 }
    expect(isAttemptActive(record, 2000)).toBe(true)
    expect(isAttemptActive(record, 1000 + 16 * 60 * 1000)).toBe(false)
  })
})

describe('решение о запросе обработки', () => {
  const now = new Date('2026-10-30T12:00:00.000Z')
  const recent = Math.floor(now.getTime() / 1000) - 60 * 60

  it('не запрашивает обработку, когда подробные данные уже есть', () => {
    expect(
      decideParseAction({
        match: matchWith(2, true),
        startTimeSeconds: recent,
        attempt: null,
        now,
      }),
    ).toEqual({ kind: 'not-needed' })
  })

  it('не запрашивает обработку для матчей старше окна хранения реплея', () => {
    const old = Math.floor(now.getTime() / 1000) - 30 * 24 * 60 * 60
    expect(
      decideParseAction({
        match: matchWith(2, false),
        startTimeSeconds: old,
        attempt: null,
        now,
      }),
    ).toEqual({ kind: 'replay-unavailable', reason: 'expired' })
  })

  it('переиспользует активную задачу вместо повторного запроса', () => {
    expect(
      decideParseAction({
        match: matchWith(2, false),
        startTimeSeconds: recent,
        attempt: { matchId: '1', jobId: '77', requestedAtMs: now.getTime() - 1000, requests: 1 },
        now,
      }),
    ).toEqual({ kind: 'reuse-job', jobId: '77' })
  })

  it('прекращает запросы после исчерпания лимита попыток', () => {
    expect(
      decideParseAction({
        match: matchWith(2, false),
        startTimeSeconds: recent,
        attempt: { matchId: '1', jobId: '77', requestedAtMs: 0, requests: 2 },
        now,
      }),
    ).toEqual({ kind: 'give-up', reason: 'attempts-exhausted' })
  })

  it('запрашивает обработку, когда подробных данных нет и лимит не исчерпан', () => {
    expect(
      decideParseAction({
        match: matchWith(2, false),
        startTimeSeconds: recent,
        attempt: null,
        now,
      }),
    ).toEqual({ kind: 'request', requests: 1 })
    expect(
      decideParseAction({
        match: matchWith(2, false),
        startTimeSeconds: recent,
        attempt: { matchId: '1', jobId: '77', requestedAtMs: 0, requests: 1 },
        now,
      }),
    ).toEqual({ kind: 'request', requests: 2 })
  })
})
