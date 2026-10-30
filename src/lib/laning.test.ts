import { describe, expect, it } from 'vitest'

import { normalizeMatch } from './normalizeMatch'
import {
  LANING_INTERVAL_END_SECONDS,
  LANING_INTERVAL_INDEX,
  LANING_INTERVAL_MINUTES,
  buildLaningInterval,
  buildLaningStageData,
  collectPurchaseLog,
  collectPurchasesInInterval,
  countEventsInInterval,
  extractTimelineValueAtMinute,
  hasLaningFacts,
  laningIntervalEndLabel,
  normalizeLaneEfficiencyPct,
} from './laning'

/**
 * Тесты ранней стадии 00:00–15:00 (Task 8; интервал изменён с 10 на 15 минут).
 *
 * Фикстуры синтетические и предназначены только для юнит-тестов; семантика полей
 * подтверждена живым ответом OpenDota (см. README). Таймлайны в фикстурах имеют
 * длину 16+ элементов, чтобы индекс 15 соответствовал 15:00.
 */

/** Таймлайн длиной 16 элементов: значение на 15-й минуте задаётся параметром. */
function timelineAt15(value: number): number[] {
  return [...Array.from({ length: 15 }, (_, index) => index), value]
}

/** Синтетическая запись игрока с расширенными полями (индекс 15 → 15:00). */
function makeRawPlayer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    player_slot: 0,
    lh_t: timelineAt15(86),
    gold_t: timelineAt15(5860),
    xp_t: timelineAt15(4512),
    kills_log: [
      { time: 102, key: 'npc_dota_hero_dark_seer' },
      { time: 182, key: 'npc_dota_hero_sharedder' },
    ],
    deaths_log: [{ time: 186, key: 'npc_dota_neutral_polar_furbolg_ursa_warrior' }],
    purchase_log: [
      { time: -89, key: 'magic_wand' },
      { time: 120, key: 'boots' },
      { time: 590, key: 'blink' },
      { time: 880, key: 'point_booster' },
      { time: 1500, key: 'black_king_bar' },
    ],
    lane_efficiency_pct: 78,
    ...overrides,
  }
}

describe('Интервал ранней стадии — 15 минут', () => {
  it('константы соответствуют интервалу 00:00–15:00', () => {
    expect(LANING_INTERVAL_MINUTES).toBe(15)
    expect(LANING_INTERVAL_INDEX).toBe(15)
    expect(LANING_INTERVAL_END_SECONDS).toBe(900)
  })

  it('интервал описывается данными, а не константой отображения', () => {
    expect(buildLaningInterval()).toEqual({ minutes: 15, label: '00:00–15:00' })
    expect(buildLaningInterval(10)).toEqual({ minutes: 10, label: '00:00–10:00' })
    expect(laningIntervalEndLabel(15)).toBe('15:00')
    expect(laningIntervalEndLabel(10)).toBe('10:00')
  })

  it('buildLaningStageData сохраняет интервал в данных', () => {
    const laning = buildLaningStageData(makeRawPlayer())
    expect(laning.interval).toEqual({ minutes: 15, label: '00:00–15:00' })
  })
})

