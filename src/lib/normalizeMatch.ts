import { buildLaningStageData, collectPurchaseLog } from './laning'
import type {
  BuildingKillEvent,
  NormalizedMatch,
  NormalizedPlayer,
  PlayerTeam,
} from '../types/match'

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

/** Неотрицательное целое значение (`radiant_score`, `dire_score`, маски зданий). */
function normalizeNonNegativeInteger(value: unknown): number | null {
  const numeric = toIntegerOrNull(value)
  if (numeric === null || numeric < 0) {
    return null
  }
  return numeric
}

/** Числовой код (`game_mode`, `region`): неотрицательное целое либо `null`. */
function normalizeCode(value: unknown): number | null {
  return normalizeNonNegativeInteger(value)
}

/** Время начала матча: положительное целое (unix, секунды) либо `null`. */
function normalizeStartTime(value: unknown): number | null {
  const numeric = toIntegerOrNull(value)
  if (numeric === null || numeric <= 0) {
    return null
  }
  return numeric
}

/**
 * Подтверждённое имя игрока (`personaname`).
 * Пустая строка и не-строки → `null`: ники не выдумываются.
 */
export function normalizePlayerName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

/** Идентификатор аккаунта: положительное целое либо `null`. */
export function normalizeAccountId(value: unknown): number | null {
  const numeric = toIntegerOrNull(value)
  if (numeric === null || numeric <= 0) {
    return null
  }
  return numeric
}

/**
 * Финальный инвентарь: ID слотов `item_0 … item_5` в исходном порядке.
 * Если ни один слот не подтверждён числом, инвентарь считается недоступным (`null`).
 */
export function collectInventoryIds(raw: unknown): (number | null)[] | null {
  if (!isRecord(raw)) {
    return null
  }
  const slots: (number | null)[] = []
  let hasAny = false
  for (let index = 0; index < 6; index += 1) {
    const value = toIntegerOrNull(raw[`item_${index}`])
    if (value !== null && value > 0) {
      slots.push(value)
      hasAny = true
    } else {
      slots.push(null)
    }
  }
  return hasAny ? slots : null
}

/** Нейтральный предмет (`item_neutral`): положительное целое либо `null`. */
export function collectNeutralItemId(raw: unknown): number | null {
  if (!isRecord(raw)) {
    return null
  }
  const value = toIntegerOrNull(raw.item_neutral)
  if (value === null || value <= 0) {
    return null
  }
  return value
}

/**
 * Запись прокачки способностей (`ability_upgrades_arr`).
 * Точный порядок сохраняется; любая некорректная запись делает список недостоверным
 * (`null`), чтобы уровень нельзя было приписать не той способности.
 */
export function collectAbilityUpgrades(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const upgrades: number[] = []
  for (const item of value) {
    const id = toIntegerOrNull(item)
    if (id === null || id <= 0) {
      return null
    }
    upgrades.push(id)
  }
  return upgrades
}

/**
 * События разрушения зданий из `objectives`: берутся только записи `building_kill`
 * с корректным временем и ключом. Некорректная запись делает список недостоверным
 * (`null`), потому что по нему показывается время разрушения.
 */
export function collectBuildingKills(value: unknown): BuildingKillEvent[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const events: BuildingKillEvent[] = []
  for (const entry of value) {
    if (!isRecord(entry) || entry.type !== 'building_kill') {
      continue
    }
    const time = toIntegerOrNull(entry.time)
    const key = entry.key
    if (time === null || time < 0 || typeof key !== 'string' || key.length === 0) {
      return null
    }
    events.push({ time, key })
  }
  return events
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
    // Дополнительные подтверждённые показатели (Task 15): отсутствие → `null`.
    hero_damage: toIntegerOrNull(raw.hero_damage),
    tower_damage: toIntegerOrNull(raw.tower_damage),
    hero_healing: toIntegerOrNull(raw.hero_healing),
    level: toIntegerOrNull(raw.level),
    denies: toIntegerOrNull(raw.denies),
    net_worth: toIntegerOrNull(raw.net_worth),
    player_name: normalizePlayerName(raw.personaname),
    account_id: normalizeAccountId(raw.account_id),
    inventory_ids: collectInventoryIds(raw),
    neutral_item_id: collectNeutralItemId(raw),
    ability_upgrades: collectAbilityUpgrades(raw.ability_upgrades_arr),
    // Полный журнал покупок за матч: нужен секции собранных предметов.
    purchaseLog: collectPurchaseLog(raw.purchase_log),
    // Ранняя стадия 00:00–15:00 (Task 8): данные читаются из той же записи игрока.
    laning: buildLaningStageData(raw),
  }
}

/**
 * Пустая нормализованная модель матча: все поля отсутствуют (`null`), участников нет.
 * Используется как безопасная заглушка, когда достоверных данных матча нет вовсе.
 */
export function createEmptyNormalizedMatch(): NormalizedMatch {
  return {
    match_id: null,
    duration: null,
    radiant_win: null,
    radiant_score: null,
    dire_score: null,
    game_mode: null,
    region: null,
    start_time: null,
    tower_status_radiant: null,
    tower_status_dire: null,
    barracks_status_radiant: null,
    barracks_status_dire: null,
    buildingKills: null,
    players: [],
  }
}

/**
 * Приводит произвольный ответ OpenDota к нормализованной модели матча.
 * Никогда не бросает исключений и не изменяет входной объект.
 */
export function normalizeMatch(raw: unknown): NormalizedMatch {
  if (!isRecord(raw)) {
    return createEmptyNormalizedMatch()
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
    // Подтверждённые метаданные и состояние зданий (Task 15): отсутствие → `null`.
    radiant_score: normalizeNonNegativeInteger(raw.radiant_score),
    dire_score: normalizeNonNegativeInteger(raw.dire_score),
    game_mode: normalizeCode(raw.game_mode),
    region: normalizeCode(raw.region),
    start_time: normalizeStartTime(raw.start_time),
    tower_status_radiant: normalizeNonNegativeInteger(raw.tower_status_radiant),
    tower_status_dire: normalizeNonNegativeInteger(raw.tower_status_dire),
    barracks_status_radiant: normalizeNonNegativeInteger(raw.barracks_status_radiant),
    barracks_status_dire: normalizeNonNegativeInteger(raw.barracks_status_dire),
    buildingKills: collectBuildingKills(raw.objectives),
    players,
  }
}