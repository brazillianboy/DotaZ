import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'

import HistoryList, { historyResultText } from './HistoryList'
import { parseHistoryRow, type HistoryReportItem } from '../lib/historyReports'

/**
 * SSR-проверки списка личной истории (Task 12).
 * Используется уже установленный `react-dom/server` и `StaticRouter` для ссылок.
 */

function makeItem(overrides: Record<string, unknown> = {}): HistoryReportItem {
  const parsed = parseHistoryRow({
    id: 'row-1',
    user_id: '11111111-1111-4111-8111-111111111111',
    match_id: '9007760151',
    status: 'ready',
    source: 'OpenDota',
    rules_version: '1.0.0',
    created_at: '2026-10-21T09:30:00.000Z',
    fetched_at: '2026-10-21T09:29:00.000Z',
    radiant_win: true,
    ...overrides,
  })
  if (!parsed.ok) {
    throw new Error('тестовая строка должна проходить валидацию')
  }
  return parsed.item
}

function renderList(props: Partial<Parameters<typeof HistoryList>[0]> = {}) {
  return renderToStaticMarkup(
    <StaticRouter location="/history">
      <HistoryList
        items={props.items ?? [makeItem()]}
        hasMore={props.hasMore ?? false}
        loadingMore={props.loadingMore ?? false}
        onLoadMore={props.onLoadMore ?? (() => {})}
        skippedCount={props.skippedCount ?? 0}
      />
    </StaticRouter>,
  )
}

describe('HistoryList — карточки сохранённых отчётов', () => {
  it('показывает ID матча, дату, результат и статус готового отчёта', () => {
    const html = renderList()
    expect(html).toContain('Матч 9007760151')
    expect(html).toContain('2026-10-21 09:30 UTC')
    expect(html).toContain('Победа Radiant')
    expect(html).toContain('Полный отчёт')
    expect(html).toContain('Источник')
    expect(html).toContain('1.0.0')
  })

  it('ведёт на существующий маршрут матча и не показывает внутренний UUID', () => {
    const html = renderList()
    expect(html).toContain('href="/matches/9007760151"')
    expect(html).toContain('Открыть отчёт')
    expect(html).not.toContain('row-1')
  })

  it('помечает частичный отчёт как доступный с ограничениями', () => {
    const html = renderList({ items: [makeItem({ status: 'partial' })] })
    expect(html).toContain('Частичный отчёт')
    expect(html).toContain('href="/matches/9007760151"')
  })

  it('для незавершённого отчёта не предлагает открытие', () => {
    const pending = renderList({ items: [makeItem({ status: 'pending' })] })
    expect(pending).toContain('Ожидает расчёта')
    expect(pending).toContain('Открытие недоступно')
    expect(pending).not.toContain('href="/matches/9007760151"')

    const failed = renderList({ items: [makeItem({ status: 'error' })] })
    expect(failed).toContain('Ошибка расчёта')
    expect(failed).toContain('Открытие недоступно')
    expect(failed).not.toContain('href="/matches/9007760151"')
  })

  it('честно показывает отсутствие результата и даты', () => {
    const html = renderList({ items: [makeItem({ radiant_win: null, created_at: null })] })
    expect(html).toContain('Нет данных')
    expect(html).not.toContain('Победа Radiant')
    expect(html).not.toContain('Победа Dire')
  })

  it('поддерживает результат победы Dire', () => {
    const html = renderList({ items: [makeItem({ radiant_win: false })] })
    expect(html).toContain('Победа Dire')
    expect(historyResultText(false)).toBe('Победа Dire')
    expect(historyResultText(null)).toBe('Нет данных')
  })

  it('для пустой истории показывает сообщение без карточек', () => {
    const html = renderList({ items: [] })
    expect(html).toContain('У вас пока нет сохранённых анализов.')
    expect(html).not.toContain('history-card')
  })

  it('сообщает о неполном списке и предлагает догрузку', () => {
    const html = renderList({ items: [makeItem()], hasMore: true })
    expect(html).toContain('Показаны последние 1 отчётов')
    expect(html).toContain('не является полным')
    expect(html).toContain('Показать ещё')
  })

  it('во время догрузки блокирует кнопку и меняет её текст', () => {
    const html = renderList({ items: [makeItem()], hasMore: true, loadingMore: true })
    expect(html).toContain('Загружаем…')
    expect(html).toContain('disabled')
  })

  it('сообщает о пропущенных записях, не удаляя и не изменяя данные', () => {
    const html = renderList({ items: [makeItem()], skippedCount: 2 })
    expect(html).toContain('Часть записей не показана')
    expect(html).toContain('(2)')
    expect(html).toContain('не изменялись и не удалялись')
  })

  it('использует семантические ссылки без вложенных интерактивных элементов', () => {
    const html = renderList()
    expect(html).toContain('<ul class="history-list">')
    expect(html).toContain('<li class="history-card panel">')
    expect(html).toContain('<a class="btn btn--primary history-card__action"')
    // Внутри ссылки нет кнопок (нет вложенных интерактивных элементов).
    const linkContent = html.slice(html.indexOf('<a class="btn btn--primary'))
    expect(linkContent.slice(0, linkContent.indexOf('</a>'))).not.toContain('<button')
  })
})