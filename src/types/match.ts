/**
 * Нормализованная модель данных матча (Task 6).
 *
 * Назначение — дать UI стабильную структуру независимо от полноты ответа OpenDota.
 * Правила представления отсутствующих данных:
 *  - отсутствующее, некорректное или недоступное значение → `null`;
 *  - легитимный ноль сохраняется как `0`;
 *  - отсутствие данных никогда не превращается в `0` или `false`.
 *
 * Здесь нет аналитики и игровых оценок — только факты из ответа провайдера.
 */

/** Сторона игрока, определённая по конвенции `player_slot` OpenDota. */
export type PlayerTeam = 'radiant' | 'dire'

/** Событие покупки из `purchase_log` OpenDota (Task 8). */
export interface LaningPurchase {
  /**
   * Время покупки в секундах от начала матча. Отрицательные значения означают
   * предматчевую закупку; в отчёт ранней стадии попадают только записи внутри
   * интервала, полный журнал сохраняется отдельно для секции собранных предметов.
   */
  time: number
  /** Идентификатор предмета как он приходит от OpenDota (справочник названий не используется). */
  key: string
}

/** Событие разрушения здания из `objectives` OpenDota (проверенное подмножество, Task 15). */
export interface BuildingKillEvent {
  /** Время события в секундах от начала матча. */
  time: number
  /** Ключ здания, например `npc_dota_badguys_tower1_top` или `npc_dota_goodguys_fort`. */
  key: string
}

/**
 * Интервал ранней стадии, к которому относятся метрики.
 *
 * Хранится в данных, а не берётся из константы, чтобы отчёты, сохранённые до
 * изменения интервала (10 минут), отображались с корректными подписями и не
 * выдавали 10-минутные значения за 15-минутные.
 */
export interface LaningInterval {
  /** Длина интервала в минутах: 10 — отчёты старого формата, 15 — текущий. */
  minutes: number
  /** Подпись интервала: `00:00–10:00` или `00:00–15:00`. */
  label: string
}

/**
 * Фактические данные ранней стадии матча (Task 8; интервал 00:00–15:00).
 *
 * Политика отсутствующих данных: `null` означает «данных нет» и никогда не
 * подменяется нулём. Для логов событий различаются два состояния:
 *  - `null` — лог отсутствует или недостоверен;
 *  - `0` / `[]` — лог присутствует, но событий в интервале не было.
 *
 * Метрики не интерпретируются: здесь нет оценок качества линии.
 */
export interface LaningStageData {
  /** Интервал, к которому относятся значения ниже. */
  interval: LaningInterval
  /** Добивания к концу интервала — накопительное значение `lh_t[N]`. */
  lastHits: number | null
  /** Накопленное золото к концу интервала — `gold_t[N]`. */
  gold: number | null
  /** Накопленный опыт к концу интервала — `xp_t[N]`. */
  xp: number | null
  /** Убийства в интервале (счётчик из `kills_log`). */
  killsFirst: number | null
  /** Смерти в интервале (счётчик из `deaths_log`). */
  deathsFirst: number | null
  /**
   * Покупки в интервале так, как они пришли в журнале OpenDota (включая компоненты
   * и обычные расходники); `null` — лог недоступен. Сырые события не фильтруются
   * и не агрегируются: отбор для показа выполняет общий фильтр `items.ts`
   * (одна политика для обеих секций), поэтому повторные покупки и порядок событий
   * сохраняются.
   */
  purchasesFirst: LaningPurchase[] | null
  /** Процент эффективности линии по версии OpenDota (шкала 0–100). */
  laneEfficiencyPct: number | null
}

/** Нормализованный участник матча. */
export interface NormalizedPlayer {
  /** Слот игрока из ответа OpenDota (0–255). */
  player_slot: number
  /** Сторона: 0–127 → `radiant`, 128–255 → `dire`, иначе `null`. */
  team: PlayerTeam | null

  hero_id: number | null

  kills: number | null
  deaths: number | null
  assists: number | null

  gold_per_min: number | null
  xp_per_min: number | null
  last_hits: number | null

