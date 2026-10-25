/**
 * Доступ к OpenDota API (Task 5).
 *
 * Архитектура: минимальный публичный клиент на нативном Fetch.
 * Endpoint `GET https://api.opendota.com/api/matches/{match_id}` не требует ключа,
 * браузерный доступ разрешён провайдером (проверено: ответ содержит
 * `Access-Control-Allow-Origin` с эхо-значением Origin), поэтому прокси и
 * серверный слой в Task 5 не нужны. Секретные ключи в браузер не помещаются.
 *
 * Нормализация полного ответа OpenDota — Task 6; здесь ответ передаётся как есть.
 */

import type { MatchIdErrorCode } from '../i18n/errors'

/** Базовый адрес endpoint матча OpenDota. */
export const OPENDOTA_MATCHES_ENDPOINT = 'https://api.opendota.com/api/matches'

/** Таймаут запроса к OpenDota (15 секунд): ограничивает время ожидания ответа. */
export const OPENDOTA_REQUEST_TIMEOUT_MS = 15000

/** Максимальная длина ID матча в цифрах (защита от небезопасных значений). */
export const MATCH_ID_MAX_DIGITS = 19

export type MatchIdValidation =
  | { ok: true; value: string }
  | { ok: false; message: string; code: MatchIdErrorCode }

/**
 * Валидация ID матча (Task 5): положительное целое, только цифры.
 * ID сохраняется строкой — без числовых преобразований и потери точности.
 * `code` используется интерфейсом для локализации сообщения (Task 13).
 */
export function validateMatchId(raw: string): MatchIdValidation {
  const value = raw.trim()

  if (value.length === 0) {
    return { ok: false, code: 'empty', message: 'Введите ID матча.' }
  }
  if (!/^\d+$/.test(value)) {
    return {
      ok: false,
      code: 'digits',
      message: 'ID матча должен содержать только цифры (положительное целое число).',
    }
  }
  if (/^0+$/.test(value)) {
    return { ok: false, code: 'positive', message: 'ID матча должен быть положительным числом.' }
  }
  if (value.length > MATCH_ID_MAX_DIGITS) {
    return { ok: false, code: 'tooLong', message: 'ID матча слишком длинный — проверьте ввод.' }
  }
  return { ok: true, value }
}

/** Виды ошибок получения матча. */
export type OpenDotaErrorKind =
  | 'not_found'
  | 'forbidden'
  | 'rate_limited'
  | 'server_error'
  | 'unexpected_status'
  | 'network'
  | 'timeout'
  | 'invalid_response'
  | 'aborted'

export interface OpenDotaError {
  kind: OpenDotaErrorKind
  /** Понятное русское сообщение без технических деталей и секретов. */
  message: string
  /** HTTP-статус, если ответ был получен. */
  status?: number
}

/** Минимальное представление ответа OpenDota: остальные поля передаются как есть. */
export interface OpenDotaMatchResponse {
  match_id?: number
  duration?: number
  radiant_win?: boolean
  players?: unknown[]
  [key: string]: unknown
}

export type OpenDotaMatchResult =
  | { ok: true; match: OpenDotaMatchResponse }
  | { ok: false; error: OpenDotaError }

/** Можно ли повторить запрос вручную (временные сбои). */
export function isRetryableError(kind: OpenDotaErrorKind): boolean {
  return (
    kind === 'timeout' ||
    kind === 'network' ||
    kind === 'rate_limited' ||
    kind === 'server_error' ||
    kind === 'unexpected_status'
  )
}

function errorFromStatus(status: number): OpenDotaError {
  if (status === 404) {
    return {
      kind: 'not_found',
      status,
      message: 'Матч не найден. Проверьте ID и попробуйте снова.',
    }
  }
  if (status === 401 || status === 403) {
    return {
      kind: 'forbidden',
      status,
      message:
        'OpenDota отклонил запрос (доступ ограничен, HTTP ' +
        status +
        '). Это ограничение доступа к провайдеру, а не отсутствие матча.',
    }
  }
  if (status === 429) {
    return {
      kind: 'rate_limited',
      status,
      message: 'Превышен лимит запросов OpenDota. Попробуйте позже.',
    }
  }
  if (status >= 500 && status <= 599) {
    return {
      kind: 'server_error',
      status,
      message: 'Сервис OpenDota временно недоступен (ошибка сервера). Попробуйте позже.',
    }
  }
  return {
    kind: 'unexpected_status',
    status,
    message: 'OpenDota вернул неожиданный ответ (HTTP ' + status + '). Повторите попытку позже.',
  }
}

/**
 * Запрос матча у OpenDota с таймаутом и поддержкой внешней отмены.
 *
 * @param matchId проверенный ID матча (строка из цифр)
 * @param signal внешний AbortSignal (отмена при уходе со страницы или новом запросе)
 */
export async function fetchMatchById(
  matchId: string,
  signal?: AbortSignal,
): Promise<OpenDotaMatchResult> {
  const controller = new AbortController()
  let timedOut = false

  const timeoutId = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, OPENDOTA_REQUEST_TIMEOUT_MS)

  const onExternalAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) {
      window.clearTimeout(timeoutId)
      return { ok: false, error: { kind: 'aborted', message: 'Запрос отменён.' } }
    }
    signal.addEventListener('abort', onExternalAbort)
  }

  try {
    const response = await fetch(`${OPENDOTA_MATCHES_ENDPOINT}/${matchId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) {
      return { ok: false, error: errorFromStatus(response.status) }
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      return {
        ok: false,
        error: {
          kind: 'invalid_response',
          status: response.status,
          message: 'Не удалось обработать ответ OpenDota: получены некорректные данные.',
        },
      }
    }

    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return {
        ok: false,
        error: {
          kind: 'invalid_response',
          status: response.status,
          message: 'Не удалось обработать ответ OpenDota: неожиданный формат данных.',
        },
      }
    }

    const match = payload as OpenDotaMatchResponse
    // Обязательное поле: подтверждает, что ответ относится к матчу.
    if (typeof match.match_id !== 'number') {
      return {
        ok: false,
        error: {
          kind: 'invalid_response',
          status: response.status,
          message: 'Ответ OpenDota не содержит идентификатор матча — данные не подтверждены.',
        },
      }
    }

    return { ok: true, match }
  } catch {
    if (timedOut) {
      return {
        ok: false,
        error: {
          kind: 'timeout',
          message:
            'Истекло время ожидания ответа OpenDota (15 секунд). Повторите попытку.',
        },
      }
    }
    if (signal?.aborted) {
      return { ok: false, error: { kind: 'aborted', message: 'Запрос отменён.' } }
    }
    return {
      ok: false,
      error: {
        kind: 'network',
        message:
          'Сеть недоступна или OpenDota не отвечает. Проверьте подключение и повторите попытку.',
      },
    }
  } finally {
    window.clearTimeout(timeoutId)
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort)
    }
  }
}