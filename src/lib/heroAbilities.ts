import { heroInfo } from './heroes'

/**
 * Способности, таланты и фасеты героя (Task 19).
 *
 * ## Проверено на живом API (2026-11-09, скрипт `scripts/audit-hero-abilities.mjs`)
 *
 * - `GET /api/constants/hero_abilities` — 127 записей вида
 *   `{ abilities: string[], talents: [{ name, level }], facets: [{ id, name, title,
 *   description, deprecated, color, icon }] }` по ключу `npc_dota_hero_<slug>`.
 *   Проверено: для всех 127 героев каталога ключ `npc_dota_hero_<slug>` существует.
 * - `GET /api/constants/abilities` — 3084 записи: `dname`, `behavior`, `dmg_type`,
 *   `target_type`, `target_team`, `dispellable`, `bkbpierce`, `desc`, `attrib[]`, `img`.
 *   **Описание есть только у 1006 записей** (из 3084). Эта цифра относится ко всему
 *   каталогу, включая устаревшие, служебные и неигровые записи, и НЕ равна покрытию
 *   актуальных способностей героев каталога.
 * - **Реальное покрытие игровых записей (аудит 2026-11-09):** 866 способностей в
 *   списках 127 героев каталога; 753 с описанием (86.95 %), 113 без описания,
 *   866 с иконкой (100 %), 0 отсутствующих в каталоге. Талантов 1023 (996 с именем).
 *   Фасетов 339, из них 307 активных и 32 устаревших; активных с описанием 292.
 * - Часть описаний содержит служебный placeholder `[object Object]` (незаполненные
 *   подстановки провайдера). Такой текст не показывается: он помечается как недоступный.
 * - Язык описаний — английский (язык источника). Русский перевод игровой механики не
 *   додумывается: интерфейс прямо сообщает, что описание недоступно на языке страницы.
 * - Патч провайдером не указывается: это снимок справочника, а не гарантия текущего патча.
 *
 * Количество способностей не фиксировано: у Phantom Assassin их шесть
 * (`stifling_dagger`, `phantom_strike`, `blur`, `fan_of_knives`, `immaterial`,
 * `coup_de_grace`), у Kez — одиннадцать, у Largo — четырнадцать, у Muerta — девять
 * без единого описания. Никакие «четыре слота» не предполагаются, типы способностей
 * не додумываются.
 */

export const HERO_ABILITIES_ENDPOINT = 'https://api.opendota.com/api/constants/hero_abilities'
export const ABILITIES_CATALOG_ENDPOINT = 'https://api.opendota.com/api/constants/abilities'
export const HERO_ABILITIES_TIMEOUT_MS = 15000

/** Базовый адрес иконок способностей на CDN Dota 2 (как в `abilities.ts`). */
export const ABILITY_ICON_CDN = 'https://cdn.cloudflare.steamstatic.com'

/** Служебный placeholder, который провайдер иногда оставляет в описаниях. */
const BROKEN_TEXT_MARKER = '[object Object]'

export interface HeroAbilityAttribute {
  header: string
  value: string
}

export interface HeroAbility {
  /** Внутреннее имя OpenDota (`phantom_assassin_stifling_dagger`). */
  name: string
  displayName: string
  /** `true`, если провайдер отдал `dname`. Иначе `displayName` — техническое имя. */
  hasDisplayName: boolean
  /** Описание или `null`, если провайдер его не отдал (в т. ч. placeholder). */
  description: string | null
  /** Тип поведения: `Passive`, `Unit Target`, `No Target` и т. п. */
  behavior: string | null
  damageType: string | null
  targetType: string | null
  targetTeam: string | null
  dispellable: string | null
  piercesImmunity: string | null
  iconUrl: string | null
  /** Провайдер помечает врождённые способности полем `is_innate`. */
  isInnate: boolean
  attributes: HeroAbilityAttribute[]
}

export interface HeroTalent {
  name: string
  /** Уровень таланта из справочника (1…4), как его отдаёт провайдер. */
  level: number
  displayName: string | null
}

export interface HeroFacet {
  name: string
  title: string
  /** Описание или `null`, если провайдер оставил незаполненные подстановки. */
  description: string | null
  color: string | null
}

