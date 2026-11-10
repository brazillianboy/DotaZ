import { afterEach, describe, expect, it } from 'vitest'

import {
  buildHeroStatsCatalog,
  computePickShare,
  computeWinRate,
  heroPickShare,
  loadHeroStatsCatalog,
  parseHeroStatsRow,
  resetHeroStatsCache,
  type HeroStatsCatalog,
} from './heroStats'

/**
 * Методика статистики героев (Task 19).
 *
 * Проверяется, что числа означают именно то, что заявлено в интерфейсе:
 * - винрейт = победы / выборы × 100 при валидных значениях;
 * - «доля выборов» = выборы героя / сумма выборов всех героев — это распределение
 *   среди записанных выборов героев, а НЕ вероятность увидеть героя в матче;
 * - отсутствие данных не превращается в ноль, а `pro_ban` различает «известный ноль»
 *   и «провайдер не сообщил»;
 * - патч и период наблюдений в ответе отсутствуют — есть только момент получения.
 */

function row(
  heroId: number,
  pubPick: number,
  pubWin: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: heroId,
    localized_name: `Hero ${heroId}`,
    primary_attr: 'agi',
    attack_type: 'Melee',
    roles: ['Carry'],
    pub_pick: pubPick,
    pub_win: pubWin,
    turbo_picks: 0,
    turbo_wins: 0,
    pro_pick: 0,
    pro_win: 0,
    pro_ban: 0,
    ...extra,
  }
}

function fullRows(pick = 100): Record<string, unknown>[] {
  return Array.from({ length: 100 }, (_unused, index) => row(index + 1, pick, pick / 2))
}

function catalogOfRows(rows: readonly unknown[]): HeroStatsCatalog | null {
  return buildHeroStatsCatalog(rows, '2026-11-09T00:00:00.000Z')
}

afterEach(() => {
  resetHeroStatsCache()
})

describe('винрейт: границы и валидность', () => {
  it('винрейт = wins / games × 100 и округляется до 0.01', () => {
    expect(computeWinRate(520, 1000)).toBe(52)
    expect(computeWinRate(1, 1000)).toBe(0.1)
    expect(computeWinRate(0, 1000)).toBe(0)
    expect(computeWinRate(2, 3)).toBe(66.67)
  })

  it('нулевые игры не дают винрейта (деления на ноль нет)', () => {
    expect(computeWinRate(0, 0)).toBeNull()
    expect(computeWinRate(10, 0)).toBeNull()
  })

  it('победы больше игр, отрицательные и нецелые значения отклоняются', () => {
    expect(computeWinRate(101, 100)).toBeNull()
    expect(computeWinRate(-3, 100)).toBeNull()
    expect(computeWinRate(50.5, 100)).toBeNull()
    expect(computeWinRate(50, 100.5)).toBeNull()
    expect(computeWinRate(Number.NaN, 100)).toBeNull()
  })
})

describe('доля выборов: знаменатель — сумма выборов героев', () => {
  it('сумма долей всех героев равна 100 % выборок, а не числу матчей', () => {
    // 100 героев по 100 выборов: в каждом матче выбирается 10 героев, поэтому
    // 10 000 выборок — это 1 000 матчей, но знаменатель доли именно 10 000.
    const catalog = catalogOfRows(fullRows())
    expect(catalog).not.toBeNull()
    if (catalog === null) {
      return
    }
    expect(catalog.totals.pubPicks).toBe(10000)
    expect(heroPickShare(catalog, 1)).toBe(1)
    const shares = [...catalog.entries.keys()].map((heroId) => heroPickShare(catalog, heroId) ?? 0)
    const total = shares.reduce((sum, value) => sum + value, 0)
    expect(total).toBeGreaterThan(99.9)
    expect(total).toBeLessThan(100.1)
  })

  it('доля не равна вероятности встретить героя в матче', () => {
    const share = heroPickShare(catalogOfRows(fullRows()), 1)
    // Если бы это была «доля матчей», при 10 героях в матче она была бы ≈ 10 %.
    expect(share).toBe(1)
    expect(share).not.toBe(10)
  })

  it('нулевой знаменатель и превышение знаменателя не дают процента', () => {
    expect(computePickShare(0, 0)).toBeNull()
    expect(computePickShare(10, 0)).toBeNull()
    expect(computePickShare(11, 10)).toBeNull()
    expect(computePickShare(-1, 10)).toBeNull()
  })

  it('известный нулевой вклад — это 0 %, а не отсутствие данных', () => {
    expect(computePickShare(0, 100)).toBe(0)
  })
})

