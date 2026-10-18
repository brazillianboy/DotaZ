import { describe, expect, it } from 'vitest'

import fixture from '../../samples/match-.json'
import { normalizeMatch, normalizeMatchId, teamFromPlayerSlot } from './normalizeMatch'

/** Мини-конструктор участника для юнит-тестов (значения синтетические). */
function makePlayer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    player_slot: 0,
    hero_id: 1,
    kills: 1,
    deaths: 1,
    assists: 1,
    gold_per_min: 100,
    xp_per_min: 100,
    last_hits: 10,
    ...overrides,
  }
}

describe('Test 1 — полный валидный матч', () => {
  it('сохраняет ID, длительность, победителя, игроков и статистику', () => {
    const match = normalizeMatch({
      match_id: 9007760151,
      duration: 2069,
      radiant_win: true,
      players: [
        makePlayer({ player_slot: 0, kills: 6, deaths: 8, assists: 18 }),
        makePlayer({ player_slot: 128, kills: 12, deaths: 2, assists: 5 }),
      ],
    })

    expect(match.match_id).toBe('9007760151')
    expect(match.duration).toBe(2069)
    expect(match.radiant_win).toBe(true)
    expect(match.players).toHaveLength(2)
    expect(match.players[0]).toEqual({
      player_slot: 0,
      team: 'radiant',
      hero_id: 1,
      kills: 6,
      deaths: 8,
      assists: 18,
      gold_per_min: 100,
      xp_per_min: 100,
      last_hits: 10,
      laning: {
        lastHitsAt10: null,
        goldAt10: null,
        xpAt10: null,
        killsFirst10: null,
        deathsFirst10: null,
        purchasesFirst10: null,
        laneEfficiencyPct: null,
      },
    })
    expect(match.players[1].team).toBe('dire')
  })
})

describe('Test 2 — сторона Radiant', () => {
  it.each([
    [0, 'radiant'],
    [1, 'radiant'],
    [127, 'radiant'],
  ])('player_slot %i → %s', (slot, team) => {
    expect(teamFromPlayerSlot(slot)).toBe(team)
  })
})

describe('Test 3 — сторона Dire', () => {
  it.each([
    [128, 'dire'],
    [129, 'dire'],
    [255, 'dire'],
  ])('player_slot %i → %s', (slot, team) => {
    expect(teamFromPlayerSlot(slot)).toBe(team)
  })
})

describe('Test 4 — некорректные слоты', () => {
  it.each([
    [-1],
    [-128],
    [256],
    [300],
    [0.5],
    [127.5],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    ['0'],
    ['abc'],
    [null],
    [undefined],
    [true],
    [{}],
  ])('слот %s не даёт выдуманной команды', (slot) => {
    expect(teamFromPlayerSlot(slot)).toBeNull()
  })

  it('запись без целочисленного слота исключается из массива', () => {
    const match = normalizeMatch({
      players: [makePlayer({ player_slot: undefined }), makePlayer({ player_slot: 5 })],
    })
    expect(match.players).toHaveLength(1)
    expect(match.players[0].player_slot).toBe(5)
  })

  it('запись с целым слотом вне диапазона сохраняется, но team = null', () => {
    const match = normalizeMatch({ players: [makePlayer({ player_slot: 300 })] })
    expect(match.players).toHaveLength(1)
    expect(match.players[0].team).toBeNull()
  })
})

describe('Test 5 — легитимный ноль', () => {
  it('нули в статистике игрока сохраняются', () => {
    const match = normalizeMatch({
      players: [
        makePlayer({
          kills: 0,
          deaths: 0,
          assists: 0,
          last_hits: 0,
          gold_per_min: 0,
          xp_per_min: 0,
          hero_id: 0,
        }),
      ],
    })
    const player = match.players[0]
    expect(player.kills).toBe(0)
    expect(player.deaths).toBe(0)
    expect(player.assists).toBe(0)
    expect(player.last_hits).toBe(0)
    expect(player.gold_per_min).toBe(0)
    expect(player.xp_per_min).toBe(0)
    expect(player.hero_id).toBe(0)
  })

  it('duration = 0 сохраняется как ноль', () => {
    expect(normalizeMatch({ duration: 0 }).duration).toBe(0)
  })
})

