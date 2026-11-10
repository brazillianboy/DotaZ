import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '../i18n/I18nContext'
import type { HeroAbilityData } from '../lib/heroAbilities'
import type { HeroStatsCatalog } from '../lib/heroStats'
import HeroAbilitiesPanel from './HeroAbilitiesPanel'
import { HeroStatsPanel } from './HeroInfoPanels'

/**
 * Панели профиля героя (Task 19): статистика без подмены отсутствия нулём,
 * методология доли выборов, врождённые способности и честный fallback описаний.
 */

const CYRILLIC = /[А-Яа-яЁё]/

function render(node: ReactElement, locale: 'ru' | 'en'): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter>{node}</MemoryRouter>
    </I18nProvider>,
  )
}

const CATALOG: HeroStatsCatalog = {
  entries: new Map([
    [
      86,
      {
        heroId: 86,
        localizedName: 'Rubick',
        primaryAttr: 'int',
        attackType: 'Ranged',
        roles: ['Support'],
        pub: { games: 1000, wins: 520, winRate: 52 },
        turbo: { games: 100, wins: 50, winRate: 50 },
        pro: { games: 10, wins: 5, winRate: 50, bans: null },
        ranks: [],
      },
    ],
  ]),
  totals: { pubPicks: 10000, turboPicks: 1000, proPicks: 100, rankPicks: [] },
  retrievedAt: '2026-11-08T10:00:00.000Z',
}

describe('панель статистики героя', () => {
  it('винрейт и доля выборов считаются от подтверждённых знаменателей', () => {
    const html = render(
      <HeroStatsPanel entry={CATALOG.entries.get(86) ?? null} catalog={CATALOG} state="ready" />,
      'ru',
    )
    expect(html).toContain('52.00%')
    expect(html).toContain('10.00%')
    expect(html).toContain('Выборов: 1000')
  })

  it('отсутствующие баны не показываются как ноль', () => {
    const html = render(
      <HeroStatsPanel entry={CATALOG.entries.get(86) ?? null} catalog={CATALOG} state="ready" />,
      'ru',
    )
    expect(html).toContain('провайдер значение не сообщил')
    expect(html).not.toContain('Банов: 0')
  })

  it('методология доли выборов и отсутствие патча указаны явно', () => {
    const html = render(
      <HeroStatsPanel entry={CATALOG.entries.get(86) ?? null} catalog={CATALOG} state="ready" />,
      'ru',
    )
    expect(html).toContain('сумма pub_pick')
    expect(html).toContain('не доля матчей с этим героем')
    expect(html).toContain('ни патч, ни период наблюдений')
    expect(html).toContain('Данные получены')
  })

  it('независимые состояния: сбой и пустая запись различаются', () => {
    const error = render(<HeroStatsPanel entry={null} catalog={null} state="error" />, 'ru')
    expect(error).toContain('Статистика матчей недоступна')
    const empty = render(<HeroStatsPanel entry={null} catalog={CATALOG} state="ready" />, 'ru')
    expect(empty).toContain('статистика в выборке провайдера отсутствует')
  })

  it('английская версия без кириллицы', () => {
    const html = render(
      <HeroStatsPanel entry={CATALOG.entries.get(86) ?? null} catalog={CATALOG} state="ready" />,
      'en',
    )
    expect(CYRILLIC.test(html)).toBe(false)
    expect(html).toContain('not reported by the provider')
  })
})

const ABILITY_DATA: HeroAbilityData = {
  heroId: 86,
  abilities: [
    {
      name: 'rubick_fade_bolt',
      displayName: 'Fade Bolt',
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
      attributes: [{ header: 'Damage', value: '70 / 140' }],
    },
    {
      name: 'rubick_innate',
      displayName: 'Arcane Accumulation',
      hasDisplayName: true,
      description: null,
      behavior: null,
      damageType: null,
      targetType: null,
      targetTeam: null,
      dispellable: null,
      piercesImmunity: null,
      iconUrl: null,
      isInnate: true,
      attributes: [],
    },
  ],
  talents: [{ name: 'special_bonus_x', level: 1, displayName: '+20 Movement Speed' }],
  facets: [],
  abilitiesWithoutDescription: 1,
  abilitiesWithoutDisplayName: 0,
  innateAbilities: 1,
  facetsWithoutDescription: 0,
}

describe('панель способностей героя', () => {
  it('врождённая способность помечена, обычная — нет', () => {
    const html = render(<HeroAbilitiesPanel data={ABILITY_DATA} state="ready" />, 'ru')
    expect(html).toContain('Врождённая')
    expect(html).toContain('Врождённых способностей в справочнике: 1')
    // Фикстура использует реальный ключ Rubick, поэтому в RU показывается перевод.
    expect(html).toContain('Угасающая молния')
    // Ключа `rubick_innate` в словаре нет — показывается английское название источника.
    expect(html).toContain('Arcane Accumulation')
  })

  it('английский режим сохраняет исходные английские названия', () => {
    const html = render(<HeroAbilitiesPanel data={ABILITY_DATA} state="ready" />, 'en')
    expect(html).toContain('Fade Bolt')
    expect(html).toContain('Arcane Accumulation')
  })

  it('отсутствие описания показывается fallback-текстом, способность не скрывается', () => {
    const html = render(<HeroAbilitiesPanel data={ABILITY_DATA} state="ready" />, 'ru')
    expect(html).toContain('Описание недоступно в источнике')
    expect(html).toContain('не отдал описание')
    expect(html).toContain('70 / 140')
  })

  it('английская версия без кириллицы и с тем же fallback', () => {
    const html = render(<HeroAbilitiesPanel data={ABILITY_DATA} state="ready" />, 'en')
    expect(html).toContain('Innate')
    expect(html).toContain('Description is unavailable in the source')
    expect(CYRILLIC.test(html)).toBe(false)
  })
})
