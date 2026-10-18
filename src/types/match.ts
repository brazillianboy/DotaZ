/**
 * Нормализованная модель данных матча (Task 6).
 *
 * Назначение — дать UI стабильную структуру независимо от полноты ответа OpenDota.
 * Правила представления отсутствующих данных:
 *  - отсутствующее, некорректное или недоступное значение → `null`;
 *  - легитимный ноль сохраняется как `0`;
 *  - отсутствие данных никогда не превращается в `0` или `false`.
 *
 * Здесь нет аналитики и игровых оценок — только факты из ответа провайдера.
 */

/** Сторона игрока, определённая по конвенции `player_slot` OpenDota. */
export type PlayerTeam = 'radiant' | 'dire'

/** Нормализованный участник матча. */
export interface NormalizedPlayer {
  /** Слот игрока из ответа OpenDota (0–255). */
  player_slot: number
  /** Сторона: 0–127 → `radiant`, 128–255 → `dire`, иначе `null`. */
  team: PlayerTeam | null

  hero_id: number | null

  kills: number | null
  deaths: number | null
  assists: number | null

  gold_per_min: number | null
  xp_per_min: number | null
  last_hits: number | null
}

/** Нормализованный матч. */
export interface NormalizedMatch {
  /**
   * ID матча в виде десятичной строки (без потери точности для больших значений).
   * `null`, если значение отсутствует или не может быть представлено точно.
   */
  match_id: string | null
  /** Длительность матча в секундах; `null`, если недоступна или некорректна. */
  duration: number | null
  /** Победила ли сторона Radiant; `null`, если значение недоступно. */
  radiant_win: boolean | null
  /** Только фактически присутствующие и идентифицируемые участники (может быть меньше десяти). */
  players: NormalizedPlayer[]
}