import { describe, expect, it } from 'vitest'

// Стили читаются как сырой текст средствами Vite (`?raw`): без Node-API и @types/node.
import css from './pages.css?raw'

/**
 * Регрессионные проверки оформления отчёта матча (Task 15).
 *
 * Это проверки СТИЛЕЙ, а не браузерной отрисовки: они фиксируют требования владельца
 * (внутренние отступы секции карты зданий, размер иконок предметов 42×42, плашку времени
 * внутри иконки, ширину колонки предметов) и защищают их от случайного отката. Визуальную
 * проверку в браузере они не заменяют.
 */
/**
 * CSS без блоков `@media`: базовые правила секций.
 *
 * Адаптивные блоки исключаются, потому что их переопределения идут в файле и до, и после
 * основных правил; сами адаптивные правила проверяются отдельными тестами.
 */
function baseCss(): string {
  let result = ''
  let index = 0
  while (index < css.length) {
    const media = css.indexOf('@media', index)
    if (media < 0) {
      result += css.slice(index)
      break
    }
    result += css.slice(index, media)
    let depth = 0
    let cursor = css.indexOf('{', media)
    for (; cursor < css.length; cursor += 1) {
      if (css[cursor] === '{') {
        depth += 1
      } else if (css[cursor] === '}') {
        depth -= 1
        if (depth === 0) {
          cursor += 1
          break
        }
      }
    }
    index = cursor
  }
  return result
}

const base = baseCss()

/** Текст базового CSS-правила по селектору (селектор должен начинать строку). */
function rule(selector: string): string {
  const start = base.indexOf(`\n${selector} {`)
  expect(start, selector).toBeGreaterThanOrEqual(0)
  return base.slice(start + 1, base.indexOf('}', start))
}

describe('Оформление секции карты зданий', () => {
  it('задаёт внутренние отступы секции и расстояние между картой и сводкой', () => {
    expect(rule('.buildings')).toContain('padding: 22px')
    expect(rule('.buildings')).toContain('box-sizing: border-box')
    expect(rule('.buildings__layout')).toContain('gap: 20px')
  })

  it('держит карту квадратной, без обрезки и растяжения', () => {
    expect(rule('.buildings__map-frame')).toContain('aspect-ratio: 1 / 1')
    expect(rule('.buildings__map-frame')).toContain('max-width: 560px')
    expect(rule('.buildings__map-image')).toContain('object-fit: contain')
    expect(rule('.buildings__map-image')).toContain('width: 100%')
    // Компактные маркеры: близкие строения (пара T4 у трона) не сливаются в одно пятно.
    expect(rule('.map-marker')).toContain('width: 18px')
    expect(rule('.map-marker')).toContain('height: 18px')
  })

  it('даёт карточкам сводки внутренние отступы и перенос длинного текста', () => {
    expect(rule('.buildings__counter')).toContain('padding: 12px 14px')
    expect(rule('.buildings__counter')).toContain('overflow-wrap: anywhere')
    expect(rule('.buildings__counters')).toContain('gap: 10px')
  })

  it('держит легенду и технические подробности отдельно от границ', () => {
    expect(rule('.buildings__legend')).toContain('gap: 10px 16px')
    expect(rule('.buildings__summary')).toContain('gap: 14px')
    expect(rule('.technical-details')).toContain('margin-top: 10px')
  })

  it('переключает карту и сводку на одну колонку на узких экранах', () => {
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.buildings__layout\s*\{\s*grid-template-columns: 1fr/)
    expect(rule('.buildings__layout')).toContain('grid-template-columns: minmax(0, 1fr)')
  })
})

describe('Оформление предметов в таблицах команд', () => {
  it('фиксирует размер слота 42×42 и запрещает сжатие иконки', () => {
    expect(rule('.item-slot')).toContain('width: 42px')
    expect(rule('.item-slot')).toContain('height: 42px')
    expect(rule('.item-slot')).toContain('flex: 0 0 auto')
    expect(rule('.item-slot__icon')).toContain('width: 42px')
    expect(rule('.item-slot__icon')).toContain('object-fit: contain')
  })

  it('выводит время покупки в правом нижнем углу внутри иконки', () => {
    const time = rule('.item-slot__time')

    expect(time).toContain('right: 2px')
    expect(time).toContain('bottom: 2px')
    expect(time).toContain('max-width: calc(100% - 4px)')
    expect(time).toContain('background: rgba(4, 8, 12, 0.85)')
    expect(time).toContain('font-size: 11px')
  })

  it('выделяет колонке предметов достаточно ширины и сохраняет прокрутку таблицы', () => {
    expect(rule('.team-table__cell--items')).toContain('min-width: 340px')
    expect(rule('.inventory-list')).toContain('gap: 6px')
    expect(rule('.inventory-list')).toContain('overflow-x: auto')
    expect(rule('.table-scroll')).toContain('overflow-x: auto')
    // Прежние правила удалённой секции «предметы за матч» не перекрывают размеры слотов.
    expect(base).not.toContain('.inventory-list__icon')
  })

  it('сохраняет подсветку выбранной строки без текстового бейджа', () => {
    expect(rule('.team-table__row--selected')).toContain('rgba(239, 48, 56, 0.14)')
    expect(css).not.toContain('team-table__selected')
  })
})
