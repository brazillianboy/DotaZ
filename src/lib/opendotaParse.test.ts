import { describe, expect, it } from 'vitest'

import {
  OPENDOTA_PARSE_TIMEOUT_MS,
  buildParseUrl,
  fetchParseJobStatus,
  requestReplayParse,
  resolveOpenDotaApiKey,
} from './opendotaParse'
import { OPENDOTA_REQUEST_ENDPOINT } from './replayParsing'

/**
 * Тесты HTTP-клиента обработки реплея (Task 14).
 *
 * Живая сеть не используется: `fetch` подменяется, поэтому проверяются методы,
 * URL (включая необязательный ключ), разбор ответов и все виды сбоев — без
 * расхода лимитов OpenDota и без реальных запросов обработки.
 */

interface Call {
  url: string
  method: string
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response
}

function fakeFetch(responder: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const call: Call = { url: String(input), method: init?.method ?? 'GET' }
    calls.push(call)
    return responder(call)
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

describe('необязательный ключ OpenDota', () => {
  it('читается только из корректного значения окружения', () => {
    expect(resolveOpenDotaApiKey(undefined)).toBeNull()
    expect(resolveOpenDotaApiKey({})).toBeNull()
    expect(resolveOpenDotaApiKey({ VITE_OPENDOTA_API_KEY: '   ' })).toBeNull()
    expect(resolveOpenDotaApiKey({ VITE_OPENDOTA_API_KEY: 42 })).toBeNull()
    expect(resolveOpenDotaApiKey({ VITE_OPENDOTA_API_KEY: ' abc ' })).toBe('abc')
  })

  it('добавляется в URL только при наличии', () => {
    expect(buildParseUrl('9007760151', null)).toBe(`${OPENDOTA_REQUEST_ENDPOINT}/9007760151`)
    expect(buildParseUrl('9007760151', 'abc')).toBe(
      `${OPENDOTA_REQUEST_ENDPOINT}/9007760151?api_key=abc`,
    )
  })
})

describe('постановка задачи обработки', () => {
  it('отправляет POST и подтверждает успех только по идентификатору задачи', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse({ job: { jobId: 614710125 } }))

    const result = await requestReplayParse('9007760151', { fetchImpl })

    expect(result).toEqual({ ok: true, jobId: '614710125' })
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${OPENDOTA_REQUEST_ENDPOINT}/9007760151`)
  })

  it('не отправляет запрос при некорректном ID матча', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse({ job: { jobId: 1 } }))

    const result = await requestReplayParse('abc', { fetchImpl })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_response')
    }
    expect(calls).toHaveLength(0)
  })

  it('считает ответ без идентификатора задачи неподтверждённым', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse({ job: {} }))

    const result = await requestReplayParse('9007760151', { fetchImpl })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_response')
    }
  })

  it('различает ограничение частоты, отказ доступа, отсутствие и сбои сервера', async () => {
    const cases: Array<{ status: number; kind: string }> = [
      { status: 429, kind: 'rate_limited' },
      { status: 403, kind: 'forbidden' },
      { status: 404, kind: 'not_found' },
      { status: 500, kind: 'server_error' },
      { status: 418, kind: 'unexpected_status' },
    ]
    for (const item of cases) {
      const { fetchImpl } = fakeFetch(() => jsonResponse(null, item.status))
      const result = await requestReplayParse('9007760151', { fetchImpl })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe(item.kind)
        expect(result.error.status).toBe(item.status)
      }
    }
  })

  it('сообщает о сетевом сбое, некорректном JSON и таймауте', async () => {
    const failing = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    const network = await requestReplayParse('9007760151', { fetchImpl: failing })
    expect(network.ok).toBe(false)
    if (!network.ok) {
      expect(network.error.kind).toBe('network')
    }

    const broken = (async () =>
      ({ ok: true, status: 200, json: async () => Promise.reject(new Error('bad json')) }) as unknown as Response) as unknown as typeof fetch
    const invalid = await requestReplayParse('9007760151', { fetchImpl: broken })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) {
      expect(invalid.error.kind).toBe('invalid_response')
    }

    const hanging = (async (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as unknown as typeof fetch
    const timedOut = await requestReplayParse('9007760151', {
      fetchImpl: hanging,
      timeoutMs: 5,
    })
    expect(timedOut.ok).toBe(false)
    if (!timedOut.ok) {
      expect(timedOut.error.kind).toBe('timeout')
    }
  })

  it('поддерживает внешнюю отмену (уход со страницы во время обработки)', async () => {
    const controller = new AbortController()
    const hanging = (async (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as unknown as typeof fetch

    const promise = requestReplayParse('9007760151', {
      fetchImpl: hanging,
      signal: controller.signal,
    })
    controller.abort()
    const result = await promise

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('aborted')
    }
    expect(OPENDOTA_PARSE_TIMEOUT_MS).toBeGreaterThan(0)
  })
})

describe('статус задачи обработки', () => {
  it('читает статус через GET и передаёт ключ, если он задан', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse({ job: { jobId: 5, status: 'completed' } }))

    const result = await fetchParseJobStatus('5', { fetchImpl, apiKey: 'key-1' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.job).toEqual({ kind: 'completed' })
    }
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${OPENDOTA_REQUEST_ENDPOINT}/5?api_key=key-1`)
  })

  it('разбирает ответ null как отсутствие задачи, а не как успех', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse(null))

    const result = await fetchParseJobStatus('5', { fetchImpl })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.job).toEqual({ kind: 'missing' })
    }
  })

  it('не отправляет запрос при некорректном идентификаторе задачи', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(null))

    const result = await fetchParseJobStatus('0', { fetchImpl })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_response')
    }
    expect(calls).toHaveLength(0)
  })

  it('сообщает об ограничении частоты при опросе', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse(null, 429))

    const result = await fetchParseJobStatus('5', { fetchImpl })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('rate_limited')
    }
  })
})
