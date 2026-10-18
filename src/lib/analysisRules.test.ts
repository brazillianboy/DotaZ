import { describe, expect, it } from 'vitest'

import {
  ANALYSIS_RULE_IDS,
  ANALYSIS_RULES_VERSION,
  PERIOD_LANING,
  PERIOD_MATCH,
  RECOMMENDATIONS_UNAVAILABLE_NOTE,
  analyzePlayer,
} from './analysisRules'
import { normalizeMatch } from './normalizeMatch'
import type { NormalizedMatch, NormalizedPlayer } from '../types/match'

/**
 * Тесты движка наблюдений и рекомендаций (Task 9).
 * Фикстуры синтетические и предназначены только для юнит-тестов.
 */

/** Полный набор расширенных полей игрока (значения синтетические). */
const RAW_FULL_PLAYER = {
  player_slot: 0,
  hero_id: 6,
  kills: 16,
  deaths: 3,
  assists: 15,
  gold_per_min: 619,
  xp_per_min: 786,
  last_hits: 238,
  lh_t: [0, 3, 7, 10, 11, 17, 23, 28, 33, 40, 47],
  gold_t: [0, 287, 779, 1029, 1540, 1906, 2379, 2684, 3037, 3438, 3864],
  xp_t: [0, 118, 408, 765, 1068, 1306, 1792, 2074, 2380, 2661, 2907],
  kills_log: [{ time: 102 }, { time: 182 }, { time: 540 }, { time: 900 }],
  deaths_log: [{ time: 186 }, { time: 1500 }],
  purchase_log: [
    { time: -89, key: 'magic_wand' },
    { time: 120, key: 'boots' },
    { time: 590, key: 'blink' },
    { time: 700, key: 'point_booster' },
  ],
  lane_efficiency_pct: 78,
}

function buildMatch(playersRaw: unknown[]): NormalizedMatch {
  return normalizeMatch({
    match_id: 9007760151,
    duration: 2069,
    radiant_win: true,
    players: playersRaw,
  })
}

function firstPlayer(match: NormalizedMatch): NormalizedPlayer {
  return match.players[0]
}

describe('Test 1 — версия правил', () => {
  it('использует единую версию правил во всех результатах', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(ANALYSIS_RULES_VERSION).toBe('1.0.0')
    expect(analysis.rule_version).toBe(ANALYSIS_RULES_VERSION)
    for (const observation of analysis.observations) {
      expect(observation.rule_version).toBe(ANALYSIS_RULES_VERSION)
    }
  })
})

describe('Test 2 — стабильные идентификаторы правил', () => {
  it('наблюдения используют объявленные rule_id', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const ids = analyzePlayer(match, firstPlayer(match)).observations.map((o) => o.rule_id)
    expect(ids).toContain(ANALYSIS_RULE_IDS.matchKda)
    expect(ids).toContain(ANALYSIS_RULE_IDS.lastHitsAt10)
    expect(ids).toContain(ANALYSIS_RULE_IDS.laningKillsDeaths)
    expect(ids).toContain(ANALYSIS_RULE_IDS.goldAt10)
    expect(ids).toContain(ANALYSIS_RULE_IDS.xpAt10)
    expect(ids).toContain(ANALYSIS_RULE_IDS.purchasesFirst10)
    expect(ids).toContain(ANALYSIS_RULE_IDS.laneEfficiencyPct)
  })
})

describe('Test 3 — принадлежность наблюдений участнику', () => {
  it('player_slot в наблюдениях совпадает с выбранным игроком', () => {
    const match = buildMatch([
      RAW_FULL_PLAYER,
      { player_slot: 128, kills: 1, deaths: 2, assists: 3 },
    ])
    const dire = match.players[1]
    const analysis = analyzePlayer(match, dire)
    expect(analysis.player_slot).toBe(128)
    for (const observation of analysis.observations) {
      expect(observation.player_slot).toBe(128)
    }
  })
})

