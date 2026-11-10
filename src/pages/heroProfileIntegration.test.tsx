import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Route, Routes, StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '../i18n/I18nContext'
import { heroAttributes, heroInfo, heroName } from '../lib/heroes'
import HeroPage, { parseHeroRouteId } from './HeroPage'

/**
 * Интеграция профиля героя (Task 19).
 *
 * Проверяется связка «маршрут → подтверждённый герой → разделы профиля»: параметр
 * маршрута не подменяется, идентичность берётся из проверенного справочника, все
 * четыре блока данных стартуют независимо в состоянии загрузки, а неизвестный ID
 * даёт состояние «герой не найден» со ссылкой в каталог.
 */

const CYRILLIC = /[А-Яа-яЁё]/

function renderAt(path: string, locale: 'ru' | 'en' = 'ru'): string {
  const node: ReactElement = (
    <Routes>
      <Route path="/heroes/:heroId" element={<HeroPage />} />
    </Routes>
  )
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <StaticRouter location={path}>{node}</StaticRouter>
    </I18nProvider>,
  )
}

describe('параметр маршрута /heroes/:heroId', () => {
  it('подтверждённые ID разбираются в те же героев', () => {
    expect(parseHeroRouteId('86')).toBe(86)
    expect(parseHeroRouteId('85')).toBe(85)
    expect(parseHeroRouteId('1')).toBe(1)
    expect(heroName(86)).toBe('Rubick')
    expect(heroName(85)).toBe('Undying')
    expect(heroName(1)).toBe('Anti-Mage')
  })

  it('неизвестные и некорректные ID не превращаются в героя', () => {
    expect(parseHeroRouteId('9999')).toBeNull()
    expect(parseHeroRouteId('0')).toBeNull()
    expect(parseHeroRouteId('-1')).toBeNull()
    expect(parseHeroRouteId('86abc')).toBeNull()
    expect(parseHeroRouteId('')).toBeNull()
    expect(parseHeroRouteId(undefined)).toBeNull()
  })

  it('справочник характеристик согласован с каталогом героев', () => {
    for (const heroId of [1, 85, 86]) {
      expect(heroInfo(heroId)).not.toBeNull()
      expect(heroAttributes(heroId)).not.toBeNull()
    }
    expect(heroInfo(9999)).toBeNull()
    expect(heroAttributes(9999)).toBeNull()
  })
})

describe('рендер профиля героя', () => {
  it('/heroes/86 показывает Рубика и все разделы профиля', () => {
    const html = renderAt('/heroes/86')
    expect(html).toContain('data-hero-id="86"')
    expect(html).toContain('Rubick')
    expect(html).toContain('id="hero-attributes-title"')
    expect(html).toContain('id="hero-stats-title"')
    expect(html).toContain('id="hero-matchups-title"')
    expect(html).toContain('id="hero-abilities-title"')
    expect(html).toContain('id="hero-items-title"')
    expect(html).toContain('href="/heroes"')
  })

  it('разделы данных стартуют независимо в состоянии загрузки', () => {
    const html = renderAt('/heroes/86')
    expect(html).toContain('Загружаем статистику героев')
    expect(html).toContain('Загружаем матчапы')
    expect(html).toContain('Загружаем способности')
    // сбоя нет: серверный рендер не выполняет эффекты
    expect(html).not.toContain('Повторить загрузку')
  })

  it('характеристики берутся из статического справочника', () => {
    const html = renderAt('/heroes/1')
    const attributes = heroAttributes(1)
    expect(attributes).not.toBeNull()
    expect(html).toContain('Anti-Mage')
    expect(html).toContain(String(attributes?.moveSpeed))
    expect(html).toContain(String(attributes?.baseHealth))
    // подпись о дате снимка справочника, а не о статистике матчей
    expect(html).toContain('Снимок справочника OpenDota от')
  })

  it('/heroes/9999 даёт состояние «герой не найден» без чужих данных', () => {
    const html = renderAt('/heroes/9999')
    expect(html).toContain('Герой не найден')
    expect(html).not.toContain('data-hero-id=')
    expect(html).not.toContain('id="hero-abilities-title"')
    expect(html).toContain('href="/heroes"')
  })

  it('английская версия профиля без кириллицы', () => {
    const html = renderAt('/heroes/86', 'en')
    expect(CYRILLIC.test(html)).toBe(false)
    expect(html).toContain('Rubick')
  })
})
