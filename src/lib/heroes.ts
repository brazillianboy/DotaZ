import { HERO_CATALOG, type HeroInfo } from './heroCatalog'

/**
 * Хелперы справочника героев (Task 15).
 *
 * Модуль чистый: без сети, React и глобального состояния. Справочник `HERO_CATALOG`
 * сгенерирован из живого ответа OpenDota `GET /api/constants/heroes` (см. `heroCatalog.ts`).
 * Неизвестный `hero_id` не выдумывается: функции возвращают `null`, а интерфейс
 * показывает нейтральную подпись и не подставляет чужое изображение.
 */

/** Базовый адрес статических изображений героев на CDN Dota 2. */
export const HERO_IMAGE_BASE =
  'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes'

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