describe('Test 4 — K/D/A за весь матч', () => {
  it('формирует наблюдение с тремя подтверждениями и периодом «весь матч»', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const observation = analyzePlayer(match, firstPlayer(match)).observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.matchKda,
    )
    expect(observation).toBeDefined()
    expect(observation?.period).toBe(PERIOD_MATCH)
    expect(observation?.source).toBe('OpenDota')
    expect(observation?.text).toContain('16')
    expect(observation?.text).toContain('15')
    expect(observation?.evidence.map((e) => e.field)).toEqual(['kills', 'deaths', 'assists'])
    expect(observation?.evidence.map((e) => e.value)).toEqual([16, 3, 15])
  })
})

describe('Test 5 — легитимные нули K/D/A', () => {
  it('нули сохраняются и не подменяются отсутствием данных', () => {
    const match = buildMatch([{ player_slot: 0, kills: 0, deaths: 0, assists: 0 }])
    const observation = analyzePlayer(match, firstPlayer(match)).observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.matchKda,
    )
    expect(observation).toBeDefined()
    expect(observation?.evidence.map((e) => e.value)).toEqual([0, 0, 0])
  })
})

describe('Test 6 — отсутствующие значения K/D/A', () => {
  it('полное отсутствие полей → ограничение и нет наблюдения', () => {
    const match = buildMatch([{ player_slot: 0 }])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.matchKda)).toBe(false)
    expect(analysis.limitations.map((l) => l.code)).toContain('match.kda.missing')
  })

  it('частичные данные → отдельное ограничение', () => {
    const match = buildMatch([{ player_slot: 0, kills: 5 }])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.matchKda)).toBe(false)
    expect(analysis.limitations.map((l) => l.code)).toContain('match.kda.partial')
  })
})

describe('Test 7 — добивания к 10:00', () => {
  it('использует lh_t[10] и период 00:00–10:00', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const observation = analyzePlayer(match, firstPlayer(match)).observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.lastHitsAt10,
    )
    expect(observation?.period).toBe(PERIOD_LANING)
    expect(observation?.evidence).toEqual([
      { field: 'lh_t[10]', value: 47, period: PERIOD_LANING, source: 'OpenDota' },
    ])
  })
})

describe('Test 8 — отсутствующие добивания к 10:00', () => {
  it('без ряда lh_t наблюдения нет, есть ограничение', () => {
    const match = buildMatch([{ player_slot: 0, last_hits: 238 }])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.lastHitsAt10)).toBe(false)
    expect(analysis.limitations.map((l) => l.code)).toContain('laning.last_hits_at_10.missing')
  })
})

describe('Test 9 — золото к 10:00', () => {
  it('формирует наблюдение по gold_t[10]', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const observation = analyzePlayer(match, firstPlayer(match)).observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.goldAt10,
    )
    expect(observation?.evidence).toEqual([
      { field: 'gold_t[10]', value: 3864, period: PERIOD_LANING, source: 'OpenDota' },
    ])
  })
})

describe('Test 10 — опыт к 10:00', () => {
  it('формирует наблюдение по xp_t[10]', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const observation = analyzePlayer(match, firstPlayer(match)).observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.xpAt10,
    )
    expect(observation?.evidence).toEqual([
      { field: 'xp_t[10]', value: 2907, period: PERIOD_LANING, source: 'OpenDota' },
    ])
  })
})

describe('Test 11 — частичная доступность золота и опыта', () => {
  it('золото есть, опыта нет: одно наблюдение и соответствующее ограничение', () => {
    const match = buildMatch([
      { player_slot: 0, gold_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1234] },
    ])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.goldAt10)).toBe(true)
    expect(analysis.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.xpAt10)).toBe(false)
    expect(analysis.limitations.map((l) => l.code)).toContain('laning.xp_at_10.missing')
  })
})

describe('Test 12 — убийства и смерти первых десяти минут', () => {
  it('учитывает только события интервала и сохраняет оба подтверждения', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const observation = analyzePlayer(match, firstPlayer(match)).observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.laningKillsDeaths,
    )
    // kills_log: 102, 182, 540 в интервале (900 — вне); deaths_log: 186 (1500 — вне).
    expect(observation?.evidence.map((e) => e.value)).toEqual([3, 1])
    expect(observation?.period).toBe(PERIOD_LANING)
  })
})

