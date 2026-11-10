import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '../i18n/I18nContext'
import type { HeroAbility, HeroAbilityData } from '../lib/heroAbilities'
import HeroAbilitiesPanel from './HeroAbilitiesPanel'

/**
 * Разметка групп способностей (Task 19).
 *
 * Проверяется то, что видит пользователь: обычные и врождённые способности разделены,
 * отсутствие описания и отображаемого имени показано локализованным fallback-текстом,
 * способность при этом не скрывается. Ни одна проверка не зависит от сети.
 */

const CYRILLIC = /[А-Яа-яЁё]/

function ability(overrides: Partial<HeroAbility> = {}): HeroAbility {
  return {
    name: 'test_ability',
    displayName: 'Test Ability',
    hasDisplayName: true,
    description: 'Verified description.',
    behavior: 'No Target',
    damageType: 'Magical',
    targetType: null,
    targetTeam: null,
    dispellable: null,
    piercesImmunity: 'No',
    iconUrl: null,
    isInnate: false,
    attributes: [{ header: 'Damage', value: '10 / 20' }],
    ...overrides,
  }
}

function data(overrides: Partial<HeroAbilityData> = {}): HeroAbilityData {
  return {
    heroId: 86,
    abilities: [ability(), ability({ name: 'innate_one', displayName: 'Innate One', isInnate: true })],
    talents: [{ name: 'special_bonus_x', level: 1, displayName: '+20 Movement Speed' }],
    facets: [
      { name: 'facet_ok', title: 'Facet OK', description: 'Verified facet.', color: null },
    ],
    abilitiesWithoutDescription: 0,
    abilitiesWithoutDisplayName: 0,
    innateAbilities: 1,
    facetsWithoutDescription: 0,
    ...overrides,
  }
}

function render(node: ReactElement, locale: 'ru' | 'en' = 'ru'): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <StaticRouter location="/heroes/86">{node}</StaticRouter>
    </I18nProvider>,
  )
}

describe('группы способностей в профиле героя', () => {
  it('обычные и врождённые способности разделены по группам', () => {
    const html = render(<HeroAbilitiesPanel data={data()} state="ready" />)
    expect(html).toContain('data-ability-group="standard"')
    expect(html).toContain('data-ability-group="innate"')
    expect(html).toContain('Обычные способности')
    expect(html).toContain('Врождённые способности')
    // врождённая способность не дублируется в обычной группе
    const standardStart = html.indexOf('data-ability-group="standard"')
    const innateStart = html.indexOf('data-ability-group="innate"')
    expect(standardStart).toBeGreaterThan(-1)
    expect(innateStart).toBeGreaterThan(standardStart)
    expect(html.slice(standardStart, innateStart)).not.toContain('innate_one')
    expect(html.slice(innateStart)).toContain('innate_one')
  })

  it('герой без врождённых способностей не получает пустой группы', () => {
    const html = render(
      <HeroAbilitiesPanel
        data={data({ abilities: [ability()], innateAbilities: 0 })}
        state="ready"
      />,
    )
    expect(html).toContain('data-ability-group="standard"')
    expect(html).not.toContain('data-ability-group="innate"')
    expect(html).not.toContain('Врождённые способности')
  })

  it('строка покрытия показывает всего, с описанием и без описания', () => {
    const html = render(
      <HeroAbilitiesPanel
        data={data({
          abilities: [ability(), ability({ name: 'no_desc', description: null })],
          abilitiesWithoutDescription: 1,
        })}
        state="ready"
      />,
    )
    expect(html).toContain('Способностей из справочника: 2')
    expect(html).toContain('с описанием: 1')
    expect(html).toContain('без описания: 1')
  })

  it('способность без описания не скрывается и получает локализованный fallback', () => {
    const html = render(
      <HeroAbilitiesPanel
        data={data({
          abilities: [ability({ name: 'quiet', description: null })],
          abilitiesWithoutDescription: 1,
          innateAbilities: 0,
        })}
        state="ready"
      />,
    )
    expect(html).toContain('data-ability="quiet"')
    expect(html).toContain('Описание недоступно в источнике.')
    expect(html).toContain('У части способностей (1)')
  })

  it('способность без dname показывает техническое имя и пометку', () => {
    const html = render(
      <HeroAbilitiesPanel
        data={data({
          abilities: [
            ability({ name: 'muerta_parting_shot', displayName: 'muerta_parting_shot', hasDisplayName: false }),
          ],
          abilitiesWithoutDisplayName: 1,
          innateAbilities: 0,
        })}
        state="ready"
      />,
    )
    expect(html).toContain('muerta_parting_shot')
    expect(html).toContain('техническое имя')
    expect(html).toContain('провайдер не отдал отображаемое имя')
  })
})