describe('Test 6 — отсутствующие статистики', () => {
  it('недостающие поля становятся null, а не нулём', () => {
    const match = normalizeMatch({ players: [{ player_slot: 0 }] })
    const player = match.players[0]
    expect(player.hero_id).toBeNull()
    expect(player.kills).toBeNull()
    expect(player.deaths).toBeNull()
    expect(player.assists).toBeNull()
    expect(player.gold_per_min).toBeNull()
    expect(player.xp_per_min).toBeNull()
    expect(player.last_hits).toBeNull()
  })

  it('отсутствующие поля матча становятся null', () => {
    const match = normalizeMatch({ players: [] })
    expect(match.match_id).toBeNull()
    expect(match.duration).toBeNull()
    expect(match.radiant_win).toBeNull()
  })
})

describe('Test 7 — явные null', () => {
  it('явные null остаются null', () => {
    const match = normalizeMatch({
      match_id: null,
      duration: null,
      radiant_win: null,
      players: [{ player_slot: 0, kills: null, deaths: null, hero_id: null, last_hits: null }],
    })
    expect(match.match_id).toBeNull()
    expect(match.duration).toBeNull()
    expect(match.radiant_win).toBeNull()
    expect(match.players[0].kills).toBeNull()
    expect(match.players[0].deaths).toBeNull()
    expect(match.players[0].hero_id).toBeNull()
    expect(match.players[0].last_hits).toBeNull()
  })
})

describe('Test 8 — отсутствующие или некорректные players', () => {
  it.each([[undefined], [null], ['не массив'], [{}], [42], [true]])(
    'players = %s → пустой массив без исключений',
    (players) => {
      expect(normalizeMatch({ players }).players).toEqual([])
    },
  )

  it('не-объектный ответ → пустая модель', () => {
    const empty = { match_id: null, duration: null, radiant_win: null, players: [] }
    expect(normalizeMatch(null)).toEqual(empty)
    expect(normalizeMatch(undefined)).toEqual(empty)
    expect(normalizeMatch('строка')).toEqual(empty)
    expect(normalizeMatch(42)).toEqual(empty)
    expect(normalizeMatch([])).toEqual(empty)
    expect(normalizeMatch({})).toEqual(empty)
  })
})

describe('Test 9 — неполный список игроков', () => {
  it('не дополняется синтетическими записями до десяти', () => {
    const match = normalizeMatch({
      players: [makePlayer({ player_slot: 0 }), makePlayer({ player_slot: 128 })],
    })
    expect(match.players).toHaveLength(2)
  })

  it('невалидные элементы массива пропускаются', () => {
    const match = normalizeMatch({ players: [null, 'x', 42, [], makePlayer({ player_slot: 3 })] })
    expect(match.players).toHaveLength(1)
    expect(match.players[0].player_slot).toBe(3)
  })
})

describe('Test 10 — некорректные типы полей', () => {
  it('строки и булевы значения не приводятся к числам', () => {
    const match = normalizeMatch({
      duration: '2069',
      radiant_win: 'true',
      players: [{ player_slot: 0, kills: '5', deaths: true, last_hits: 1.5 }],
    })
    expect(match.duration).toBeNull()
    expect(match.radiant_win).toBeNull()
    expect(match.players[0].kills).toBeNull()
    expect(match.players[0].deaths).toBeNull()
    expect(match.players[0].last_hits).toBeNull()
  })

  it('NaN, Infinity и отрицательная длительность → null', () => {
    expect(normalizeMatch({ duration: Number.NaN }).duration).toBeNull()
    expect(normalizeMatch({ duration: Number.POSITIVE_INFINITY }).duration).toBeNull()
    expect(normalizeMatch({ duration: -5 }).duration).toBeNull()
    const match = normalizeMatch({ players: [{ player_slot: 0, kills: Number.POSITIVE_INFINITY }] })
    expect(match.players[0].kills).toBeNull()
  })

  it('radiant_win = false сохраняется как false (не превращается в null)', () => {
    expect(normalizeMatch({ radiant_win: false }).radiant_win).toBe(false)
  })
})

