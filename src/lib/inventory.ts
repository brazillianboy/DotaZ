import { ITEM_ID_TO_KEY } from './itemIdCatalog'
import { firstPurchaseTime, itemDisplayName, itemIconUrl } from './items'
import type { LaningPurchase } from '../types/match'

/**
 * Инвентарь игрока (Task 15).
 *
 * В ответе OpenDota инвентарь приходит числовыми ID (`players[].item_0 … item_5`,
 * `item_neutral`), поэтому для отображения нужен проверенный справочник соответствия
 * ID → ключ (`itemIdCatalog.ts`, сгенерирован из `GET /api/constants/items`).
 * Имена и иконки берутся из проверенного слоя Task 14 (`items.ts`).
 *
 * Модуль чистый: без сети, React и глобального состояния. Неизвестный ID не
 * выдумывается: он не попадает в список, а интерфейс сообщает о неполноте данных.
 *
 * Время получения предмета берётся из журнала покупок (`purchase_log`) строго по
 * совпадению ключа предмета. Это подтверждённое событие покупки, а не «момент сборки»;
 * если покупка ключа в журнале не подтверждена (например, предмет получен из другого
 * источника), время остаётся `null` и не подставляется.
 */

export interface InventoryItem {
  /** Ключ предмета OpenDota (например, `power_treads`). */
  key: string
  /** Отображаемое имя предмета. */
  name: string
  /** URL иконки предмета на CDN Dota 2. */
  iconUrl: string
  /** Первое подтверждённое время покупки (секунды) или `null`, если не подтверждено. */
  acquiredAt: number | null
}

/** Ключ предмета по числовому ID; пустой/неизвестный ID → `null`. */
export function itemKeyFromId(id: number | null): string | null {
  if (id === null || !Number.isInteger(id) || id <= 0) {
    return null
  }
  return ITEM_ID_TO_KEY[id] ?? null
}

/**
 * Предмет инвентаря (ключ, имя, иконка и подтверждённое время покупки).
 * `purchaseLog` необязателен: без него время остаётся `null`.
 */
export function inventoryItem(
  id: number | null,
  purchaseLog: LaningPurchase[] | null = null,
): InventoryItem | null {
  const key = itemKeyFromId(id)
  if (key === null) {
    return null
  }
  return {
    key,
    name: itemDisplayName(key),
    iconUrl: itemIconUrl(key),
    acquiredAt: firstPurchaseTime(purchaseLog, key),
  }
}

/**
 * Список предметов инвентаря: подтверждённые ID в исходном порядке слотов.
 * `null` — инвентарь недоступен в ответе; `[]` — слоты пусты или не подтверждены.
 */
export function inventoryItems(
  ids: (number | null)[] | null,
  purchaseLog: LaningPurchase[] | null = null,
): InventoryItem[] | null {
  if (ids === null) {
    return null
  }
  const items: InventoryItem[] = []
  for (const id of ids) {
    const item = inventoryItem(id, purchaseLog)
    if (item !== null) {
      items.push(item)
    }
  }
  return items
}

/**
 * Хронологический порядок предметов по подтверждённому времени покупки (Task 15).
 *
 * Причина существования: провайдер отдаёт финальный инвентарь в порядке СЛОТОВ
 * (`item_0 … item_5`), который не связан со временем приобретения. Для читаемого отчёта
 * предметы выстраиваются по времени: сначала самый ранний, затем более поздние.
 *
 * Правила (детерминированные и без выдумывания данных):
 *  1) сортировка по **числовым секундам** (`a.acquiredAt - b.acquiredAt`), а не по строкам
 *     `мм:сс` — строковое сравнение дало бы неверный порядок;
 *  2) при равном времени порядок определяет исходный номер слота (стабильно и повторяемо);
 *  3) предметы БЕЗ подтверждённого времени идут после всех таймированных, в исходном
 *     порядке слотов и без подставленного времени;
 *  4) связь «предмет ↔ время» не меняется: каждый предмет сохраняет своё `acquiredAt`;
 *  5) исходный массив не изменяется — возвращается новая копия.
 */
export function sortInventoryChronologically(items: InventoryItem[]): InventoryItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftTime = left.item.acquiredAt
      const rightTime = right.item.acquiredAt
      if (leftTime === null && rightTime === null) {
        return left.index - right.index
      }
      if (leftTime === null) {
        return 1
      }
      if (rightTime === null) {
        return -1
      }
      if (leftTime === rightTime) {
        return left.index - right.index
      }
      return leftTime - rightTime
    })
    .map((entry) => entry.item)
}

/** Есть ли в наборе ID хотя бы один подтверждённый предмет. */
export function hasKnownInventoryItems(ids: (number | null)[] | null): boolean {
  if (ids === null) {
    return false
  }
  return ids.some((id) => itemKeyFromId(id) !== null)
}