describe('профессиональные баны: известный ноль против отсутствия', () => {
  it('pro_ban: 0 — это подтверждённый ноль', () => {
    expect(parseHeroStatsRow(row(2, 100, 50, { pro_ban: 0 }))?.pro.bans).toBe(0)
  })

  it('отсутствующий pro_ban не подменяется нулём', () => {
    const raw = row(2, 100, 50)
    delete raw.pro_ban
    expect(parseHeroStatsRow(raw)?.pro.bans).toBeNull()
  })

  it('нечисловой и отрицательный pro_ban не считается баном', () => {
    expect(parseHeroStatsRow(row(2, 100, 50, { pro_ban: '12' }))?.pro.bans).toBeNull()
    expect(parseHeroStatsRow(row(2, 100, 50, { pro_ban: -1 }))?.pro.bans).toBeNull()
  })
})

describe('патч, период наблюдений и момент получения', () => {
  it('в каталоге есть только момент получения и нет выдуманного патча', () => {
    const catalog = catalogOfRows(fullRows())
    expect(catalog?.retrievedAt).toBe('2026-11-09T00:00:00.000Z')
    expect(Object.prototype.hasOwnProperty.call(catalog, 'patch')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(catalog, 'period')).toBe(false)
  })

  it('момент получения — валидная ISO-строка, отдельная от периода наблюдений', () => {
    const catalog = buildHeroStatsCatalog(fullRows())
    expect(catalog).not.toBeNull()
    const iso = catalog?.retrievedAt ?? ''
    expect(Number.isNaN(Date.parse(iso))).toBe(false)
    expect(iso).toBe(new Date(iso).toISOString())
  })
})

describe('невалидные ответы провайдера', () => {
  it('неполный или битый список строк не превращается в каталог', () => {
    expect(buildHeroStatsCatalog([])).toBeNull()
    expect(buildHeroStatsCatalog(fullRows().slice(0, 99))).toBeNull()
    expect(catalogOfRows([null, 1, 'x', [1, 2]])).toBeNull()
  })

  it('строки с неизвестным атрибутом, пустым именем и дублями отбрасываются', () => {
    const rows: unknown[] = fullRows()
    rows.push(row(1, 999, 999)) // дубль hero_id 1
    rows.push({ ...row(500, 10, 5), primary_attr: 'speed' })
    rows.push({ ...row(501, 10, 5), localized_name: '' })
    const catalog = catalogOfRows(rows)
    expect(catalog?.entries.size).toBe(100)
    // дубль не исказил счётчики первого героя
    expect(catalog?.entries.get(1)?.pub.games).toBe(100)
    expect(catalog?.totals.pubPicks).toBe(10000)
  })

  it('сбой сети кешируется как отсутствие данных, а не как пустая статистика', async () => {
    await expect(loadHeroStatsCatalog(async () => null)).resolves.toBeNull()
    resetHeroStatsCache()
    await expect(loadHeroStatsCatalog(async () => ({ not: 'an array' }))).resolves.toBeNull()
  })

  it('успешный ответ разбирается один раз и переиспользуется из кеша', async () => {
    let calls = 0
    const fetcher = async (): Promise<unknown> => {
      calls += 1
      return fullRows(200)
    }
    const first = await loadHeroStatsCatalog(fetcher)
    const second = await loadHeroStatsCatalog(fetcher)
    expect(calls).toBe(1)
    expect(first?.entries.size).toBe(100)
    expect(second).toBe(first)
  })
})

describe('отсутствующая статистика героя', () => {
  it('герой вне выборки не получает ни винрейта, ни доли', () => {
    const catalog = catalogOfRows(fullRows())
    expect(heroPickShare(catalog, 9999)).toBeNull()
    expect(heroPickShare(null, 1)).toBeNull()
  })

  it('нулевые выборы героя дают отсутствие винрейта, но не ошибку', () => {
    const rows = fullRows()
    rows[0] = row(1, 0, 0)
    const catalog = catalogOfRows(rows)
    expect(catalog?.entries.get(1)?.pub.winRate).toBeNull()
    expect(heroPickShare(catalog, 1)).toBe(0)
  })
})