describe('Test 13 — отсутствующие журналы событий', () => {
  it('нет журналов → наблюдения нет, есть ограничение', () => {
    const match = buildMatch([{ player_slot: 0, kills: 10, deaths: 2 }])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.laningKillsDeaths)).toBe(false)
    expect(analysis.limitations.map((l) => l.code)).toContain('laning.events.missing')
  })
})

describe('Test 14 — легитимные нулевые события', () => {
  it('пустые журналы дают наблюдение с нулями', () => {
    const match = buildMatch([{ player_slot: 0, kills_log: [], deaths_log: [] }])
    const observation = analyzePlayer(match, firstPlayer(match)).observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.laningKillsDeaths,
    )
    expect(observation?.evidence.map((e) => e.value)).toEqual([0, 0])
  })
})

describe('Test 15 — пустой доступный журнал покупок', () => {
  it('пустой журнал даёт наблюдение о нуле покупок', () => {
    const match = buildMatch([{ player_slot: 0, purchase_log: [] }])
    const observation = analyzePlayer(match, firstPlayer(match)).observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.purchasesFirst10,
    )
    expect(observation?.evidence[0].value).toBe(0)
    expect(observation?.text).toContain('0')
  })
})

describe('Test 16 — отсутствующий журнал покупок', () => {
  it('нет журнала → наблюдения о покупках нет, ноль не выдумывается', () => {
    const match = buildMatch([{ player_slot: 0, lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 47] }])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.purchasesFirst10)).toBe(false)
    expect(analysis.limitations.map((l) => l.code)).toContain('laning.purchases.missing')
  })
})

describe('Test 17 — корректный подсчёт покупок', () => {
  it('учитывает только записи интервала 00:00–10:00', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const observation = analyzePlayer(match, firstPlayer(match)).observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.purchasesFirst10,
    )
    // Предматчевая (-89) и запись после 10:00 (700) исключены.
    expect(observation?.evidence[0].value).toBe(2)
  })
})

describe('Test 18 — эффективность линии с валидным значением', () => {
  it('показывает значение провайдера с явной атрибуцией', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const observation = analyzePlayer(match, firstPlayer(match)).observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.laneEfficiencyPct,
    )
    expect(observation?.evidence[0]).toEqual({
      field: 'lane_efficiency_pct',
      value: 78,
      period: PERIOD_LANING,
      source: 'OpenDota',
    })
    expect(observation?.text).toContain('OpenDota')
    expect(observation?.text).toContain('провайдера')
  })
})

describe('Test 19 — отсутствующая эффективность линии', () => {
  it('нет значения → наблюдения нет, есть ограничение', () => {
    const match = buildMatch([{ player_slot: 0, lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 47] }])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.laneEfficiencyPct)).toBe(false)
    expect(analysis.limitations.map((l) => l.code)).toContain('laning.efficiency_pct.missing')
  })
})

describe('Test 20 — некорректные или недоверенные данные', () => {
  it('битые значения не создают наблюдений и не превращаются в нули', () => {
    const match = buildMatch([
      {
        player_slot: 0,
        kills: '16',
        lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, '47'],
        gold_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, Number.NaN],
        kills_log: [{ time: 'soon' }],
        purchase_log: [{ time: 'later', key: 'boots' }],
        lane_efficiency_pct: 150,
      },
    ])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.observations).toEqual([])
    expect(analysis.hasObservations).toBe(false)
    expect(analysis.limitations.map((l) => l.code)).toContain('match.kda.missing')
    expect(analysis.limitations.map((l) => l.code)).toContain('laning.last_hits_at_10.missing')
  })
})

describe('Test 21 — нет наблюдений при полном отсутствии данных', () => {
  it('пустой игрок → hasObservations=false и ограничения', () => {
    const match = buildMatch([{ player_slot: 0 }])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.hasObservations).toBe(false)
    expect(analysis.observations).toEqual([])
    expect(analysis.limitations.length).toBeGreaterThan(0)
  })
})

