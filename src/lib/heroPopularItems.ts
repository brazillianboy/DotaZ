import { ITEM_ID_TO_KEY } from './itemIdCatalog'

/**
 * Популярные предметы героя (Task 19) из OpenDota `GET /api/heroes/{hero_id}/itemPopularity`.
 *
 * ## Проверено на живом API (08.11.2026)
 *
 * Ответ — объект с четырьмя фазами: `start_game_items`, `early_game_items`,
 * `mid_game_items`, `late_game_items`; внутри — отображение `item_id → число`.
 * Для Phantom Lancer значения выглядят как счётчики (например, `63: 100`, `22: 82`)
 * и **знаменатель провайдером не публикуется**.
 *
 * Поэтому показываются именно счётчики вхождений, а не проценты: превращать их в
 * «долю игроков» без знаменателя нельзя. Популярность не означает оптимальность —
 * это описание выборки, а не рекомендация сборки.
 */

export const HERO_ITEM_POPULARITY_ENDPOINT = (heroId: number): string =>
  `https://api.opendota.com/api/heroes/${heroId}/itemPopularity`

export const HERO_ITEM_POPULARITY_TIMEOUT_MS = 15000

/** Сколько предметов показывать в каждой фазе. */
export const HERO_ITEM_POPULARITY_LIMIT = 5

export type ItemPhase = 'start' | 'early' | 'mid' | 'late'

export interface PopularItem {
  itemKey: string
  /** Счётчик вхождений в выборку провайдера (не процент). */
  count: number
}

export type PopularItemsByPhase = Record<ItemPhase, PopularItem[]>

const PHASE_FIELDS: Record<ItemPhase, string> = {
  start: 'start_game_items',
  early: 'early_game_items',
  mid: 'mid_game_items',
  late: 'late_game_items',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePhase(raw: unknown, limit: number): PopularItem[] {
  if (!isRecord(raw)) {
    return []
  }
  const items: PopularItem[] = []
  for (const [rawId, rawCount] of Object.entries(raw)) {
    const itemId = Number(rawId)
    if (!Number.isInteger(itemId) || itemId <= 0) {
      continue
    }
    if (typeof rawCount !== 'number' || !Number.isInteger(rawCount) || rawCount <= 0) {
      continue
    }
    const itemKey = ITEM_ID_TO_KEY[itemId]
    if (typeof itemKey !== 'string' || itemKey.length === 0) {
      continue
    }
    items.push({ itemKey, count: rawCount })
  }
  return items
    .sort((a, b) => b.count - a.count || a.itemKey.localeCompare(b.itemKey, 'en'))
    .slice(0, limit)
}

/** Разбор ответа: неизвестные `item_id` и невалидные счётчики отбрасываются. */
export function parseItemPopularity(
  raw: unknown,
  limit: number = HERO_ITEM_POPULARITY_LIMIT,
): PopularItemsByPhase | null {
  if (!isRecord(raw)) {
    return null
  }
  const result: PopularItemsByPhase = { start: [], early: [], mid: [], late: [] }
  let total = 0
  for (const phase of Object.keys(PHASE_FIELDS) as ItemPhase[]) {
    result[phase] = parsePhase(raw[PHASE_FIELDS[phase]], limit)
    total += result[phase].length
  }
  return total === 0 ? null : result
}

export type MetadataFetcher = (url: string) => Promise<unknown>

async function defaultFetcher(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), HERO_ITEM_POPULARITY_TIMEOUT_MS)
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
  }
}

const cache = new Map<number, PopularItemsByPhase | null>()

/**
 * Популярные предметы одного героя. Запрос выполняется только для открытого профиля,
 * результат кешируется в памяти, сбой кешируется как «нет данных».
 */
export async function loadHeroItemPopularity(
  heroId: number | null,
  fetcher: MetadataFetcher = defaultFetcher,
): Promise<PopularItemsByPhase | null> {
  if (heroId === null || !Number.isInteger(heroId) || heroId <= 0) {
    return null
  }
  const cached = cache.get(heroId)
  if (cached !== undefined) {
    return cached
  }
  const payload = await fetcher(HERO_ITEM_POPULARITY_ENDPOINT(heroId))
  const parsed = parseItemPopularity(payload)
  cache.set(heroId, parsed)
  return parsed
}

/** Сброс кеша популярных предметов (тесты). */
export function resetHeroItemPopularityCache(): void {
  cache.clear()
}