describe('Test 11 — иммутабельность входных данных', () => {
  it('исходный объект не изменяется', () => {
    const raw = {
      match_id: 9007760151,
      duration: 2069,
      radiant_win: true,
      players: [{ player_slot: 0, kills: 0, nested: { value: 1 } }],
    }
    const snapshot = JSON.stringify(raw)
    normalizeMatch(raw)
    expect(JSON.stringify(raw)).toBe(snapshot)
  })
})

describe('Test 12 — детерминизм', () => {
  it('одинаковый вход даёт идентичный результат', () => {
    const raw = {
      match_id: 9007760151,
      duration: 2069,
      radiant_win: true,
      players: [makePlayer({ player_slot: 128, kills: 0 })],
    }
    const first = JSON.stringify(normalizeMatch(raw))
    const second = JSON.stringify(normalizeMatch(raw))
    expect(first).toBe(second)
  })
})

describe('Test 13 — большие ID матча', () => {
  it('безопасное целое → десятичная строка', () => {
    expect(normalizeMatchId(9007760151)).toBe('9007760151')
  })

  it('строковый большой ID сохраняется без потери точности', () => {
    expect(normalizeMatchId('12345678901234567890123')).toBe('12345678901234567890123')
  })

  it('небезопасное число → null (без молчаливого округления)', () => {
    expect(normalizeMatchId(1e21)).toBeNull()
    expect(normalizeMatchId(Number.MAX_SAFE_INTEGER + 2)).toBeNull()
  })

  it('ноль, мусор и отсутствие значения → null', () => {
    expect(normalizeMatchId(0)).toBeNull()
    expect(normalizeMatchId('0')).toBeNull()
    expect(normalizeMatchId('0000')).toBeNull()
    expect(normalizeMatchId('abc')).toBeNull()
    expect(normalizeMatchId('12.5')).toBeNull()
    expect(normalizeMatchId(undefined)).toBeNull()
    expect(normalizeMatchId(null)).toBeNull()
  })

  it('внешние пробелы обрезаются', () => {
    expect(normalizeMatchId('  9007760151 ')).toBe('9007760151')
  })
})

describe('Test 14 — реальная фикстура OpenDota (samples/match-.json)', () => {
  it('факты матча и участников сохраняются без изменений', () => {
    const match = normalizeMatch(fixture)

    expect(match.match_id).toBe('9040229641')
    expect(match.duration).toBe(2797)
    expect(match.radiant_win).toBe(true)
    expect(match.players).toHaveLength(10)

    const first = match.players[0]
    expect(first.player_slot).toBe(0)
    expect(first.team).toBe('radiant')
    expect(first.hero_id).toBe(2)
    expect(first.kills).toBe(20)
    expect(first.deaths).toBe(4)
    expect(first.assists).toBe(14)
    expect(first.last_hits).toBe(193)
    expect(first.gold_per_min).toBe(611)
    expect(first.xp_per_min).toBe(995)

    const radiant = match.players.filter((player) => player.team === 'radiant')
    const dire = match.players.filter((player) => player.team === 'dire')
    expect(radiant.length + dire.length).toBe(match.players.length)
    expect(radiant.length).toBeGreaterThan(0)
    expect(dire.length).toBeGreaterThan(0)
    expect(match.players.every((player) => player.team !== null)).toBe(true)
  })
})