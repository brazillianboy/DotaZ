import { describe, expect, it } from 'vitest'

import type { TimelineEntry } from './itemTimeline'
import { classifyItemTiming, compareItemTimings, parseItemTimingSnapshot } from './itemTimings'

/**
 * Тесты генератора `scripts/build-item-timings.mjs` (Task 18).
 *
 * Генератор написан на Node ESM, поэтому импортируется динамически по URL:
 * так TypeScript не требует деклараций для `.mjs` и не тянет скрипт в бандл.
 * Сеть здесь не используется: проверяются чистые функции (SQL, разбор строк,
 * объединение шардов, схема снапшота) и — при наличии локального файла —
 * валидность реального снапшота.
 */

interface GeneratorBucket {
  hero_id: number
  lane_role: number
  item_key: string
  stats: { n: number; p25: number; p50: number; p75: number }
}

interface GeneratorSnapshot {
  method_version: string
  patch: string
  patch_id: number | null
  thresholds: { store: number; full: number; classify: number }
  bucket_count: number
  buckets: GeneratorBucket[]
  totals?: { observations: number; heroes: number; items: number }
  [key: string]: unknown
}

interface GeneratorModule {
  METHOD_VERSION: string
  THRESHOLDS: { store: number; full: number; classify: number }
  MIN_OBSERVATIONS: number
  CLASSIFY_MIN_OBSERVATIONS: number
  collectEligibleItemKeys(source: string): string[]
  loadEligibleItemKeys(root?: string): string[]
  buildSql(patch: string, itemKeys: string[], heroRange?: number[]): string
  parseRow(row: unknown, eligibleKeys?: Set<string> | null): GeneratorBucket | null
  mergeBuckets(lists: GeneratorBucket[][]): GeneratorBucket[]
  buildSnapshot(
    patch: string,
    patchId: number | null,
    buckets: GeneratorBucket[],
    generatedAt?: string,
  ): GeneratorSnapshot
  validateSnapshot(snapshot: GeneratorSnapshot): GeneratorSnapshot
  parseArgs(argv: string[]): { patch: string; dryRun: boolean; force: boolean; out: string | null }
  stableJson(snapshot: GeneratorSnapshot): string
  defaultOutputPath(patch: string, root?: string): string
}

const moduleUrl = new URL('../../scripts/build-item-timings.mjs', import.meta.url).href
const generator = (await import(moduleUrl)) as unknown as GeneratorModule

/** Строка Explorer: числа `numeric` приходят строками. */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    hero_id: 6,
    lane_role: 1,
    item_key: 'blink',
    n: 120,
    p25: '600.4',
    p50: '750.5',
    p75: '900.6',
    ...overrides,
  }
}

function bucket(overrides: Partial<GeneratorBucket> = {}): GeneratorBucket {
  return {
    hero_id: 6,
    lane_role: 1,
    item_key: 'blink',
    stats: { n: 120, p25: 600, p50: 750, p75: 900 },
    ...overrides,
  }
}

function entry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    key: 'boots',
    name: 'Boots of Speed',
    iconUrl: '',
    timeSeconds: 240,
    category: 'completed',
    occurrence: 1,
    comparable: true,
    ...overrides,
  }
}

describe('генератор: каталог предметов', () => {
  it('извлекает каталог из кода приложения, а не из дублирующего списка', () => {
    const keys = generator.loadEligibleItemKeys()
    expect(keys.length).toBeGreaterThanOrEqual(50)
    expect(keys).toContain('boots')
    expect(keys).toContain('power_treads')
    expect(keys).toContain('black_king_bar')
    // Обычные расходники и рецепты в нормативы не попадают.
    expect(keys).not.toContain('tango')
    expect(keys).not.toContain('clarity')
    expect(keys).not.toContain('ward_observer')
    expect(keys.some((key) => key.includes('recipe'))).toBe(false)
  })

  it('отказывается работать при повреждённом каталоге', () => {
    expect(() =>
      generator.collectEligibleItemKeys(
        "export const COMPLETED_ITEM_CATALOG: readonly string[] = ['blink']\nexport const BOOTS_UPGRADE_ITEM_KEYS: readonly string[] = ['power_treads']\nexport const BASIC_BOOTS_KEY = 'boots'\n",
      ),
    ).toThrow()
  })
})

