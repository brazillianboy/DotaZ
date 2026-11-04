import { describe, expect, it } from 'vitest'

import {
  inventoryItem,
  inventoryItems,
  itemKeyFromId,
  sortInventoryChronologically,
  type InventoryItem,
} from './inventory'
import type { LaningPurchase } from '../types/match'

/**
 * Тесты слоя инвентаря (Task 15, итерация 2).
 *
 * Проверяется соответствие числовых ID предметов проверенному справочнику, честное
 * поведение при неизвестных ID и связь предмета с подтверждённым временем покупки
 * строго по ключу предмета.
 */

const LOG: LaningPurchase[] = [
  { time: 300, key: 'magic_wand' },
  { time: 592, key: 'power_treads' },
  { time: 900, key: 'power_treads' },
]

describe('Инвентарь: ID предметов', () => {
  it('переводит подтверждённые ID в ключи предметов', () => {
    expect(itemKeyFromId(63)).toBe('power_treads')
    expect(inventoryItem(63)?.name).toBe('Power Treads')
  })

  it('не выдумывает предметы для пустых и неизвестных ID', () => {
    expect(itemKeyFromId(0)).toBeNull()
    expect(itemKeyFromId(null)).toBeNull()
    expect(itemKeyFromId(999999)).toBeNull()
  })

  it('различает недоступный инвентарь и пустые слоты', () => {
    expect(inventoryItems(null)).toBeNull()
    expect(inventoryItems([0, null, 999999])).toEqual([])
  })
})

describe('Инвентарь: подтверждённое время покупки', () => {
  it('подписывает предмет временем его собственной покупки', () => {
    const items = inventoryItems([63, 36], LOG)

    expect(items?.map((item) => [item.key, item.acquiredAt])).toEqual([
      ['power_treads', 592],
      ['magic_wand', 300],
    ])
  })

  it('оставляет время пустым, если покупка не подтверждена', () => {
    const items = inventoryItems([63, 36], [{ time: 300, key: 'magic_wand' }])

    expect(items?.[0].acquiredAt).toBeNull()
    expect(items?.[1].acquiredAt).toBe(300)
  })

  it('без журнала покупок время не подставляется', () => {
    expect(inventoryItems([63])?.[0].acquiredAt).toBeNull()
    expect(inventoryItem(63)?.acquiredAt).toBeNull()
  })
})

/**
 * Хронологический порядок (Task 15, итерация 3).
 *
 * Порядок слотов финального инвентаря (`item_0 … item_5`) не связан со временем покупки,
 * поэтому отображение сортируется по подтверждённым секундам. Здесь проверяются числовая
 * сортировка (не строковая), детерминированный порядок при равном времени, положение
 * предметов без подтверждённого времени, сохранение связи «предмет ↔ время» и отсутствие
 * изменения исходного массива.
 */
function makeItem(key: string, acquiredAt: number | null): InventoryItem {
  return { key, name: key, iconUrl: `icon:${key}`, acquiredAt }
}

describe('Хронологический порядок предметов инвентаря', () => {
  it('выстраивает предметы от раннего к позднему (пример владельца)', () => {
    const items = [
      makeItem('glimmer_cape', 1686),
      makeItem('arcane_boots', 592),
      makeItem('ultimate_scepter', 2369),
      makeItem('blink', 1281),
    ]

    expect(sortInventoryChronologically(items).map((item) => item.key)).toEqual([
      'arcane_boots',
      'blink',
      'glimmer_cape',
      'ultimate_scepter',
    ])
  })

  it('сравнивает числовые секунды, а не строки времени', () => {
    // Строковое сравнение поставило бы 1266 («21:06») раньше 592 («09:52»).
    const items = [makeItem('later', 1266), makeItem('earlier', 592)]

    expect(sortInventoryChronologically(items).map((item) => item.key)).toEqual([
      'earlier',
      'later',
    ])
  })

  it('при равном времени сохраняет исходный порядок слотов и повторяем', () => {
    const items = [makeItem('a', 600), makeItem('b', 600), makeItem('c', 600)]

    const once = sortInventoryChronologically(items).map((item) => item.key)
    const twice = sortInventoryChronologically(sortInventoryChronologically(items)).map(
      (item) => item.key,
    )

    expect(once).toEqual(['a', 'b', 'c'])
    expect(twice).toEqual(once)
  })

  it('предметы без подтверждённого времени идут последними и без подставленного времени', () => {
    const items = [
      makeItem('untimed-first', null),
      makeItem('timed', 592),
      makeItem('untimed-second', null),
    ]
    const ordered = sortInventoryChronologically(items)

    expect(ordered.map((item) => item.key)).toEqual(['timed', 'untimed-first', 'untimed-second'])
    expect(ordered[1].acquiredAt).toBeNull()
    expect(ordered[2].acquiredAt).toBeNull()
  })

  it('сохраняет связь «предмет ↔ его время» при перестановке', () => {
    const items = inventoryItems([63, 36], LOG) ?? []
    const ordered = sortInventoryChronologically(items)

    expect(ordered.map((item) => [item.key, item.acquiredAt])).toEqual([
      ['magic_wand', 300],
      ['power_treads', 592],
    ])
  })

  it('не изменяет исходный массив предметов', () => {
    const items = [makeItem('late', 900), makeItem('early', 300)]
    const before = items.map((item) => item.key)

    sortInventoryChronologically(items)

    expect(items.map((item) => item.key)).toEqual(before)
  })
})

/**
 * Подтверждённая покупка на нулевой секунде (Task 15, финальная итерация).
 *
 * Время `0` — это реальное событие из `purchase_log`, а не отсутствие данных: оно
 * сохраняется как `0` (не `null`) и не считается «пустым» ни при подписи, ни при сортировке.
 */
describe('Нулевое и отсутствующее время покупки', () => {
  it('сохраняет покупку на нулевой секунде как 0, а не как отсутствие времени', () => {
    const items = inventoryItems([63], [{ time: 0, key: 'power_treads' }])

    expect(items?.[0].acquiredAt).toBe(0)
    expect(items?.[0].acquiredAt).not.toBeNull()
  })

  it('ставит предмет с нулевым временем перед более поздними покупками', () => {
    const items = [
      makeItem('late', 900),
      makeItem('zero', 0),
      makeItem('no-time', null),
    ]

    expect(sortInventoryChronologically(items).map((item) => item.key)).toEqual([
      'zero',
      'late',
      'no-time',
    ])
  })

  it('оставляет время отсутствующим, если события покупки нет', () => {
    expect(inventoryItems([63], [])?.[0].acquiredAt).toBeNull()
    expect(inventoryItems([63], null)?.[0].acquiredAt).toBeNull()
  })
})
