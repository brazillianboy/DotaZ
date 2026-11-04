import type { OpenDotaMatchResult } from './opendota'
import { normalizeMatch } from './normalizeMatch'
import type { NormalizedMatch, NormalizedPlayer } from '../types/match'

/**
 * Обогащение отображения недостающими метаданными визуализаций (Task 15).
 *
 * Проблема: отчёты, сохранённые до Task 15 (а также матчи, где OpenDota не вернула
 * подробные поля), не содержат данных для Ability Build и Buildings Map. Для таких
 * отчётов допускается **одно** дополнительное чтение матча у OpenDota.
 *
 * Жёсткие правила безопасности:
 *  - запрос выполняется только если метаданных визуализаций действительно не хватает;
 *  - повторные обращения к тому же матчу не дублируются (кэш по ID матча);
 *  - ответ принимается только при совпадении `match_id` — данные разных матчей не
 *    смешиваются ни при каких условиях;
 *  - переносятся ТОЛЬКО отсутствующие поля визуализаций: битмаски зданий, события
 *    разрушения, запись прокачки способностей, ID финального инвентаря и нейтрального
 *    предмета. Статистика, журналы покупок и данные 00:00–15:00 не перезаписываются;
 *  - сохранённый отчёт не изменяется, запись в Supabase не выполняется, обработка
 *    реплея не запрашивается (модуль не умеет этого делать: ему передан только
 *    `fetchMatch`);
 *  - отмена, таймаут и ошибки провайдера дают честный результат «недоступно».
 */

/** Не хватает ли метаданных для визуализаций (Ability Build / Buildings Map / инвентарь). */
export function needsVisualizationMetadata(match: NormalizedMatch): boolean {
  const hasAbilities = match.players.some((player) => player.ability_upgrades !== null)
  const hasBuildings =
    match.tower_status_radiant !== null ||
    match.tower_status_dire !== null ||
    match.barracks_status_radiant !== null ||
    match.barracks_status_dire !== null ||
    (match.buildingKills !== null && match.buildingKills.length > 0)
  const hasInventory = match.players.some((player) => player.inventory_ids !== null)
  return !(hasAbilities && hasBuildings && hasInventory)
}

function mergePlayer(
  stored: NormalizedPlayer,
  fetched: NormalizedPlayer | undefined,
): NormalizedPlayer {
  if (fetched === undefined) {
    return stored
  }
  return {
    // Исторические значения остаются без изменений: перезаписывается только пустое.
    ...stored,
    ability_upgrades: stored.ability_upgrades ?? fetched.ability_upgrades,
    inventory_ids: stored.inventory_ids ?? fetched.inventory_ids,
    neutral_item_id: stored.neutral_item_id ?? fetched.neutral_item_id,
  }
}

/**
 * Точечное слияние: сохраняются все значения снимка, а из свежего ответа берутся
 * только отсутствующие поля визуализаций. Статистика матча и игроков, журналы покупок
 * и данные ранней стадии не изменяются.
 */
export function mergeVisualizationMetadata(
  stored: NormalizedMatch,
  fetched: NormalizedMatch,
): NormalizedMatch {
  const fetchedBySlot = new Map(fetched.players.map((player) => [player.player_slot, player]))
  return {
    ...stored,
    tower_status_radiant: stored.tower_status_radiant ?? fetched.tower_status_radiant,
    tower_status_dire: stored.tower_status_dire ?? fetched.tower_status_dire,
    barracks_status_radiant: stored.barracks_status_radiant ?? fetched.barracks_status_radiant,
    barracks_status_dire: stored.barracks_status_dire ?? fetched.barracks_status_dire,
    buildingKills: stored.buildingKills ?? fetched.buildingKills,
    players: stored.players.map((player) => mergePlayer(player, fetchedBySlot.get(player.player_slot))),
  }
}

export type EnrichmentOutcome =
  | { kind: 'not-needed'; match: NormalizedMatch }
  | { kind: 'enriched'; match: NormalizedMatch }
  | { kind: 'unavailable'; match: NormalizedMatch; reason: 'provider' | 'mismatch' }
  | { kind: 'aborted'; match: NormalizedMatch }

export interface EnrichmentDeps {
  /** Проверенный ID матча из адреса (строка из цифр). */
  matchId: string
  /** Отображаемый (сохранённый) матч — он не изменяется. */
  match: NormalizedMatch
  fetchMatch: (matchId: string, signal?: AbortSignal) => Promise<OpenDotaMatchResult>
  signal?: AbortSignal
}

/** Кэш загрузок по ID матча: повторные обращения не создают новых запросов. */
const enrichmentCache = new Map<string, Promise<NormalizedMatch | null>>()

/** Сброс кэша обогащения (тесты и повторная попытка после сбоя). */
export function clearEnrichmentCache(): void {
  enrichmentCache.clear()
}

/**
 * Проверка отмены вынесена в функцию: `AbortSignal.aborted` объявлено неизменяемым,
 * и при прямой проверке TypeScript считает повторное обращение избыточным.
 */
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal !== undefined && signal.aborted
}

function loadFetchedMatch(deps: EnrichmentDeps): Promise<NormalizedMatch | null> {
  const cached = enrichmentCache.get(deps.matchId)
  if (cached !== undefined) {
    return cached
  }
  const request = (async () => {
    const result = await deps.fetchMatch(deps.matchId, deps.signal)
    if (!result.ok) {
      return null
    }
    const normalized = normalizeMatch(result.match)
    // Совпадение ID проверяется перед слиянием (см. `loadVisualizationMetadata`):
    // ответ другого матча не должен попасть в отображение ни при каких условиях.
    return normalized
  })()
  enrichmentCache.set(deps.matchId, request)
  return request
}

/**
 * Одно безопасное чтение матча для дополнения визуализаций.
 * Никогда не бросает исключений и не изменяет переданный матч.
 */
export async function loadVisualizationMetadata(deps: EnrichmentDeps): Promise<EnrichmentOutcome> {
  if (!needsVisualizationMetadata(deps.match)) {
    return { kind: 'not-needed', match: deps.match }
  }
  if (isAborted(deps.signal)) {
    return { kind: 'aborted', match: deps.match }
  }
  const fetched = await loadFetchedMatch(deps)
  if (isAborted(deps.signal)) {
    return { kind: 'aborted', match: deps.match }
  }
  if (fetched === null) {
    return { kind: 'unavailable', match: deps.match, reason: 'provider' }
  }
  if (fetched.match_id !== deps.matchId) {
    return { kind: 'unavailable', match: deps.match, reason: 'mismatch' }
  }
  return { kind: 'enriched', match: mergeVisualizationMetadata(deps.match, fetched) }
}