describe('фасеты и таланты в профиле героя', () => {
  it('фасет без описания не скрывается, показывается локализованный fallback', () => {
    const html = render(
      <HeroAbilitiesPanel
        data={data({
          facets: [{ name: 'facet_quiet', title: 'Facet Quiet', description: null, color: null }],
          facetsWithoutDescription: 1,
        })}
        state="ready"
      />,
    )
    expect(html).toContain('data-facet="facet_quiet"')
    expect(html).toContain('Описание фасета недоступно в источнике.')
    expect(html).toContain('У части активных фасетов (1)')
  })

  it('отсутствие талантов и фасетов подписано, а не оставлено пустым', () => {
    const html = render(
      <HeroAbilitiesPanel data={data({ talents: [], facets: [] })} state="ready" />,
    )
    expect(html).toContain('Таланты в справочнике отсутствуют.')
    expect(html).toContain('Активных фасетов в справочнике нет.')
    expect(html).toContain('Устаревшие фасеты провайдера не показываются')
  })

  it('провайдер не помечает «дополнительные» способности — это сказано прямо', () => {
    const html = render(<HeroAbilitiesPanel data={data()} state="ready" />)
    expect(html).toContain('отдельной пометки «дополнительная» он не отдаёт')
  })

  it('язык описаний указан явно: перевод механики не додумывается', () => {
    const html = render(<HeroAbilitiesPanel data={data()} state="ready" />)
    expect(html).toContain('на языке источника (английский)')
    expect(html).toContain('не додумывается')
  })

  it('нестандартное количество способностей отображается полностью', () => {
    const many = Array.from({ length: 14 }, (_unused, index) =>
      ability({ name: `largo_${index}`, displayName: `Largo ${index}` }),
    )
    const html = render(
      <HeroAbilitiesPanel data={data({ abilities: many, innateAbilities: 0 })} state="ready" />,
    )
    for (let index = 0; index < 14; index += 1) {
      expect(html).toContain(`data-ability="largo_${index}"`)
    }
    expect(html).toContain('Способностей из справочника: 14')
  })
})

describe('локализация панели способностей', () => {
  it('английская версия без кириллицы и с теми же fallback-текстами', () => {
    const html = render(
      <HeroAbilitiesPanel
        data={data({
          abilities: [ability({ name: 'quiet', description: null, hasDisplayName: false })],
          abilitiesWithoutDescription: 1,
          abilitiesWithoutDisplayName: 1,
          facets: [{ name: 'facet_quiet', title: 'Facet Quiet', description: null, color: null }],
          facetsWithoutDescription: 1,
        })}
        state="ready"
      />,
      'en',
    )
    expect(CYRILLIC.test(html)).toBe(false)
    expect(html).toContain('Standard abilities')
    expect(html).toContain('Innate abilities')
    expect(html).toContain('Description is unavailable in the source.')
    expect(html).toContain('The facet description is unavailable in the source.')
    expect(html).toContain('technical name')
  })

  it('состояния загрузки и сбоя различаются и не показывают способности', () => {
    const loading = render(<HeroAbilitiesPanel data={null} state="loading" />)
    expect(loading).toContain('Загружаем способности…')
    expect(loading).not.toContain('data-ability=')
    const error = render(<HeroAbilitiesPanel data={null} state="error" />)
    expect(error).toContain('Справочник способностей недоступен')
    expect(error).not.toContain('data-ability=')
    const empty = render(<HeroAbilitiesPanel data={null} state="ready" />)
    expect(empty).toContain('Провайдер не вернул способности для этого героя.')
  })
})
