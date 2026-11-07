import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BENCHMARK_METHOD_VERSION, type BenchmarkSnapshot } from './benchmarks'
import {
  BENCHMARK_SNAPSHOT_PATH,
  benchmarkSnapshotUrl,
  loadBenchmarkSnapshot,
  resetBenchmarkSnapshotCache,
} from './benchmarkSnapshot'

/**
 * Тесты runtime-загрузки снапшота нормативов (Task 16).
 *
 * Проверяется, что отсутствие данных (404, сеть, битый JSON) даёт `null`, а не
 * ошибку приложения и не выдуманные значения. Сеть не используется: `fetch`
 * подменяется явно.
 */

function validSnapshot(): BenchmarkSnapshot {
  return {
    method_version: BENCHMARK_METHOD_VERSION,
    source: {
      name: 'OpenDota Explorer',
      url: 'https://api.opendota.com/api/explorer',
      dataset: 'test',
      attribution: 'OpenDota (opendota.com)',
    },
    generated_at: '2026-11-07T00:00:00.000Z',
    patch: '7.41',
    patch_id: 60,
    interval: { minutes: 15, arrayIndex: 16, label: '00:00–15:00' },
    thresholds: { full: 200, medianOnly: 50 },
    bucket_count: 1,
    buckets: [
      {
        hero_id: 6,
        lane_role: 1,
        metrics: {
          lastHits: { n: 400, p25: 90, p50: 110, p75: 130 },
          gold: { n: 400, p25: 6000, p50: 6800, p75: 7500 },
          xp: { n: 400, p25: 5900, p50: 6700, p75: 7400 },
        },
      },
    ],
  }
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response
}

beforeEach(() => {
  resetBenchmarkSnapshotCache()
})

describe('benchmarkSnapshotUrl', () => {
  it('формирует путь от корня сайта', () => {
    expect(benchmarkSnapshotUrl('/')).toBe(`/${BENCHMARK_SNAPSHOT_PATH}`)
  })

  it('учитывает деплой в подкаталоге и отсутствие завершающего слэша', () => {
    expect(benchmarkSnapshotUrl('/dota2/')).toBe(`/dota2/${BENCHMARK_SNAPSHOT_PATH}`)
    expect(benchmarkSnapshotUrl('/dota2')).toBe(`/dota2/${BENCHMARK_SNAPSHOT_PATH}`)
    expect(benchmarkSnapshotUrl('')).toBe(`/${BENCHMARK_SNAPSHOT_PATH}`)
  })
})

describe('loadBenchmarkSnapshot', () => {
  it('загружает и валидирует снапшот, кешируя результат', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(validSnapshot()))

    const first = await loadBenchmarkSnapshot({ fetchImpl, baseUrl: '/' })
    const second = await loadBenchmarkSnapshot({ fetchImpl, baseUrl: '/' })

    expect(first?.patch).toBe('7.41')
    expect(first?.bucket_count).toBe(1)
    expect(second).toBe(first)
    // Второй вызов не должен повторять сетевой запрос.
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      `/${BENCHMARK_SNAPSHOT_PATH}`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('отсутствие файла (404) даёт null и не считается ошибкой', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null, false, 404))
    await expect(loadBenchmarkSnapshot({ fetchImpl, baseUrl: '/' })).resolves.toBeNull()
  })

  it('невалидная структура JSON даёт null', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ patch: '7.41', buckets: 'nope' }))
    await expect(loadBenchmarkSnapshot({ fetchImpl, baseUrl: '/' })).resolves.toBeNull()
  })

  it('битый JSON (ошибка разбора) даёт null', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token')
          },
        }) as unknown as Response,
    )
    await expect(loadBenchmarkSnapshot({ fetchImpl, baseUrl: '/' })).resolves.toBeNull()
  })

  it('сетевой сбой даёт null, приложение не падает', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })
    await expect(loadBenchmarkSnapshot({ fetchImpl, baseUrl: '/' })).resolves.toBeNull()
  })

  it('отказ кешируется: повторный вызов не делает новых запросов', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null, false, 404))
    await loadBenchmarkSnapshot({ fetchImpl, baseUrl: '/' })
    await loadBenchmarkSnapshot({ fetchImpl, baseUrl: '/' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('сброс кеша заставляет загрузить данные заново', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(validSnapshot()))
    await loadBenchmarkSnapshot({ fetchImpl, baseUrl: '/' })
    resetBenchmarkSnapshotCache()
    await loadBenchmarkSnapshot({ fetchImpl, baseUrl: '/' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