  /** Урон по героям (`hero_damage`) за матч. */
  hero_damage: number | null
  /** Урон по зданиям (`tower_damage`) за матч. */
  tower_damage: number | null
  /** Лечение союзников (`hero_healing`) за матч. */
  hero_healing: number | null
  /** Уровень героя на конец матча (`level`). */
  level: number | null
  /** Добивания своих крипов (`denies`). */
  denies: number | null
  /** Чистая стоимость (`net_worth`) на конец матча. */
  net_worth: number | null
  /**
   * Подтверждённое имя игрока (`personaname`). Пустая строка из ответа трактуется
   * как отсутствие данных (`null`); ники не выдумываются.
   */
  player_name: string | null
  /** Идентификатор аккаунта (`account_id`), если подтверждён. */
  account_id: number | null
  /**
   * Финальный инвентарь: ID предметов слотов `item_0 … item_5` в исходном порядке.
   * `null` — инвентарь отсутствует в ответе; `null` внутри массива — пустой слот.
   * Время получения предметов здесь не определяется (для этого есть журнал покупок).
   */
  inventory_ids: (number | null)[] | null
  /** Нейтральный предмет (`item_neutral`), если подтверждён. */
  neutral_item_id: number | null

  /**
   * Класс линии по OpenDota (`lane`): абсолютная нумерация линии. `null` — данных нет.
   * Используется только как факт матча; роли/позиции из этого не выводятся.
   */
  lane: number | null

  /**
   * Класс линии по OpenDota (`lane_role`): 1 — safe, 2 — mid, 3 — off, 4 — jungle.
   * Это НЕ позиция 1–5: две поддержки в одной линии неразличимы.
   * `null` — данных нет, сравнение с нормативами недоступно (Task 16).
   */
  lane_role: number | null
  /**
   * Запись прокачки способностей (`ability_upgrades_arr`): ID способностей и талантов
   * в порядке изучения, где индекс `i` соответствует уровню героя `i + 1`.
   * `null` — данных нет.
   */
  ability_upgrades: number[] | null

  /**
   * Полный журнал покупок за матч из `purchase_log` (включая предматчевые и
   * поздние записи). `null` — журнал отсутствует или недостоверен.
   * Используется секцией собранных предметов за матч.
   */
  purchaseLog: LaningPurchase[] | null

  /** Фактические данные ранней стадии матча (Task 8; интервал 00:00–15:00). */
  laning: LaningStageData
}

/** Нормализованный матч. */
export interface NormalizedMatch {
  /**
   * ID матча в виде десятичной строки (без потери точности для больших значений).
   * `null`, если значение отсутствует или не может быть представлено точно.
   */
  match_id: string | null
  /** Длительность матча в секундах; `null`, если недоступна или некорректна. */
  duration: number | null
  /** Победила ли сторона Radiant; `null`, если значение недоступно. */
  radiant_win: boolean | null
  /** Подтверждённый счёт убийств Radiant (`radiant_score`) или `null`. */
  radiant_score: number | null
  /** Подтверждённый счёт убийств Dire (`dire_score`) или `null`. */
  dire_score: number | null
  /** Числовой режим игры OpenDota (`game_mode`) или `null`. */
  game_mode: number | null
  /**
   * Числовой id патча OpenDota (`patch`, например 60 = «7.41») или `null`.
   * Нужен для сопоставления с нормативами строго в пределах одного патча (Task 16).
   */
  patch: number | null
  /** Числовой регион OpenDota (`region`) или `null`. */
  region: number | null
  /** Время начала матча (unix, секунды) или `null`. */
  start_time: number | null
  /** Битмаска башен Radiant (`tower_status_radiant`): установленный бит — башня стоит. */
  tower_status_radiant: number | null
  /** Битмаска башен Dire (`tower_status_dire`). */
  tower_status_dire: number | null
  /** Битмаска бараков Radiant (`barracks_status_radiant`). */
  barracks_status_radiant: number | null
  /** Битмаска бараков Dire (`barracks_status_dire`). */
  barracks_status_dire: number | null
  /**
   * Подтверждённые события разрушения зданий из `objectives` (только `building_kill`
   * с корректным временем и ключом). `null` — список отсутствует или недостоверен.
   */
  buildingKills: BuildingKillEvent[] | null
  /** Только фактически присутствующие и идентифицируемые участники (может быть меньше десяти). */
  players: NormalizedPlayer[]
}