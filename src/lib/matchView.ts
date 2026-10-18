import type { NormalizedPlayer, PlayerTeam } from '../types/match'

/**
 * Хелперы представления данных матча (Task 7).
 *
 * Чистые функции без React и аналитики: только форматирование фактов из
 * нормализованной модели (Task 6). Отсутствующие значения показываются как
 * «Нет данных», легитимный ноль остаётся нулём.
 */

export const NO_DATA_LABEL = 'Нет данных'
export const UNKNOWN_TEAM_LABEL = 'Команда не определена'
const MISSING_PART = '—'

/** Длительность в секундах → «MM:SS»; отсутствие данных → «Нет данных». */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return NO_DATA_LABEL
  }
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** Числовая статистика: значение как есть (включая `0`) или «Нет данных». */
export function formatStat(value: number | null): string {
  if (value === null) {
    return NO_DATA_LABEL
  }
  return String(value)
}

/** Часть K/D/A: отсутствующее значение обозначается прочерком. */
export function formatKdaPart(value: number | null): string {
  if (value === null) {
    return MISSING_PART
  }
  return String(value)
}

/** K/D/A в виде «kills / deaths / assists» (без расчёта KDA-коэффициента). */
export function formatKda(
  kills: number | null,
  deaths: number | null,
  assists: number | null,
): string {
  return `${formatKdaPart(kills)} / ${formatKdaPart(deaths)} / ${formatKdaPart(assists)}`
}

/** Победитель по `radiant_win`: `null` — результат недоступен (не Dire). */
export function winnerLabel(radiantWin: boolean | null): string {
  if (radiantWin === null) {
    return NO_DATA_LABEL
  }
  return radiantWin ? 'Radiant' : 'Dire'
}

/** Название стороны игрока. */
export function teamLabel(team: PlayerTeam | null): string {
  if (team === 'radiant') {
    return 'Radiant'
  }
  if (team === 'dire') {
    return 'Dire'
  }
  return UNKNOWN_TEAM_LABEL
}

/**
 * Подпись участника. Ники из API в нормализованной модели отсутствуют,
 * поэтому используется фактический идентификатор — слот; при наличии
 * подтверждённого `hero_id` он добавляется как есть (без справочника героев).
 */
export function playerLabel(player: Pick<NormalizedPlayer, 'player_slot' | 'hero_id'>): string {
  const base = `Игрок — слот ${player.player_slot}`
  if (player.hero_id === null) {
    return base
  }
  return `${base} · герой ${player.hero_id}`
}

export interface GroupedPlayers {
  radiant: NormalizedPlayer[]
  dire: NormalizedPlayer[]
  unknown: NormalizedPlayer[]
}

/** Группировка участников по стороне, определённой из `player_slot`. */
export function groupPlayers(players: NormalizedPlayer[]): GroupedPlayers {
  const grouped: GroupedPlayers = { radiant: [], dire: [], unknown: [] }
  for (const player of players) {
    if (player.team === 'radiant') {
      grouped.radiant.push(player)
    } else if (player.team === 'dire') {
      grouped.dire.push(player)
    } else {
      grouped.unknown.push(player)
    }
  }
  return grouped
}

/** Слот участника, выбираемого по умолчанию (первый в списке), или `null`. */
export function pickDefaultPlayerSlot(players: NormalizedPlayer[]): number | null {
  if (players.length === 0) {
    return null
  }
  return players[0].player_slot
}

/** Поиск участника по слоту (устойчивый идентификатор выбора). */
export function findPlayerBySlot(
  players: NormalizedPlayer[],
  slot: number | null,
): NormalizedPlayer | null {
  if (slot === null) {
    return null
  }
  return players.find((player) => player.player_slot === slot) ?? null
}

/** Процент эффективности линии OpenDota: значение со знаком «%» или «Нет данных». */
export function formatLaneEfficiencyPct(value: number | null): string {
  if (value === null) {
    return NO_DATA_LABEL
  }
  return `${value} %`
}

/** Время события в секундах → «MM:SS» (для журнала покупок). */
export function formatEventTime(seconds: number): string {
  return formatDuration(Math.max(0, Math.floor(seconds)))
}