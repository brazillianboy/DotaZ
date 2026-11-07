import { describe, expect, it } from 'vitest'

import {
  BENCHMARK_METHOD_VERSION,
  compareLaningWithBenchmark,
  compareMetric,
  hasDisplayableComparison,
  isLaneRole,
  parseBenchmarkSnapshot,
  selectBenchmark,
  type BenchmarkSnapshot,
} from './benchmarks'

/**
 * Реальный снапшот лежит в `public/benchmarks/` и НЕ коммитится (права на
 * распространение данных не подтверждены). Файл читается через `import.meta.glob`:
 * при отсутствии датасета набор тестов на реальных данных просто пропускается,
 * а `tsc` не требует node-типов.
 */
const LOCAL_SNAPSHOT_MODULES = import.meta.glob('../../public/benchmarks/benchmarks-7.41.json', {
  eager: true,
}) as Record<string, unknown>

function localSnapshotEntry(): unknown {
  const entries = Object.entries(LOCAL_SNAPSHOT_MODULES)
  if (entries.length === 0) {
    return undefined
  }
  const value = entries[0][1]
  if (value !== null && typeof value === 'object' && 'default' in value) {
    return (value as { default: unknown }).default
  }
  return value
}

const localSnapshot = localSnapshotEntry()
const hasLocalSnapshot = localSnapshot !== undefined

function readLocalSnapshot(): unknown {
  return localSnapshot
}

/**
 * Тесты нормативов 15-й минуты (Task 16).
 *
 * Все синтетические значения используются ТОЛЬКО как фикстуры логики и не выдаются
 * за реальные нормативы. Отдельный блок проверяет структуру настоящего снапшота
 * (`src/data/benchmarks-7.41.json`), но не фиксирует конкретные медианы: они
 * меняются при пересборке данных.
 */

const THRESHOLDS = { full: 200, medianOnly: 50 }

function metric(n: number, p25: number | null, p50: number | null, p75: number | null) {
  return { n, p25, p50, p75 }
}

function makeSnapshot(overrides: Partial<BenchmarkSnapshot> = {}): BenchmarkSnapshot {
  return {
    method_version: BENCHMARK_METHOD_VERSION,
    source: {
      name: 'OpenDota Explorer',
      url: 'https://api.opendota.com/api/explorer',
      dataset: 'test',
      attribution: 'test',
    },
    generated_at: '2026-11-07T00:00:00.000Z',
    patch: '7.41',
    patch_id: 60,
    interval: { minutes: 15, arrayIndex: 16, label: '00:00–15:00' },
    thresholds: THRESHOLDS,
    bucket_count: 2,
    buckets: [
      {
        hero_id: 6,
        lane_role: 1,
        metrics: {
          lastHits: metric(400, 90, 110, 130),
          gold: metric(400, 6000, 6800, 7500),
          xp: metric(400, 5900, 6700, 7400),
        },
      },
      {
        hero_id: 6,
        lane_role: 2,
        metrics: {
          lastHits: metric(60, 80, 100, 120),
          gold: metric(0, null, null, null),
          xp: metric(60, 5500, 6200, 6900),
        },
      },
    ],
    ...overrides,
  }
}

const ACTUAL = { lastHits: 120, gold: 7000, xp: 6000 }

