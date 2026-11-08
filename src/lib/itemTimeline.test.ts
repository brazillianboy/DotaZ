import { describe, expect, it } from 'vitest'

import { buildItemTimeline, isComparableItem, ITEM_TIMELINE_LIMIT } from './itemTimeline'
import type { LaningPurchase } from '../types/match'

/**
 * Тесты таймлайна покупок (Task 18). Используются только синтетические журналы:
 * проверяется обработка событий, а не реальные тайминги.
 */

function log(entries: [number | unknown, string][]): LaningPurchase[] {
  return entries.map(([time, key]) => ({ time: time as number, key }))
}

describe('buildItemTimeline — базовые состояния', () => {
  it('отсутствие журнала даёт статус no-log', () => {
    const timeline = buildItemTimeline(null)
    expect(timeline.status).toBe('no-log')
    expect(timeline.entries).toEqual([])
  })

  it('пустой журнал даёт статус empty', () => {
    const timeline = buildItemTimeline([])
    expect(timeline.status).toBe('empty')
    expect(timeline.entries).toEqual([])
  })

  it('журнал только из расходников и рецептов даёт empty с их счётчиками', () => {
    const timeline = buildItemTimeline(log([[10, 'tango'], [20, 'recipe_blink']]))
    expect(timeline.status).toBe('empty')
    expect(timeline.hiddenConsumables).toBeGreaterThan(0)
    expect(timeline.hiddenRecipes).toBeGreaterThan(0)
  })
})

describe('buildItemTimeline — события', () => {
  it('сортирует покупки хронологически, включая отрицательное время закупки', () => {
    const timeline = buildItemTimeline(
      log([
        [420, 'blink'],
        [-30, 'boots'],
        [180, 'magic_wand'],
      ]),
    )
    expect(timeline.status).toBe('ready')
    expect(timeline.entries.map((entry) => entry.timeSeconds)).toEqual([-30, 180, 420])
    expect(timeline.entries.map((entry) => entry.key)).toEqual(['boots', 'magic_wand', 'blink'])
  })

  it('сохраняет повторные покупки отдельными событиями с номером повторения', () => {
    const timeline = buildItemTimeline(log([[100, 'ward_observer'], [200, 'boots'], [300, 'boots']]))
    const boots = timeline.entries.filter((entry) => entry.key === 'boots')
    expect(boots).toHaveLength(2)
    expect(boots.map((entry) => entry.occurrence)).toEqual([1, 2])
    expect(timeline.repeatedItems).toBe(1)
  })

  it('отбрасывает записи без корректного времени и не подменяет его нулём', () => {
    const timeline = buildItemTimeline(
      log([
        [Number.NaN, 'boots'],
        ['abc', 'blink'],
        [Number.POSITIVE_INFINITY, 'magic_wand'],
        [60, 'boots'],
      ]),
    )
    expect(timeline.droppedInvalid).toBe(3)
    expect(timeline.entries).toHaveLength(1)
    expect(timeline.entries[0].timeSeconds).toBe(60)
  })

  it('неклассифицированный ключ показывается как есть и считается отдельно', () => {
    const timeline = buildItemTimeline(log([[90, 'never_seen_item_key']]))
    expect(timeline.status).toBe('ready')
    expect(timeline.entries[0].key).toBe('never_seen_item_key')
    expect(timeline.unknownItems).toBe(1)
    expect(timeline.entries[0].category).toBe('unclassified')
  })

  it('ограничивает число событий и сообщает, сколько скрыто', () => {
    const many: [number, string][] = []
    for (let index = 0; index < ITEM_TIMELINE_LIMIT + 5; index += 1) {
      many.push([index * 10, 'boots'])
    }
    const timeline = buildItemTimeline(log(many))
    expect(timeline.entries).toHaveLength(ITEM_TIMELINE_LIMIT)
    expect(timeline.hiddenByLimit).toBe(5)
  })

  it('разные игроки не смешиваются: таймлайн строится только по своему журналу', () => {
    const first = buildItemTimeline(log([[100, 'blink']]))
    const second = buildItemTimeline(log([[500, 'black_king_bar']]))
    expect(first.entries.map((entry) => entry.key)).toEqual(['blink'])
    expect(second.entries.map((entry) => entry.key)).toEqual(['black_king_bar'])
  })
})

describe('isComparableItem', () => {
  it('собранные предметы и базовые сапоги участвуют в сравнении', () => {
    expect(isComparableItem('blink', 'completed')).toBe(true)
    expect(isComparableItem('boots', 'component')).toBe(true)
  })

  it('компоненты, расходники и неизвестные ключи не сравниваются', () => {
    expect(isComparableItem('magic_wand', 'component')).toBe(false)
    expect(isComparableItem('bottle', 'included-exception')).toBe(false)
    expect(isComparableItem('weird_key', 'unclassified')).toBe(false)
  })
})
