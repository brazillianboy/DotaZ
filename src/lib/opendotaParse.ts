import type { OpenDotaError } from './opendota'
import {
  OPENDOTA_REQUEST_ENDPOINT,
  readParseJob,
  readParseJobId,
  type ParseJobReading,
} from './replayParsing'

/**
 * HTTP-клиент автоматической обработки реплея OpenDota (Task 14, часть 3).
 *
 * Используются только документированные endpoint'ы:
 *  - `POST {OPENDOTA_REQUEST_ENDPOINT}/{match_id}` — постановка задачи обработки;
 *  - `GET  {OPENDOTA_REQUEST_ENDPOINT}/{job_id}`  — статус задачи.
 *
 * Живая проверка (30.10.2026) подтвердила: оба endpoint'а доступны из браузера
 * (CORS: `Access-Control-Allow-Origin` повторяет Origin, `OPTIONS` → 204) и
 * работают без ключа. Ключ OpenDota (`api_key`) не является секретом доступа к
 * приватным данным и служит только для повышения лимитов, поэтому он берётся из
 * переменной окружения сборки и никогда не хранится в исходном коде; если
 * переменная не задана, запросы идут анонимно (60 запросов/мин, 3000/сутки).
 */

/** Таймаут одного запроса обработки/статуса (15 секунд). */
export const OPENDOTA_PARSE_TIMEOUT_MS = 15000

/** Имя переменной окружения сборки для необязательного ключа OpenDota. */
export const OPENDOTA_API_KEY_ENV_NAME = 'VITE_OPENDOTA_API_KEY'

export interface ParseRequestOptions {
  signal?: AbortSignal
  /** Необязательный ключ OpenDota (только повышение лимитов); в логи не попадает. */
  apiKey?: string | null
  timeoutMs?: number
  /** Подмена `fetch` для тестов. */
  fetchImpl?: typeof fetch
}

export type ParseRequestResult =
  | { ok: true; jobId: string }
  | { ok: false; error: OpenDotaError }

export type ParseStatusResult =
  | { ok: true; job: ParseJobReading }
  | { ok: false; error: OpenDotaError }

/** Чтение необязательного ключа OpenDota из окружения сборки. */
export function resolveOpenDotaApiKey(
  env: Record<string, unknown> | undefined | null,
): string | null {
  if (env === undefined || env === null) {
    return null
  }
  const raw = env[OPENDOTA_API_KEY_ENV_NAME]
  if (typeof raw !== 'string') {
    return null
  }
  const value = raw.trim()
  return value.length === 0 ? null : value
}

/**
 * URL запроса: ключ добавляется только если он задан.
 * Значение ключа никогда не пишется в сообщения об ошибках.
 */
export function buildParseUrl(id: string, apiKey: string | null): string {
  const base = `${OPENDOTA_REQUEST_ENDPOINT}/${id}`
  return apiKey === null ? base : `${base}?api_key=${encodeURIComponent(apiKey)}`
}

function isPositiveDigits(value: string): boolean {
  return /^\d+$/.test(value) && !/^0+$/.test(value)
}

function invalidIdError(kind: 'match' | 'job'): OpenDotaError {
  return {
    kind: 'invalid_response',
    message:
      kind === 'match'
        ? 'Некорректный ID матча: запрос обработки реплея не отправлен.'
        : 'Некорректный идентификатор задачи обработки: запрос статуса не отправлен.',
  }
}

function errorFromStatus(status: number): OpenDotaError {
  if (status === 404) {
    return { kind: 'not_found', status, message: 'Запрос обработки не найден у OpenDota.' }
  }
  if (status === 401 || status === 403) {
    return {
      kind: 'forbidden',
      status,
      message: 'OpenDota отклонил запрос обработки реплея (нет доступа).',
    }
  }
  if (status === 429) {
    return {
      kind: 'rate_limited',
      status,
      message: 'OpenDota ограничил частоту запросов. Повторите попытку позже.',
    }
  }
  if (status >= 500 && status <= 599) {
    return {
      kind: 'server_error',
      status,
      message: 'OpenDota временно недоступен (ошибка сервера). Повторите попытку позже.',
    }
  }
  return {
    kind: 'unexpected_status',
    status,
    message: `OpenDota вернул неожиданный ответ (HTTP ${status}).`,
  }
}

type JsonOutcome = { ok: true; payload: unknown } | { ok: false; error: OpenDotaError }

/**
 * Один HTTP-запрос с таймаутом и поддержкой внешней отмены.
 * Ответ может быть `null` (валидный JSON `null`) — это передаётся как есть.
 */
async function requestJson(
  url: string,
  method: 'GET' | 'POST',
  options: ParseRequestOptions,
): Promise<JsonOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? OPENDOTA_PARSE_TIMEOUT_MS
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const external = options.signal
  const onExternalAbort = () => controller.abort()
  if (external !== undefined) {
    if (external.aborted) {
      clearTimeout(timeoutId)
      return { ok: false, error: { kind: 'aborted', message: 'Запрос отменён.' } }
    }
    external.addEventListener('abort', onExternalAbort)
  }

  try {
    const response = await fetchImpl(url, {
      method,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      return { ok: false, error: errorFromStatus(response.status) }
    }
    try {
      return { ok: true, payload: (await response.json()) as unknown }
    } catch {
      return {
        ok: false,
        error: {
          kind: 'invalid_response',
          status: response.status,
          message: 'Не удалось разобрать ответ OpenDota об обработке реплея.',
        },
      }
    }
  } catch {
    if (timedOut) {
      return {
        ok: false,
        error: {
          kind: 'timeout',
          message: 'Истекло время ожидания ответа OpenDota об обработке реплея.',
        },
      }
    }
    if (external?.aborted === true) {
      return { ok: false, error: { kind: 'aborted', message: 'Запрос отменён.' } }
    }
    return {
      ok: false,
      error: {
        kind: 'network',
        message: 'Сеть недоступна или OpenDota не отвечает.',
      },
    }
  } finally {
    clearTimeout(timeoutId)
    if (external !== undefined) {
      external.removeEventListener('abort', onExternalAbort)
    }
  }
}

/**
 * Постановка задачи обработки реплея.
 * Успех подтверждается только корректным `job.jobId` в ответе.
 */
export async function requestReplayParse(
  matchId: string,
  options: ParseRequestOptions = {},
): Promise<ParseRequestResult> {
  if (!isPositiveDigits(matchId)) {
    return { ok: false, error: invalidIdError('match') }
  }
  const outcome = await requestJson(
    buildParseUrl(matchId, options.apiKey ?? null),
    'POST',
    options,
  )
  if (!outcome.ok) {
    return { ok: false, error: outcome.error }
  }
  const jobId = readParseJobId(outcome.payload)
  if (jobId === null) {
    return {
      ok: false,
      error: {
        kind: 'invalid_response',
        message: 'OpenDota не вернул идентификатор задачи обработки реплея.',
      },
    }
  }
  return { ok: true, jobId }
}

/** Статус задачи обработки реплея; тело `null` разбирается как `missing`. */
export async function fetchParseJobStatus(
  jobId: string,
  options: ParseRequestOptions = {},
): Promise<ParseStatusResult> {
  if (!isPositiveDigits(jobId)) {
    return { ok: false, error: invalidIdError('job') }
  }
  const outcome = await requestJson(buildParseUrl(jobId, options.apiKey ?? null), 'GET', options)
  if (!outcome.ok) {
    return { ok: false, error: outcome.error }
  }
  return { ok: true, job: readParseJob(outcome.payload) }
}
