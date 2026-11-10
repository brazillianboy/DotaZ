import { HERO_CATALOG, type HeroInfo } from './heroCatalog'
import {
  HERO_ATTRIBUTE_ROWS,
  HERO_ATTRIBUTES_GENERATED_AT,
  type HeroPrimaryAttribute,
} from './heroAttributes'

/**
 * Хелперы справочника героев (Task 15, расширены в Task 19).
 *
 * Модуль чистый: без сети, React и глобального состояния. Справочник `HERO_CATALOG`
 * сгенерирован из живого ответа OpenDota `GET /api/constants/heroes` (см. `heroCatalog.ts`).
 * Атрибуты героев лежат в `heroAttributes.ts` — это статический снимок того же
 * справочника для тех же `hero_id`, а не второй каталог идентичности.
 * Неизвестный `hero_id` не выдумывается: функции возвращают `null`, а интерфейс
 * показывает нейтральную подпись и не подставляет чужое изображение.
 */

/** Базовый адрес статических изображений героев на CDN Dota 2. */
export const HERO_IMAGE_BASE =
  'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes'

/**
 * Подтверждённые атрибуты героя: базовые значения, рост и характеристики из
 * справочника. Рассчитанные показатели здесь не хранятся.
 */
export interface HeroAttributes {
  heroId: number
  primaryAttr: HeroPrimaryAttribute
  attackType: string | null
  roles: string[]
  baseStr: number | null
  strGain: number | null
  baseAgi: number | null
  agiGain: number | null
  baseInt: number | null
  intGain: number | null
  baseHealth: number | null
  baseMana: number | null
  baseArmor: number | null
  baseMr: number | null
  baseAttackMin: number | null
  baseAttackMax: number | null
  attackRange: number | null
  attackRate: number | null
  baseAttackTime: number | null
  attackPoint: number | null
  projectileSpeed: number | null
  moveSpeed: number | null
  turnRate: number | null
  legs: number | null
  dayVision: number | null
  nightVision: number | null
  cmEnabled: boolean | null
}

function parseAttributeRow(row: (typeof HERO_ATTRIBUTE_ROWS)[number]): HeroAttributes {
  return {
    heroId: row[0],
    primaryAttr: row[1],
    attackType: row[2],
    roles: [...row[3]],
    baseStr: row[4],
    strGain: row[5],
    baseAgi: row[6],
    agiGain: row[7],
    baseInt: row[8],
    intGain: row[9],
    baseHealth: row[10],
    baseMana: row[11],
    baseArmor: row[12],
    baseMr: row[13],
    baseAttackMin: row[14],
    baseAttackMax: row[15],
    attackRange: row[16],
    attackRate: row[17],
    baseAttackTime: row[18],
    attackPoint: row[19],
    projectileSpeed: row[20],
    moveSpeed: row[21],
    turnRate: row[22],
    legs: row[23],
    dayVision: row[24],
    nightVision: row[25],
    cmEnabled: row[26],
  }
}

/** Атрибуты по `hero_id` из сгенерированного снимка справочника. */
export const HERO_ATTRIBUTES: ReadonlyMap<number, HeroAttributes> = new Map(
  HERO_ATTRIBUTE_ROWS.map((row) => [row[0], parseAttributeRow(row)]),
)

export { HERO_ATTRIBUTES_GENERATED_AT }
export type { HeroPrimaryAttribute }

/** Атрибуты героя; неизвестный ID → `null`. */
export function heroAttributes(heroId: number | null): HeroAttributes | null {
  if (heroId === null || !Number.isInteger(heroId)) {
    return null
  }
  return HERO_ATTRIBUTES.get(heroId) ?? null
}

/** Запись каталога для списков и карточек: идентичность + подтверждённые атрибуты. */
export interface HeroCatalogEntry {
  heroId: number
  name: string
  /** Slug изображения на CDN Dota 2. */
  slug: string
  imageUrl: string
  primaryAttr: HeroPrimaryAttribute | null
  attackType: string | null
  roles: string[]
}

/** Все герои каталога, отсортированные по `hero_id` (стабильный порядок). */
export function heroCatalogEntries(): HeroCatalogEntry[] {
  return Object.keys(HERO_CATALOG)
    .map((key) => Number(key))
    .sort((a, b) => a - b)
    .map((heroId) => {
      const info = HERO_CATALOG[heroId]
      const attributes = HERO_ATTRIBUTES.get(heroId) ?? null
      return {
        heroId,
        name: info.name,
        slug: info.slug,
        imageUrl: `${HERO_IMAGE_BASE}/${info.slug}`,
        primaryAttr: attributes?.primaryAttr ?? null,
        attackType: attributes?.attackType ?? null,
        roles: attributes?.roles ?? [],
      }
    })
}

/** Информация о герое по подтверждённому `hero_id`; неизвестный ID → `null`. */
export function heroInfo(heroId: number | null): HeroInfo | null {
  if (heroId === null || !Number.isInteger(heroId)) {
    return null
  }
  return HERO_CATALOG[heroId] ?? null
}

/** Название героя из справочника; неизвестный ID → `null`. */
export function heroName(heroId: number | null): string | null {
  const info = heroInfo(heroId)
  return info === null ? null : info.name
}

/**
 * URL портрета героя; неизвестный ID → `null`, чтобы интерфейс не показывал
 * битое изображение (проверено: несуществующий файл отдаёт HTTP 404).
 * В справочнике хранится имя файла изображения (`drow_ranger.png`), поэтому
 * расширение при необходимости дописывается один раз.
 */
export function heroImageUrl(heroId: number | null): string | null {
  const info = heroInfo(heroId)
  if (info === null) {
    return null
  }
  const file = info.slug.endsWith('.png') ? info.slug : `${info.slug}.png`
  return `${HERO_IMAGE_BASE}/${file}`
}

/** Известен ли герой в проверенном справочнике. */
export function isKnownHero(heroId: number | null): boolean {
  return heroInfo(heroId) !== null
}

/** Количество героев в справочнике (для диагностики и тестов). */
export function heroCatalogSize(): number {
  return Object.keys(HERO_CATALOG).length
}