describe('Test 22 — содержательные ограничения при частичных данных', () => {
  it('каждое отсутствующее поле даёт своё ограничение, не отменяя остальные факты', () => {
    const match = buildMatch([
      { player_slot: 0, kills: 1, deaths: 2, assists: 3, lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 47] },
    ])
    const analysis = analyzePlayer(match, firstPlayer(match))
    const codes = analysis.limitations.map((l) => l.code)
    expect(codes).toContain('laning.events.missing')
    expect(codes).toContain('laning.gold_at_10.missing')
    expect(codes).toContain('laning.xp_at_10.missing')
    expect(codes).toContain('laning.purchases.missing')
    expect(codes).toContain('laning.efficiency_pct.missing')
    expect(codes).toContain('benchmarks.hero_role_missing')
    // Доступные факты при этом сохранены.
    expect(analysis.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.matchKda)).toBe(true)
    expect(analysis.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.lastHitsAt10)).toBe(true)
  })
})

describe('Test 23 — пустой список рекомендаций без обоснованных правил', () => {
  it('рекомендации пусты и сопровождаются честным пояснением', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.recommendations).toEqual([])
    expect(analysis.recommendationsNote).toBe(RECOMMENDATIONS_UNAVAILABLE_NOTE)
    expect(analysis.recommendationsNote).toContain('нормы героя и роли')
  })
})

describe('Test 24 — нет неподтверждённых суждений о герое и роли', () => {
  it('тексты наблюдений не содержат оценок и сравнений с нормативами', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const analysis = analyzePlayer(match, firstPlayer(match))
    const forbidden = ['хорош', 'плох', 'ошибк', 'норма', 'средн', 'высок', 'низк', 'провал', 'успешн']
    for (const observation of analysis.observations) {
      const text = observation.text.toLowerCase()
      for (const word of forbidden) {
        expect(text).not.toContain(word)
      }
    }
    expect(analysis.recommendations).toHaveLength(0)
  })
})

describe('Test 25 — нет выдуманных пороговых значений', () => {
  it('в наблюдениях нет порогов вида «минимум», «не менее», «должен»', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const analysis = analyzePlayer(match, firstPlayer(match))
    for (const observation of analysis.observations) {
      const text = observation.text.toLowerCase()
      expect(text).not.toContain('минимум')
      expect(text).not.toContain('не менее')
      expect(text).not.toContain('должен')
      expect(text).not.toContain('рекоменду')
    }
  })
})

describe('Test 26 — подтверждения совпадают с нормализованными данными', () => {
  it('значения evidence равны значениям модели', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const player = firstPlayer(match)
    const analysis = analyzePlayer(match, player)
    const byField = new Map<string, number | string | boolean>()
    for (const observation of analysis.observations) {
      for (const item of observation.evidence) {
        byField.set(item.field, item.value)
      }
    }
    expect(byField.get('kills')).toBe(player.kills)
    expect(byField.get('deaths')).toBe(player.deaths)
    expect(byField.get('assists')).toBe(player.assists)
    expect(byField.get('lh_t[10]')).toBe(player.laning.lastHitsAt10)
    expect(byField.get('gold_t[10]')).toBe(player.laning.goldAt10)
    expect(byField.get('xp_t[10]')).toBe(player.laning.xpAt10)
    expect(byField.get('lane_efficiency_pct')).toBe(player.laning.laneEfficiencyPct)
  })
})

describe('Test 27 — различие показателей матча и первых десяти минут', () => {
  it('добивания к 10:00 не равны last_hits за матч и имеют другой период', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const player = firstPlayer(match)
    const analysis = analyzePlayer(match, player)
    const observation = analysis.observations.find(
      (o) => o.rule_id === ANALYSIS_RULE_IDS.lastHitsAt10,
    )
    expect(player.laning.lastHitsAt10).toBe(47)
    expect(player.last_hits).toBe(238)
    expect(observation?.evidence[0].value).not.toBe(player.last_hits)
    expect(observation?.period).toBe(PERIOD_LANING)
    expect(
      analysis.observations.find((o) => o.rule_id === ANALYSIS_RULE_IDS.matchKda)?.period,
    ).toBe(PERIOD_MATCH)
  })
})

