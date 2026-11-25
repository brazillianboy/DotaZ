import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import ProgressTrendChart from './ProgressTrendChart'
import type { TrendPoint } from '../lib/progress'

/** SSR-проверки дискретной диаграммы показателя (Task 20). */

function render(points: TrendPoint[], overrides: Partial<Parameters<typeof ProgressTrendChart>[0]> = {}) {
  return renderToStaticMarkup(
    <ProgressTrendChart
      points={points}
      formatDate={(unix) => (unix === null ? '—' : String(unix))}
      formatValue={(value) => String(value)}
      {...overrides}
    />,
  )
}

describe('ProgressTrendChart', () => {
  it('для пустого набора точек не отрисовывает диаграмму', () => {
    expect(render([])).toBe('')
  })

  it('рисует фактическую колонку на каждый замер с доступной подписью', () => {
    const points: TrendPoint[] = [
      { matchId: '1', date: 100, value: 400 },
      { matchId: '2', date: 200, value: 500 },
    ]
    const html = render(points)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="100: 400"')
    expect(html).toContain('aria-label="200: 500"')
    expect((html.match(/progress-chart__col/g) ?? []).length).toBe(2)
  })

  it('подставляет форматтеры даты и значения', () => {
    const points: TrendPoint[] = [{ matchId: '1', date: 100, value: 7.5 }]
    const html = render(points, {
      formatDate: () => '2026-11-18',
      formatValue: () => 'KDA 7.5',
    })
    expect(html).toContain('aria-label="2026-11-18: KDA 7.5"')
  })

  it('не соединяет столбцы линией (только дискретные колонки)', () => {
    const points: TrendPoint[] = [
      { matchId: '1', date: 100, value: 1 },
      { matchId: '2', date: 200, value: 2 },
    ]
    const html = render(points)
    expect(html).not.toContain('<line')
    expect(html).not.toContain('<polyline')
    expect(html).not.toContain('<path')
  })
})