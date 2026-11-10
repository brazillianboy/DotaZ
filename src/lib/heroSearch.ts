import type { HeroCatalogEntry, HeroPrimaryAttribute } from './heroes'

/**
 * Поиск, фильтрация и сортировка каталога героев (Task 19).
 *
 * Модуль чистый: без сети, React и Supabase. Имена героев — официальные английские
 * названия из справочника OpenDota: русских названий провайдер не отдаёт, выдумывать
 * их нельзя. Поиск по русскому вводу невозможен без проверенного источника перевода.
 */

/** Фильтр по основному атрибуту. `any` — без фильтра, `universal` — атрибут `all`. */
export type HeroAttributeFilter = 'any' | 'str' | 'agi' | 'int' | 'universal'

export const HERO_ATTRIBUTE_FILTERS: readonly HeroAttributeFilter[] = [
  'any',
  'str',
  'agi',
  'int',
  'universal',
]

/** Значение `primary_attr` OpenDota для фильтра. */
function filterToPrimaryAttr(filter: HeroAttributeFilter): HeroPrimaryAttribute | null {
  if (filter === 'universal') {
    return 'all'
  }
  if (filter === 'any') {
    return null
  }
  return filter
}

/**
 * Нормализация поискового запроса: обрезка, схлопывание пробелов, нижний регистр.
 * Регистр и лишние пробелы не должны влиять на результат поиска.
 */
export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Совпадение героя с запросом: частичное, без учёта регистра и лишних пробелов. */
export function matchesHeroQuery(entry: HeroCatalogEntry, query: string): boolean {
  const normalized = normalizeSearchQuery(query)
  if (normalized.length === 0) {
    return true
  }
  const name = entry.name.toLowerCase()
  if (name.includes(normalized)) {
    return true
  }
  // Поиск по словам в любом порядке: «ranger drow» находит «Drow Ranger».
  const words = normalized.split(' ')
  return words.every((word) => name.includes(word))
}

/** Соответствие фильтру по атрибуту; герой без подтверждённого атрибута не проходит фильтр. */
export function matchesHeroAttribute(
  entry: HeroCatalogEntry,
  filter: HeroAttributeFilter,
): boolean {
  const expected = filterToPrimaryAttr(filter)
  if (expected === null) {
    return true
  }
  return entry.primaryAttr === expected
}

export interface HeroSearchOptions {
  query?: string
  attribute?: HeroAttributeFilter
}

/** Поиск и фильтрация одновременно; порядок исходного массива сохраняется. */
export function filterHeroes(
  entries: readonly HeroCatalogEntry[],
  options: HeroSearchOptions = {},
): HeroCatalogEntry[] {
  const query = options.query ?? ''
  const attribute = options.attribute ?? 'any'
  return entries.filter(
    (entry) => matchesHeroQuery(entry, query) && matchesHeroAttribute(entry, attribute),
  )
}

/** Режимы сортировки. Метрики меты доступны только при наличии проверенных статистик. */
export type HeroSortMode = 'name' | 'winRate' | 'pickRate'

export const HERO_SORT_MODES: readonly HeroSortMode[] = ['name', 'winRate', 'pickRate']

/** Проверенная метрика героя для сортировки (проценты или `null`, если данных нет). */
export interface HeroRateSnapshot {
  winRate: number | null
  pickRate: number | null
}

/**
 * Сортировка каталога. `name` — алфавитная (локаль `en`), метрики — по убыванию.
 * Герои без метрики всегда в конце; при равенстве — по названию, затем по `hero_id`,
 * чтобы порядок был детерминированным.
 */
export function sortHeroes(
  entries: readonly HeroCatalogEntry[],
  mode: HeroSortMode,
  rates?: ReadonlyMap<number, HeroRateSnapshot>,
): HeroCatalogEntry[] {
  const sorted = [...entries]
  const byName = (a: HeroCatalogEntry, b: HeroCatalogEntry): number =>
    a.name.localeCompare(b.name, 'en') || a.heroId - b.heroId

  if (mode === 'name' || rates === undefined) {
    return sorted.sort(byName)
  }

  const metric = (entry: HeroCatalogEntry): number | null => {
    const snapshot = rates.get(entry.heroId)
    if (snapshot === undefined) {
      return null
    }
    return mode === 'winRate' ? snapshot.winRate : snapshot.pickRate
  }

  return sorted.sort((a, b) => {
    const left = metric(a)
    const right = metric(b)
    if (left === null && right === null) {
      return byName(a, b)
    }
    if (left === null) {
      return 1
    }
    if (right === null) {
      return -1
    }
    if (left !== right) {
      return right - left
    }
    return byName(a, b)
  })
}