describe('генератор: SQL', () => {
  const sql = generator.buildSql('7.41', ['blink', 'boots'], [1, 40])

  it('фильтрует точный патч, диапазон героев и допустимые линии', () => {
    expect(sql).toContain("mp.patch = '7.41'")
    expect(sql).toContain('pm.hero_id BETWEEN 1 AND 40')
    expect(sql).toContain('pm.lane_role IN (1, 2, 3, 4)')
    expect(sql).toContain("(u.elem->>'key') IN ('blink', 'boots')")
  })

  it('применяет фильтры качества матчей как в Task 16', () => {
    expect(sql).toContain('m.game_mode IN (1, 2, 3, 4, 5, 12, 16, 17, 22)')
    expect(sql).toContain('m.lobby_type NOT IN (3, 4, 10, 11)')
    expect(sql).toContain("json_typeof(u.elem) = 'object'")
  })

  it('берёт первую покупку предмета на игрока и отбрасывает некорректное время', () => {
    expect(sql).toContain('MIN(time_text::numeric) AS purchase_time')
    expect(sql).toContain('GROUP BY 1, 2, 3, 4, 5')
    expect(sql).toContain("(u.elem->>'time') ~ '^-?[0-9]+$'")
  })

  it('группирует по герою, линии и предмету, считая перцентили в СУБД', () => {
    expect(sql).toContain('GROUP BY 1, 2, 3')
    expect(sql).toContain('percentile_cont(0.25)')
    expect(sql).toContain('percentile_cont(0.50)')
    expect(sql).toContain('percentile_cont(0.75)')
    expect(sql).toContain(`HAVING COUNT(*) >= ${generator.MIN_OBSERVATIONS}`)
  })
})

describe('генератор: разбор строк Explorer', () => {
  it('принимает валидную строку и приводит строковые числа к number', () => {
    expect(generator.parseRow(row())).toEqual({
      hero_id: 6,
      lane_role: 1,
      item_key: 'blink',
      stats: { n: 120, p25: 600.4, p50: 750.5, p75: 900.6 },
    })
  })

  it('корректно принимает отрицательное время предматчевой покупки', () => {
    const parsed = generator.parseRow(
      row({ item_key: 'magic_wand', p25: '-90', p50: '-88', p75: '170' }),
    )
    expect(parsed?.stats.p25).toBe(-90)
    expect(parsed?.stats.p50).toBe(-88)
  })

  it('отбрасывает выборку меньше порога и не «дотягивает» её', () => {
    expect(generator.parseRow(row({ n: 29 }))).toBeNull()
    expect(generator.parseRow(row({ n: 30 }))).not.toBeNull()
  })

  it('отбрасывает нарушенный порядок квартилей и неправдоподобные значения', () => {
    expect(generator.parseRow(row({ p25: '800', p50: '700' }))).toBeNull()
    expect(generator.parseRow(row({ p25: '-5000' }))).toBeNull()
    expect(generator.parseRow(row({ p75: '99999' }))).toBeNull()
    expect(generator.parseRow(row({ p50: 'abc' }))).toBeNull()
  })

  it('отбрасывает неизвестную линию, героя и предмет вне каталога', () => {
    expect(generator.parseRow(row({ lane_role: 5 }))).toBeNull()
    expect(generator.parseRow(row({ hero_id: 0 }))).toBeNull()
    expect(generator.parseRow(row({ item_key: 'tango' }), new Set(['blink']))).toBeNull()
    expect(generator.parseRow(row({ item_key: 'Blink' }))).toBeNull()
    expect(generator.parseRow(null)).toBeNull()
    expect(generator.parseRow('мусор')).toBeNull()
  })
})

