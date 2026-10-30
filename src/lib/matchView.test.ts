import { describe, expect, it } from 'vitest'

import { buildLaningStageData } from './laning'
import type { NormalizedPlayer } from '../types/match'
import {
  NO_DATA_LABEL,
  UNKNOWN_TEAM_LABEL,
  findPlayerBySlot,
  formatDuration,
  formatKda,
  formatKdaPart,
  formatStat,
  groupPlayers,
  pickDefaultPlayerSlot,
  playerLabel,
  teamLabel,
  winnerLabel,
} from './matchView'

/** Синтетический участник для тестов представления (без данных стадии линии). */
function makePlayer(overrides: Partial<Omit<NormalizedPlayer, 'laning' | 'purchaseLog'>> = {}): NormalizedPlayer {
  return {
    player_slot: 0,
    team: 'radiant',
    hero_id: 1,
    kills: 1,
    deaths: 1,
    assists: 1,
    gold_per_min: 100,
    xp_per_min: 100,
    last_hits: 10,
    purchaseLog: null,
    laning: buildLaningStageData({}),
    ...overrides,
  }
}

describe('formatDuration', () => {
  it('форматирует секунды в MM:SS', () => {
    expect(formatDuration(2069)).toBe('34:29')
    expect(formatDuration(2797)).toBe('46:37')
    expect(formatDuration(59)).toBe('0:59')
  })

  it('сохраняет легитимный ноль', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('отсутствие данных показывает как «Нет данных»', () => {
    expect(formatDuration(null)).toBe(NO_DATA_LABEL)
  })
})

describe('formatStat', () => {
  it('возвращает значение как есть, включая ноль', () => {
    expect(formatStat(0)).toBe('0')
    expect(formatStat(619)).toBe('619')
  })

  it('отсутствующее значение → «Нет данных»', () => {
    expect(formatStat(null)).toBe(NO_DATA_LABEL)
  })
})

describe('formatKda', () => {
  it('полные значения форматируются как «k / d / a»', () => {
    expect(formatKda(6, 8, 18)).toBe('6 / 8 / 18')
  })

  it('нули сохраняются', () => {
    expect(formatKda(0, 0, 0)).toBe('0 / 0 / 0')
  })

  it('отсутствующие части обозначаются прочерком', () => {
    expect(formatKda(6, null, 18)).toBe('6 / — / 18')
    expect(formatKda(null, null, null)).toBe('— / — / —')
  })

  it('formatKdaPart сохраняет ноль и помечает отсутствие', () => {
    expect(formatKdaPart(0)).toBe('0')
    expect(formatKdaPart(null)).toBe('—')
  })
})

describe('winnerLabel', () => {
  it('true → Radiant, false → Dire', () => {
    expect(winnerLabel(true)).toBe('Radiant')
    expect(winnerLabel(false)).toBe('Dire')
  })

  it('null не трактуется как победа Dire', () => {
    expect(winnerLabel(null)).toBe(NO_DATA_LABEL)
  })
})

describe('teamLabel', () => {
  it('известные стороны и неопределённая', () => {
    expect(teamLabel('radiant')).toBe('Radiant')
    expect(teamLabel('dire')).toBe('Dire')
    expect(teamLabel(null)).toBe(UNKNOWN_TEAM_LABEL)
  })
})

describe('playerLabel', () => {
  it('без hero_id — только слот', () => {
    expect(playerLabel({ player_slot: 128, hero_id: null })).toBe('Игрок — слот 128')
  })

  it('с hero_id добавляет подтверждённый идентификатор героя', () => {
    expect(playerLabel({ player_slot: 0, hero_id: 6 })).toBe('Игрок — слот 0 · герой 6')
  })
})

describe('groupPlayers', () => {
  it('группирует по стороне, включая неопределённую', () => {
    const grouped = groupPlayers([
      makePlayer({ player_slot: 0, team: 'radiant' }),
      makePlayer({ player_slot: 128, team: 'dire' }),
      makePlayer({ player_slot: 300, team: null }),
    ])
    expect(grouped.radiant.map((p) => p.player_slot)).toEqual([0])
    expect(grouped.dire.map((p) => p.player_slot)).toEqual([128])
    expect(grouped.unknown.map((p) => p.player_slot)).toEqual([300])
  })

  it('пустой список даёт пустые группы', () => {
    const grouped = groupPlayers([])
    expect(grouped.radiant).toEqual([])
    expect(grouped.dire).toEqual([])
    expect(grouped.unknown).toEqual([])
  })
})

describe('pickDefaultPlayerSlot', () => {
  it('выбирает первый слот, если участники есть', () => {
    expect(pickDefaultPlayerSlot([makePlayer({ player_slot: 128 })])).toBe(128)
  })

  it('пустой список → null (ничего не выбрано)', () => {
    expect(pickDefaultPlayerSlot([])).toBeNull()
  })
})

describe('findPlayerBySlot', () => {
  it('находит участника по устойчивому идентификатору', () => {
    const players = [makePlayer({ player_slot: 0 }), makePlayer({ player_slot: 128 })]
    expect(findPlayerBySlot(players, 128)?.player_slot).toBe(128)
  })

  it('не найденный слот или null → null', () => {
    const players = [makePlayer({ player_slot: 0 })]
    expect(findPlayerBySlot(players, 5)).toBeNull()
    expect(findPlayerBySlot(players, null)).toBeNull()
  })
})