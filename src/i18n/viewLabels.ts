import type { TranslationKey } from './translations'
import { formatPercentValue, formatUtcDateTime } from './formatters'
import type { Locale } from './translations'
import type { NormalizedPlayer, PlayerTeam } from '../types/match'

/**
 * Локальные подписи представления (Task 13).
 *
 * Значения (числа, длительность, проценты) остаются неизменными — локализуются
 * только подписи, поэтому факты матча не искажаются.
 */

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

/** Длительность в секундах → «MM:SS» или локализованное «нет данных». */
export function durationText(t: Translate, seconds: number | null): string {
  if (seconds === null) {
    return t('common.noData')
  }
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** Числовая статистика: значение как есть (включая 0) или «нет данных». */
export function statText(t: Translate, value: number | null): string {
  return value === null ? t('common.noData') : String(value)
}

/** Часть K/D/A: отсутствующее значение обозначается прочерком. */
export function kdaPart(value: number | null): string {
  return value === null ? '—' : String(value)
}

/** K/D/A в виде «kills / deaths / assists». */
export function kdaText(
  kills: number | null,
  deaths: number | null,
  assists: number | null,
): string {
  return `${kdaPart(kills)} / ${kdaPart(deaths)} / ${kdaPart(assists)}`
}

/** Название стороны игрока. */
export function teamText(t: Translate, team: PlayerTeam | null): string {
  if (team === 'radiant') {
    return 'Radiant'
  }
  if (team === 'dire') {
    return 'Dire'
  }
  return t('match.players.unknownTeam')
}

/** Победитель по `radiant_win`; `null` — результат недоступен. */
export function winnerText(t: Translate, radiantWin: boolean | null): string {
  if (radiantWin === null) {
    return t('common.noData')
  }
  return radiantWin ? 'Radiant' : 'Dire'
}

/** Подпись участника: слот и (при наличии) подтверждённый `hero_id`. */
export function playerText(
  t: Translate,
  player: Pick<NormalizedPlayer, 'player_slot' | 'hero_id'>,
): string {
  const base = t('match.players.playerLabel', { slot: player.player_slot })
  if (player.hero_id === null) {
    return base
  }
  return `${base}${t('match.players.heroSuffix', { heroId: player.hero_id })}`
}

/** Процент эффективности линии провайдера. */
export function laneEfficiencyText(t: Translate, value: number | null, locale: Locale): string {
  if (value === null) {
    return t('common.noData')
  }
  return formatPercentValue(value, locale)
}

/** Временная метка в UTC с учётом локали. */
export function timestampText(value: string | null, locale: Locale): string | null {
  return formatUtcDateTime(value, locale)
}