describe('Test 28 — повторные вызовы дают идентичный результат', () => {
  it('детерминизм при одинаковом входе', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const player = firstPlayer(match)
    expect(JSON.stringify(analyzePlayer(match, player))).toBe(
      JSON.stringify(analyzePlayer(match, player)),
    )
  })
})

describe('Test 29 — входные объекты не изменяются', () => {
  it('match и player остаются прежними', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const player = firstPlayer(match)
    const matchSnapshot = JSON.stringify(match)
    const playerSnapshot = JSON.stringify(player)
    analyzePlayer(match, player)
    expect(JSON.stringify(match)).toBe(matchSnapshot)
    expect(JSON.stringify(player)).toBe(playerSnapshot)
  })
})

describe('Test 30 — независимые результаты для разных игроков', () => {
  it('у каждого участника свои наблюдения', () => {
    const match = buildMatch([
      RAW_FULL_PLAYER,
      {
        player_slot: 128,
        kills: 1,
        deaths: 9,
        assists: 2,
        lh_t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      },
    ])
    const radiant = analyzePlayer(match, match.players[0])
    const dire = analyzePlayer(match, match.players[1])
    expect(radiant.player_slot).toBe(0)
    expect(dire.player_slot).toBe(128)
    const radiantLh = radiant.observations.find((o) => o.rule_id === ANALYSIS_RULE_IDS.lastHitsAt10)
    const direLh = dire.observations.find((o) => o.rule_id === ANALYSIS_RULE_IDS.lastHitsAt10)
    expect(radiantLh?.evidence[0].value).toBe(47)
    expect(direLh?.evidence[0].value).toBe(12)
    expect(dire.observations.some((o) => o.rule_id === ANALYSIS_RULE_IDS.matchKda)).toBe(true)
  })
})

describe('Test 31 — обработка некорректного выбора игрока', () => {
  it('участник не из матча → анализ не выполняется, без исключений', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const stranger = normalizeMatch({ players: [{ player_slot: 200, kills: 1 }] }).players[0]
    const analysis = analyzePlayer(match, stranger)
    expect(analysis.observations).toEqual([])
    expect(analysis.hasObservations).toBe(false)
    expect(analysis.limitations.map((l) => l.code)).toEqual(['player.not_in_match'])
    expect(analysis.recommendationsNote).toBe(RECOMMENDATIONS_UNAVAILABLE_NOTE)
  })
})

describe('Test 32 — предсказуемый порядок наблюдений и ограничений', () => {
  it('наблюдения идут в фиксированном порядке правил', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const analysis = analyzePlayer(match, firstPlayer(match))
    expect(analysis.observations.map((o) => o.rule_id)).toEqual([
      ANALYSIS_RULE_IDS.matchKda,
      ANALYSIS_RULE_IDS.lastHitsAt10,
      ANALYSIS_RULE_IDS.laningKillsDeaths,
      ANALYSIS_RULE_IDS.goldAt10,
      ANALYSIS_RULE_IDS.xpAt10,
      ANALYSIS_RULE_IDS.purchasesFirst10,
      ANALYSIS_RULE_IDS.laneEfficiencyPct,
    ])
    expect(analysis.limitations.map((l) => l.code)).toEqual(['benchmarks.hero_role_missing'])
  })
})

describe('Test 33 — результат сериализуем в JSON', () => {
  it('JSON.stringify не теряет данные и не падает', () => {
    const match = buildMatch([RAW_FULL_PLAYER])
    const analysis = analyzePlayer(match, firstPlayer(match))
    const json = JSON.stringify(analysis)
    expect(json.length).toBeGreaterThan(0)
    const parsed = JSON.parse(json) as typeof analysis
    expect(parsed.rule_version).toBe(ANALYSIS_RULES_VERSION)
    expect(parsed.observations).toHaveLength(analysis.observations.length)
    expect(parsed.observations[0].evidence[0].source).toBe('OpenDota')
  })
})