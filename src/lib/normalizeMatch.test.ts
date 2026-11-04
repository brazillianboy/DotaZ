import { describe, expect, it } from 'vitest'

import fixture from '../../samples/match-.json'
import {
  collectAbilityUpgrades,
  collectBuildingKills,
  collectInventoryIds,
  createEmptyNormalizedMatch,
  normalizeAccountId,
  normalizeMatch,
  normalizeMatchId,
  normalizePlayerName,
  teamFromPlayerSlot,
} from './normalizeMatch'

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
      // Task 15: подтверждённые дополнительные поля (в синтетическом игроке отсутствуют).
      hero_damage: null,
      tower_damage: null,
      hero_healing: null,
      level: null,
      denies: null,
      net_worth: null,
      player_name: null,
      account_id: null,
      inventory_ids: null,
      neutral_item_id: null,
      ability_upgrades: null,
      purchaseLog: null,
      laning: {
        interval: { minutes: 15, label: '00:00–15:00' },
        lastHits: null,
        gold: null,
        xp: null,
        killsFirst: null,
        deathsFirst: null,
        purchasesFirst: null,
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

describe('Test 15 — подтверждённые поля Task 15', () => {
  it('читает инвентарь, уровень, денаи, net worth, урон и лечение', () => {
    const match = normalizeMatch({
      players: [
        {
          player_slot: 0,
          level: 22,
          denies: 23,
          net_worth: 20857,
          hero_damage: 31142,
          tower_damage: 6003,
          hero_healing: 0,
          item_0: 63,
          item_1: 147,
          item_2: 0,
          item_3: null,
          item_4: 108,
          item_5: 139,
          item_neutral: 263,
          personaname: 'Eris Greyrat',
          account_id: 1095077156,
        },
      ],
    })
    const player = match.players[0]

    expect(player.level).toBe(22)
    expect(player.denies).toBe(23)
    expect(player.net_worth).toBe(20857)
    expect(player.hero_damage).toBe(31142)
    expect(player.tower_damage).toBe(6003)
    // Легитимный ноль сохраняется нулём, а не «нет данных».
    expect(player.hero_healing).toBe(0)
    expect(player.inventory_ids).toEqual([63, 147, null, null, 108, 139])
    expect(player.neutral_item_id).toBe(263)
    expect(player.player_name).toBe('Eris Greyrat')
    expect(player.account_id).toBe(1095077156)
  })

  it('пустое имя игрока и отсутствие инвентаря → null (ники не выдумываются)', () => {
    const match = normalizeMatch({
      players: [{ player_slot: 0, personaname: '   ', name: 'не используется' }],
    })

    expect(match.players[0].player_name).toBeNull()
    expect(match.players[0].inventory_ids).toBeNull()
    expect(match.players[0].neutral_item_id).toBeNull()
    expect(normalizePlayerName(undefined)).toBeNull()
    expect(normalizeAccountId(0)).toBeNull()
    expect(collectInventoryIds({ item_0: 0, item_1: 0 })).toBeNull()
  })

  it('сохраняет запись прокачки способностей в исходном порядке', () => {
    const upgrades = [5019, 343, 5019, 5632, 6027]
    const match = normalizeMatch({ players: [{ player_slot: 0, ability_upgrades_arr: upgrades }] })

    expect(match.players[0].ability_upgrades).toEqual(upgrades)
    expect(collectAbilityUpgrades([1, 'x'])).toBeNull()
    expect(collectAbilityUpgrades('nope')).toBeNull()
    expect(collectAbilityUpgrades([])).toEqual([])
  })

  it('читает метаданные матча и битмаски зданий', () => {
    const match = normalizeMatch({
      match_id: 9007760151,
      radiant_score: 56,
      dire_score: 22,
      game_mode: 22,
      region: 3,
      start_time: 1789895287,
      tower_status_radiant: 1974,
      tower_status_dire: 0,
      barracks_status_radiant: 63,
      barracks_status_dire: 0,
    })

    expect(match.radiant_score).toBe(56)
    expect(match.dire_score).toBe(22)
    expect(match.game_mode).toBe(22)
    expect(match.region).toBe(3)
    expect(match.start_time).toBe(1789895287)
    expect(match.tower_status_radiant).toBe(1974)
    expect(match.tower_status_dire).toBe(0)
    expect(match.barracks_status_radiant).toBe(63)
    expect(match.barracks_status_dire).toBe(0)
  })

  it('собирает только подтверждённые события разрушения зданий', () => {
    const match = normalizeMatch({
      objectives: [
        { type: 'CHAT_MESSAGE_FIRSTBLOOD', time: 95 },
        { type: 'building_kill', time: 664, key: 'npc_dota_badguys_tower1_top' },
        { type: 'building_kill', time: 2070, key: 'npc_dota_badguys_fort' },
      ],
    })

    expect(match.buildingKills).toEqual([
      { time: 664, key: 'npc_dota_badguys_tower1_top' },
      { time: 2070, key: 'npc_dota_badguys_fort' },
    ])
    expect(collectBuildingKills(undefined)).toBeNull()
    expect(collectBuildingKills([{ type: 'building_kill', time: 'x', key: 'k' }])).toBeNull()
    expect(collectBuildingKills([])).toEqual([])
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
    const empty = createEmptyNormalizedMatch()
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