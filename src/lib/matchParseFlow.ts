import type { NormalizedMatch } from '../types/match'
import { normalizeMatch } from './normalizeMatch'
import type { OpenDotaError, OpenDotaMatchResult } from './opendota'
import type { ParseRequestOptions, ParseRequestResult, ParseStatusResult } from './opendotaParse'
import {
  PARSE_POLL_BUDGET_MS,
  PARSE_POLL_MAX_ATTEMPTS,
  PARSE_REQUEST_MAX_ATTEMPTS,
  decideParseAction,
  inspectDetailedData,
  parsePollDelayMs,
  readMatchStartTime,
  shouldContinuePolling,
  type ParseAttemptStore,
} from './replayParsing'

/**
 * Оркестрация автоматической обработки реплея (Task 14, часть 3).
 *
 * Модуль не содержит React и не создаёт клиентов: HTTP-функции, время, таймеры и
 * хранилище передаются снаружи, поэтому все сценарии (включая сбои, лимиты и
 * гонки) проверяются юнит-тестами без живой сети.
 *
 * Границы поведения:
 *  - запрос обработки отправляется только при отсутствии подробных данных;
 *  - дубликаты не создаются: активная задача переиспользуется;
 *  - опрос ограничен и числом попыток, и общим бюджетом времени (backoff);
 *  - если обработка не завершилась в текущей сессии, возвращается честный статус
 *    `pending` с идентификатором задачи — фоновая обработка не обещается;
 *  - подробные данные не выдумываются: успех подтверждается только повторной
 *    загрузкой матча, где проверка полноты действительно пройдена.
 */

/** Шаги автоматической обработки, отображаемые в интерфейсе. */
export type MatchParsePhase =
  | 'inspecting-data'
  | 'requesting-parse'
  | 'waiting-parse'
  | 'refetching'

/** Итог автоматической обработки реплея. */
export type MatchParseOutcome =
  | { kind: 'not-needed'; match: NormalizedMatch }
  | { kind: 'parsed'; match: NormalizedMatch; jobId: string }
  | {
      kind: 'replay-unavailable'
      reason: 'expired' | 'denied' | 'unknown'
      match: NormalizedMatch
    }
  | { kind: 'pending'; jobId: string | null; match: NormalizedMatch }
  | {
      kind: 'failed'
      reason: 'rate-limited' | 'network' | 'provider' | 'incomplete'
      match: NormalizedMatch
    }
  | { kind: 'aborted' }

export interface MatchParseDeps {
  /** Проверенный ID матча (строка из цифр). */
  matchId: string
  /** Сырой ответ OpenDota: нужен только для времени начала матча. */
  rawMatch: unknown
  /** Уже нормализованный матч — вход для проверки полноты данных. */
  match: NormalizedMatch
  fetchMatch: (matchId: string, signal?: AbortSignal) => Promise<OpenDotaMatchResult>
  requestParse: (matchId: string, options?: ParseRequestOptions) => Promise<ParseRequestResult>
  fetchJobStatus: (jobId: string, options?: ParseRequestOptions) => Promise<ParseStatusResult>
  now: () => Date
  /** Хранилище записей о задачах; `null` — работа без сохранения (только память процесса). */
  store?: ParseAttemptStore | null
  apiKey?: string | null
  signal?: AbortSignal
  /** Ожидание между опросами; в тестах подменяется. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  onPhase?: (phase: MatchParsePhase) => void
  maxRequests?: number
  maxPollAttempts?: number
  budgetMs?: number
}

/** Ожидание с поддержкой отмены: таймер не остаётся «висящим». */
function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted === true) {
      resolve()
      return
    }
    const onAbort = () => {
      clearTimeout(timerId)
      resolve()
    }
    const timerId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort)
  })
}

/** Перевод ошибки провайдера в честный итог обработки (без выдачи успеха). */
function outcomeFromError(match: NormalizedMatch, error: OpenDotaError): MatchParseOutcome {
  if (error.kind === 'aborted') {
    return { kind: 'aborted' }
  }
  if (error.kind === 'rate_limited') {
    return { kind: 'failed', reason: 'rate-limited', match }
  }
  if (error.kind === 'forbidden' || error.kind === 'not_found') {
    return { kind: 'replay-unavailable', reason: 'denied', match }
  }
  if (error.kind === 'network' || error.kind === 'timeout') {
    return { kind: 'failed', reason: 'network', match }
  }
  return { kind: 'failed', reason: 'provider', match }
}

/**
 * Автоматическая обработка реплея: единственная точка входа.
 *
 * Никогда не бросает исключений и не зацикливается: число запросов обработки,
 * число опросов и общее время ожидания ограничены константами `replayParsing`.
 */
