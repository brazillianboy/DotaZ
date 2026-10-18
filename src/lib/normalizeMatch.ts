import { buildLaningStageData } from './laning'
import type { NormalizedMatch, NormalizedPlayer, PlayerTeam } from '../types/match'

/**
 * Нормализация ответа OpenDota (Task 6).
 *
 * Модуль чистый и детерминированный: без HTTP-запросов, Supabase, React-хуков,
 * глобального состояния и изменения исходного объекта. Ответ провайдера
 * рассматривается как недоверенный ввод, поэтому каждый тип проверяется в рантайме.
 *
 * Правила:
 *  - отсутствующее/некорректное значение → `null` (никогда не `0` и не `false`);
 *  - легитимный ноль сохраняется;
 *  - аналитика и игровые оценки здесь не выполняются.
 */

/** Границы `player_slot` по конвенции OpenDota. */
const RADIANT_SLOT_MIN = 0
const RADIANT_SLOT_MAX = 127
const DIRE_SLOT_MIN = 128
const DIRE_SLOT_MAX = 255

/** Проверка, что значение — обычный объект (не массив, не null). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Строгое числовое значение: принимается только конечное число.
 * Строки и другие типы не приводятся к числу.
 */
function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return value
}

/** Целое числовое значение; дробные, NaN, Infinity и не-числа → `null`. */
function toIntegerOrNull(value: unknown): number | null {
  const numeric = toFiniteNumberOrNull(value)
  if (numeric === null || !Number.isInteger(numeric)) {
    return null
  }
  return numeric
}

/**
 * ID матча в виде десятичной строки без потери точности.
 * Числовое значение принимается только как безопасное целое; строки из цифр
 * сохраняются как есть, поэтому большие ID не округляются.
 */
export function normalizeMatchId(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) {
      return null
    }
    return String(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!/^\d+$/.test(trimmed) || /^0+$/.test(trimmed)) {
      return null
    }
    return trimmed
  }
  return null
}

/**
 * Сторона игрока по `player_slot`: 0–127 → `radiant`, 128–255 → `dire`.
 * Некорректный, дробный, отсутствующий или выходящий за диапазон слот → `null`
 * (команда не выдумывается).
 */
export function teamFromPlayerSlot(slot: unknown): PlayerTeam | null {
  const value = toIntegerOrNull(slot)
  if (value === null) {
    return null
  }
  if (value >= RADIANT_SLOT_MIN && value <= RADIANT_SLOT_MAX) {
    return 'radiant'
  }
  if (value >= DIRE_SLOT_MIN && value <= DIRE_SLOT_MAX) {
    return 'dire'
  }
  return null
}

/** Длительность: неотрицательное целое число; ноль — допустимое значение. */
function normalizeDuration(value: unknown): number | null {
  const duration = toIntegerOrNull(value)
  if (duration === null || duration < 0) {
    return null
  }
  return duration
}

/**
 * Нормализация одного участника.
 *
 * Записи без корректного `player_slot` исключаются: нормализованная модель
 * идентифицирует участников по слоту, поэтому выдумывать слот нельзя.
 * Исключение безопасно — оно не создаёт фиктивных игроков и не приводит к ошибкам.
 */
function normalizePlayer(raw: unknown): NormalizedPlayer | null {
  if (!isRecord(raw)) {
    return null
  }
  const playerSlot = toIntegerOrNull(raw.player_slot)
  if (playerSlot === null) {
    return null
  }
  return {
    player_slot: playerSlot,
    team: teamFromPlayerSlot(playerSlot),
    hero_id: toIntegerOrNull(raw.hero_id),
    kills: toIntegerOrNull(raw.kills),
    deaths: toIntegerOrNull(raw.deaths),
    assists: toIntegerOrNull(raw.assists),
    gold_per_min: toIntegerOrNull(raw.gold_per_min),
    xp_per_min: toIntegerOrNull(raw.xp_per_min),
    last_hits: toIntegerOrNull(raw.last_hits),
    // Стадия линии 00:00–10:00 (Task 8): данные читаются из той же записи игрока.
    laning: buildLaningStageData(raw),
  }
}

/**
 * Приводит произвольный ответ OpenDota к нормализованной модели матча.
 * Никогда не бросает исключений и не изменяет входной объект.
 */
export function normalizeMatch(raw: unknown): NormalizedMatch {
  if (!isRecord(raw)) {
    return { match_id: null, duration: null, radiant_win: null, players: [] }
  }

  const players: NormalizedPlayer[] = []
  if (Array.isArray(raw.players)) {
    for (const item of raw.players) {
      const player = normalizePlayer(item)
      if (player !== null) {
        players.push(player)
      }
    }
  }

  return {
    match_id: normalizeMatchId(raw.match_id),
    duration: normalizeDuration(raw.duration),
    radiant_win: typeof raw.radiant_win === 'boolean' ? raw.radiant_win : null,
    players,
  }
}