describe('Поминутные показатели на 15-й минуте', () => {
  it('извлекает lh_t[15], gold_t[15], xp_t[15]', () => {
    const laning = buildLaningStageData(makeRawPlayer())
    expect(laning.lastHits).toBe(86)
    expect(laning.gold).toBe(5860)
    expect(laning.xp).toBe(4512)
  })

  it('использует именно индекс 15 (значение не путается с соседними)', () => {
    const series = [...Array.from({ length: 15 }, (_, index) => index), 99, 100]
    expect(extractTimelineValueAtMinute(series, LANING_INTERVAL_INDEX)).toBe(99)
    expect(extractTimelineValueAtMinute(series, 14)).toBe(14)
  })

  it('off-by-one: массив длиной 16 содержит 15-ю минуту, длиной 15 — нет', () => {
    const seriesOfSixteen = Array.from({ length: 16 }, (_, index) => index)
    expect(extractTimelineValueAtMinute(seriesOfSixteen, LANING_INTERVAL_INDEX)).toBe(15)
    const seriesOfFifteen = Array.from({ length: 15 }, (_, index) => index)
    expect(extractTimelineValueAtMinute(seriesOfFifteen, LANING_INTERVAL_INDEX)).toBeNull()
  })

  it('легитимные нули сохраняются', () => {
    const laning = buildLaningStageData({
      lh_t: timelineAt15(0),
      gold_t: timelineAt15(0),
      xp_t: timelineAt15(0),
      kills_log: [],
      deaths_log: [],
      purchase_log: [],
      lane_efficiency_pct: 0,
    })
    expect(laning.lastHits).toBe(0)
    expect(laning.gold).toBe(0)
    expect(laning.xp).toBe(0)
    expect(laning.killsFirst).toBe(0)
    expect(laning.deathsFirst).toBe(0)
    expect(laning.purchasesFirst).toEqual([])
    expect(laning.laneEfficiencyPct).toBe(0)
  })

  it('отсутствующие, короткие и некорректные таймлайны → null', () => {
    const laning = buildLaningStageData({ player_slot: 0 })
    expect(laning.lastHits).toBeNull()
    expect(laning.gold).toBeNull()
    expect(laning.xp).toBeNull()

    expect(extractTimelineValueAtMinute('86', LANING_INTERVAL_INDEX)).toBeNull()
    expect(extractTimelineValueAtMinute(null, LANING_INTERVAL_INDEX)).toBeNull()
    expect(extractTimelineValueAtMinute([], LANING_INTERVAL_INDEX)).toBeNull()
    expect(extractTimelineValueAtMinute([1, 2, 3], LANING_INTERVAL_INDEX)).toBeNull()

    const invalid = [...Array.from({ length: 15 }, () => 0), '86']
    expect(extractTimelineValueAtMinute(invalid, LANING_INTERVAL_INDEX)).toBeNull()
    const nan = [...Array.from({ length: 15 }, () => 0), Number.NaN]
    expect(extractTimelineValueAtMinute(nan, LANING_INTERVAL_INDEX)).toBeNull()
    const infinite = [...Array.from({ length: 15 }, () => 0), Number.POSITIVE_INFINITY]
    expect(extractTimelineValueAtMinute(infinite, LANING_INTERVAL_INDEX)).toBeNull()
  })
})

describe('События 00:00–15:00', () => {
  it('считает события с time в 0..900 включительно', () => {
    const log = [{ time: 0 }, { time: 102 }, { time: 899 }, { time: 900 }]
    expect(countEventsInInterval(log)).toBe(4)
  })

  it('исключает события после 15:00 (901+) и предматчевые (time < 0)', () => {
    const log = [{ time: -30 }, { time: 901 }, { time: 1500 }]
    expect(countEventsInInterval(log)).toBe(0)
  })

  it('убийства и смерти считаются отдельно по своим журналам', () => {
    const laning = buildLaningStageData(
      makeRawPlayer({
        kills_log: [{ time: 100 }, { time: 400 }, { time: 800 }],
        deaths_log: [{ time: 200 }],
      }),
    )
    expect(laning.killsFirst).toBe(3)
    expect(laning.deathsFirst).toBe(1)
  })

  it('отсутствующий журнал → null, доступный пустой → 0', () => {
    const missing = buildLaningStageData({ player_slot: 0 })
    expect(missing.killsFirst).toBeNull()
    expect(missing.deathsFirst).toBeNull()
    expect(countEventsInInterval(null)).toBeNull()
    expect(countEventsInInterval('log')).toBeNull()
    expect(countEventsInInterval([])).toBe(0)
  })

  it('недостоверный журнал (невалидное время) → null', () => {
    expect(countEventsInInterval([{ time: 'soon' }])).toBeNull()
    expect(countEventsInInterval([null])).toBeNull()
  })
})

