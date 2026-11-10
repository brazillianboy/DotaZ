import type { HeroPrimaryAttribute } from './heroes'

/**
 * Live-статистика героев (Task 19) из OpenDota `GET /api/heroStats`.
 *
 * ## Проверено на живом API (08.11.2026)
 *
 * - ответ — массив из 127 записей; поля `id`, `localized_name`, `primary_attr`,
 *   `attack_type`, `roles`, `pub_pick`, `pub_win`, `turbo_picks`, `turbo_wins`,
 *   `pro_pick`, `pro_win`, `pro_ban`, `1_pick`/`1_win` … `8_pick`/`8_win`.
 * - **Патч в ответе отсутствует**: провайдер не сообщает ни патч, ни период наблюдений,
 *   поэтому эти числа нельзя выдавать за «мету текущего патча».
 * - `pub_pick` — число выборов героя в публичных разобранных матчах OpenDota; сумма
 *   по всем героям (37 897 929 на момент проверки) даёт знаменатель доли выборов.
 * - `N_pick`/`N_win` — разбивка по ранговым брекетам 1…8 (1 = Herald).
 *
 * ## Методика
 *
 * - винрейт = `wins / games × 100` при целых `games > 0` и `0 ≤ wins ≤ games`;
 * - доля выборов = `pick / сумма picks по всем героям × 100` — это доля выборов,
 *   а не вероятность увидеть героя в матче;
 * - отсутствие данных не подменяется нулём: `null` и явное состояние в интерфейсе.
 */

export const HERO_STATS_ENDPOINT = 'https://api.opendota.com/api/heroStats'
export const HERO_STATS_TIMEOUT_MS = 15000

/** Блок статистики: игры, победы и вычисленный винрейт. */
export interface HeroStatBlock {
  games: number
  wins: number
  winRate: number | null
}

export interface HeroStatsEntry {
  heroId: number
  localizedName: string
  primaryAttr: HeroPrimaryAttribute
  attackType: string | null
  roles: string[]
  /** Публичные разобранные матчи. */
  pub: HeroStatBlock
  turbo: HeroStatBlock
  pro: HeroStatBlock & { bans: number | null }
  /** Ранговые брекеты 1…8; индекс 0 соответствует брекету 1. */
  ranks: HeroStatBlock[]
}

export interface HeroStatsTotals {
  /** Сумма `pub_pick` по всем героям — знаменатель доли выборов. */
  pubPicks: number
  turboPicks: number
  proPicks: number
  rankPicks: number[]
}

export interface HeroStatsCatalog {
  entries: ReadonlyMap<number, HeroStatsEntry>
  totals: HeroStatsTotals
  /** Момент получения ответа (не период наблюдений). */
  retrievedAt: string
}

/**
 * Винрейт в процентах с округлением до 0.01. Невалидные значения → `null`
 * (никаких делений на ноль и «примерных» процентов).
 */
export function computeWinRate(wins: number, games: number): number | null {
  if (!Number.isInteger(wins) || !Number.isInteger(games)) {
    return null
  }
  if (games <= 0 || wins < 0 || wins > games) {
    return null
  }
  return Math.round((wins / games) * 10000) / 100
}

/** Доля выборов героя среди всех выборов героев в выборке провайдера. */
export function computePickShare(pick: number, totalPicks: number): number | null {
  if (!Number.isInteger(pick) || !Number.isInteger(totalPicks)) {
    return null
  }
  if (pick < 0 || totalPicks <= 0 || pick > totalPicks) {
    return null
  }
  return Math.round((pick / totalPicks) * 10000) / 100
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}

function block(games: unknown, wins: unknown): HeroStatBlock {
  const safeGames = count(games)
  const safeWins = count(wins)
  return { games: safeGames, wins: safeWins, winRate: computeWinRate(safeWins, safeGames) }
}

const PRIMARY_ATTRS: readonly HeroPrimaryAttribute[] = ['str', 'agi', 'int', 'all']
const RANK_COUNT = 8

