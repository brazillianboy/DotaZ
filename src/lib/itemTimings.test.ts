import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TimelineEntry } from './itemTimeline'
import {
  ITEM_TIMING_METHOD_VERSION,
  ITEM_TIMING_MIN_CLASSIFY_SAMPLE,
  ITEM_TIMING_MIN_PERCENTILE_SAMPLE,
  ITEM_TIMING_MIN_STORE_SAMPLE,
  ITEM_TIMINGS_PATH,
  classifyItemTiming,
  compareItemTimings,
  effectiveClassifyThreshold,
  effectivePercentileThreshold,
  itemTimingsUrl,
  loadItemTimingSnapshot,
  parseItemTimingSnapshot,
  resetItemTimingSnapshotCache,
  selectItemTiming,
  type ItemTimingSnapshot,
} from './itemTimings'

/** Фикстуры нормативов таймингов: синтетические значения, не реальные данные. */

function snapshot(overrides: Partial<ItemTimingSnapshot> = {}): ItemTimingSnapshot {
  return {
    method_version: ITEM_TIMING_METHOD_VERSION,
    source: { name: 'OpenDota Explorer', url: '', dataset: 'test', attribution: 'test' },
    generated_at: '2026-11-07T00:00:00.000Z',
    patch: '7.41',
    patch_id: 60,
    thresholds: { store: 30, full: 100, classify: 100 },
    bucket_count: 1,
    buckets: [
      {
        hero_id: 6,
        lane_role: 1,
        item_key: 'blink',
        stats: { n: 200, p25: 600, p50: 750, p75: 900 },
      },
    ],
    ...overrides,
  }
}

function entry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    key: 'blink',
    name: 'Blink Dagger',
    iconUrl: '',
    timeSeconds: 700,
    category: 'completed',
    occurrence: 1,
    comparable: true,
    ...overrides,
  }
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response
}

beforeEach(() => {
  resetItemTimingSnapshotCache()
})

describe('parseItemTimingSnapshot', () => {
  it('принимает корректный снапшот', () => {
    expect(parseItemTimingSnapshot(snapshot()).ok).toBe(true)
  })

  it('отвергает дубли бакетов и нарушенный порядок перцентилей', () => {
    const duplicate = snapshot()
    duplicate.buckets.push({ ...duplicate.buckets[0] })
    expect(parseItemTimingSnapshot(duplicate).ok).toBe(false)

    const badOrder = snapshot()
    badOrder.buckets[0].stats = { n: 200, p25: 900, p50: 750, p75: 600 }
    expect(parseItemTimingSnapshot(badOrder).ok).toBe(false)
  })

  it('отвергает перцентили при нулевой выборке и неизвестную линию', () => {
    const zeroWithStats = snapshot()
    zeroWithStats.buckets[0].stats = { n: 0, p25: 600, p50: 750, p75: 900 }
    expect(parseItemTimingSnapshot(zeroWithStats).ok).toBe(false)

    const badRole = snapshot()
    badRole.buckets[0].lane_role = 9 as unknown as 1
    expect(parseItemTimingSnapshot(badRole).ok).toBe(false)
  })
})

describe('selectItemTiming', () => {
  const base = { heroId: 6, laneRole: 1, patchId: 60, itemKey: 'blink' }

  it('находит норматив для героя, линии, патча и предмета', () => {
    expect(selectItemTiming(snapshot(), base).status).toBe('ready')
  })

  it('не смешивает патчи и роли', () => {
    expect(selectItemTiming(snapshot(), { ...base, patchId: 59 }).status).toBe('patch-mismatch')
    expect(selectItemTiming(snapshot(), { ...base, laneRole: null }).status).toBe('missing-role')
    expect(selectItemTiming(snapshot(), { ...base, patchId: null }).status).toBe('missing-patch')
  })

  it('нет бакета для другого предмета', () => {
    expect(selectItemTiming(snapshot(), { ...base, itemKey: 'black_king_bar' }).status).toBe(
      'no-benchmark',
    )
  })
})