export interface HeroAbilityData {
  heroId: number
  abilities: HeroAbility[]
  talents: HeroTalent[]
  facets: HeroFacet[]
  /** Сколько способностей пришло без описания (для честной подписи в интерфейсе). */
  abilitiesWithoutDescription: number
  /** Сколько способностей пришло без `dname` (показывается техническое имя). */
  abilitiesWithoutDisplayName: number
  /** Сколько способностей провайдер пометил врождёнными (`is_innate`). */
  innateAbilities: number
  /** Сколько активных фасетов пришло без описания. */
  facetsWithoutDescription: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Текст из справочника: обрезка, отбрасывание пустого и сломанного placeholder. */
export function sanitizeAbilityText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.includes(BROKEN_TEXT_MARKER)) {
    return null
  }
  return trimmed
}

/**
 * Провайдер помечает устаревшие фасеты по-разному: встречаются и `'1'`, и `'true'`,
 * и булево `true`. Все варианты считаются устаревшими — иначе устаревший фасет
 * мог бы быть показан как актуальный.
 */
export function isDeprecatedFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

/**
 * Текст поля, которое провайдер иногда отдаёт массивом (`behavior`, `target_type`).
 * Значения соединяются через `, ` без изменения порядка; пустые отбрасываются.
 */
export function sanitizeAbilityList(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return sanitizeAbilityText(value)
  }
  const parts: string[] = []
  for (const item of value) {
    const text = sanitizeAbilityText(item)
    if (text !== null) {
      parts.push(text)
    }
  }
  return parts.length === 0 ? null : parts.join(', ')
}

/** Ключ героя в справочнике способностей: `npc_dota_hero_<slug>`. */
export function heroAbilitiesKey(heroId: number | null): string | null {
  const info = heroInfo(heroId)
  if (info === null) {
    return null
  }
  const slug = info.slug.replace(/\.png$/i, '')
  return slug.length === 0 ? null : `npc_dota_hero_${slug}`
}

function iconUrlFrom(name: string, raw: unknown): string | null {
  if (typeof raw === 'string' && raw.startsWith('/')) {
    return `${ABILITY_ICON_CDN}${raw}`
  }
  return `${ABILITY_ICON_CDN}/apps/dota2/images/dota_react/abilities/${name}.png`
}

/** Разбор одной способности; неизвестное имя → `null`. */
export function parseAbility(name: string, raw: unknown): HeroAbility | null {
  if (typeof name !== 'string' || name.length === 0 || !isRecord(raw)) {
    return null
  }
  const attributes: HeroAbilityAttribute[] = []
  if (Array.isArray(raw.attrib)) {
    for (const entry of raw.attrib) {
      if (!isRecord(entry)) {
        continue
      }
      const header = sanitizeAbilityText(entry.header)
      const value = Array.isArray(entry.value)
        ? entry.value.map((item) => String(item)).join(' / ')
        : entry.value === undefined || entry.value === null
          ? null
          : String(entry.value)
      if (header !== null && value !== null) {
        attributes.push({ header, value })
      }
    }
  }
  const displayName = sanitizeAbilityText(raw.dname)
  return {
    name,
    displayName: displayName ?? name,
    hasDisplayName: displayName !== null,
    description: sanitizeAbilityText(raw.desc),
    behavior: sanitizeAbilityList(raw.behavior),
    damageType: sanitizeAbilityText(raw.dmg_type),
    targetType: sanitizeAbilityList(raw.target_type),
    targetTeam: sanitizeAbilityText(raw.target_team),
    dispellable: sanitizeAbilityText(raw.dispellable),
    piercesImmunity: sanitizeAbilityText(raw.bkbpierce),
    iconUrl: iconUrlFrom(name, raw.img),
    isInnate: raw.is_innate === true,
    attributes,
  }
}