export async function ensureDetailedMatchData(
  deps: MatchParseDeps,
): Promise<MatchParseOutcome> {
  const store = deps.store ?? null
  const sleep = deps.sleep ?? defaultSleep
  const apiKey = deps.apiKey ?? null
  const maxRequests = deps.maxRequests ?? PARSE_REQUEST_MAX_ATTEMPTS
  const maxPollAttempts = deps.maxPollAttempts ?? PARSE_POLL_MAX_ATTEMPTS
  const budgetMs = deps.budgetMs ?? PARSE_POLL_BUDGET_MS
  const options: ParseRequestOptions = { signal: deps.signal, apiKey }

  deps.onPhase?.('inspecting-data')
  const attempt = store?.read(deps.matchId) ?? null
  const action = decideParseAction({
    match: deps.match,
    startTimeSeconds: readMatchStartTime(deps.rawMatch),
    attempt,
    now: deps.now(),
    maxRequests,
  })

  if (action.kind === 'not-needed') {
    return { kind: 'not-needed', match: deps.match }
  }
  if (action.kind === 'replay-unavailable') {
    return { kind: 'replay-unavailable', reason: 'expired', match: deps.match }
  }
  if (action.kind === 'give-up') {
    // Запросы исчерпаны: новых не отправляем, но статус остаётся честным.
    return { kind: 'pending', jobId: attempt?.jobId ?? null, match: deps.match }
  }

  let jobId: string
  if (action.kind === 'reuse-job') {
    jobId = action.jobId
  } else {
    deps.onPhase?.('requesting-parse')
    const requested = await deps.requestParse(deps.matchId, options)
    if (!requested.ok) {
      return outcomeFromError(deps.match, requested.error)
    }
    jobId = requested.jobId
    store?.write({
      matchId: deps.matchId,
      jobId,
      requestedAtMs: deps.now().getTime(),
      requests: action.requests,
    })
  }

  deps.onPhase?.('waiting-parse')
  const startedAtMs = deps.now().getTime()
  let polls = 0
  let missingStreak = 0
  let latestMatch = deps.match

  while (
    shouldContinuePolling({
      attempts: polls,
      elapsedMs: deps.now().getTime() - startedAtMs,
      maxAttempts: maxPollAttempts,
      budgetMs,
    })
  ) {
    if (deps.signal?.aborted === true) {
      return { kind: 'aborted' }
    }

    const status = await deps.fetchJobStatus(jobId, options)
    polls += 1

    if (!status.ok) {
      if (status.error.kind === 'aborted') {
        return { kind: 'aborted' }
      }
      if (status.error.kind === 'rate_limited') {
        return { kind: 'failed', reason: 'rate-limited', match: latestMatch }
      }
      if (status.error.kind === 'network' || status.error.kind === 'timeout') {
        // Одиночный сетевой сбой не прекращает наблюдение: ждём и пробуем снова,
        // но общий бюджет попыток при этом расходуется.
        await sleep(parsePollDelayMs(polls), deps.signal)
        continue
      }
      return { kind: 'failed', reason: 'provider', match: latestMatch }
    }

    const reading = status.job
    if (reading.kind === 'completed') {
      deps.onPhase?.('refetching')
      const refetched = await deps.fetchMatch(deps.matchId, deps.signal)
      if (!refetched.ok) {
        return outcomeFromError(latestMatch, refetched.error)
      }
      const normalized = normalizeMatch(refetched.match)
      latestMatch = normalized
      if (inspectDetailedData(normalized).detailed) {
        store?.clear(deps.matchId)
        return { kind: 'parsed', match: normalized, jobId }
      }
      // Задача завершилась, но подробных данных нет: успех не подтверждается.
      return { kind: 'failed', reason: 'incomplete', match: normalized }
    }
    if (reading.kind === 'failed') {
      store?.clear(deps.matchId)
      return { kind: 'failed', reason: 'provider', match: latestMatch }
    }
    if (reading.kind === 'missing') {
      // `null` — задача неизвестна (скорее всего, реплей удалён у OpenDota).
      // Одна повторная проверка, затем честный вывод «реплей недоступен».
      missingStreak += 1
      if (missingStreak >= 2) {
        store?.clear(deps.matchId)
        return { kind: 'replay-unavailable', reason: 'unknown', match: latestMatch }
      }
    } else {
      missingStreak = 0
    }

    await sleep(parsePollDelayMs(polls), deps.signal)
  }

  if (deps.signal?.aborted === true) {
    return { kind: 'aborted' }
  }
  // Бюджет или лимит попыток исчерпан: статус «обработка не завершена» с
  // сохранённым идентификатором задачи — повторное открытие продолжит наблюдение.
  return { kind: 'pending', jobId, match: latestMatch }
}
