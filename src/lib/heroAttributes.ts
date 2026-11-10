/**
 * Атрибуты героев Dota 2 (Task 19) — СГЕНЕРИРОВАННЫЙ ФАЙЛ, не редактировать вручную.
 *
 * Источник: OpenDota `GET /api/constants/heroes` (снимок 2026-11-08).
 * Идентичность героя (id → название, slug) остаётся в `heroCatalog.ts`; здесь только
 * числовые атрибуты для тех же `hero_id`. Скрипт генерации проверяет совпадение
 * набора ID с каталогом и падает при расхождении.
 *
 * Значения — базовые (base*), роста (gain) и характеристики, как их отдаёт провайдер.
 * Рассчитанные показатели не сохраняются. Патч провайдером не указывается: это снимок
 * справочника на дату генерации, а не гарантия текущего патча.
 *
 * Порядок полей кортежа (`HeroAttributeTuple`):
 * 1. heroId
 * 2. primaryAttr
 * 3. attackType
 * 4. roles
 * 5. baseStr
 * 6. strGain
 * 7. baseAgi
 * 8. agiGain
 * 9. baseInt
 * 10. intGain
 * 11. baseHealth
 * 12. baseMana
 * 13. baseArmor
 * 14. baseMr
 * 15. baseAttackMin
 * 16. baseAttackMax
 * 17. attackRange
 * 18. attackRate
 * 19. baseAttackTime
 * 20. attackPoint
 * 21. projectileSpeed
 * 22. moveSpeed
 * 23. turnRate
 * 24. legs
 * 25. dayVision
 * 26. nightVision
 * 27. cmEnabled
 */

export type HeroPrimaryAttribute = 'str' | 'agi' | 'int' | 'all'

export type HeroAttributeTuple = readonly [
  number,
  HeroPrimaryAttribute,
  string | null,
  readonly string[],
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  boolean | null,
]

/** Дата снимка атрибутов (не период наблюдений). */
export const HERO_ATTRIBUTES_GENERATED_AT = '2026-11-08'

