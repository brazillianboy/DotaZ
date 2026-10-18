import { describe, expect, it } from 'vitest'

import { normalizeMatch } from './normalizeMatch'
import {
  LANING_INTERVAL_END_SECONDS,
  TEN_MINUTE_INDEX,
  buildLaningStageData,
  collectPurchasesInInterval,
  countEventsInInterval,
  extractTimelineValueAtMinute,
  hasLaningFacts,
  normalizeLaneEfficiencyPct,
} from './laning'

/**
 * Тесты стадии линии 00:00–10:00 (Task 8).
 * Все фикстуры синтетические и предназначены только для юнит-тестов;
 * семантика полей подтверждена живым ответом OpenDota (см. README).
 */

/** Синтетическая запись игрока с расширенными полями. */
function makeRawPlayer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    player_slot: 0,
    lh_t: [0, 3, 7, 10, 11, 17, 23, 28, 33, 40, 47, 53, 57],
    gold_t: [0, 287, 779, 1029, 1540, 1906, 2379, 2684, 3037, 3438, 3864, 4191, 4520],
    xp_t: [0, 118, 408, 765, 1068, 1306, 1792, 2074, 2380, 2661, 2907, 3201, 3501],
    kills_log: [
      { time: 102, key: 'npc_dota_hero_dark_seer' },
      { time: 182, key: 'npc_dota_hero_sharedder' },
    ],
    deaths_log: [{ time: 186, key: 'npc_dota_neutral_polar_furbolg_ursa_warrior' }],
    purchase_log: [
      { time: -89, key: 'magic_wand' },
      { time: 120, key: 'boots' },
      { time: 590, key: 'blink' },
      { time: 700, key: 'point_booster' },
    ],
    lane_efficiency_pct: 78,
    ...overrides,
  }
}

describe('Test 1 — полные валидные таймлайны', () => {
  it('извлекает значения на 10-й минуте для lh_t, gold_t, xp_t', () => {
    const laning = buildLaningStageData(makeRawPlayer())
    expect(laning.lastHitsAt10).toBe(47)
    expect(laning.goldAt10).toBe(3864)
    expect(laning.xpAt10).toBe(2907)
  })
})

describe('Test 2 — точное извлечение 10-й минуты', () => {
  it('использует индекс 10 (значение не путается с соседними)', () => {
    const series = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
    expect(TEN_MINUTE_INDEX).toBe(10)
    expect(extractTimelineValueAtMinute(series, TEN_MINUTE_INDEX)).toBe(20)
  })
})

describe('Test 3 — off-by-one в индексации', () => {
  it('массив длиной 11 не содержит 10-й минуты (индексы 0..10)', () => {
    const seriesOfEleven = Array.from({ length: 11 }, (_, index) => index)
    expect(extractTimelineValueAtMinute(seriesOfEleven, TEN_MINUTE_INDEX)).toBe(10)
  })

  it('массив длиной 10 (индексы 0..9) не даёт значения 10-й минуты', () => {
    const seriesOfTen = Array.from({ length: 10 }, (_, index) => index)
    expect(extractTimelineValueAtMinute(seriesOfTen, TEN_MINUTE_INDEX)).toBeNull()
  })

  it('индекс 0 соответствует началу матча', () => {
    expect(extractTimelineValueAtMinute([0, 5, 9], 0)).toBe(0)
  })
})

describe('Test 4 — легитимные нули', () => {
  it('нулевые значения сохраняются', () => {
    const laning = buildLaningStageData({
      lh_t: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      gold_t: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      xp_t: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      kills_log: [],
      deaths_log: [],
      purchase_log: [],
      lane_efficiency_pct: 0,
    })
    expect(laning.lastHitsAt10).toBe(0)
    expect(laning.goldAt10).toBe(0)
    expect(laning.xpAt10).toBe(0)
    expect(laning.killsFirst10).toBe(0)
    expect(laning.deathsFirst10).toBe(0)
    expect(laning.purchasesFirst10).toEqual([])
    expect(laning.laneEfficiencyPct).toBe(0)
  })
})