describe('Покупки 00:00–15:00 (компоненты разрешены)', () => {
  it('включает все фактические покупки интервала, включая компоненты и расходники', () => {
    const purchases = collectPurchasesInInterval(makeRawPlayer().purchase_log)
    expect(purchases).toEqual([
      { time: 120, key: 'boots' },
      { time: 590, key: 'blink' },
      { time: 880, key: 'point_booster' },
    ])
    // Компонент (boots, point_booster) не фильтруется: это реальная закупка игрока.
    expect(purchases?.map((purchase) => purchase.key)).toContain('boots')
  })

  it('исключает предматчевые записи (time < 0) и события после 15:00', () => {
    const purchases = collectPurchasesInInterval([
      { time: -89, key: 'magic_wand' },
      { time: 120, key: 'boots' },
      { time: 1500, key: 'black_king_bar' },
    ])
    expect(purchases).toEqual([{ time: 120, key: 'boots' }])
  })

  it('границы интервала включительны: 900 входит, 901 — нет', () => {
    expect(collectPurchasesInInterval([{ time: 900, key: 'blink' }])).toHaveLength(1)
    expect(collectPurchasesInInterval([{ time: 901, key: 'blink' }])).toHaveLength(0)
  })

  it('отсутствующий журнал → null, доступный пустой → []', () => {
    expect(collectPurchasesInInterval(undefined)).toBeNull()
    expect(collectPurchasesInInterval([])).toEqual([])
  })

  it('невалидная запись делает журнал недостоверным → null', () => {
    expect(collectPurchasesInInterval([{ time: 120 }])).toBeNull()
    expect(collectPurchasesInInterval([{ time: 120, key: '' }])).toBeNull()
    expect(collectPurchasesInInterval([{ time: 'soon', key: 'boots' }])).toBeNull()
    expect(collectPurchasesInInterval([null])).toBeNull()
    expect(collectPurchasesInInterval('log')).toBeNull()
  })
})

describe('Полный журнал покупок за матч', () => {
  it('сохраняет все записи, включая предматчевые и поздние', () => {
    const log = collectPurchaseLog(makeRawPlayer().purchase_log)
    expect(log).toHaveLength(5)
    expect(log?.[0]).toEqual({ time: -89, key: 'magic_wand' })
    expect(log?.[4]).toEqual({ time: 1500, key: 'black_king_bar' })
  })

  it('недостоверный журнал → null, доступный пустой → []', () => {
    expect(collectPurchaseLog([{ time: 120 }])).toBeNull()
    expect(collectPurchaseLog([])).toEqual([])
    expect(collectPurchaseLog(undefined)).toBeNull()
  })

  it('нормализация матча сохраняет полный журнал покупок игрока', () => {
    const match = normalizeMatch({
      players: [{ player_slot: 0, purchase_log: [{ time: 120, key: 'boots' }] }],
    })
    expect(match.players[0].purchaseLog).toEqual([{ time: 120, key: 'boots' }])
    expect(match.players[0].laning.purchasesFirst).toEqual([{ time: 120, key: 'boots' }])
  })
})

describe('Эффективность линии', () => {
  it('принимает значения 0–100 и сохраняет ноль', () => {
    expect(normalizeLaneEfficiencyPct(78)).toBe(78)
    expect(normalizeLaneEfficiencyPct(0)).toBe(0)
    expect(normalizeLaneEfficiencyPct(100)).toBe(100)
  })

  it('отклоняет нечисла, NaN, Infinity и значения вне 0–100', () => {
    expect(normalizeLaneEfficiencyPct('78')).toBeNull()
    expect(normalizeLaneEfficiencyPct(Number.NaN)).toBeNull()
    expect(normalizeLaneEfficiencyPct(Number.POSITIVE_INFINITY)).toBeNull()
    expect(normalizeLaneEfficiencyPct(-1)).toBeNull()
    expect(normalizeLaneEfficiencyPct(101)).toBeNull()
    expect(normalizeLaneEfficiencyPct(undefined)).toBeNull()
  })
})