describe('генератор: объединение шардов и детерминизм', () => {
  it('сортирует бакеты по герою, линии и предмету', () => {
    const merged = generator.mergeBuckets([
      [bucket({ hero_id: 7, item_key: 'blink' })],
      [bucket({ hero_id: 6, item_key: 'boots' }), bucket({ hero_id: 6, item_key: 'blink' })],
    ])
    expect(merged.map((item) => `${item.hero_id}:${item.lane_role}:${item.item_key}`)).toEqual([
      '6:1:blink',
      '6:1:boots',
      '7:1:blink',
    ])
  })

  it('не допускает дубль бакета при слиянии шардов', () => {
    expect(() => generator.mergeBuckets([[bucket()], [bucket()]])).toThrow(/дубль/)
  })

  it('не включает время генерации в стабильную часть снапшота', () => {
    const first = generator.buildSnapshot('7.41', 60, [bucket()], '2026-11-08T10:00:00.000Z')
    const second = generator.buildSnapshot('7.41', 60, [bucket()], '2026-11-09T11:00:00.000Z')
    expect(generator.stableJson(first)).toBe(generator.stableJson(second))
    expect(first.generated_at).not.toBe(second.generated_at)
  })
})

describe('генератор: снапшот', () => {
  it('формирует схему, совместимую с парсером приложения', () => {
    const snapshot = generator.buildSnapshot('7.41', 60, [bucket()], '2026-11-08T10:00:00.000Z')
    const parsed = parseItemTimingSnapshot(snapshot)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.method_version).toBe(generator.METHOD_VERSION)
      expect(parsed.value.patch).toBe('7.41')
      expect(parsed.value.patch_id).toBe(60)
      expect(parsed.value.thresholds).toEqual(generator.THRESHOLDS)
      expect(parsed.value.bucket_count).toBe(1)
      expect(parsed.value.buckets[0].stats).toEqual({ n: 120, p25: 600, p50: 750, p75: 900 })
    }
  })

  it('фиксирует три порога выборки: хранение 30, квартили и классификация 100', () => {
    expect(generator.THRESHOLDS).toEqual({ store: 30, full: 100, classify: 100 })
    expect(generator.MIN_OBSERVATIONS).toBe(30)
    expect(generator.CLASSIFY_MIN_OBSERVATIONS).toBe(100)

    const snapshot = generator.buildSnapshot('7.41', 60, [bucket()], '2026-11-08T10:00:00.000Z')
    expect(snapshot.thresholds).toEqual({ store: 30, full: 100, classify: 100 })
    const parsed = parseItemTimingSnapshot(snapshot)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.thresholds.classify).toBe(100)
    }
  })

  it('бакет с n = 30…99 сохраняется, но приложение его не классифицирует', () => {
    const small = generator.buildSnapshot(
      '7.41',
      60,
      [bucket({ stats: { n: 30, p25: 600, p50: 750, p75: 900 } })],
      '2026-11-08T10:00:00.000Z',
    )
    const parsed = parseItemTimingSnapshot(small)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(
        classifyItemTiming(700, parsed.value.buckets[0].stats, parsed.value.thresholds),
      ).toBe('insufficient')
    }
  })

  it('не записывает пустой или несогласованный снапшот', () => {
    expect(() => generator.validateSnapshot(generator.buildSnapshot('7.41', 60, []))).toThrow()
    const broken = generator.buildSnapshot('7.41', 60, [
      bucket({ stats: { n: 10, p25: 1, p50: 2, p75: 3 } }),
    ])
    expect(() => generator.validateSnapshot(broken)).toThrow(/n=/)
  })

  it('пишет снапшот в путь, который читает приложение', () => {
    const path = generator.defaultOutputPath('7.41')
    expect(path).toContain('public')
    expect(path).toContain('item-timings-7.41.json')
  })

  it('разбирает аргументы командной строки и отвергает мусор', () => {
    expect(generator.parseArgs(['--patch=7.41', '--dry-run'])).toEqual({
      patch: '7.41',
      dryRun: true,
      force: false,
      out: null,
    })
    expect(generator.parseArgs(['--patch=7.41', '--force']).force).toBe(true)
    expect(() => generator.parseArgs(['--patch=abc'])).toThrow()
    expect(() => generator.parseArgs(['--unknown'])).toThrow()
  })
})