describe('Test 5 — отсутствующие таймлайны', () => {
  it('отсутствующие массивы дают null, а не 0', () => {
    const laning = buildLaningStageData({ player_slot: 0 })
    expect(laning.lastHitsAt10).toBeNull()
    expect(laning.goldAt10).toBeNull()
    expect(laning.xpAt10).toBeNull()
  })

  it('не-массив вместо таймлайна → null', () => {
    expect(extractTimelineValueAtMinute('47', TEN_MINUTE_INDEX)).toBeNull()
    expect(extractTimelineValueAtMinute(null, TEN_MINUTE_INDEX)).toBeNull()
    expect(extractTimelineValueAtMinute(47, TEN_MINUTE_INDEX)).toBeNull()
  })
})

describe('Test 6 — пустые таймлайны', () => {
  it('пустой массив → null (данных нет)', () => {
    expect(extractTimelineValueAtMinute([], TEN_MINUTE_INDEX)).toBeNull()
  })
})

describe('Test 7 — короткие таймлайны', () => {
  it('массив короче 11 элементов → null', () => {
    expect(extractTimelineValueAtMinute([1, 2, 3], TEN_MINUTE_INDEX)).toBeNull()
  })

  it('экстраполяция не выполняется', () => {
    const shortSeries = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    expect(extractTimelineValueAtMinute(shortSeries, 10)).toBeNull()
  })
})

describe('Test 8 — некорректные элементы массива', () => {
  it('нечисловые и нефинитные значения на 10-м индексе → null', () => {
    const invalidSeries = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, '47']
    expect(extractTimelineValueAtMinute(invalidSeries, TEN_MINUTE_INDEX)).toBeNull()

    const nanSeries = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, Number.NaN]
    expect(extractTimelineValueAtMinute(nanSeries, TEN_MINUTE_INDEX)).toBeNull()

    const infiniteSeries = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, Number.POSITIVE_INFINITY]
    expect(extractTimelineValueAtMinute(infiniteSeries, TEN_MINUTE_INDEX)).toBeNull()
  })
})

describe('Test 9 — отсутствующие журналы событий', () => {
  it('отсутствующий kills_log/deaths_log → null (не 0)', () => {
    const laning = buildLaningStageData({ player_slot: 0 })
    expect(laning.killsFirst10).toBeNull()
    expect(laning.deathsFirst10).toBeNull()
  })

  it('не-массив вместо журнала → null', () => {
    expect(countEventsInInterval(null)).toBeNull()
    expect(countEventsInInterval('log')).toBeNull()
    expect(countEventsInInterval({})).toBeNull()
  })
})

describe('Test 10 — доступные пустые журналы', () => {
  it('пустой журнал → 0 событий (лог получен)', () => {
    expect(countEventsInInterval([])).toBe(0)
    const laning = buildLaningStageData({ kills_log: [], deaths_log: [] })
    expect(laning.killsFirst10).toBe(0)
    expect(laning.deathsFirst10).toBe(0)
  })
})

describe('Test 11 — убийства в интервале', () => {
  it('считает события с time в 0..600 включительно', () => {
    const log = [{ time: 0 }, { time: 102 }, { time: 599 }]
    expect(countEventsInInterval(log)).toBe(3)
  })
})

describe('Test 12 — убийства вне интервала', () => {
  it('события после 10:00 не учитываются', () => {
    const log = [{ time: 102 }, { time: 601 }, { time: 900 }, { time: 2069 }]
    expect(countEventsInInterval(log)).toBe(1)
  })
})

describe('Test 13 — смерти в интервале', () => {
  it('считает смерти первых десяти минут', () => {
    const laning = buildLaningStageData({
      deaths_log: [{ time: 186, key: 'npc' }, { time: 420, key: 'npc' }],
    })
    expect(laning.deathsFirst10).toBe(2)
  })
})

describe('Test 14 — смерти вне интервала', () => {
  it('смерти после 10:00 не входят в отчёт', () => {
    const laning = buildLaningStageData({
      deaths_log: [{ time: 186 }, { time: 1092 }, { time: 1625 }],
    })
    expect(laning.deathsFirst10).toBe(1)
  })
})

describe('Test 15 — события ровно на границах интервала', () => {
  it('time = 0 включается, time = 600 включается, time = 601 исключается', () => {
    const log = [{ time: 0 }, { time: 600 }, { time: 601 }]
    expect(countEventsInInterval(log)).toBe(2)
    expect(LANING_INTERVAL_END_SECONDS).toBe(600)
  })

  it('отрицательное время (до начала матча) исключается из интервала', () => {
    const log = [{ time: -89 }, { time: -1 }, { time: 0 }, { time: 100 }]
    expect(countEventsInInterval(log)).toBe(2)
  })
})

