import { describe, expect, it, vi } from 'vitest'

import {
  clearEnrichmentCache,
  loadVisualizationMetadata,
  mergeVisualizationMetadata,
  needsVisualizationMetadata,
} from './matchEnrichment'
import { normalizeMatch } from './normalizeMatch'
import type { OpenDotaMatchResult } from './opendota'

/**
 * Тесты дополнения визуализаций для старых снимков (Task 15).
 *
 * Проверяется: запрос выполняется только при нехватке метаданных, данные разных матчей
 * не смешиваются, исторические значения не перезаписываются, повторные запросы
 * дублируются не создаются, отмена и ошибки дают честный результат.
 * Модуль не умеет писать в Supabase и не запускает обработку реплея — ему передан
 * только `fetchMatch`.
 */

const FETCHED_RAW = {
  match_id: 9007760151,
  duration: 2069,
  radiant_win: true,
  tower_status_radiant: 1974,
  tower_status_dire: 0,
  barracks_status_radiant: 63,
  barracks_status_dire: 0,
  objectives: [{ type: 'building_kill', time: 664, key: 'npc_dota_badguys_tower1_top' }],
  players: [
    {
      player_slot: 0,
      hero_id: 6,
      // Заведомо другие значения статистики: они НЕ должны попасть в отображение.
      kills: 99,
      gold_per_min: 999,
      ability_upgrades_arr: [5019, 343],
      item_0: 63,
      item_1: 147,
    },
  ],
}

/** Снимок до Task 15: без битмасок зданий, прокачки и инвентаря. */
function legacyMatch() {
  return normalizeMatch({
    match_id: 9007760151,
    duration: 2069,
    radiant_win: true,
    players: [{ player_slot: 0, hero_id: 6, kills: 1, gold_per_min: 500 }],
  })
}

function okResult(raw: unknown): OpenDotaMatchResult {
  return { ok: true, match: raw as Record<string, unknown> }
}

describe('Потребность в метаданных визуализаций', () => {
  it('старый снимок без зданий, прокачки и инвентаря требует дополнения', () => {
    expect(needsVisualizationMetadata(legacyMatch())).toBe(true)
  })

  it('полный матч дополнения не требует', () => {
    expect(needsVisualizationMetadata(normalizeMatch(FETCHED_RAW))).toBe(false)
  })
})

describe('Загрузка метаданных визуализаций', () => {
  it('не выполняет запрос, если метаданные уже есть', async () => {
    clearEnrichmentCache()
    const fetchMatch = vi.fn()
    const outcome = await loadVisualizationMetadata({
      matchId: '9007760151',
      match: normalizeMatch(FETCHED_RAW),
      fetchMatch,
    })

    expect(outcome.kind).toBe('not-needed')
    expect(fetchMatch).not.toHaveBeenCalled()
  })

  it('дополняет здания, прокачку и инвентарь, не изменяя статистику снимка', async () => {
    clearEnrichmentCache()
    const stored = legacyMatch()
    const outcome = await loadVisualizationMetadata({
      matchId: '9007760151',
      match: stored,
      fetchMatch: async () => okResult(FETCHED_RAW),
    })

    expect(outcome.kind).toBe('enriched')
    if (outcome.kind !== 'enriched') {
      return
    }
    expect(outcome.match.tower_status_radiant).toBe(1974)
    expect(outcome.match.barracks_status_dire).toBe(0)
    expect(outcome.match.buildingKills).toEqual([
      { time: 664, key: 'npc_dota_badguys_tower1_top' },
    ])
    expect(outcome.match.players[0].ability_upgrades).toEqual([5019, 343])
    expect(outcome.match.players[0].inventory_ids).toEqual([63, 147, null, null, null, null])
    // Историческая статистика снимка не перезаписывается свежими значениями.
    expect(outcome.match.players[0].kills).toBe(1)
    expect(outcome.match.players[0].gold_per_min).toBe(500)
    // Исходный объект не изменён.
    expect(stored.players[0].kills).toBe(1)
    expect(stored.tower_status_radiant).toBeNull()
  })

  it('не смешивает данные другого матча', async () => {
    clearEnrichmentCache()
    const outcome = await loadVisualizationMetadata({
      matchId: '9007760151',
      match: legacyMatch(),
      fetchMatch: async () => okResult({ ...FETCHED_RAW, match_id: 1111111111 }),
    })

    expect(outcome.kind).toBe('unavailable')
    if (outcome.kind === 'unavailable') {
      expect(outcome.reason).toBe('mismatch')
    }
  })

  it('сообщает о недоступности провайдера и не выдумывает метаданные', async () => {
    clearEnrichmentCache()
    const outcome = await loadVisualizationMetadata({
      matchId: '9007760151',
      match: legacyMatch(),
      fetchMatch: async () => ({ ok: false, error: { kind: 'network', message: 'нет сети' } }),
    })

    expect(outcome.kind).toBe('unavailable')
    if (outcome.kind === 'unavailable') {
      expect(outcome.match.tower_status_radiant).toBeNull()
    }
  })

  it('не дублирует запросы для одного и того же матча', async () => {
    clearEnrichmentCache()
    const fetchMatch = vi.fn(async () => okResult(FETCHED_RAW))
    await loadVisualizationMetadata({ matchId: '9007760151', match: legacyMatch(), fetchMatch })
    await loadVisualizationMetadata({ matchId: '9007760151', match: legacyMatch(), fetchMatch })

    expect(fetchMatch).toHaveBeenCalledTimes(1)
  })

  it('прекращает работу при отмене (уход со страницы)', async () => {
    clearEnrichmentCache()
    const controller = new AbortController()
    controller.abort()
    const fetchMatch = vi.fn(async () => okResult(FETCHED_RAW))
    const outcome = await loadVisualizationMetadata({
      matchId: '9007760151',
      match: legacyMatch(),
      fetchMatch,
      signal: controller.signal,
    })

    expect(outcome.kind).toBe('aborted')
    expect(fetchMatch).not.toHaveBeenCalled()
  })

  it('слияние не трогает журналы покупок и данные ранней стадии', () => {
    const stored = legacyMatch()
    const merged = mergeVisualizationMetadata(stored, normalizeMatch(FETCHED_RAW))

    expect(merged.players[0].purchaseLog).toBe(stored.players[0].purchaseLog)
    expect(merged.players[0].laning).toBe(stored.players[0].laning)
    expect(merged.duration).toBe(stored.duration)
  })
})