describe('parseBenchmarkSnapshot — валидация', () => {
  it('принимает корректный снапшот и сохраняет метаданные', () => {
    const parsed = parseBenchmarkSnapshot(makeSnapshot())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.patch).toBe('7.41')
    expect(parsed.value.patch_id).toBe(60)
    expect(parsed.value.bucket_count).toBe(2)
    expect(parsed.value.thresholds).toEqual(THRESHOLDS)
  })

  it('отвергает нарушенный порядок перцентилей', () => {
    const snapshot = makeSnapshot()
    snapshot.buckets[0].metrics.lastHits = metric(400, 130, 110, 90)
    expect(parseBenchmarkSnapshot(snapshot).ok).toBe(false)
  })

  it('отвергает перцентили при нулевой выборке', () => {
    const snapshot = makeSnapshot()
    snapshot.buckets[0].metrics.xp = metric(0, 1, 2, 3)
    expect(parseBenchmarkSnapshot(snapshot).ok).toBe(false)
  })

  it('отвергает неполные перцентили при ненулевой выборке', () => {
    const snapshot = makeSnapshot()
    snapshot.buckets[0].metrics.gold = metric(10, null, 100, null)
    expect(parseBenchmarkSnapshot(snapshot).ok).toBe(false)
  })

  it('отвергает дубли бакетов (неоднозначный выбор норматива)', () => {
    const snapshot = makeSnapshot()
    snapshot.buckets.push({ ...snapshot.buckets[0] })
    expect(parseBenchmarkSnapshot(snapshot).ok).toBe(false)
  })

  it('отвергает некорректный патч и lane_role', () => {
    expect(parseBenchmarkSnapshot(makeSnapshot({ patch: '7' })).ok).toBe(false)
    const badRole = makeSnapshot()
    badRole.buckets[0].lane_role = 5 as unknown as 1
    expect(parseBenchmarkSnapshot(badRole).ok).toBe(false)
  })

  it('не принимает снапшот без обязательных полей', () => {
    expect(parseBenchmarkSnapshot(null).ok).toBe(false)
    expect(parseBenchmarkSnapshot({}).ok).toBe(false)
    expect(parseBenchmarkSnapshot({ ...makeSnapshot(), buckets: 'nope' }).ok).toBe(false)
  })

  it('isLaneRole принимает только 1–4', () => {
    expect([1, 2, 3, 4].every((role) => isLaneRole(role))).toBe(true)
    expect(isLaneRole(0)).toBe(false)
    expect(isLaneRole(5)).toBe(false)
    expect(isLaneRole(null)).toBe(false)
  })
})

describe('selectBenchmark — герой, линия, патч', () => {
  const snapshot = makeSnapshot()

  it('находит бакет по герою и линии', () => {
    const selection = selectBenchmark(snapshot, { heroId: 6, laneRole: 1, patchId: 60, intervalMinutes: 15 })
    expect(selection.status).toBe('ready')
    if (selection.status !== 'ready') return
    expect(selection.bucket.lane_role).toBe(1)
  })

  it('различает линии одного героя', () => {
    const mid = selectBenchmark(snapshot, { heroId: 6, laneRole: 2, patchId: 60, intervalMinutes: 15 })
    expect(mid.status).toBe('ready')
    if (mid.status !== 'ready') return
    expect(mid.bucket.lane_role).toBe(2)
  })

  it('возвращает no-benchmark для другого героя', () => {
    expect(selectBenchmark(snapshot, { heroId: 11, laneRole: 1, patchId: 60, intervalMinutes: 15 }).status).toBe(
      'no-benchmark',
    )
  })

  it('возвращает no-benchmark для другой линии того же героя', () => {
    expect(selectBenchmark(snapshot, { heroId: 6, laneRole: 3, patchId: 60, intervalMinutes: 15 }).status).toBe(
      'no-benchmark',
    )
  })

  it('не смешивает патчи', () => {
    const selection = selectBenchmark(snapshot, { heroId: 6, laneRole: 1, patchId: 59, intervalMinutes: 15 })
    expect(selection.status).toBe('patch-mismatch')
    if (selection.status !== 'patch-mismatch') return
    expect(selection.benchmarkPatch).toBe('7.41')
  })

  it('не сравнивает интервал 10 минут с нормативом 15 минут', () => {
    const selection = selectBenchmark(snapshot, {
      heroId: 6,
      laneRole: 1,
      patchId: 60,
      intervalMinutes: 10,
    })
    expect(selection.status).toBe('interval-mismatch')
    if (selection.status !== 'interval-mismatch') return
    expect(selection.benchmarkInterval).toBe(15)
  })

  it('различает неизвестную линию и неизвестный патч', () => {
    expect(selectBenchmark(snapshot, { heroId: 6, laneRole: null, patchId: 60, intervalMinutes: 15 }).status).toBe(
      'missing-role',
    )
    expect(selectBenchmark(snapshot, { heroId: 6, laneRole: 1, patchId: null, intervalMinutes: 15 }).status).toBe(
      'missing-patch',
    )
  })

  it('без числового patch_id в снапшоте сравнение не выполняется', () => {
    const withoutId = makeSnapshot({ patch_id: null })
    expect(selectBenchmark(withoutId, { heroId: 6, laneRole: 1, patchId: 60, intervalMinutes: 15 }).status).toBe(
      'no-benchmark',
    )
  })
})

