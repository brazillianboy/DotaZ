import type { NormalizedMatch, NormalizedPlayer } from '../types/match'

/**
 * Метаданные матча для шапки отчёта (Task 15).
 *
 * Модуль чистый: без сети, React и глобального состояния. Все значения берутся из
 * подтверждённых полей OpenDota; отсутствующие данные не подменяются нулями и не
 * выдумываются. Справочники режимов и регионов сгенерированы по живым ответам
 * `GET /api/constants/game_mode` и `GET /api/constants/region` (30.10.2026).
 */

/** Проверенный справочник режимов игры OpenDota (ID → ключ провайдера). */
export const GAME_MODE_KEYS: Readonly<Record<number, string>> = {
  0: 'game_mode_unknown',
  1: 'game_mode_all_pick',
  2: 'game_mode_captains_mode',
  3: 'game_mode_random_draft',
  4: 'game_mode_single_draft',
  5: 'game_mode_all_random',
  6: 'game_mode_intro',
  7: 'game_mode_diretide',
  8: 'game_mode_reverse_captains_mode',
  9: 'game_mode_greeviling',
  10: 'game_mode_tutorial',
  11: 'game_mode_mid_only',
  12: 'game_mode_least_played',
  13: 'game_mode_limited_heroes',
  14: 'game_mode_compendium_matchmaking',
  15: 'game_mode_custom',
  16: 'game_mode_captains_draft',
  17: 'game_mode_balanced_draft',
  18: 'game_mode_ability_draft',
  19: 'game_mode_event',
  20: 'game_mode_all_random_death_match',
  21: 'game_mode_1v1_mid',
  22: 'game_mode_all_draft',
  23: 'game_mode_turbo',
  24: 'game_mode_mutation',
  25: 'game_mode_coaches_challenge',
}

/** Проверенный справочник регионов OpenDota (ID → название провайдера). */
export const REGION_NAMES: Readonly<Record<number, string>> = {
  1: 'US WEST',
  2: 'US EAST',
  3: 'EUROPE',
  5: 'SINGAPORE',
  6: 'DUBAI',
  7: 'AUSTRALIA',
  8: 'STOCKHOLM',
  9: 'AUSTRIA',
  10: 'BRAZIL',
  11: 'SOUTHAFRICA',
  12: 'PW TELECOM SHANGHAI',
  13: 'PW UNICOM',
  14: 'CHILE',
  15: 'PERU',
  16: 'INDIA',
  17: 'PW TELECOM GUANGDONG',
  18: 'PW TELECOM ZHEJIANG',
  19: 'JAPAN',
  20: 'PW TELECOM WUHAN',
  25: 'PW UNICOM TIANJIN',
  37: 'TAIWAN',
  38: 'ARGENTINA',
}

/** Источник счёта: подтверждённые поля провайдера или подсчёт по полным 5+5 данным. */
export type ScoreSource = 'provider' | 'players' | null

export interface TeamScore {
  radiant: number | null
  dire: number | null
  source: ScoreSource
}

/**
 * Счёт по убийствам.
 *
 * Приоритет — подтверждённые поля `radiant_score`/`dire_score`. Если их нет,
 * подсчёт выполняется ТОЛЬКО при полных данных: ровно по 5 участников в каждой
 * команде и подтверждённые (не `null`) убийства у всех десяти. Любая неполнота
 * даёт «нет данных» вместо выдуманного счёта.
 */
export function matchScore(match: NormalizedMatch): TeamScore {
  if (match.radiant_score !== null && match.dire_score !== null) {
    return { radiant: match.radiant_score, dire: match.dire_score, source: 'provider' }
  }
  const radiant = match.players.filter((player) => player.team === 'radiant')
  const dire = match.players.filter((player) => player.team === 'dire')
  if (radiant.length !== 5 || dire.length !== 5) {
    return { radiant: null, dire: null, source: null }
  }
  const sumKills = (players: NormalizedPlayer[]): number | null => {
    let total = 0
    for (const player of players) {
      if (player.kills === null) {
        return null
      }
      total += player.kills
    }
    return total
  }
  const radiantKills = sumKills(radiant)
  const direKills = sumKills(dire)
  if (radiantKills === null || direKills === null) {
    return { radiant: null, dire: null, source: null }
  }
  return { radiant: radiantKills, dire: direKills, source: 'players' }
}

/** Ключ режима игры OpenDota (`game_mode_all_draft`); неизвестный ID → `null`. */
export function gameModeKey(gameMode: number | null): string | null {
  if (gameMode === null) {
    return null
  }
  return GAME_MODE_KEYS[gameMode] ?? null
}

/**
 * Slug режима из ключа провайдера: `game_mode_all_draft` → `all_draft`.
 * Служебный префикс `game_mode_` снимается; значение не переводится здесь —
 * локализация выполняется словарём по известным slug.
 */
export function gameModeSlug(gameMode: number | null): string | null {
  const key = gameModeKey(gameMode)
  if (key === null) {
    return null
  }
  return key.replace(/^game_mode_/, '')
}

/** Название региона в том виде, в каком его отдаёт провайдер; неизвестный ID → `null`. */
export function regionName(region: number | null): string | null {
  if (region === null) {
    return null
  }
  return REGION_NAMES[region] ?? null
}

/** Время начала матча (unix, секунды) → ISO 8601; отсутствует → `null`. */
export function startTimeToIso(startTime: number | null): string | null {
  if (startTime === null || !Number.isFinite(startTime) || startTime <= 0) {
    return null
  }
  return new Date(startTime * 1000).toISOString()
}

/**
 * Возраст матча в целых днях. `null`, если время начала недоступно или находится
 * в будущем относительно переданного «сейчас» (расхождение часов не трактуется
 * как подтверждённый возраст).
 */
export function matchAgeDays(startTime: number | null, now: Date): number | null {
  if (startTime === null || !Number.isFinite(startTime) || startTime <= 0) {
    return null
  }
  const diffMs = now.getTime() - startTime * 1000
  if (diffMs < 0) {
    return null
  }
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}