export const HERO_ATTRIBUTE_ROWS: readonly HeroAttributeTuple[] = [
  [1, 'agi', 'Melee', ['Carry', 'Escape', 'Nuker'], 21, 1.6, 24, 2.8, 12, 1.8, 120, 75, 2, 25, 29, 33, 150, 1.4, 100, 0.3, 0, 310, null, 2, 1800, 800, true],
  [2, 'str', 'Melee', ['Initiator', 'Durable', 'Disabler', 'Carry'], 25, 2.7, 20, 1.7, 18, 1.6, 120, 75, 0, 25, 31, 35, 150, 1.7, 100, 0.4, 900, 315, null, 2, 1800, 800, true],
  [3, 'all', 'Ranged', ['Support', 'Disabler', 'Nuker', 'Durable'], 23, 2.5, 23, 2.5, 23, 2.5, 120, 75, 1, 25, 24, 30, 425, 1.7, 100, 0.3, 900, 305, null, 4, 1800, 1200, true],
  [4, 'agi', 'Melee', ['Carry', 'Disabler', 'Nuker', 'Initiator'], 24, 2.7, 24, 3.1, 17, 2, 120, 75, 2, 25, 35, 41, 150, 1.7, 100, 0.43, 900, 285, null, 2, 1800, 800, true],
  [5, 'int', 'Ranged', ['Support', 'Disabler', 'Nuker'], 17, 2.2, 16, 1.8, 20, 3.3, 120, 75, 0, 25, 28, 34, 600, 1.7, 100, 0.45, 900, 280, null, 2, 1800, 800, true],
  [6, 'agi', 'Ranged', ['Carry', 'Disabler', 'Pusher'], 16, 1.9, 22, 2.8, 15, 1.4, 120, 75, 0, 25, 27, 34, 625, 1.7, 100, 0.5, 1250, 310, 0.7, 2, 1800, 800, true],
  [7, 'str', 'Melee', ['Support', 'Initiator', 'Disabler', 'Nuker'], 22, 3.7, 12, 1.4, 18, 2.1, 120, 75, 2, 25, 27, 37, 150, 1.7, 100, 0.467, 0, 315, 0.9, 2, 1800, 800, true],
  [8, 'agi', 'Melee', ['Carry', 'Pusher', 'Escape'], 20, 2, 32, 2.8, 14, 1.4, 120, 75, 0, 25, 22, 24, 150, 1.4, 110, 0.33, 0, 300, null, 2, 1800, 800, true],
  [9, 'agi', 'Ranged', ['Carry', 'Support', 'Escape', 'Nuker', 'Disabler'], 20, 2.2, 26, 3.1, 22, 1.9, 120, 75, -2, 25, 22, 28, 630, 1.7, 100, 0.35, 900, 285, null, 2, 1800, 800, true],
  [10, 'agi', 'Ranged', ['Carry', 'Escape', 'Durable', 'Nuker', 'Disabler'], 23, 2.6, 24, 3.9, 19, 1.8, 120, 75, -1, 25, 12, 21, 350, 1.5, 100, 0.5, 1300, 285, 0.7, 0, 1800, 800, true],
  [11, 'agi', 'Ranged', ['Carry', 'Nuker'], 19, 2.7, 25, 3.6, 18, 2.2, 120, 75, 0, 25, 16, 22, 525, 1.6, 100, 0.5, 1200, 305, 0.9, 0, 1800, 800, true],
  [12, 'agi', 'Melee', ['Carry', 'Escape', 'Pusher', 'Nuker'], 21, 2.2, 26, 3.4, 21, 1.8, 120, 75, 0, 25, 26, 36, 225, 1.7, 110, 0.5, 900, 285, null, 2, 1800, 800, true],
  [13, 'int', 'Ranged', ['Initiator', 'Disabler', 'Escape', 'Nuker'], 17, 2.4, 14, 2.3, 23, 3.8, 120, 75, 0, 25, 22, 30, 550, 1.7, 100, 0.5, 900, 290, 0.9, 2, 1800, 800, true],
  [14, 'str', 'Melee', ['Disabler', 'Initiator', 'Durable', 'Nuker'], 25, 3, 11, 1.4, 16, 1.8, 120, 75, 0, 25, 45, 51, 175, 1.7, 100, 0.5, 0, 280, 0.7, 2, 1800, 800, true],
  [15, 'agi', 'Ranged', ['Carry', 'Durable', 'Nuker', 'Pusher'], 22, 2.8, 24, 2.8, 21, 2.2, 120, 75, 0, 25, 23, 25, 475, 1.7, 100, 0.3, 2000, 280, null, 0, 1800, 800, true],
  [16, 'all', 'Melee', ['Initiator', 'Disabler', 'Support', 'Nuker', 'Escape'], 23, 2.3, 19, 2, 17, 2, 120, 75, 1, 25, 19, 29, 150, 1.7, 110, 0.53, 900, 290, null, 6, 1800, 800, true],
  [17, 'int', 'Ranged', ['Carry', 'Escape', 'Nuker', 'Initiator', 'Disabler'], 21, 2, 22, 2.6, 23, 3.7, 120, 75, 1, 25, 24, 34, 480, 1.6, 115, 0.5, 1100, 285, 0.8, 2, 1800, 800, true],
  [18, 'str', 'Melee', ['Carry', 'Disabler', 'Initiator', 'Durable', 'Nuker'], 24, 3.5, 18, 2.2, 16, 1.5, 120, 75, 0, 25, 37, 39, 150, 1.9, 110, 0.4, 0, 325, null, 2, 1800, 800, true],
  [19, 'str', 'Melee', ['Carry', 'Nuker', 'Pusher', 'Initiator', 'Durable', 'Disabler'], 30, 4.2, 0, 0, 17, 2.2, 120, 75, 0, 25, 31, 37, 150, 1.7, 90, 0.4, 900, 275, null, 2, 1800, 800, true],
  [20, 'agi', 'Ranged', ['Support', 'Initiator', 'Disabler', 'Nuker', 'Escape'], 20, 2.6, 23, 3, 19, 1.5, 120, 75, 0, 25, 28, 34, 400, 1.5, 100, 0.33, 1500, 300, null, 2, 1800, 800, true],
  [21, 'all', 'Ranged', ['Carry', 'Support', 'Disabler', 'Escape', 'Nuker'], 18, 2.6, 17, 2.1, 18, 3.2, 120, 75, 0, 25, 24, 36, 600, 1.5, 90, 0.4, 1250, 285, 0.8, 2, 1800, 800, true],
  [22, 'int', 'Ranged', ['Nuker', 'Carry'], 21, 2.1, 11, 1.2, 23, 3.3, 120, 75, 1, 25, 30, 40, 380, 1.7, 100, 0.35, 1100, 305, null, 2, 1800, 800, true],
  [23, 'str', 'Melee', ['Carry', 'Support', 'Disabler', 'Initiator', 'Durable', 'Nuker'], 24, 3.6, 14, 1.6, 18, 1.8, 120, 75, 2, 25, 30, 36, 150, 1.7, 100, 0.4, 900, 315, null, 2, 1800, 800, true],
  [25, 'int', 'Ranged', ['Support', 'Carry', 'Nuker', 'Disabler'], 20, 2.4, 23, 2.4, 30, 4, 120, 75, 0, 25, 21, 29, 670, 1.6, 100, 0.65, 1000, 290, null, 2, 1800, 800, true],
  [26, 'int', 'Ranged', ['Support', 'Disabler', 'Nuker', 'Initiator'], 18, 2.4, 15, 1.7, 19, 3.5, 120, 75, 0, 25, 29, 35, 600, 1.7, 115, 0.43, 900, 290, null, 2, 1800, 800, true],
  [27, 'int', 'Ranged', ['Support', 'Pusher', 'Disabler', 'Nuker', 'Initiator'], 20, 2.3, 16, 1.6, 23, 3.5, 120, 75, 2, 25, 40, 47, 400, 1.7, 100, 0.3, 900, 285, null, 2, 1800, 800, true],
  [28, 'str', 'Melee', ['Carry', 'Durable', 'Initiator', 'Disabler', 'Escape'], 21, 3.4, 17, 2.1, 15, 1.5, 120, 75, 2, 25, 30, 38, 150, 1.7, 100, 0.36, 0, 300, null, 0, 1800, 800, true],
  [29, 'str', 'Melee', ['Initiator', 'Durable', 'Disabler', 'Nuker', 'Carry'], 26, 3.7, 15, 1.5, 20, 1.7, 120, 75, 0, 25, 25, 31, 150, 1.7, 100, 0.6, 900, 300, null, 2, 1800, 800, true],
  [30, 'int', 'Ranged', ['Support', 'Nuker', 'Disabler'], 20, 2.1, 13, 1.4, 22, 3.1, 120, 75, 0, 25, 26, 36, 550, 1.7, 100, 0.4, 1200, 300, null, 2, 1800, 800, true],
  [31, 'int', 'Ranged', ['Support', 'Nuker'], 20, 2.1, 17, 1.7, 28, 3.4, 120, 75, -1, 25, 24, 33, 550, 1.7, 100, 0.46, 900, 290, 0.7, 2, 1800, 800, true],
  [32, 'agi', 'Melee', ['Carry', 'Escape', 'Disabler'], 18, 2, 30, 2.4, 14, 1.3, 120, 75, 0, 25, 22, 26, 150, 1.7, 90, 0.3, 900, 315, null, 2, 1800, 800, true],
  [33, 'all', 'Ranged', ['Disabler', 'Initiator', 'Pusher'], 21, 2.5, 14, 1, 19, 3.6, 120, 75, 1, 25, 19, 25, 500, 1.7, 100, 0.4, 900, 280, null, 0, 1800, 800, true],
  [34, 'int', 'Ranged', ['Carry', 'Nuker', 'Pusher'], 19, 2.3, 17, 1.4, 30, 3.3, 120, 75, 2, 25, 22, 28, 500, 1.7, 100, 0.35, 900, 305, null, 2, 1800, 800, true],
  [35, 'agi', 'Ranged', ['Carry', 'Nuker'], 19, 2, 27, 3.2, 15, 2.6, 120, 75, 0, 25, 13, 19, 550, 1.7, 100, 0.17, 3000, 285, 0.7, 2, 1800, 1400, true],
  [36, 'int', 'Ranged', ['Carry', 'Nuker', 'Durable', 'Disabler'], 18, 2.3, 12, 1.3, 23, 2.7, 120, 75, 2, 25, 26, 30, 500, 1.7, 100, 0.3, 1200, 280, null, 2, 1800, 800, true],
  [37, 'int', 'Ranged', ['Support', 'Initiator', 'Disabler'], 22, 2.4, 10, 1, 25, 3.1, 120, 75, 1, 25, 27, 37, 600, 1.7, 90, 0.3, 1200, 300, null, 2, 1800, 800, true],
  [38, 'all', 'Melee', ['Initiator', 'Disabler', 'Durable', 'Nuker'], 25, 2.9, 19, 2, 16, 1.9, 120, 75, -1, 25, 23, 27, 150, 1.7, 100, 0.3, 0, 305, null, 2, 1800, 800, true],
  [39, 'int', 'Ranged', ['Carry', 'Nuker', 'Escape'], 20, 2.4, 22, 2.5, 25, 3.4, 120, 75, 0, 25, 26, 32, 550, 1.5, 100, 0.56, 1500, 290, null, 2, 1800, 800, true],
  [40, 'all', 'Ranged', ['Support', 'Nuker', 'Initiator', 'Pusher', 'Disabler'], 19, 2.1, 25, 2.8, 19, 1.8, 120, 75, 0, 25, 18, 21, 450, 1.7, 115, 0.3, 900, 280, null, 0, 1800, 800, true],
  [41, 'agi', 'Melee', ['Carry', 'Initiator', 'Disabler', 'Escape', 'Durable'], 20, 2.6, 24, 3.3, 15, 1.5, 120, 75, 0, 25, 34, 40, 150, 1.7, 100, 0.5, 900, 300, 0.9, 2, 1800, 800, true],
  [42, 'str', 'Melee', ['Carry', 'Support', 'Durable', 'Disabler', 'Initiator'], 22, 2.8, 16, 1.7, 16, 1.6, 120, 75, 0, 25, 38, 40, 150, 1.7, 100, 0.56, 0, 310, null, 2, 1800, 800, true],
  [43, 'all', 'Ranged', ['Carry', 'Pusher', 'Nuker', 'Disabler'], 21, 2.9, 17, 2, 24, 3, 120, 75, 1, 25, 22, 32, 600, 1.7, 100, 0.5, 1000, 290, 0.8, 2, 1800, 800, true],
  [44, 'agi', 'Melee', ['Carry', 'Escape'], 19, 2, 21, 3.4, 15, 1.7, 120, 75, 1, 25, 35, 37, 150, 1.7, 110, 0.3, 900, 310, 0.8, 2, 1800, 800, true],
  [45, 'int', 'Ranged', ['Nuker', 'Pusher'], 19, 2, 21, 1.3, 26, 5.2, 120, 75, 0, 25, 21, 28, 630, 1.7, 100, 0.5, 900, 325, null, 2, 1800, 800, true],
  [46, 'agi', 'Ranged', ['Carry', 'Escape'], 21, 2.4, 23, 3.4, 20, 2, 120, 75, 0, 25, 28, 33, 250, 1.6, 100, 0.3, 1000, 310, 0.7, 2, 1800, 800, true],
  [47, 'agi', 'Ranged', ['Carry', 'Durable', 'Initiator', 'Disabler'], 21, 2.4, 21, 2.9, 17, 2, 120, 75, -2, 25, 27, 29, 575, 1.7, 110, 0.33, 1200, 275, null, 0, 1800, 800, true],
  [48, 'agi', 'Ranged', ['Carry', 'Nuker', 'Pusher'], 21, 2.2, 24, 3.4, 23, 1.9, 120, 75, 2, 25, 26, 32, 330, 1.7, 100, 0.35, 900, 325, null, 2, 1800, 800, true],
  [49, 'str', 'Melee', ['Carry', 'Pusher', 'Durable', 'Disabler', 'Initiator', 'Nuker'], 21, 3.2, 14, 2, 18, 1.7, 120, 75, 0, 25, 34, 40, 150, 1.6, 100, 0.5, 900, 310, null, 2, 1800, 800, true],
  [50, 'all', 'Ranged', ['Support', 'Nuker', 'Disabler'], 19, 2.3, 20, 1.7, 25, 3.5, 120, 75, 0, 25, 19, 25, 575, 1.7, 100, 0.3, 1200, 305, 0.7, 2, 1800, 800, true],
  [51, 'str', 'Melee', ['Initiator', 'Disabler', 'Durable', 'Nuker'], 26, 3.2, 13, 2.3, 18, 1.7, 120, 75, 1, 25, 24, 26, 150, 1.7, 100, 0.33, 900, 310, null, 2, 1800, 800, true],
  [52, 'int', 'Ranged', ['Carry', 'Support', 'Nuker', 'Pusher', 'Disabler'], 20, 2.8, 17, 2.5, 22, 3.5, 120, 75, 1, 25, 27, 31, 575, 1.7, 100, 0.4, 900, 325, null, 4, 1800, 800, true],
  [53, 'all', 'Ranged', ['Carry', 'Pusher', 'Escape', 'Nuker'], 19, 2.6, 14, 2.6, 22, 3.5, 120, 75, 0, 25, 20, 26, 600, 1.5, 100, 0.4, 1125, 295, 0.9, 2, 1800, 800, true],
  [54, 'str', 'Melee', ['Carry', 'Durable', 'Escape', 'Disabler'], 23, 2.4, 15, 1.9, 15, 1.8, 120, 75, 1, 25, 26, 32, 150, 1.7, 120, 0.39, 900, 320, 0.9, 2, 1800, 800, true],
  [55, 'int', 'Melee', ['Initiator', 'Escape', 'Disabler'], 20, 2.6, 19, 1.5, 22, 2.7, 120, 75, 2, 25, 31, 37, 150, 1.7, 100, 0.59, 900, 295, null, 2, 1800, 800, true],
  [56, 'agi', 'Ranged', ['Carry', 'Escape', 'Pusher'], 18, 2, 25, 2.7, 21, 2.2, 120, 75, 0, 25, 19, 25, 600, 1.7, 100, 0.4, 900, 285, null, 2, 1800, 800, true],
  [57, 'str', 'Melee', ['Support', 'Durable', 'Nuker'], 22, 3.1, 15, 1.7, 16, 2.1, 120, 75, 2, 25, 31, 41, 150, 1.7, 100, 0.433, 900, 310, null, 2, 1800, 800, true],
  [58, 'int', 'Ranged', ['Support', 'Pusher', 'Durable', 'Disabler'], 17, 2, 19, 2.1, 22, 4, 120, 75, 1, 25, 21, 31, 575, 1.7, 100, 0.3, 900, 320, null, 4, 1800, 800, true],
  [59, 'str', 'Ranged', ['Carry', 'Durable', 'Initiator'], 23, 3.3, 10, 1.5, 18, 0, 120, 0, 1, 25, 21, 26, 400, 1.6, 100, 0.3, 1400, 290, null, 2, 1800, 800, true],
  [60, 'str', 'Melee', ['Carry', 'Initiator', 'Durable', 'Disabler', 'Nuker'], 23, 3, 18, 2.2, 15, 1.6, 120, 75, 2, 25, 40, 44, 150, 1.7, 100, 0.55, 900, 295, null, 2, 800, 1800, true],
  [61, 'agi', 'Melee', ['Carry', 'Pusher', 'Escape', 'Nuker'], 18, 2.9, 18, 3.4, 18, 2, 120, 75, -1, 25, 27, 33, 175, 1.7, 125, 0.4, 900, 285, null, 8, 1800, 800, true],
  [62, 'agi', 'Melee', ['Escape', 'Nuker'], 19, 2.5, 21, 2.6, 20, 1.9, 120, 75, 5, 25, 33, 41, 150, 1.5, 100, 0.59, 900, 325, null, 2, 1800, 1000, true],
  [63, 'agi', 'Ranged', ['Carry', 'Escape'], 16, 2, 17, 3.3, 20, 2, 120, 75, 1, 25, 37, 43, 425, 1.8, 120, 0.55, 900, 275, null, 4, 1800, 800, true],
  [64, 'int', 'Ranged', ['Support', 'Nuker', 'Pusher', 'Disabler'], 25, 2.5, 15, 1.2, 25, 3, 120, 75, 1, 25, 27, 35, 400, 1.7, 100, 0.4, 1100, 290, 0.8, 2, 1800, 800, true],
  [65, 'all', 'Ranged', ['Initiator', 'Disabler', 'Escape'], 23, 2.9, 13, 2, 22, 2.9, 120, 75, 2, 25, 12, 16, 400, 1.7, 100, 0.3, 900, 320, 0.9, 2, 1800, 800, true],
  [66, 'int', 'Ranged', ['Support', 'Pusher'], 23, 2, 15, 2.1, 19, 3.2, 120, 75, -1, 25, 29, 39, 650, 1.7, 100, 0.5, 1100, 305, null, 2, 1800, 800, true],
  [67, 'agi', 'Melee', ['Carry', 'Durable', 'Escape'], 21, 2.4, 26, 2.4, 16, 1.7, 120, 75, 0, 25, 23, 27, 150, 1.8, 110, 0.3, 900, 295, null, 0, 1800, 800, true],
  [68, 'int', 'Ranged', ['Support', 'Disabler', 'Nuker'], 20, 1.9, 20, 2, 23, 3.1, 120, 75, -1, 25, 21, 31, 675, 1.7, 100, 0.45, 1250, 285, null, 0, 1800, 800, true],
  [69, 'str', 'Melee', ['Carry', 'Disabler', 'Initiator', 'Durable', 'Nuker'], 24, 3.6, 15, 1.5, 15, 1.9, 120, 75, 2, 25, 32, 42, 200, 1.9, 100, 0.5, 900, 290, null, 2, 1800, 800, true],
  [70, 'agi', 'Melee', ['Carry', 'Durable', 'Disabler'], 25, 2.4, 18, 2.8, 16, 1.5, 120, 75, 1, 25, 24, 28, 150, 1.7, 100, 0.3, 900, 310, null, 2, 1800, 800, true],
  [71, 'str', 'Melee', ['Carry', 'Initiator', 'Disabler', 'Durable', 'Escape'], 28, 3.3, 17, 1.7, 14, 1.8, 120, 75, 1, 25, 34, 44, 170, 1.9, 100, 0.6, 900, 295, null, 2, 1800, 800, true],
  [72, 'agi', 'Ranged', ['Carry', 'Nuker', 'Disabler'], 22, 2.5, 25, 3.4, 21, 2.4, 120, 75, 1, 25, 18, 24, 365, 1.7, 115, 0.2, 3000, 315, null, 2, 1800, 800, true],
  [73, 'str', 'Melee', ['Carry', 'Support', 'Durable', 'Disabler', 'Initiator', 'Nuker'], 23, 2.7, 22, 1.5, 25, 1.8, 120, 75, 0, 25, 27, 33, 150, 1.7, 110, 0.35, 900, 295, null, 2, 1800, 800, true],
  [74, 'int', 'Ranged', ['Carry', 'Nuker', 'Disabler', 'Escape', 'Pusher'], 19, 2.5, 14, 2, 20, 4, 120, 75, -1, 25, 19, 25, 600, 1.7, 100, 0.4, 900, 285, null, 2, 1800, 800, true],
  [75, 'int', 'Ranged', ['Carry', 'Support', 'Disabler', 'Initiator', 'Nuker'], 18, 2.2, 22, 2.2, 25, 2.9, 120, 75, 0, 25, 18, 32, 600, 1.6, 110, 0.5, 900, 300, null, 2, 1800, 800, true],
  [76, 'int', 'Ranged', ['Carry', 'Nuker', 'Disabler'], 21, 2.9, 17, 1.6, 30, 4.2, 120, 75, 0, 25, 19, 31, 450, 1.9, 100, 0.46, 900, 315, null, 4, 1800, 800, true],
  [77, 'str', 'Melee', ['Carry', 'Pusher', 'Durable', 'Escape'], 28, 3.4, 18, 1.7, 23, 1.7, 120, 75, 0, 25, 24, 29, 150, 1.7, 110, 0.55, 900, 305, null, 2, 1800, 800, true],
  [78, 'all', 'Melee', ['Carry', 'Initiator', 'Durable', 'Disabler', 'Nuker'], 24, 3.2, 19, 2, 17, 1.9, 120, 75, 1, 25, 26, 33, 150, 1.7, 100, 0.35, 900, 310, null, 2, 1800, 800, true],
  [79, 'int', 'Ranged', ['Support', 'Disabler', 'Initiator', 'Nuker'], 23, 2.6, 18, 2.2, 22, 3.6, 120, 75, 0, 25, 29, 33, 500, 1.7, 100, 0.35, 900, 290, null, 2, 1800, 800, true],
  [80, 'agi', 'Ranged', ['Carry', 'Pusher', 'Durable'], 20, 2.5, 22, 2.8, 13, 1.4, 120, 75, 0, 25, 22, 26, 550, 1.6, 100, 0.33, 1125, 300, null, 2, 1800, 800, true],
  [81, 'str', 'Melee', ['Carry', 'Disabler', 'Durable', 'Pusher', 'Initiator'], 24, 3.1, 18, 1.8, 18, 1.2, 120, 75, 2, 25, 29, 49, 150, 1.7, 100, 0.5, 900, 325, null, 2, 1800, 800, true],
  [82, 'agi', 'Melee', ['Carry', 'Escape', 'Nuker', 'Disabler', 'Initiator', 'Pusher'], 24, 2.2, 17, 2.1, 18, 1.9, 120, 75, 3, 25, 29, 35, 150, 1.7, 100, 0.38, 900, 315, 0.9, 2, 1800, 800, true],
  [83, 'str', 'Melee', ['Support', 'Initiator', 'Durable', 'Disabler', 'Escape'], 25, 3.4, 15, 1.8, 20, 1.8, 120, 75, 1, 25, 60, 68, 150, 1.9, 100, 0.6, 900, 280, null, 2, 1800, 800, true],
  [84, 'str', 'Melee', ['Support', 'Nuker', 'Disabler', 'Durable', 'Initiator'], 25, 4.2, 14, 1.5, 0, 0, 120, 120, 4, 25, 45, 51, 150, 1.7, 100, 0.3, 900, 290, null, 2, 1800, 800, true],
  [85, 'str', 'Melee', ['Support', 'Durable', 'Disabler', 'Nuker'], 22, 2.4, 13, 1.2, 27, 2.8, 120, 75, 0, 25, 33, 41, 150, 1.7, 100, 0.3, 900, 300, null, 2, 1800, 800, true],
  [86, 'int', 'Ranged', ['Support', 'Disabler', 'Nuker'], 21, 2, 23, 2.5, 24, 3.7, 120, 75, 1, 25, 25, 31, 550, 1.7, 100, 0.4, 1125, 290, 0.7, 2, 1800, 800, true],
  [87, 'int', 'Ranged', ['Support', 'Disabler', 'Nuker', 'Initiator'], 21, 2.4, 15, 1.4, 20, 2.9, 120, 75, 0, 25, 27, 31, 625, 1.7, 100, 0.4, 1200, 295, null, 2, 1800, 800, true],
  [88, 'all', 'Melee', ['Disabler', 'Nuker', 'Initiator', 'Escape'], 17, 2.7, 18, 2.9, 21, 2.6, 120, 75, 1, 25, 26, 30, 150, 1.7, 100, 0.46, 900, 310, null, 6, 1800, 800, true],
  [89, 'agi', 'Melee', ['Carry', 'Support', 'Pusher', 'Disabler', 'Initiator', 'Escape'], 21, 2.4, 22, 3.4, 19, 2, 120, 75, 1, 25, 23, 25, 150, 1.7, 110, 0.5, 900, 330, null, 0, 1800, 800, true],
  [90, 'int', 'Ranged', ['Support', 'Nuker', 'Disabler'], 18, 2.3, 15, 1.6, 24, 3.3, 120, 75, 0, 25, 20, 27, 600, 1.7, 100, 0.3, 900, 315, 0.7, 2, 1800, 800, true],
  [91, 'all', 'Ranged', ['Support', 'Escape', 'Nuker'], 19, 3, 14, 1.6, 21, 1.7, 120, 75, 1, 25, 21, 27, 500, 1.7, 100, 0.3, 1200, 320, 0.7, 0, 1800, 800, true],
  [92, 'all', 'Ranged', ['Support', 'Nuker', 'Durable', 'Disabler', 'Pusher'], 22, 2.8, 11, 1.3, 22, 2.9, 120, 75, 0, 25, 21, 31, 600, 1.7, 110, 0.4, 1400, 285, null, 2, 1800, 800, true],
  [93, 'agi', 'Melee', ['Carry', 'Escape', 'Disabler', 'Nuker'], 20, 2.1, 21, 1.5, 16, 1.9, 120, 75, 0, 25, 37, 43, 150, 1.7, 120, 0.5, 0, 300, 0.7, 2, 1800, 1800, true],
  [94, 'agi', 'Ranged', ['Carry', 'Disabler', 'Durable'], 0, 0, 22, 3.6, 25, 3.6, 120, 75, -1, 25, 26, 32, 600, 1.7, 100, 0.5, 1200, 275, null, 0, 1800, 800, true],
  [95, 'agi', 'Ranged', ['Carry', 'Pusher', 'Disabler', 'Durable'], 21, 2.5, 23, 3.3, 13, 1, 120, 75, -1, 25, 27, 35, 500, 1.7, 100, 0.3, 1200, 290, null, 2, 1800, 800, true],
  [96, 'str', 'Melee', ['Durable', 'Initiator', 'Disabler', 'Nuker', 'Escape'], 27, 4.2, 15, 1, 15, 1.6, 120, 75, -2, 25, 36, 38, 150, 1.7, 90, 0.3, 900, 300, null, 4, 1800, 800, true],
  [97, 'all', 'Melee', ['Initiator', 'Disabler', 'Nuker', 'Escape'], 23, 3.1, 14, 2, 20, 2.1, 120, 75, 1, 25, 31, 39, 200, 1.8, 100, 0.5, 900, 305, 0.8, 4, 1800, 800, true],
  [98, 'str', 'Melee', ['Nuker', 'Durable', 'Escape'], 23, 3.6, 16, 1.6, 23, 2.7, 120, 75, 0, 25, 23, 27, 150, 1.7, 100, 0.36, 900, 280, null, 2, 1800, 800, true],
  [99, 'str', 'Melee', ['Carry', 'Durable', 'Initiator', 'Nuker'], 22, 2.8, 17, 1.8, 14, 2.8, 120, 75, 1, 25, 31, 37, 150, 1.8, 100, 0.3, 900, 295, 0.9, 2, 1800, 800, true],
  [100, 'str', 'Melee', ['Initiator', 'Disabler', 'Nuker'], 23, 3.9, 23, 1.9, 18, 1.7, 120, 75, 1, 25, 27, 31, 150, 1.7, 100, 0.36, 900, 310, 0.7, 2, 1800, 800, true],
  [101, 'int', 'Ranged', ['Support', 'Nuker', 'Disabler'], 21, 2, 13, 0.8, 25, 4.1, 120, 75, -2, 25, 16, 26, 625, 1.7, 90, 0.4, 1000, 325, null, 2, 1800, 800, true],
  [102, 'all', 'Melee', ['Support', 'Carry', 'Durable'], 21, 2.6, 22, 1.5, 18, 2, 120, 75, -1, 25, 22, 32, 150, 1.5, 95, 0.56, 900, 325, 0.6, 2, 1800, 800, true],
  [103, 'str', 'Melee', ['Initiator', 'Disabler', 'Nuker', 'Durable'], 26, 3, 16, 1.8, 23, 1.6, 120, 75, 0, 25, 23, 33, 150, 1.7, 100, 0.35, 900, 305, null, 2, 1800, 800, true],
  [104, 'str', 'Melee', ['Carry', 'Disabler', 'Initiator', 'Durable', 'Nuker'], 24, 3.1, 18, 1.7, 20, 2.2, 120, 75, -1, 25, 33, 37, 150, 1.7, 100, 0.46, 900, 325, null, 2, 1800, 800, true],
  [105, 'all', 'Ranged', ['Nuker', 'Disabler'], 19, 2.6, 16, 1.8, 25, 3, 120, 75, 2, 25, 20, 22, 600, 1.7, 90, 0.5, 900, 310, null, 6, 1800, 800, true],
  [106, 'agi', 'Melee', ['Carry', 'Escape', 'Nuker', 'Disabler', 'Initiator'], 22, 2.5, 22, 3.2, 20, 2.2, 120, 75, 0, 25, 33, 37, 150, 1.7, 100, 0.4, 900, 300, 0.8, 2, 1800, 800, true],
  [107, 'str', 'Melee', ['Nuker', 'Escape', 'Disabler', 'Initiator', 'Durable'], 22, 3.8, 17, 2.4, 18, 2.1, 120, 75, 0, 25, 25, 29, 150, 1.7, 100, 0.35, 900, 290, null, 2, 1800, 800, true],
  [108, 'str', 'Melee', ['Support', 'Nuker', 'Disabler', 'Durable', 'Escape'], 25, 3.2, 12, 1.6, 18, 2.3, 120, 75, 3, 25, 37, 43, 200, 1.7, 100, 0.45, 900, 290, null, 2, 1800, 800, true],
  [109, 'agi', 'Melee', ['Carry', 'Pusher', 'Nuker'], 18, 2, 23, 4, 19, 1.6, 120, 75, 6, 25, 26, 32, 150, 1.5, 110, 0.3, 900, 315, 0.8, 2, 1800, 800, true],
  [110, 'str', 'Ranged', ['Support', 'Nuker', 'Initiator', 'Escape', 'Disabler'], 23, 3.3, 12, 1.5, 16, 1.8, 120, 75, -1, 25, 21, 31, 525, 1.7, 100, 0.35, 1100, 280, 0.9, 2, 1800, 800, true],
  [111, 'int', 'Ranged', ['Support', 'Nuker', 'Disabler', 'Escape'], 20, 2.2, 15, 1.7, 26, 3.6, 120, 75, 1, 25, 13, 19, 625, 1.7, 100, 0.3, 900, 295, 0.7, 2, 1800, 800, true],
  [112, 'int', 'Ranged', ['Support', 'Disabler', 'Nuker'], 22, 2.5, 16, 1.7, 26, 3.6, 120, 75, 1, 25, 16, 23, 450, 1.7, 100, 0.25, 700, 285, null, 2, 1800, 1200, true],
  [113, 'all', 'Ranged', ['Carry', 'Escape', 'Nuker'], 20, 2.2, 20, 2.7, 24, 2.6, 120, 75, 0, 25, 23, 29, 625, 1.7, 110, 0.3, 900, 300, 0.7, 2, 1800, 800, true],
  [114, 'agi', 'Melee', ['Carry', 'Escape', 'Disabler', 'Initiator'], 19, 2.8, 24, 3.7, 20, 1.8, 120, 75, 1, 25, 29, 33, 300, 1.6, 95, 0.45, 900, 300, null, 2, 1800, 800, true],
  [119, 'int', 'Ranged', ['Support', 'Nuker', 'Disabler', 'Escape'], 20, 2, 18, 1.6, 21, 3.5, 120, 75, 0, 25, 27, 35, 475, 1.5, 115, 0.3, 1200, 290, 0.7, 2, 1800, 800, true],
  [120, 'all', 'Melee', ['Carry', 'Nuker', 'Disabler', 'Durable', 'Escape', 'Initiator'], 20, 2.7, 18, 3.2, 16, 2.5, 120, 75, 2, 25, 26, 32, 150, 1.7, 100, 0.33, 900, 300, 0.9, 2, 1800, 800, true],
  [121, 'int', 'Ranged', ['Support', 'Nuker', 'Disabler', 'Escape'], 21, 2.4, 18, 1.9, 25, 3.8, 120, 75, 0, 25, 22, 26, 600, 1.7, 100, 0.35, 900, 290, null, 0, 1800, 800, true],
  [123, 'agi', 'Ranged', ['Support', 'Nuker', 'Escape', 'Disabler'], 17, 2, 25, 3.6, 21, 2.9, 120, 75, 0, 25, 22, 29, 575, 2, 100, 0.4, 1800, 315, 0.9, 4, 1800, 800, true],
  [126, 'all', 'Melee', ['Carry', 'Escape', 'Nuker', 'Disabler'], 22, 2.6, 21, 2.2, 24, 3.1, 120, 75, -1, 25, 18, 22, 200, 1.7, 100, 0.35, 900, 290, 0.7, 2, 1800, 800, true],
  [128, 'all', 'Ranged', ['Support', 'Nuker', 'Disabler', 'Escape'], 21, 3.5, 16, 1.9, 21, 2.2, 120, 75, 1, 25, 25, 31, 400, 1.8, 100, 0.35, 1800, 300, null, 2, 1800, 800, true],
  [129, 'str', 'Melee', ['Carry', 'Initiator', 'Disabler', 'Durable'], 23, 3.7, 18, 1.7, 21, 2.2, 120, 75, -1, 25, 26, 34, 250, 1.8, 100, 0.4, 900, 310, 0.8, 2, 1800, 800, true],
  [131, 'int', 'Ranged', ['Support', 'Nuker', 'Escape', 'Disabler'], 21, 2.1, 11, 1.6, 25, 3, 120, 75, 1, 25, 23, 33, 575, 1.7, 100, 0.5, 1200, 310, 0.6, 2, 1800, 800, true],
  [135, 'str', 'Melee', ['Carry', 'Durable'], 25, 3.4, 14, 1.7, 20, 2, 120, 75, 2, 25, 31, 35, 150, 1.7, 100, 0.46, 900, 300, 0.6, 2, 1800, 800, true],
  [136, 'all', 'Melee', ['Support', 'Carry', 'Initiator', 'Disabler', 'Escape'], 23, 3.2, 20, 2.2, 19, 1.9, 120, 75, 0, 25, 29, 33, 150, 1.7, 100, 0.3, 0, 315, 0.9, 2, 1800, 800, true],
  [137, 'str', 'Melee', ['Initiator', 'Durable', 'Disabler'], 26, 4.3, 15, 1, 16, 1.7, 120, 75, 2, 25, 36, 38, 150, 1.8, 100, 0.6, 900, 305, 0.6, 2, 1800, 800, true],
  [138, 'int', 'Ranged', ['Carry', 'Nuker', 'Disabler'], 19, 2, 21, 2.7, 23, 3.6, 120, 75, 0, 25, 24, 32, 575, 1.7, 115, 0.35, 3000, 295, 0.7, 2, 1800, 800, true],
  [145, 'agi', 'Melee', ['Carry', 'Escape', 'Disabler'], 20, 2.8, 27, 3.5, 20, 1.7, 120, 75, 1, 25, 23, 29, 225, 1.9, 100, 0.35, 900, 310, 1, 2, 1800, 800, true],
  [155, 'str', 'Melee', ['Durable', 'Disabler', 'Support'], 24, 3.6, 14, 1.3, 21, 2.6, 120, 75, 2, 25, 39, 45, 150, 1.7, 100, 0.35, 0, 290, 0.7, 2, 1800, 800, true],
]