describe('Test 16 — некорректные отметки времени', () => {
  it('журнал с невалидным time считается недостоверным → null', () => {
    expect(countEventsInInterval([{ time: 102 }, { time: 'later' }])).toBeNull()
    expect(countEventsInInterval([{ time: 102 }, {}])).toBeNull()
    expect(countEventsInInterval([{ time: 102 }, null])).toBeNull()
    expect(countEventsInInterval([{ time: Number.NaN }])).toBeNull()
  })

  it('недостоверный журнал не превращается в ноль в модели', () => {
    const laning = buildLaningStageData({ kills_log: [{ time: 'x' }] })
    expect(laning.killsFirst10).toBeNull()
  })
})

describe('Test 17 — отсутствующие журналы покупок', () => {
  it('отсутствующий purchase_log → null (данных нет)', () => {
    expect(collectPurchasesInInterval(undefined)).toBeNull()
    const laning = buildLaningStageData({ player_slot: 0 })
    expect(laning.purchasesFirst10).toBeNull()
  })
})

describe('Test 18 — доступные пустые журналы покупок', () => {
  it('пустой журнал → [] (покупок в интервале нет, лог получен)', () => {
    expect(collectPurchasesInInterval([])).toEqual([])
    const laning = buildLaningStageData({ purchase_log: [] })
    expect(laning.purchasesFirst10).toEqual([])
  })
})

describe('Test 19 — покупки в интервале', () => {
  it('включает записи 0..600 и сохраняет ключи предметов как есть', () => {
    const log = [
      { time: 0, key: 'tango' },
      { time: 120, key: 'boots' },
      { time: 600, key: 'magic_wand' },
    ]
    expect(collectPurchasesInInterval(log)).toEqual([
      { time: 0, key: 'tango' },
      { time: 120, key: 'boots' },
      { time: 600, key: 'magic_wand' },
    ])
  })
})

describe('Test 20 — покупки вне интервала', () => {
  it('исключает события после 10:00 и предматчевые записи (time < 0)', () => {
    const log = [
      { time: -89, key: 'magic_wand' },
      { time: 120, key: 'boots' },
      { time: 601, key: 'point_booster' },
      { time: 1500, key: 'black_king_bar' },
    ]
    expect(collectPurchasesInInterval(log)).toEqual([{ time: 120, key: 'boots' }])
  })
})

describe('Test 21 — некорректные покупки', () => {
  it('невалидные записи делают журнал недостоверным → null', () => {
    expect(collectPurchasesInInterval([{ time: 120 }])).toBeNull()
    expect(collectPurchasesInInterval([{ time: 120, key: '' }])).toBeNull()
    expect(collectPurchasesInInterval([{ time: 'soon', key: 'boots' }])).toBeNull()
    expect(collectPurchasesInInterval([null])).toBeNull()
    expect(collectPurchasesInInterval('log')).toBeNull()
  })
})

describe('Test 22 — отсутствующая эффективность линии', () => {
  it('отсутствующее значение → null (не 0)', () => {
    expect(normalizeLaneEfficiencyPct(undefined)).toBeNull()
    const laning = buildLaningStageData({ player_slot: 0 })
    expect(laning.laneEfficiencyPct).toBeNull()
  })
})

describe('Test 23 — валидная эффективность линии', () => {
  it('принимает значения шкалы 0–100 и сохраняет ноль', () => {
    expect(normalizeLaneEfficiencyPct(78)).toBe(78)
    expect(normalizeLaneEfficiencyPct(0)).toBe(0)
    expect(normalizeLaneEfficiencyPct(100)).toBe(100)
    expect(buildLaningStageData({ lane_efficiency_pct: 49 }).laneEfficiencyPct).toBe(49)
  })
})

describe('Test 24 — некорректная эффективность линии', () => {
  it('отклоняет нечисла, NaN, Infinity и значения вне 0–100', () => {
    expect(normalizeLaneEfficiencyPct('78')).toBeNull()
    expect(normalizeLaneEfficiencyPct(Number.NaN)).toBeNull()
    expect(normalizeLaneEfficiencyPct(Number.POSITIVE_INFINITY)).toBeNull()
    expect(normalizeLaneEfficiencyPct(-1)).toBeNull()
    expect(normalizeLaneEfficiencyPct(101)).toBeNull()
  })
})

