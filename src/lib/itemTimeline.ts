import type { LaningPurchase } from '../types/match'
import {
  BASIC_BOOTS_KEY,
  classifyPurchaseItem,
  isDisplayedInEarlyGame,
  itemDisplayName,
  itemIconUrl,
  type PurchaseItemCategory,
} from './items'

/**
 * Хронологический таймлайн покупок выбранного игрока (Task 18).
 *
 * Принципы:
 *  - используются только подтверждённые события `purchase_log`; время не выдумывается;
 *  - записи с некорректным временем отбрасываются (не заменяются нулём);
 *  - повторные покупки сохраняются как отдельные события с номером повторения;
 *  - неклассифицированные ключи показываются как есть, а не причисляются к расходникам;
 *  - обычные расходники и рецепты не засоряют таймлайн, но считаются отдельно.
 *
 * Модуль чистый: без сети, React и Supabase.
 */

/** Максимум событий в таймлайне: защита интерфейса от длинных журналов. */
export const ITEM_TIMELINE_LIMIT = 40

export interface TimelineEntry {
  /** Ключ предмета OpenDota (например, `power_treads`). */
  key: string
  name: string
  iconUrl: string
  /** Подтверждённое время покупки в секундах (может быть отрицательным — закупка до 0:00). */
  timeSeconds: number
  category: PurchaseItemCategory
  /** Номер покупки того же предмета: 1 — первая, 2 — повторная и т. д. */
  occurrence: number
  /** Участвует ли покупка в сравнении таймингов (собранные предметы и базовые сапоги). */
  comparable: boolean
}

export type ItemTimelineStatus = 'ready' | 'no-log' | 'empty'

export interface PlayerItemTimeline {
  /** `no-log` — журнала нет; `empty` — журнал есть, но событий нет. */
  status: ItemTimelineStatus
  entries: TimelineEntry[]
  /** События, не показанные из-за лимита. */
  hiddenByLimit: number
  /** Обычные расходники, скрытые из таймлайна (подтверждённые события). */
  hiddenConsumables: number
  /** Рецепты, скрытые из таймлайна. */
  hiddenRecipes: number
  /** Записи без корректного времени — отброшены (время не подменяется нулём). */
  droppedInvalid: number
  /** Подтверждённые ключи вне каталогов (показываются как есть). */
  unknownItems: number
  /** Сколько предметов куплено более одного раза. */
  repeatedItems: number
}

function isValidTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Один ли предмет участвует в сравнении таймингов. */
export function isComparableItem(key: string, category: PurchaseItemCategory): boolean {
  if (category === 'completed') {
    return true
  }
  // Базовые сапоги сравниваются отдельно: их улучшение подтверждается журналом.
  return key === BASIC_BOOTS_KEY
}

/**
 * Строит таймлайн покупок. Порядок событий — по подтверждённому времени
 * (при равенстве сохраняется порядок журнала).
 */
export function buildItemTimeline(
  purchaseLog: LaningPurchase[] | null,
  options: { limit?: number } = {},
): PlayerItemTimeline {
  const limit = options.limit ?? ITEM_TIMELINE_LIMIT
  const empty: PlayerItemTimeline = {
    status: 'no-log',
    entries: [],
    hiddenByLimit: 0,
    hiddenConsumables: 0,
    hiddenRecipes: 0,
    droppedInvalid: 0,
    unknownItems: 0,
    repeatedItems: 0,
  }
  if (purchaseLog === null) {
    return empty
  }

  let droppedInvalid = 0
  let hiddenConsumables = 0
  let hiddenRecipes = 0
  const occurrences = new Map<string, number>()
  const repeated = new Set<string>()
  const candidates: { entry: TimelineEntry; order: number }[] = []
  let unknownItems = 0

  purchaseLog.forEach((purchase, order) => {
    if (!isValidTime(purchase.time) || typeof purchase.key !== 'string' || purchase.key.length === 0) {
      droppedInvalid += 1
      return
    }
    const key = purchase.key
    const category = classifyPurchaseItem(key)
    if (category === 'consumable') {
      hiddenConsumables += 1
      return
    }
    if (category === 'recipe') {
      hiddenRecipes += 1
      return
    }
    if (!isDisplayedInEarlyGame(key)) {
      hiddenConsumables += 1
      return
    }
    const previous = occurrences.get(key) ?? 0
    const occurrence = previous + 1
    occurrences.set(key, occurrence)
    if (occurrence > 1) {
      repeated.add(key)
    }
    if (category === 'unclassified') {
      unknownItems += 1
    }
    candidates.push({
      order,
      entry: {
        key,
        name: itemDisplayName(key),
        iconUrl: itemIconUrl(key),
        timeSeconds: purchase.time,
        category,
        occurrence,
        comparable: isComparableItem(key, category),
      },
    })
  })

  if (candidates.length === 0) {
    return {
      status: 'empty',
      entries: [],
      hiddenByLimit: 0,
      hiddenConsumables,
      hiddenRecipes,
      droppedInvalid,
      unknownItems,
      repeatedItems: 0,
    }
  }

  candidates.sort((a, b) => a.entry.timeSeconds - b.entry.timeSeconds || a.order - b.order)
  const sorted = candidates.map((item) => item.entry)
  const entries = sorted.slice(0, Math.max(0, limit))

  return {
    status: 'ready',
    entries,
    hiddenByLimit: sorted.length - entries.length,
    hiddenConsumables,
    hiddenRecipes,
    droppedInvalid,
    unknownItems,
    repeatedItems: repeated.size,
  }
}