describe('compareMetric — пороги выборки и отсутствующие значения', () => {
  it('полная выборка: медиана и квартили', () => {
    const result = compareMetric('lastHits', 120, metric(200, 90, 110, 130), THRESHOLDS)
    expect(result.status).toBe('full')
    expect(result.median).toBe(110)
    expect(result.p25).toBe(90)
    expect(result.p75).toBe(130)
  })

  it('граница 200 — полная выборка, 199 — уже нет', () => {
    expect(compareMetric('gold', 7000, metric(200, 1, 2, 3), THRESHOLDS).status).toBe('full')
    expect(compareMetric('gold', 7000, metric(199, 1, 2, 3), THRESHOLDS).status).toBe('median-only')
  })

  it('граница 50 — малая выборка, 49 — недостаточно', () => {
    expect(compareMetric('xp', 6000, metric(50, 1, 2, 3), THRESHOLDS).status).toBe('median-only')
    expect(compareMetric('xp', 6000, metric(49, 1, 2, 3), THRESHOLDS).status).toBe('insufficient')
  })

  it('нулевая выборка — no-sample, а не «ноль»', () => {
    const result = compareMetric('gold', 7000, metric(0, null, null, null), THRESHOLDS)
    expect(result.status).toBe('no-sample')
    expect(result.median).toBeNull()
    expect(result.difference).toBeNull()
  })

  it('отсутствующее значение игрока — missing-actual, а не 0', () => {
    const result = compareMetric('lastHits', null, metric(400, 90, 110, 130), THRESHOLDS)
    expect(result.status).toBe('missing-actual')
    expect(result.actual).toBeNull()
    expect(result.difference).toBeNull()
  })

  it('считает абсолютную и процентную разницу, включая отрицательную', () => {
    const above = compareMetric('lastHits', 120, metric(400, 90, 110, 130), THRESHOLDS)
    expect(above.difference).toBe(10)
    expect(above.differencePercent).toBe(9.1)

    const below = compareMetric('lastHits', 95, metric(400, 90, 110, 130), THRESHOLDS)
    expect(below.difference).toBe(-15)
    expect(below.differencePercent).toBe(-13.6)
  })

  it('при нулевой медиане процент разницы не вычисляется', () => {
    const result = compareMetric('gold', 10, metric(400, 0, 0, 0), THRESHOLDS)
    expect(result.difference).toBe(10)
    expect(result.differencePercent).toBeNull()
  })

  it('размер выборки берётся из конкретной метрики', () => {
    const snapshot = makeSnapshot()
    const result = compareLaningWithBenchmark(
      snapshot,
      { heroId: 6, laneRole: 2, patchId: 60, intervalMinutes: 15 },
      { lastHits: 120, gold: 7000, xp: 6000 },
    )
    expect(result.status).toBe('ready')
    expect(result.metrics?.lastHits.status).toBe('median-only')
    expect(result.metrics?.lastHits.sampleSize).toBe(60)
    // У золота в этом бакете нет наблюдений — статус отличается от LH.
    expect(result.metrics?.gold.status).toBe('no-sample')
    expect(result.metrics?.gold.sampleSize).toBe(0)
    expect(result.metrics?.xp.status).toBe('median-only')
  })
})