describe('classifyItemTiming', () => {
  const stats = { n: 200, p25: 600, p50: 750, p75: 900 }
  const thresholds = { store: 30, full: 100, classify: 100 }

  it('раньше p25, в диапазоне и позже p75', () => {
    expect(classifyItemTiming(500, stats, thresholds)).toBe('early')
    expect(classifyItemTiming(700, stats, thresholds)).toBe('typical')
    expect(classifyItemTiming(1000, stats, thresholds)).toBe('late')
  })

  it('недостаточная выборка и отсутствие наблюдений', () => {
    expect(classifyItemTiming(700, { ...stats, n: 10 }, thresholds)).toBe('insufficient')
    expect(
      classifyItemTiming(700, { n: 0, p25: null, p50: null, p75: null }, thresholds),
    ).toBe('no-sample')
  })

  it('граница порога: 29 и 30 наблюдений не классифицируются', () => {
    expect(classifyItemTiming(500, { ...stats, n: 29 }, thresholds)).toBe('insufficient')
    expect(classifyItemTiming(500, { ...stats, n: 30 }, thresholds)).toBe('insufficient')
  })

  it('граница порога: 99 наблюдений не классифицируется, 100 классифицируется', () => {
    expect(classifyItemTiming(500, { ...stats, n: 99 }, thresholds)).toBe('insufficient')
    expect(classifyItemTiming(500, { ...stats, n: 100 }, thresholds)).toBe('early')
    expect(classifyItemTiming(700, { ...stats, n: 100 }, thresholds)).toBe('typical')
    expect(classifyItemTiming(1000, { ...stats, n: 100 }, thresholds)).toBe('late')
  })

  it('101 наблюдение классифицируется', () => {
    expect(classifyItemTiming(700, { ...stats, n: 101 }, thresholds)).toBe('typical')
  })

  it('порог нельзя понизить метаданными снапшота', () => {
    const legacy = { store: 30, full: 100, classify: 30, medianOnly: 30 }
    expect(effectiveClassifyThreshold(legacy)).toBe(ITEM_TIMING_MIN_CLASSIFY_SAMPLE)
    expect(classifyItemTiming(500, { ...stats, n: 50 }, legacy)).toBe('insufficient')
    expect(effectivePercentileThreshold(legacy)).toBe(ITEM_TIMING_MIN_PERCENTILE_SAMPLE)
  })

  it('нечисловое время покупки не классифицируется', () => {
    expect(classifyItemTiming(Number.NaN, stats, thresholds)).toBe('insufficient')
    expect(classifyItemTiming(Number.POSITIVE_INFINITY, stats, thresholds)).toBe('insufficient')
  })
})