describe('Частичная доступность данных и признаки фактов', () => {
  it('доступны золото и убийства; опыт, добивания, покупки и эффективность отсутствуют', () => {
    const laning = buildLaningStageData({
      gold_t: timelineAt15(5860),
      kills_log: [{ time: 300 }],
    })
    expect(laning.gold).toBe(5860)
    expect(laning.killsFirst).toBe(1)
    expect(laning.xp).toBeNull()
    expect(laning.lastHits).toBeNull()
    expect(laning.purchasesFirst).toBeNull()
    expect(laning.laneEfficiencyPct).toBeNull()
    expect(hasLaningFacts(laning)).toBe(true)
  })

  it('без расширенных полей подтверждённых фактов нет', () => {
    const laning = buildLaningStageData({ player_slot: 0, kills: 5, last_hits: 200 })
    expect(hasLaningFacts(laning)).toBe(false)
  })
})

describe('Иммутабельность, детерминизм и привязка к игроку', () => {
  it('исходный объект игрока не изменяется', () => {
    const raw = makeRawPlayer()
    const snapshot = JSON.stringify(raw)
    buildLaningStageData(raw)
    expect(JSON.stringify(raw)).toBe(snapshot)
  })

  it('одинаковый вход даёт идентичный результат', () => {
    const raw = makeRawPlayer()
    expect(JSON.stringify(buildLaningStageData(raw))).toBe(JSON.stringify(buildLaningStageData(raw)))
  })

  it('поля Task 6 сохраняются, а статистика за матч не подменяет интервал', () => {
    const match = normalizeMatch({
      match_id: 9007760151,
      duration: 2069,
      radiant_win: true,
      players: [
        {
          player_slot: 0,
          hero_id: 6,
          kills: 16,
          deaths: 3,
          assists: 15,
          gold_per_min: 619,
          xp_per_min: 786,
          last_hits: 238,
          lh_t: timelineAt15(86),
        },
      ],
    })
    const player = match.players[0]
    expect(player.player_slot).toBe(0)
    expect(player.team).toBe('radiant')
    expect(player.hero_id).toBe(6)
    expect(player.kills).toBe(16)
    expect(player.deaths).toBe(3)
    expect(player.assists).toBe(15)
    expect(player.gold_per_min).toBe(619)
    expect(player.xp_per_min).toBe(786)
    expect(player.last_hits).toBe(238)
    expect(player.laning.lastHits).toBe(86)
    expect(player.laning.lastHits).not.toBe(player.last_hits)
  })

  it('игрок без расширенных полей получает laning из null-значений и интервал 15 минут', () => {
    const match = normalizeMatch({ players: [{ player_slot: 128, kills: 5 }] })
    expect(match.players[0].purchaseLog).toBeNull()
    expect(match.players[0].laning).toEqual({
      interval: { minutes: 15, label: '00:00–15:00' },
      lastHits: null,
      gold: null,
      xp: null,
      killsFirst: null,
      deathsFirst: null,
      purchasesFirst: null,
      laneEfficiencyPct: null,
    })
  })

  it('данные ранней стадии привязаны к своему игроку', () => {
    const match = normalizeMatch({
      players: [
        { player_slot: 0, lh_t: timelineAt15(86), lane_efficiency_pct: 78 },
        { player_slot: 128, lh_t: timelineAt15(41), lane_efficiency_pct: 39 },
      ],
    })
    const radiant = match.players.find((player) => player.player_slot === 0)
    const dire = match.players.find((player) => player.player_slot === 128)
    expect(radiant?.laning.lastHits).toBe(86)
    expect(radiant?.laning.laneEfficiencyPct).toBe(78)
    expect(dire?.laning.lastHits).toBe(41)
    expect(dire?.laning.laneEfficiencyPct).toBe(39)
  })

  it('повторная нормализация того же ответа не изменяет данные других игроков', () => {
    const raw = {
      match_id: 9007760151,
      players: [
        { player_slot: 0, kills_log: [{ time: 100 }], lh_t: timelineAt15(5) },
        { player_slot: 128, kills_log: [{ time: 200 }, { time: 300 }], lh_t: timelineAt15(9) },
      ],
    }
    const before = JSON.stringify(normalizeMatch(raw))
    const after = JSON.stringify(normalizeMatch(raw))
    expect(after).toBe(before)
    const match = normalizeMatch(raw)
    expect(match.players[0].laning.killsFirst).toBe(1)
    expect(match.players[1].laning.killsFirst).toBe(2)
  })
})