/** Строгий разбор строки `/api/heroStats`; всё неподтверждённое → `null`. */
export function parseHeroStatsRow(raw: unknown): HeroStatsEntry | null {
  if (!isRecord(raw)) {
    return null
  }
  const heroId = raw.id
  if (typeof heroId !== 'number' || !Number.isInteger(heroId) || heroId <= 0) {
    return null
  }
  const localizedName = raw.localized_name
  if (typeof localizedName !== 'string' || localizedName.length === 0) {
    return null
  }
  const primaryAttr = raw.primary_attr
  if (
    typeof primaryAttr !== 'string' ||
    !PRIMARY_ATTRS.includes(primaryAttr as HeroPrimaryAttribute)
  ) {
    return null
  }
  const roles = Array.isArray(raw.roles) ? raw.roles.filter((r) => typeof r === 'string') : []
  const ranks: HeroStatBlock[] = []
  for (let rank = 1; rank <= RANK_COUNT; rank += 1) {
    ranks.push(block(raw[`${rank}_pick`], raw[`${rank}_win`]))
  }
  return {
    heroId,
    localizedName,
    primaryAttr: primaryAttr as HeroPrimaryAttribute,
    attackType: typeof raw.attack_type === 'string' ? raw.attack_type : null,
    roles,
    pub: block(raw.pub_pick, raw.pub_win),
    turbo: block(raw.turbo_picks, raw.turbo_wins),
    pro: {
      ...block(raw.pro_pick, raw.pro_win),
      // Баны: строгая проверка. Отсутствующее или некорректное значение — `null`,
      // а не 0, чтобы «провайдер не сообщил» не выглядело как «банов не было».
      bans:
        typeof raw.pro_ban === 'number' && Number.isInteger(raw.pro_ban) && raw.pro_ban >= 0
          ? raw.pro_ban
          : null,
    },
    ranks,
  }
}

/** Сборка каталога статистики и знаменателей; меньше 100 героев — отказ. */
export function buildHeroStatsCatalog(
  rows: readonly unknown[],
  retrievedAt: string = new Date().toISOString(),
): HeroStatsCatalog | null {
  const entries = new Map<number, HeroStatsEntry>()
  const rankPicks = new Array<number>(RANK_COUNT).fill(0)
  const totals: HeroStatsTotals = { pubPicks: 0, turboPicks: 0, proPicks: 0, rankPicks }
  for (const raw of rows) {
    const entry = parseHeroStatsRow(raw)
    if (entry === null || entries.has(entry.heroId)) {
      continue
    }
    entries.set(entry.heroId, entry)
    totals.pubPicks += entry.pub.games
    totals.turboPicks += entry.turbo.games
    totals.proPicks += entry.pro.games
    entry.ranks.forEach((rankBlock, index) => {
      totals.rankPicks[index] += rankBlock.games
    })
  }
  if (entries.size < 100) {
    return null
  }
  return { entries, totals, retrievedAt }
}

export type MetadataFetcher = (url: string) => Promise<unknown>

async function defaultFetcher(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), HERO_STATS_TIMEOUT_MS)
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

let cached: Promise<HeroStatsCatalog | null> | null = null

/**
 * Ленивая загрузка статистики с кешем в памяти: каталог и страница героя используют
 * один запрос. Сбой кешируется как `null`, чтобы не зацикливать сетевые вызовы.
 */
export function loadHeroStatsCatalog(
  fetcher: MetadataFetcher = defaultFetcher,
): Promise<HeroStatsCatalog | null> {
  if (cached === null) {
    cached = (async () => {
      const payload = await fetcher(HERO_STATS_ENDPOINT)
      if (!Array.isArray(payload)) {
        return null
      }
      return buildHeroStatsCatalog(payload)
    })()
  }
  return cached
}

/** Сброс кеша (тесты и повторная попытка после сбоя). */
export function resetHeroStatsCache(): void {
  cached = null
}

/** Запись статистики героя; неизвестный ID → `null`. */
export function heroStatsEntry(
  catalog: HeroStatsCatalog | null,
  heroId: number | null,
): HeroStatsEntry | null {
  if (catalog === null || heroId === null || !Number.isInteger(heroId)) {
    return null
  }
  return catalog.entries.get(heroId) ?? null
}

/** Доля выборов героя в публичных матчах выборки провайдера (в процентах). */
export function heroPickShare(
  catalog: HeroStatsCatalog | null,
  heroId: number | null,
): number | null {
  const entry = heroStatsEntry(catalog, heroId)
  if (catalog === null || entry === null) {
    return null
  }
  return computePickShare(entry.pub.games, catalog.totals.pubPicks)
}

/** Карта винрейтов и долей выборов для сортировки каталога. */
export function heroRateMap(
  catalog: HeroStatsCatalog | null,
): Map<number, { winRate: number | null; pickRate: number | null }> {
  const rates = new Map<number, { winRate: number | null; pickRate: number | null }>()
  if (catalog === null) {
    return rates
  }
  for (const entry of catalog.entries.values()) {
    rates.set(entry.heroId, {
      winRate: entry.pub.winRate,
      pickRate: computePickShare(entry.pub.games, catalog.totals.pubPicks),
    })
  }
  return rates
}