describe('пороги выборки', () => {
  it('продуктовые значения: хранение 30, квартили 100, классификация 100', () => {
    expect(ITEM_TIMING_MIN_STORE_SAMPLE).toBe(30)
    expect(ITEM_TIMING_MIN_PERCENTILE_SAMPLE).toBe(100)
    expect(ITEM_TIMING_MIN_CLASSIFY_SAMPLE).toBe(100)
  })

  it('действующие пороги не опускаются ниже продуктовых', () => {
    expect(
      effectiveClassifyThreshold({ store: 30, full: 100, classify: 100 }),
    ).toBe(100)
    expect(effectivePercentileThreshold({ store: 30, full: 100, classify: 100 })).toBe(100)
    expect(effectiveClassifyThreshold({ store: 30, full: 40, classify: 10 })).toBe(100)
    expect(effectivePercentileThreshold({ store: 30, full: 40, classify: 10 })).toBe(100)
  })

  it('снапшот первой версии читается и не разрешает классификацию при n < 100', () => {
    const legacy = snapshot()
    const raw = {
      ...legacy,
      thresholds: { full: 100, medianOnly: 30 },
    }
    const parsed = parseItemTimingSnapshot(raw)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    expect(parsed.value.thresholds.classify).toBe(30)
    expect(parsed.value.thresholds.store).toBe(ITEM_TIMING_MIN_STORE_SAMPLE)
    expect(effectiveClassifyThreshold(parsed.value.thresholds)).toBe(100)
    expect(
      classifyItemTiming(500, { n: 60, p25: 600, p50: 750, p75: 900 }, parsed.value.thresholds),
    ).toBe('insufficient')
  })

  it('снапшот с полными порогами сохраняет их и отклоняет некорректные', () => {
    const parsed = parseItemTimingSnapshot({
      ...snapshot(),
      thresholds: { store: 30, full: 100, classify: 100 },
    })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.thresholds).toEqual({ store: 30, full: 100, classify: 100 })
    }

    expect(
      parseItemTimingSnapshot({ ...snapshot(), thresholds: { store: 500, full: 100, classify: 100 } })
        .ok,
    ).toBe(false)
    expect(
      parseItemTimingSnapshot({ ...snapshot(), thresholds: { full: 100 } }).ok,
    ).toBe(true)
    expect(
      parseItemTimingSnapshot({ ...snapshot(), thresholds: { store: 30, full: 0, classify: 100 } })
        .ok,
    ).toBe(false)
  })
})

describe('compareItemTimings', () => {
  it('сравнивает только первую покупку значимого предмета', () => {
    const entries = [
      entry(),
      entry({ timeSeconds: 1200, occurrence: 2 }),
      entry({ key: 'magic_wand', comparable: false }),
    ]
    const result = compareItemTimings(entries, snapshot(), { heroId: 6, laneRole: 1, patchId: 60 })
    expect(result.size).toBe(1)
    const comparison = result.get('blink')
    expect(comparison?.actualSeconds).toBe(700)
    expect(comparison?.median).toBe(750)
    expect(comparison?.timingClass).toBe('typical')
    expect(comparison?.differenceSeconds).toBe(-50)
    expect(comparison?.sampleSize).toBe(200)
  })

  it('без подходящего бакета сравнений нет', () => {
    const result = compareItemTimings([entry()], snapshot(), {
      heroId: 11,
      laneRole: 1,
      patchId: 60,
    })
    expect(result.size).toBe(0)
  })
})

describe('loadItemTimingSnapshot', () => {
  it('загружает снапшот и кеширует результат', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(snapshot()))
    const first = await loadItemTimingSnapshot({ fetchImpl, baseUrl: '/' })
    const second = await loadItemTimingSnapshot({ fetchImpl, baseUrl: '/' })
    expect(first?.patch).toBe('7.41')
    expect(second).toBe(first)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('404, невалидный JSON и сетевой сбой дают null', async () => {
    await expect(
      loadItemTimingSnapshot({
        fetchImpl: async () => jsonResponse(null, false, 404),
        baseUrl: '/',
      }),
    ).resolves.toBeNull()
    resetItemTimingSnapshotCache()
    await expect(
      loadItemTimingSnapshot({
        fetchImpl: async () => jsonResponse({ buckets: 'nope' }),
        baseUrl: '/',
      }),
    ).resolves.toBeNull()
    resetItemTimingSnapshotCache()
    await expect(
      loadItemTimingSnapshot({
        fetchImpl: async () => {
          throw new Error('network')
        },
        baseUrl: '/',
      }),
    ).resolves.toBeNull()
  })

  it('URL учитывает BASE_URL', () => {
    expect(itemTimingsUrl('/')).toBe(`/${ITEM_TIMINGS_PATH}`)
    expect(itemTimingsUrl('/dota2/')).toBe(`/dota2/${ITEM_TIMINGS_PATH}`)
    expect(itemTimingsUrl('/dota2')).toBe(`/dota2/${ITEM_TIMINGS_PATH}`)
  })
})
