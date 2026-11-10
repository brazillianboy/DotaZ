import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '../i18n/I18nContext'
import type { MatchupRow } from '../lib/heroMatchups'
import HeroMatchups from './HeroMatchups'

/**
 * Секция матчапов (Task 19): две группы по пять, порог 100 матчей,
 * состояния загрузки/сбоя и локализация RU/EN.
 */

const CYRILLIC = /[А-Яа-яЁё]/

function render(node: ReactElement, locale: 'ru' | 'en'): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter>{node}</MemoryRouter>
    </I18nProvider>,
  )
}

function row(opponentId: number, games: number, wins: number): MatchupRow {
  return { opponentId, games, wins, winRate: Math.round((wins / games) * 10000) / 100 }
}

const QUALIFIED: MatchupRow[] = Array.from({ length: 12 }, (_unused, index) =>
  row(index + 1, 300, 150 - index * 5),
)

function countRows(html: string): number {
  return html.split('class="hero-matchup"').length - 1
}

describe('матчапы героя — разметка', () => {
  it('показываются обе группы по пять соперников', () => {
    const html = render(<HeroMatchups heroId={11} rows={QUALIFIED} state="ready" />, 'ru')
    expect(html).toContain('Пять наиболее успешных матчапов')
    expect(html).toContain('Пять наименее успешных матчапов')
    expect(countRows(html)).toBe(10)
    expect(html).toContain('Матчей: 300')
    expect(html).toContain('Винрейт 50.00%')
  })

  it('указаны порог выборки и ограничения источника', () => {
    const html = render(<HeroMatchups heroId={11} rows={QUALIFIED} state="ready" />, 'ru')
    expect(html).toContain('не менее 100 матчей')
    expect(html).toContain('Провайдер не указывает патч')
    expect(html).toContain('Это наблюдение, а не «контрпик»')
  })

  it('пары с выборкой ниже порога не ранжируются', () => {
    const html = render(<HeroMatchups heroId={11} rows={[row(2, 99, 60)]} state="ready" />, 'ru')
    expect(html).toContain('После порога 100 матчей не осталось пар')
    expect(countRows(html)).toBe(0)
  })

  it('соперники ведут на профили героев', () => {
    const html = render(<HeroMatchups heroId={11} rows={QUALIFIED} state="ready" />, 'ru')
    expect(html).toContain('href="/heroes/1"')
    expect(html).toContain('href="/heroes/5"')
    expect(html).not.toContain('href="/heroes/6"')
  })

  it('сбой и пустой ответ различаются', () => {
    const errorHtml = render(<HeroMatchups heroId={11} rows={null} state="error" />, 'ru')
    expect(errorHtml).toContain('Матчапы недоступны')
    const emptyHtml = render(<HeroMatchups heroId={11} rows={[]} state="ready" />, 'ru')
    expect(emptyHtml).toContain('нет матчапов для этого героя')
  })
})

describe('матчапы героя — локализация', () => {
  it('английская версия без кириллицы', () => {
    const html = render(<HeroMatchups heroId={11} rows={QUALIFIED} state="ready" />, 'en')
    expect(html).toContain('Five most successful matchups')
    expect(html).toContain('Matches: 300')
    expect(CYRILLIC.test(html)).toBe(false)
  })

  it('русская версия без английских подписей матчапов', () => {
    const html = render(<HeroMatchups heroId={11} rows={QUALIFIED} state="ready" />, 'ru')
    expect(html).not.toContain('Five most successful matchups')
    expect(CYRILLIC.test(html)).toBe(true)
  })
})