/** Локальный снапшот не входит в Git: группа выполняется только там, где файл есть. */
const snapshotModules = import.meta.glob('/public/benchmarks/item-timings-*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

const realSnapshot = snapshotModules['/public/benchmarks/item-timings-7.41.json']

describe.skipIf(realSnapshot === undefined)('реальный снапшот нормативов таймингов', () => {
  const parsed = parseItemTimingSnapshot(realSnapshot)

  it('проходит строгую проверку схемы приложения', () => {
    expect(parsed.ok).toBe(true)
  })

  it('содержит только бакеты с достаточной выборкой и корректными квартилями', () => {
    if (!parsed.ok) {
      throw new Error('снапшот не разобран')
    }
    expect(parsed.value.patch).toBe('7.41')
    expect(parsed.value.buckets.length).toBeGreaterThan(100)
    for (const item of parsed.value.buckets) {
      expect(item.stats.n).toBeGreaterThanOrEqual(30)
      expect(item.stats.p25).not.toBeNull()
      expect(item.stats.p25 as number).toBeLessThanOrEqual(item.stats.p50 as number)
      expect(item.stats.p50 as number).toBeLessThanOrEqual(item.stats.p75 as number)
      expect(item.lane_role).toBeGreaterThanOrEqual(1)
      expect(item.lane_role).toBeLessThanOrEqual(4)
    }
  })

  it('отсортирован детерминированно (герой → линия → предмет)', () => {
    if (!parsed.ok) {
      throw new Error('снапшот не разобран')
    }
    const keys = parsed.value.buckets.map(
      (item) => `${String(item.hero_id).padStart(4, '0')}:${item.lane_role}:${item.item_key}`,
    )
    expect(keys).toEqual([...keys].sort())
  })

  it('сравнивает фактические тайминги со значениями снапшота', () => {
    if (!parsed.ok) {
      throw new Error('снапшот не разобран')
    }
    const sample = parsed.value.buckets.find(
      (item) => item.item_key === 'boots' && item.stats.n >= 100,
    )
    expect(sample).toBeDefined()
    if (sample === undefined) {
      return
    }
    const p25 = sample.stats.p25 as number
    const p50 = sample.stats.p50 as number
    const p75 = sample.stats.p75 as number
    const query = { heroId: sample.hero_id, laneRole: sample.lane_role, patchId: parsed.value.patch_id }

    const early = compareItemTimings([entry({ key: sample.item_key, timeSeconds: p25 - 30 })], parsed.value, query)
    const typical = compareItemTimings([entry({ key: sample.item_key, timeSeconds: p50 })], parsed.value, query)
    const late = compareItemTimings([entry({ key: sample.item_key, timeSeconds: p75 + 30 })], parsed.value, query)

    expect(early.get(sample.item_key)?.timingClass).toBe('early')
    expect(typical.get(sample.item_key)?.timingClass).toBe('typical')
    expect(late.get(sample.item_key)?.timingClass).toBe('late')
    expect(typical.get(sample.item_key)?.median).toBe(p50)
    expect(typical.get(sample.item_key)?.sampleSize).toBe(sample.stats.n)
    expect(typical.get(sample.item_key)?.differenceSeconds).toBe(0)
  })

  it('не выдумывает сравнение для героя вне снапшота и для чужого патча', () => {
    if (!parsed.ok) {
      throw new Error('снапшот не разобран')
    }
    const unknownHero = compareItemTimings([entry({ timeSeconds: 1200 })], parsed.value, {
      heroId: 999,
      laneRole: 1,
      patchId: parsed.value.patch_id,
    })
    expect(unknownHero.size).toBe(0)

    const otherPatch = compareItemTimings([entry({ timeSeconds: 1200 })], parsed.value, {
      heroId: 6,
      laneRole: 1,
      patchId: (parsed.value.patch_id ?? 0) + 1,
    })
    expect(otherPatch.size).toBe(0)
  })
})
