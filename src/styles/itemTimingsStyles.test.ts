import { describe, expect, it } from 'vitest'

import css from './pages.css?raw'

/**
 * Проверки стилей Task 18 на уровне кода: адаптивность раскладки и доступность
 * шкалы. Браузерный визуальный прогон этим не заменяется, но гарантирует, что
 * мобильные правила и маркеры не пропадут при правках CSS.
 */
describe('стили таймлайна предметов', () => {
  it('содержит контейнер строки и блок статистики', () => {
    expect(css).toContain('.item-timeline__item')
    expect(css).toContain('.item-timeline__main')
    expect(css).toContain('.item-timeline__stats')
    expect(css).toContain('.item-timeline__actual')
  })

  it('выравнивает статистику вправо на широких экранах', () => {
    const statsRule = /\.item-timeline__stats \{[^}]*\}/.exec(css)?.[0] ?? ''
    expect(statsRule).toContain('justify-content: flex-end')
    expect(statsRule).toContain('text-align: right')
  })

  it('переключается на вертикальную раскладку на узких экранах', () => {
    const blocks = css.match(/@media \(max-width: 560px\) \{[\s\S]*?\n\}/g) ?? []
    expect(blocks.length).toBeGreaterThan(0)
    const itemBlock = blocks.find((block) => block.includes('.item-timeline__main'))
    expect(itemBlock).toBeDefined()
    expect(itemBlock).toContain('flex-direction: column')
    expect(itemBlock).toContain('.item-timeline__stats')
  })

  it('не задаёт фиксированную ширину, из-за которой появился бы горизонтальный скролл', () => {
    const itemRules = css.match(/\.item-tim(?:eline|ing-scale)[^{]*\{[^}]*\}/g) ?? []
    expect(itemRules.length).toBeGreaterThan(5)
    for (const rule of itemRules) {
      expect(rule).not.toMatch(/min-width:\s*\d{3,}px/)
      expect(rule).not.toMatch(/width:\s*\d{3,}px/)
    }
  })

  it('рисует маркер покупки псевдоэлементом, чтобы не обрезать подпись', () => {
    const marker = /\.item-timing-scale__actual \{[^}]*\}/.exec(css)?.[0] ?? ''
    expect(marker).not.toContain('clip-path')
    expect(css).toContain('.item-timing-scale__actual::before')
    expect(css).toContain('clip-path: polygon')
    expect(css).toContain('.item-timing-scale__actual-label')
  })

  it('зона p25–p75 отличается формой и штриховкой, а не только цветом', () => {
    const range = /\.item-timing-scale__range \{[^}]*\}/.exec(css)?.[0] ?? ''
    expect(range).toContain('repeating-linear-gradient')
    expect(range).toContain('border-left')
    expect(range).toContain('border-right')
    const median = /\.item-timing-scale__median \{[^}]*\}/.exec(css)?.[0] ?? ''
    expect(median).toContain('width: 2px')
    expect(median).not.toContain('background-image')
  })
})