/** Разбор записи героя из `/api/constants/hero_abilities`. */
export function parseHeroAbilityRecord(
  heroId: number,
  record: unknown,
  abilitiesCatalog: unknown,
): HeroAbilityData | null {
  if (!isRecord(record)) {
    return null
  }
  const catalog = isRecord(abilitiesCatalog) ? abilitiesCatalog : {}
  const names = Array.isArray(record.abilities)
    ? record.abilities.filter((name): name is string => typeof name === 'string' && name.length > 0)
    : []

  const abilities: HeroAbility[] = []
  for (const name of names) {
    const parsed = parseAbility(name, catalog[name])
    if (parsed !== null) {
      abilities.push(parsed)
    }
  }

  const talents: HeroTalent[] = []
  if (Array.isArray(record.talents)) {
    for (const entry of record.talents) {
      if (!isRecord(entry)) {
        continue
      }
      const name = sanitizeAbilityText(entry.name)
      const level = entry.level
      if (name === null || typeof level !== 'number' || !Number.isInteger(level)) {
        continue
      }
      const details = catalog[name]
      talents.push({
        name,
        level,
        displayName: isRecord(details) ? sanitizeAbilityText(details.dname) : null,
      })
    }
  }

  // Фасеты: только неустаревшие (`deprecated === '1'` помечается провайдером как старый).
  const facets: HeroFacet[] = []
  if (Array.isArray(record.facets)) {
    for (const entry of record.facets) {
      if (!isRecord(entry)) {
        continue
      }
      if (isDeprecatedFlag(entry.deprecated)) {
        continue
      }
      const title = sanitizeAbilityText(entry.title)
      const name = sanitizeAbilityText(entry.name)
      if (title === null || name === null) {
        continue
      }
      facets.push({
        name,
        title,
        description: sanitizeAbilityText(entry.description),
        color: sanitizeAbilityText(entry.color),
      })
    }
  }

  if (abilities.length === 0 && talents.length === 0 && facets.length === 0) {
    return null
  }

  return {
    heroId,
    abilities,
    talents,
    facets,
    abilitiesWithoutDescription: abilities.filter((ability) => ability.description === null).length,
    abilitiesWithoutDisplayName: abilities.filter((ability) => !ability.hasDisplayName).length,
    innateAbilities: abilities.filter((ability) => ability.isInnate).length,
    facetsWithoutDescription: facets.filter((facet) => facet.description === null).length,
  }
}

/**
 * Обычные (не врождённые) способности героя.
 *
 * Провайдер делит способности только флагом `is_innate`; отдельной пометки
 * «дополнительная/скрытая» он не отдаёт. Поэтому «прочие» способности (субабилки,
 * переключатели форм, способности с нестандартными слотами) остаются в этой группе:
 * придумывать для них категорию без подтверждения источника нельзя.
 */
export function standardAbilities(data: HeroAbilityData): HeroAbility[] {
  return data.abilities.filter((ability) => !ability.isInnate)
}

/** Врождённые способности героя, как их пометил провайдер (`is_innate`). */
export function innateAbilities(data: HeroAbilityData): HeroAbility[] {
  return data.abilities.filter((ability) => ability.isInnate)
}

export type MetadataFetcher = (url: string) => Promise<unknown>

async function defaultFetcher(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), HERO_ABILITIES_TIMEOUT_MS)
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

let heroAbilitiesCatalog: Promise<unknown | null> | null = null
let abilitiesCatalog: Promise<unknown | null> | null = null

function loadHeroAbilitiesCatalog(fetcher: MetadataFetcher): Promise<unknown | null> {
  if (heroAbilitiesCatalog === null) {
    heroAbilitiesCatalog = fetcher(HERO_ABILITIES_ENDPOINT)
  }
  return heroAbilitiesCatalog
}

function loadAbilitiesCatalog(fetcher: MetadataFetcher): Promise<unknown | null> {
  if (abilitiesCatalog === null) {
    abilitiesCatalog = fetcher(ABILITIES_CATALOG_ENDPOINT)
  }
  return abilitiesCatalog
}

/**
 * Данные способностей героя. Оба справочника загружаются один раз за сессию и
 * кешируются; при сбое возвращается `null` (интерфейс показывает состояние
 * «справочник недоступен», а не выдуманные способности).
 */
export async function loadHeroAbilityData(
  heroId: number | null,
  fetcher: MetadataFetcher = defaultFetcher,
): Promise<HeroAbilityData | null> {
  if (heroId === null || !Number.isInteger(heroId)) {
    return null
  }
  const key = heroAbilitiesKey(heroId)
  if (key === null) {
    return null
  }
  const [heroCatalogRaw, abilitiesRaw] = await Promise.all([
    loadHeroAbilitiesCatalog(fetcher),
    loadAbilitiesCatalog(fetcher),
  ])
  if (!isRecord(heroCatalogRaw)) {
    return null
  }
  return parseHeroAbilityRecord(heroId, heroCatalogRaw[key], abilitiesRaw)
}

/** Сброс кешей справочников (тесты и повторная попытка после сбоя). */
export function resetHeroAbilityCaches(): void {
  heroAbilitiesCatalog = null
  abilitiesCatalog = null
}
