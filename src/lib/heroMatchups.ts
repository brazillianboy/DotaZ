import { computeWinRate } from './heroStats'
import { isKnownHero } from './heroes'

/**
 * Матчапы героя (Task 19) из OpenDota `GET /api/heroes/{hero_id}/matchups`.
 *
 * ## Проверено на живом API (08.11.2026)
 *
 * - ответ — массив `{ hero_id, games_played, wins }` (для героя 12 — 125 записей);
 * - `hero_id` в строке — **герой-соперник**, запрошенный герой является точкой отсчёта;
 * - `wins` — победы **запрошенного** героя. Проверено антисимметрией: для пары 12↔11
 *   `games_played` = 80 и 80, `wins` = 37 и 43, сумма = 80 = числу игр. Если бы `wins`
 *   были победами соперника, значения совпадали бы, а не дополняли друг друга;
 * - провайдер **не публикует** патч, дату, бракет, режим и определение выборки,
 *   поэтому ранжирование нельзя называть статистикой текущего патча.
 */

export const HERO_MATCHUPS_ENDPOINT = (heroId: number): string =>
  `https://api.opendota.com/api/heroes/${heroId}/matchups`

/** Минимум матчей на пару соперников для участия в рейтинге. */
export const HERO_MATCHUPS_MIN_GAMES = 100

/** Максимум соперников в каждой группе. */
export const HERO_MATCHUPS_LIMIT = 5

export const HERO_MATCHUPS_TIMEOUT_MS = 15000

/** Подтверждённая пара «соперник ↔ запрошенный герой». */
export interface MatchupRow {
  opponentId: number
  games: number
  wins: number
  /** Винрейт запрошенного героя против соперника, %. */
  winRate: number
}

export interface RankedMatchups {
  strongest: MatchupRow[]
  weakest: MatchupRow[]
  /** Сколько пар прошло порог до исключения пересечений. */
  qualifiedCount: number
  /** Слабейшая группа короче лимита из-за нехватки данных. */
  weakestLimited: boolean
  /** Меньше 10 подходящих соперников: обе группы по 5 невозможны без пересечений. */
  limitedCoverage: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Строгий разбор строки: неизвестный соперник, нулевые игры, победы больше игр
 * или нечисловые значения → `null`.
 */
export function parseMatchupRow(
  raw: unknown,
  knownHero: (heroId: number) => boolean = isKnownHero,
): MatchupRow | null {
  if (!isRecord(raw)) {
    return null
  }
  const opponentId = raw.hero_id
  const games = raw.games_played
  const wins = raw.wins
  if (typeof opponentId !== 'number' || !Number.isInteger(opponentId) || opponentId <= 0) {
    return null
  }
  if (!knownHero(opponentId)) {
    return null
  }
  if (typeof games !== 'number' || !Number.isInteger(games) || games <= 0) {
    return null
  }
  if (typeof wins !== 'number' || !Number.isInteger(wins) || wins < 0 || wins > games) {
    return null
  }
  const winRate = computeWinRate(wins, games)
  if (winRate === null) {
    return null
  }
  return { opponentId, games, wins, winRate }
}

/** Разбор всего ответа: невалидные строки пропускаются, дубли схлопываются. */
export function parseMatchupRows(
  raw: unknown,
  knownHero: (heroId: number) => boolean = isKnownHero,
): MatchupRow[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const byOpponent = new Map<number, MatchupRow>()
  for (const row of raw) {
    const parsed = parseMatchupRow(row, knownHero)
    if (parsed === null) {
      continue
    }
    const existing = byOpponent.get(parsed.opponentId)
    // Дубль соперника: оставляем строку с большей выборкой, при равенстве — первую.
    if (existing === undefined || parsed.games > existing.games) {
      byOpponent.set(parsed.opponentId, parsed)
    }
  }
  return [...byOpponent.values()]
}

export interface RankMatchupsOptions {
  minGames?: number
  limit?: number
}

/** Ранжирование на две непересекающиеся группы; данных не хватает — пустые группы. */
export function rankMatchups(
  rows: readonly MatchupRow[],
  options: RankMatchupsOptions = {},
): RankedMatchups {
  const minGames = options.minGames ?? HERO_MATCHUPS_MIN_GAMES
  const limit = options.limit ?? HERO_MATCHUPS_LIMIT

  const qualified = rows.filter((row) => row.games >= minGames)
  const strongest = [...qualified]
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games || a.opponentId - b.opponentId)
    .slice(0, limit)
  const takenIds = new Set(strongest.map((row) => row.opponentId))
  const weakest = [...qualified]
    .filter((row) => !takenIds.has(row.opponentId))
    .sort((a, b) => a.winRate - b.winRate || b.games - a.games || a.opponentId - b.opponentId)
    .slice(0, limit)

  return {
    strongest,
    weakest,
    qualifiedCount: qualified.length,
    weakestLimited: weakest.length < limit,
    limitedCoverage: qualified.length < limit * 2,
  }
}

export type MatchupFetcher = (url: string, signal?: AbortSignal) => Promise<unknown>

async function defaultFetcher(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), HERO_MATCHUPS_TIMEOUT_MS)
  const onAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      return null
    }
    return (await response.json()) as unknown
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onAbort)
  }
}

const cache = new Map<number, MatchupRow[]>()

/**
 * Загрузка матчапов только для одного героя. Успешный ответ кешируется в памяти,
 * отмена (`signal`) прекращает запрос и ничего не кеширует, сбой возвращает `null`.
 */
export async function loadHeroMatchups(
  heroId: number,
  options: { fetcher?: MatchupFetcher; signal?: AbortSignal } = {},
): Promise<MatchupRow[] | null> {
  if (!Number.isInteger(heroId) || heroId <= 0) {
    return null
  }
  const cachedRows = cache.get(heroId)
  if (cachedRows !== undefined) {
    return cachedRows
  }
  const fetcher = options.fetcher ?? defaultFetcher
  const payload = await fetcher(HERO_MATCHUPS_ENDPOINT(heroId), options.signal)
  if (payload === null) {
    return null
  }
  const rows = parseMatchupRows(payload)
  cache.set(heroId, rows)
  return rows
}

/** Сброс кеша матчапов (тесты). */
export function resetHeroMatchupsCache(): void {
  cache.clear()
}