describe('Test 25 — частичная доступность данных', () => {
  it('доступны золото и убийства, отсутствуют опыт, покупки и эффективность', () => {
    const laning = buildLaningStageData({
      gold_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1234],
      kills_log: [{ time: 300 }],
    })
    expect(laning.goldAt10).toBe(1234)
    expect(laning.killsFirst10).toBe(1)
    expect(laning.xpAt10).toBeNull()
    expect(laning.lastHitsAt10).toBeNull()
    expect(laning.purchasesFirst10).toBeNull()
    expect(laning.laneEfficiencyPct).toBeNull()
    expect(hasLaningFacts(laning)).toBe(true)
  })

  it('полностью отсутствующие расширенные поля → нет подтверждённых фактов', () => {
    const laning = buildLaningStageData({ player_slot: 0, kills: 5, last_hits: 200 })
    expect(hasLaningFacts(laning)).toBe(false)
  })
})

describe('Test 26 — иммутабельность входа', () => {
  it('исходный объект игрока не изменяется', () => {
    const raw = makeRawPlayer()
    const snapshot = JSON.stringify(raw)
    buildLaningStageData(raw)
    expect(JSON.stringify(raw)).toBe(snapshot)
  })
})

describe('Test 27 — детерминизм', () => {
  it('одинаковый вход даёт идентичный результат', () => {
    const raw = makeRawPlayer()
    expect(JSON.stringify(buildLaningStageData(raw))).toBe(
      JSON.stringify(buildLaningStageData(raw)),
    )
  })
})

describe('Test 28 — поля Task 6 остаются без изменений', () => {
  it('нормализация матча сохраняет прежние поля игрока и добавляет laning', () => {
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
          lh_t: [0, 3, 7, 10, 11, 17, 23, 28, 33, 40, 47],
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
    // Новое поле Task 8 не подменяет статистику за матч.
    expect(player.laning.lastHitsAt10).toBe(47)
    expect(player.laning.lastHitsAt10).not.toBe(player.last_hits)
  })

  it('игрок без расширенных полей получает laning из null-значений', () => {
    const match = normalizeMatch({ players: [{ player_slot: 128, kills: 5 }] })
    expect(match.players[0].laning).toEqual({
      lastHitsAt10: null,
      goldAt10: null,
      xpAt10: null,
      killsFirst10: null,
      deathsFirst10: null,
      purchasesFirst10: null,
      laneEfficiencyPct: null,
    })
  })
})

describe('Test 29 — данные стадии линии привязаны к своему игроку', () => {
  it('у каждого участника свои значения, взятые из его записи', () => {
    const match = normalizeMatch({
      players: [
        { player_slot: 0, lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 47], lane_efficiency_pct: 78 },
        { player_slot: 128, lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12], lane_efficiency_pct: 39 },
      ],
    })
    const radiant = match.players.find((player) => player.player_slot === 0)
    const dire = match.players.find((player) => player.player_slot === 128)
    expect(radiant?.laning.lastHitsAt10).toBe(47)
    expect(radiant?.laning.laneEfficiencyPct).toBe(78)
    expect(dire?.laning.lastHitsAt10).toBe(12)
    expect(dire?.laning.laneEfficiencyPct).toBe(39)
  })
})

describe('Test 30 — переключение игрока не меняет данные матча', () => {
  it('повторная нормализация того же ответа не изменяет данные других игроков', () => {
    const raw = {
      match_id: 9007760151,
      players: [
        { player_slot: 0, kills_log: [{ time: 100 }], lh_t: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5] },
        { player_slot: 128, kills_log: [{ time: 200 }, { time: 300 }], lh_t: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9] },
      ],
    }
    const before = JSON.stringify(normalizeMatch(raw))
    // Имитация переключения выбранного игрока: данные матча пересчитываются из того же ответа.
    const after = JSON.stringify(normalizeMatch(raw))
    expect(after).toBe(before)
    const match = normalizeMatch(raw)
    expect(match.players[0].laning.killsFirst10).toBe(1)
    expect(match.players[1].laning.killsFirst10).toBe(2)
  })
})