describe('compareLaningWithBenchmark — недоступные состояния', () => {
  it('неизвестная линия и чужой патч не дают числового сравнения', () => {
    const snapshot = makeSnapshot()

    const noRole = compareLaningWithBenchmark(
      snapshot,
      { heroId: 6, laneRole: null, patchId: 60, intervalMinutes: 15 },
      ACTUAL,
    )
    expect(noRole.status).toBe('missing-role')
    expect(noRole.metrics).toBeNull()
    expect(hasDisplayableComparison(noRole)).toBe(false)

    const mismatch = compareLaningWithBenchmark(
      snapshot,
      { heroId: 6, laneRole: 1, patchId: 59, intervalMinutes: 15 },
      ACTUAL,
    )
    expect(mismatch.status).toBe('patch-mismatch')
    expect(mismatch.metrics).toBeNull()
  })

  it('отчёт за 10 минут не сравнивается с 15-минутным нормативом', () => {
    const snapshot = makeSnapshot()
    const result = compareLaningWithBenchmark(
      snapshot,
      { heroId: 6, laneRole: 1, patchId: 60, intervalMinutes: 10 },
      ACTUAL,
    )
    expect(result.status).toBe('interval-mismatch')
    expect(result.metrics).toBeNull()
    expect(hasDisplayableComparison(result)).toBe(false)
  })

  it('отсутствующий таймлайн не превращается в ноль', () => {
    const snapshot = makeSnapshot()
    const result = compareLaningWithBenchmark(
      snapshot,
      { heroId: 6, laneRole: 1, patchId: 60, intervalMinutes: 15 },
      { lastHits: null, gold: null, xp: null },
    )
    expect(result.status).toBe('ready')
    for (const key of ['lastHits', 'gold', 'xp'] as const) {
      expect(result.metrics?.[key].status).toBe('missing-actual')
      expect(result.metrics?.[key].difference).toBeNull()
    }
    expect(hasDisplayableComparison(result)).toBe(false)
  })

  it('недостаточная выборка не показывает сравнение', () => {
    const snapshot = makeSnapshot()
    snapshot.buckets[0].metrics.lastHits = metric(10, 90, 110, 130)
    snapshot.buckets[0].metrics.gold = metric(10, 1, 2, 3)
    snapshot.buckets[0].metrics.xp = metric(10, 1, 2, 3)
    const result = compareLaningWithBenchmark(
      snapshot,
      { heroId: 6, laneRole: 1, patchId: 60, intervalMinutes: 15 },
      ACTUAL,
    )
    expect(result.metrics?.lastHits.status).toBe('insufficient')
    expect(hasDisplayableComparison(result)).toBe(false)
  })
})

describe.skipIf(!hasLocalSnapshot)('реальный снапшот public/benchmarks/benchmarks-7.41.json', () => {
  it('проходит валидацию и содержит метаданные источника', () => {
    const parsed = parseBenchmarkSnapshot(readLocalSnapshot())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.patch).toBe('7.41')
    expect(parsed.value.patch_id).toBe(60)
    expect(parsed.value.interval.minutes).toBe(15)
    expect(parsed.value.source.name).toBe('OpenDota Explorer')
    expect(parsed.value.bucket_count).toBeGreaterThan(0)
    expect(parsed.value.bucket_count).toBe(parsed.value.buckets.length)
  })

  it('не содержит бакетов с нарушенным порядком перцентилей', () => {
    const parsed = parseBenchmarkSnapshot(readLocalSnapshot())
    if (!parsed.ok) throw new Error('снапшот не прошёл валидацию')
    let checked = 0
    for (const bucket of parsed.value.buckets) {
      for (const stats of Object.values(bucket.metrics)) {
        if (stats.n === 0) {
          expect(stats.p50).toBeNull()
          continue
        }
        expect(stats.p25).not.toBeNull()
        expect(stats.p75).not.toBeNull()
        expect((stats.p25 ?? 0) <= (stats.p50 ?? 0)).toBe(true)
        expect((stats.p50 ?? 0) <= (stats.p75 ?? 0)).toBe(true)
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('содержит бакет Drow Ranger в лёгкой линии', () => {
    const parsed = parseBenchmarkSnapshot(readLocalSnapshot())
    if (!parsed.ok) throw new Error('снапшот не прошёл валидацию')
    const bucket = parsed.value.buckets.find((item) => item.hero_id === 6 && item.lane_role === 1)
    expect(bucket).toBeDefined()
    expect(bucket?.metrics.lastHits.n).toBeGreaterThanOrEqual(50)
  })
})
