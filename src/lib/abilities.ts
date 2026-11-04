/**
 * Прокачка способностей (Task 15).
 *
 * ## Источник данных (проверено на живом API)
 *
 * - `players[].ability_upgrades_arr` — точная запись порядка: массив **числовых ID**
 *   способностей и талантов, где индекс `i` соответствует уровню героя `i + 1`
 *   (проверено на матче 9007760151: `[5019, 343, 5019, 5632, …]` → Frost Arrows,
 *   Multishot, Frost Arrows, Gust у Drow Ranger).
 * - `GET /api/constants/ability_ids` — 3150 записей вида `{"5019": "drow_ranger_frost_arrows"}`
 *   (ID → внутреннее имя).
 * - `GET /api/constants/abilities` — имена и названия: у обычных способностей есть
 *   `dname` и `img`, у талантов (`special_bonus_*`) — только `dname`
 *   (например, `+75 Attack Range`), поэтому иконка таланта не подставляется.
 *
 * Иконка строится статически по проверенному шаблону CDN:
 * `…/dota_react/abilities/{name}.png` (существующая способность → HTTP 200).
 *
 * ## Ограничения и честность
 *
 * - Порядок и уровни берутся ИСКЛЮЧИТЕЛЬНО из записанной последовательности:
 *   пропущенные уровни не выдумываются, события не сдвигаются.
 * - Талантом считается только ключ с префиксом `special_bonus_`; уровень таланта —
 *   его фактическая позиция в записи, а не предположение о фиксированном уровне.
 * - Неизвестный ID способности показывается как `#<id>` без иконки.
 * - Справочник способностей (3150 записей) не хранится в исходниках: он загружается
 *   один раз за сессию, кэшируется в памяти и не запрашивается повторно (в том числе
 *   при смене языка). При недоступности справочника показывается состояние
 *   «названия недоступны», а не выдуманные имена.
 */

export interface AbilityCatalogEntry {
  /** Внутреннее имя способности OpenDota (`drow_ranger_frost_arrows`). */
  name: string
  /** Отображаемое название (`Frost Arrows`) или внутреннее имя, если названия нет. */
  displayName: string
  /** URL иконки способности; `null` у талантов и неизвестных записей. */
  iconUrl: string | null
  /** Талант ли это (`special_bonus_*`). */
  isTalent: boolean
}

export interface AbilityCatalog {
  readonly byId: ReadonlyMap<number, AbilityCatalogEntry>
}

/** Адреса справочников OpenDota (проверены 30.10.2026). */
export const ABILITY_IDS_ENDPOINT = 'https://api.opendota.com/api/constants/ability_ids'
export const ABILITIES_ENDPOINT = 'https://api.opendota.com/api/constants/abilities'

/** Базовый адрес статических иконок способностей на CDN Dota 2. */
export const ABILITY_ICON_BASE =
  'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities'

/** Префикс внутренних имён талантов в справочнике OpenDota. */
export const TALENT_NAME_PREFIX = 'special_bonus_'

/** Таймаут загрузки справочника способностей. */
export const ABILITY_CATALOG_TIMEOUT_MS = 15000

export type MetadataFetcher = (url: string) => Promise<unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function defaultFetcher(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ABILITY_CATALOG_TIMEOUT_MS)
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

/**
 * Сборка справочника из двух ответов OpenDota (чистая функция, тестируемая без сети).
 * Любая некорректная структура → `null` (неполный справочник не подменяется догадками).
 */
export function buildAbilityCatalog(
  abilityIds: unknown,
  abilities: unknown,
): AbilityCatalog | null {
  if (!isRecord(abilityIds) || !isRecord(abilities)) {
    return null
  }
  const byId = new Map<number, AbilityCatalogEntry>()
  for (const [rawId, rawName] of Object.entries(abilityIds)) {
    const id = Number(rawId)
    if (!Number.isInteger(id) || id <= 0 || typeof rawName !== 'string' || rawName.length === 0) {
      continue
    }
    const record = abilities[rawName]
    const displayName =
      isRecord(record) && typeof record.dname === 'string' && record.dname.length > 0
        ? record.dname
        : rawName
    const isTalent = rawName.startsWith(TALENT_NAME_PREFIX)
    byId.set(id, {
      name: rawName,
      displayName,
      iconUrl: isTalent ? null : `${ABILITY_ICON_BASE}/${rawName}.png`,
      isTalent,
    })
  }
  if (byId.size === 0) {
    return null
  }
  return { byId }
}

let cachedCatalog: Promise<AbilityCatalog | null> | null = null

/**
 * Ленивая загрузка справочника способностей с кэшем в памяти процесса.
 * Повторные вызовы (в том числе после смены языка или перерисовки) не создают
 * новых сетевых запросов. Ошибка загрузки кэшируется как `null` — интерфейс
 * показывает состояние недоступности и не зацикливает запросы.
 */
export function loadAbilityCatalog(
  fetcher: MetadataFetcher = defaultFetcher,
): Promise<AbilityCatalog | null> {
  if (cachedCatalog === null) {
    cachedCatalog = (async () => {
      const [abilityIds, abilities] = await Promise.all([
        fetcher(ABILITY_IDS_ENDPOINT),
        fetcher(ABILITIES_ENDPOINT),
      ])
      return buildAbilityCatalog(abilityIds, abilities)
    })()
  }
  return cachedCatalog
}

/** Сброс кэша справочника (используется тестами и повторной попыткой после сбоя). */
export function resetAbilityCatalogCache(): void {
  cachedCatalog = null
}

/** Запись справочника по ID способности; неизвестный ID или нет справочника → `null`. */
export function abilityEntry(
  catalog: AbilityCatalog | null,
  abilityId: number,
): AbilityCatalogEntry | null {
  if (catalog === null || !Number.isInteger(abilityId)) {
    return null
  }
  return catalog.byId.get(abilityId) ?? null
}

/** Шаг прокачки: уровень героя и подтверждённая запись способности. */
export interface AbilityUpgradeStep {
  /** Уровень героя (индекс записи + 1); ничего не додумывается. */
  level: number
  /** ID способности из ответа OpenDota. */
  abilityId: number
  /** Внутреннее имя способности или `null`, если справочник недоступен/ID неизвестен. */
  name: string | null
  /** Отображаемое название или `null`. */
  displayName: string | null
  /** Иконка способности или `null` (таланты и неизвестные ID). */
  iconUrl: string | null
  /** Талант ли это; `false`, если подтвердить нельзя. */
  isTalent: boolean
}

/**
 * Последовательность прокачки из записи OpenDota.
 * `null` — данных нет; `[]` — запись пустая (герой не повышал способности).
 * Порядок и количество шагов сохраняются точно, включая уровни выше 25.
 */
export function buildAbilityTimeline(
  upgrades: number[] | null,
  catalog: AbilityCatalog | null,
): AbilityUpgradeStep[] | null {
  if (upgrades === null) {
    return null
  }
  return upgrades.map((abilityId, index) => {
    const entry = abilityEntry(catalog, abilityId)
    return {
      level: index + 1,
      abilityId,
      name: entry === null ? null : entry.name,
      displayName: entry === null ? null : entry.displayName,
      iconUrl: entry === null ? null : entry.iconUrl,
      isTalent: entry === null ? false : entry.isTalent,
    }
  })
}
