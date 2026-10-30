import type { LaningPurchase } from '../types/match'

/**
 * Фильтрация и отображение предметов из журнала покупок (Task 14).
 *
 * Модуль чистый и детерминированный: без сети, БД, React и глобального состояния.
 * Единственный источник данных — журнал покупок OpenDota (`purchase_log`) из уже
 * полученного ответа матча. Сырые журналы в нормализованных данных и сохранённых
 * снимках не изменяются: фильтрация применяется только при подготовке списка к показу.
 *
 * Политики показа РАЗНЫЕ для двух секций (утилиты классификации переиспользуются общие):
 *
 *  1. Ранняя стадия 00:00–15:00 (`isDisplayedInEarlyGame`) — подробный список событий:
 *     компоненты, собранные предметы и явные исключения (Bottle, Refresher Shard,
 *     Cheese, Block of Cheese; Aghanim's Shard показывается как собранный предмет);
 *     исключаются обычные расходники (варды, Tango, Clarity, Smoke, Dust, Town Portal
 *     Scroll и т. п.) и рецепты.
 *
 *  2. Весь матч (`isDisplayedInFullMatch`) — только значимые приобретения: собранные
 *     предметы, Bottle и базовые Boots of Speed, если они НЕ были улучшены в собранные
 *     сапоги. Компоненты, обычные расходники, рецепты и исключения ранней стадии
 *     (Refresher Shard, Cheese, Block of Cheese) здесь не показываются; Aghanim's Shard
 *     показывается только потому, что классифицируется как собранный предмет.
 *
 * Время — момент **первой покупки** предмета по журналу (подтверждённое событие; сам
 * момент сборки может отличаться). Время никогда не выдумывается: записи без корректного
 * времени отбрасываются ещё при нормализации (`collectPurchaseLog`). Порядок событий
 * хронологический; повторные покупки одного предмета в списке событий интервала сохраняются.
 *
 * Улучшение базовых сапог определяется ТОЛЬКО по подтверждённой истории покупок
 * (`purchase_log`), а не по финальному инвентарю: если в журнале есть покупка любых
 * собранных сапог, базовые Boots of Speed скрываются. Это консервативный
 * документированный фолбэк: «улучшение не подтверждено — сапоги показываются».
 */

/** Предмет из журнала покупок с подтверждённым временем получения. */
export interface MatchItemEntry {
  /** Идентификатор предмета OpenDota (например, `blink`). */
  key: string
  /** Отображаемое имя предмета. */
  name: string
  /** Время первой покупки в секундах от начала матча (может быть отрицательным). */
  time: number
  /** URL иконки предмета на CDN Dota 2. */
  iconUrl: string
}

/** Категория предмета из журнала покупок (единая для обеих секций). */
export type PurchaseItemCategory =
  | 'completed'
  | 'component'
  | 'included-exception'
  | 'consumable'
  | 'recipe'
  | 'unclassified'

/**
 * Явные исключения политики ранней стадии 00:00–15:00: показываются там ВСЕГДА,
 * даже если предмет по природе расходуемый (требование владельца). В секции за весь
 * матч эта политика не применяется: там исключения не форсируются и предмет
 * показывается только при подтверждённой классификации «собранный предмет»
 * (поэтому Refresher Shard, Cheese и Block of Cheese видны только в интервале).
 *
 * Aghanim's Shard в этот список НЕ входит: он классифицируется как собранный
 * (значимый) предмет и потому показывается в ОБЕИХ секциях по общему правилу.
 * Здесь остаётся его расходуемая версия с Рошана (`aghanims_shard_roshan`).
 *
 * Ключи проверены по живому справочнику OpenDota `GET /api/constants/items`
 * (30.10.2026): `bottle` → «Bottle», `aghanims_shard_roshan` →
 * «Aghanim's Shard - Consumable», `refresher_shard` → «Refresher Shard»,
 * `cheese` → «Cheese», а «Block of Cheese» приходит под ключом
 * `royale_with_cheese` (не `block_of_cheese`).
 */
export const ALWAYS_INCLUDED_ITEM_KEYS: readonly string[] = [
  'bottle', // Bottle
  'aghanims_shard_roshan', // Aghanim's Shard — Consumable (отдельный ключ OpenDota)
  'refresher_shard', // Refresher Shard
  'cheese', // Cheese
  'royale_with_cheese', // Block of Cheese
]

/**
 * Базовые сапоги (Boots of Speed). В секции за матч показываются только если в
 * подтверждённой истории покупок нет улучшения в собранные сапоги.
 */
export const BASIC_BOOTS_KEY = 'boots'

/** Bottle: единственное «не сапожное» исключение политики секции за весь матч. */
export const BOTTLE_KEY = 'bottle'

/**
 * Собранные сапоги: апгрейды базовых Boots of Speed. Ключи проверены по живому
 * справочнику OpenDota `GET /api/constants/items` (30.10.2026): Power Treads,
 * Phase Boots, Arcane Boots, Tranquil Boots, Boots of Travel, Boots of Travel 2,
 * Guardian Greaves, Boots of Bearing.
 */
export const BOOTS_UPGRADE_ITEM_KEYS: readonly string[] = [
  'power_treads',
  'phase_boots',
  'arcane_boots',
  'tranquil_boots',
  'travel_boots',
  'travel_boots_2',
  'guardian_greaves',
  'boots_of_bearing',
]

/**
 * Обычные расходники: единственная категория, которая исключается из обеих секций.
 *
 * Список составлен по проверенным ключам OpenDota (справочник предметов и живой
 * `purchase_log` матча 9068605888): Tango (`tango`, `tango_single`), Healing Salve
 * (`flask`), Clarity (`clarity`), Enchanted Mango (`enchanted_mango`), Faerie Fire
 * (`faerie_fire`, `greater_faerie_fire`), Blood Grenade (`blood_grenade`), Infused
 * Raindrops (`infused_raindrop`), Observer Ward (`ward_observer`), Sentry Ward
 * (`ward_sentry`), Observer and Sentry Wards (`ward_dispenser`), Dust of Appearance
 * (`dust`), Smoke of Deceit (`smoke_of_deceit`), Town Portal Scroll (`tpscroll`),
 * Animal/Flying Courier (`courier`, `flying_courier`).
 *
 * Всё, что не входит в этот список, не является «обычным расходником» и не может
 * быть исключено молча: компоненты, собранные предметы и неклассифицированные
 * ключи показываются (см. `isDisplayedPurchase`).
 */
export const ORDINARY_CONSUMABLE_KEYS: readonly string[] = [
  'tango',
  'tango_single',
  'flask',
  'clarity',
  'enchanted_mango',
  'faerie_fire',
  'greater_faerie_fire',
  'blood_grenade',
  'infused_raindrop',
  'ward_observer',
  'ward_sentry',
  'ward_dispenser',
  'dust',
  'smoke_of_deceit',
  'tpscroll',
  'courier',
  'flying_courier',
]

/**
 * Проверенный каталог компонентов: сырьё и промежуточные предметы, которые
 * покупаются в магазине. Компоненты показываются в ОБЕИХ секциях (требование
 * владельца: «include all valid item components»).
 *
 * Все ключи проверены по живому справочнику `GET /api/constants/items`
 * (30.10.2026) и по фактическому `purchase_log` матча 9068605888 — включая новые
 * предметы, которых не было в прежнем «чёрном списке» (`pavise`, `shawl`,
 * `wizard_hat`, `ring_of_basilius`, `headdress`).
 *
 * Каталог используется для классификации и тестов. Отображение строится по
 * принципу «исключаем только подтверждённые обычные расходники» (см.
 * `isDisplayedPurchase`), поэтому пропуск в каталоге не приводит к потере данных.
 */
export const COMPONENT_ITEM_CATALOG: readonly string[] = [
  // Базовое сырьё
  'branches',
  'circlet',
  'slippers',
  'mantle',
  'gauntlets',
  'quelling_blade',
  'magic_stick',
  'boots',
  'gloves',
  'belt_of_strength',
  'boots_of_elves',
  'robe',
  'blades_of_attack',
  'mithril_hammer',
  'ogre_axe',
  'staff_of_wizardry',
  'chainmail',
  'ring_of_protection',
  'ring_of_regen',
  'sobi_mask',
  'void_stone',
  'energy_booster',
  'vitality_booster',
  'point_booster',
  'talisman_of_evasion',
  'blitz_knuckles',
  'javelin',
  'claymore',
  'broadsword',
  'hyperstone',
  'demon_edge',
  'eagle',
  'relic',
  'mystic_staff',
  'reaver',
  'ultimate_orb',
  'platemail',
  'helm_of_iron_will',
  'wind_lace',
  'fluffy_hat',
  'blight_stone',
  'orb_of_venom',
  'blade_of_alacrity',
  'oblivion_staff',
  'crown',
  'diadem',
  'lifesteal',
  'shadow_amulet',
  'ghost',
  'cloak',
  'ring_of_health',
  'pers',
  'soul_booster',
  'vanguard',
  'headdress',
  'buckler',
  'ring_of_basilius',
  'wizard_hat',
  'shawl',
  'pavise',
  'cornucopia',
  'chasm_stone',
]

const ALWAYS_INCLUDED_KEYS = new Set<string>(ALWAYS_INCLUDED_ITEM_KEYS)
const CONSUMABLE_KEYS = new Set<string>(ORDINARY_CONSUMABLE_KEYS)
const COMPONENT_KEYS = new Set<string>(COMPONENT_ITEM_CATALOG)
const BOOTS_UPGRADE_KEYS = new Set<string>(BOOTS_UPGRADE_ITEM_KEYS)

/**
 * Проверенный каталог собранных предметов по ключам OpenDota.
 *
 * Каталог описывает классификацию (`classifyPurchaseItem` → `completed`) и служит
 * документацией. Сам показ предметов каталогом НЕ ограничивается: политика
 * отображения — «исключаем только подтверждённые обычные расходники», поэтому
 * предмет, которого нет в каталоге, всё равно показывается (категория
 * `unclassified`), и подтверждённые покупки не теряются.
 *
 * В каталог входят предметы, которые игроки целенаправленно собирают, включая
 * базовые апгрейды, которые позже могут быть улучшены (например, `maelstrom` →
 * `mjollnir`): предмет остаётся видимым, если подтверждён отдельной покупкой.
 */
export const COMPLETED_ITEM_CATALOG: readonly string[] = [
  // Обувь
  'power_treads',
  'phase_boots',
  'arcane_boots',
  'tranquil_boots',
  'travel_boots',
  'travel_boots_2',
  'guardian_greaves',
  // Ранние значимые предметы
  'magic_wand',
  'soul_ring',
  'ring_of_aquila',
  'ancient_janggo', // Drum of Endurance (проверенный ключ OpenDota)
  'hand_of_midas',
  'falcon_blade',
  'echo_sabre',
  'armlet',
  'helm_of_the_dominator',
  'mask_of_madness',
  // Мобильность и контроль
  'blink',
  'arcane_blink',
  'swift_blink',
  'overwhelming_blink',
  'force_staff',
  'cyclone',
  'wind_waker',
  'harpoon',
  'rod_of_atos',
  'orchid',
  'bloodthorn',
  'sheepstick',
  'diffusal_blade',
  'nullifier',
  'basher', // Skull Basher (проверенный ключ OpenDota)
  'abyssal_blade',
  'heavens_halberd',
  // Урон
  'maelstrom',
  'mjollnir',
  'gungir', // Gleipnir (проверенный ключ OpenDota)
  'dragon_lance',
  'witch_blade',
  'lesser_crit',
  'greater_crit',
  'monkey_king_bar',
  'desolator',
  'bfury',
  'invis_sword',
  'silver_edge',
  'rapier',
  'dagon_2',
  'dagon_3',
  'dagon_4',
  'dagon_5',
  'ethereal_blade',
  'veil_of_discord',
  'meteor_hammer',
  'mage_slayer',
  // Выживаемость и защита
  'black_king_bar',
  'manta',
  'sange_and_yasha',
  'yasha_and_kaya', // Yasha and Kaya (проверенный ключ OpenDota)
  'kaya_and_sange',
  'hurricane_pike',
  'lotus_orb',
  'glimmer_cape',
  'aeon_disk',
  'sphere',
  'blade_mail',
  'crimson_guard',
  'pipe',
  'mekansm',
  'holy_locket',
  'solar_crest',
  'spirit_vessel',
  'shivas_guard',
  'assault',
  'heart',
  'satanic',
  'butterfly',
  'skadi', // Eye of Skadi (проверенный ключ OpenDota)
  'radiance',
  'moon_shard',
  'octarine_core',
  'refresher',
  'ultimate_scepter',
  'aghanims_shard',
  'bloodstone',
  'necronomicon',
  // Ранние собранные предметы (проверены по живому справочнику OpenDota)
  'bracer',
  'wraith_band',
  'null_talisman',
  // Прочие подтверждённые собранные предметы
  'aether_lens',
  'eternal_shroud',
  'hood_of_defiance',
  'boots_of_bearing',
  'helm_of_the_overlord',
  'disperser',
]

const COMPLETED_KEYS = new Set<string>(COMPLETED_ITEM_CATALOG)

/**
 * Отображаемые имена предметов, для которых механическое преобразование ключа
 * (`_` → пробел, Title Case) даёт неточное название. Остальные ключи преобразуются
 * автоматически; ключи API не изменяются.
 *
 * Словарь сверен с живым справочником OpenDota `GET /api/constants/items`
 * (30.10.2026): здесь остаются только ключи, у которых `dname` провайдера отличается
 * от механического преобразования, а значения приведены к `dname` дословно.
 * Поэтому имя в интерфейсе всегда совпадает с названием предмета у провайдера:
 *  - `ultimate_scepter` → «Aghanim's Scepter» (ранее ошибочно «Ultimate Scepter»);
 *  - `arcane_blink` → «Arcane Blink» (ранее ошибочно «Overwhelming Blink» — запись
 *    удалена, механическое преобразование совпадает с `dname`);
 *  - `ancient_janggo` → «Drum of Endurance», `gungir` → «Gleipnir», `skadi` → «Eye of Skadi»,
 *    `yasha_and_kaya` → «Yasha and Kaya»;
 *  - «мёртвые» ключи, которых нет у провайдера (`bkb`, `aghanims_scepter`, `midas`,
 *    `shadow_blade`, `blink_dagger`, `spirit_breaker`, `drums_of_endurance`,
 *    `eye_of_skadi`, `gleipnir`, `yasha_and_kasha`, `skull_basher`), удалены.
 */
export const ITEM_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  // Собранные предметы
  ultimate_scepter: "Aghanim's Scepter",
  aghanims_shard: "Aghanim's Shard",
  aghanims_shard_roshan: "Aghanim's Shard - Consumable",
  blink: 'Blink Dagger',
  manta: 'Manta Style',
  cyclone: "Eul's Scepter of Divinity",
  lesser_crit: 'Crystalys',
  greater_crit: 'Daedalus',
  basher: 'Skull Basher',
  bfury: 'Battle Fury',
  invis_sword: 'Shadow Blade',
  rapier: 'Divine Rapier',
  orchid: 'Orchid Malevolence',
  sheepstick: 'Scythe of Vyse',
  armlet: 'Armlet of Mordiggian',
  assault: 'Assault Cuirass',
  heart: 'Heart of Tarrasque',
  skadi: 'Eye of Skadi',
  sphere: "Linken's Sphere",
  shivas_guard: "Shiva's Guard",
  heavens_halberd: "Heaven's Halberd",
  pipe: 'Pipe of Insight',
  refresher: 'Refresher Orb',
  travel_boots: 'Boots of Travel',
  travel_boots_2: 'Boots of Travel 2',
  ancient_janggo: 'Drum of Endurance',
  gungir: 'Gleipnir',
  dagon_2: 'Dagon',
  dagon_3: 'Dagon',
  dagon_4: 'Dagon',
  dagon_5: 'Dagon',
  // Явные исключения ранней стадии
  royale_with_cheese: 'Block of Cheese',
  // Компоненты
  branches: 'Iron Branch',
  slippers: 'Slippers of Agility',
  mantle: 'Mantle of Intelligence',
  gauntlets: 'Gauntlets of Strength',
  boots: 'Boots of Speed',
  gloves: 'Gloves of Haste',
  boots_of_elves: 'Band of Elvenskin',
  robe: 'Robe of the Magi',
  sobi_mask: "Sage's Mask",
  eagle: 'Eaglesong',
  relic: 'Sacred Relic',
  blight_stone: 'Orb of Blight',
  lifesteal: 'Morbid Mask',
  ghost: 'Ghost Scepter',
  pers: 'Perseverance',
  // Обычные расходники: в секциях не показываются, имена — для полноты справочника
  flask: 'Healing Salve',
  dust: 'Dust of Appearance',
  infused_raindrop: 'Infused Raindrops',
  courier: 'Animal Courier',
  tango_single: 'Tango (Shared)',
  tpscroll: 'Town Portal Scroll',
  ward_observer: 'Observer Ward',
  ward_sentry: 'Sentry Ward',
  ward_dispenser: 'Observer and Sentry Wards',
}

/**
 * Служебные слова, которые в названиях предметов Dota 2 пишутся со строчной буквы
 * («Boots of Speed», «Sange and Yasha», «Helm of the Dominator»). Правило делает
 * механическое преобразование ключа ближе к реальным названиям и не требует
 * отдельной записи в словаре для каждого такого ключа.
 */
const LOWERCASE_NAME_PARTS = new Set(['of', 'the', 'and'])

/** Название предмета для отображения (по ключу OpenDota). */
export function itemDisplayName(key: string): string {
  const override = ITEM_NAME_OVERRIDES[key]
  if (override !== undefined) {
    return override
  }
  return key
    .split('_')
    .filter((part) => part.length > 0)
    .map((part, index) =>
      index > 0 && LOWERCASE_NAME_PARTS.has(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ')
}

/** URL иконки предмета на CDN Dota 2 (статические изображения, не API-запрос). */
export function itemIconUrl(key: string): string {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${key}.png`
}

/** Рецепт ли предмет (рецепт не является предметом и не показывается). */
export function isRecipeKey(key: string): boolean {
  return key.startsWith('recipe_') || key.endsWith('_recipe')
}

/**
 * Единая классификация предмета из журнала покупок (Task 14).
 *
 * Порядок проверок фиксирован и определяет политику отображения:
 *  1) пустой ключ → `unclassified` (показ запрещён);
 *  2) рецепт → `recipe` (исключается);
 *  3) собранный предмет (каталог) → `completed`;
 *  4) явные исключения (Bottle, Refresher Shard, Cheese, Block of Cheese и расходуемая
 *     версия Aghanim's Shard с Рошана) → `included-exception` (показываются в интервале);
 *  5) обычный расходник → `consumable` (исключается);
 *  6) компонент (каталог) → `component`;
 *  7) иначе → `unclassified`: ключ не подтверждён каталогами, но и не доказано,
 *     что это расходник, поэтому в интервале он показывается — безопасный
 *     документированный фолбэк («не теряем подтверждённые покупки и не выдаём их
 *     за расходники»).
 */
export function classifyPurchaseItem(key: string): PurchaseItemCategory {
  if (key.length === 0) {
    return 'unclassified'
  }
  if (isRecipeKey(key)) {
    return 'recipe'
  }
  if (COMPLETED_KEYS.has(key)) {
    return 'completed'
  }
  if (ALWAYS_INCLUDED_KEYS.has(key)) {
    return 'included-exception'
  }
  if (CONSUMABLE_KEYS.has(key)) {
    return 'consumable'
  }
  if (COMPONENT_KEYS.has(key)) {
    return 'component'
  }
  return 'unclassified'
}

/**
 * Общая база обеих политик: ключ не пустой, не рецепт и не обычный расходник.
 * Используется как строительный блок; сами политики секций различаются.
 */
function isNotConsumableOrRecipe(key: string): boolean {
  if (key.length === 0) {
    return false
  }
  const category = classifyPurchaseItem(key)
  return category !== 'recipe' && category !== 'consumable'
}

/**
 * Политика секции ранней стадии 00:00–15:00: подробный список событий интервала.
 *
 * Показываются компоненты, собранные предметы, явные исключения (Bottle,
 * Aghanim's Shard, Refresher Shard, Cheese, Block of Cheese) и неклассифицированные
 * ключи (безопасный документированный фолбэк: ключ не причисляется молча к
 * расходникам). Исключаются обычные расходники (варды, Tango, Clarity, Smoke, Dust,
 * Town Portal Scroll и т. п.) и рецепты.
 */
export function isDisplayedInEarlyGame(key: string): boolean {
  return isNotConsumableOrRecipe(key)
}

/**
 * Политика секции за весь матч: только значимые приобретения.
 *
 * Показываются:
 *  1) собранные предметы (`isCompletedItem`) — включая Aghanim's Shard, который
 *     классифицируется как собранный предмет, и апгрейды базовых сапог;
 *  2) Bottle (`BOTTLE_KEY`) — явное требование владельца;
 *  3) базовые Boots of Speed — только если в подтверждённой истории покупок нет
 *     улучшения в собранные сапоги (`options.hasBootsUpgrade`).
 *
 * Не показываются: прочие компоненты, обычные расходники, рецепты, исключения
 * ранней стадии (Refresher Shard, Cheese, Block of Cheese) и неклассифицированные
 * ключи — консервативный фолбэк «собранный предмет не подтверждён — не показываем».
 */
export function isDisplayedInFullMatch(
  key: string,
  options: { hasBootsUpgrade: boolean },
): boolean {
  if (!isNotConsumableOrRecipe(key)) {
    return false
  }
  if (key === BOTTLE_KEY) {
    return true
  }
  if (key === BASIC_BOOTS_KEY) {
    return !options.hasBootsUpgrade
  }
  return isCompletedItem(key)
}

/**
 * Есть ли в подтверждённой истории покупок улучшение базовых сапог.
 * Проверяется именно журнал событий, а не финальный инвентарь.
 */
export function hasConfirmedBootsUpgrade(purchases: LaningPurchase[]): boolean {
  return purchases.some((purchase) => BOOTS_UPGRADE_KEYS.has(purchase.key))
}

/** Предмет из проверенного каталога собранных предметов. */
export function isCompletedItem(key: string): boolean {
  return classifyPurchaseItem(key) === 'completed'
}

/** Компонент из проверенного каталога компонентов. */
export function isComponentItem(key: string): boolean {
  return classifyPurchaseItem(key) === 'component'
}

/** Явное исключение требования (показывается всегда). */
export function isAlwaysIncludedItem(key: string): boolean {
  return classifyPurchaseItem(key) === 'included-exception'
}

/**
 * Неклассифицированный ключ: не рецепт, не расходник, не входит в каталоги.
 * Показывается как есть (документированный fallback), но не считается собранным
 * предметом и не причисляется к расходникам.
 */
export function isUnknownItemKey(key: string): boolean {
  return key.length > 0 && classifyPurchaseItem(key) === 'unclassified'
}

/**
 * Фильтр покупок интервала 00:00–15:00 (политика ранней стадии).
 *
 * Порядок записей и повторные покупки сохраняются: фильтр не агрегирует события и
 * не удаляет легитимные дубликаты (две покупки одного предмета в разное время —
 * два события). `null` означает отсутствие журнала и остаётся `null`.
 */
export function filterEarlyGamePurchases(
  purchases: LaningPurchase[] | null,
): LaningPurchase[] | null {
  if (purchases === null) {
    return null
  }
  return purchases.filter((purchase) => isDisplayedInEarlyGame(purchase.key))
}

/**
 * Предметы за матч: каждый отображаемый предмет один раз, время — первая
 * подтверждённая покупка. Используется политика секции за весь матч
 * (`isDisplayedInFullMatch`): собранные предметы, Bottle и базовые Boots of Speed
 * без подтверждённого улучшения; компоненты, расходники и рецепты скрыты.
 *
 * Возвращает `null`, если журнал покупок недоступен (секция не строится), и `[]`,
 * если журнал получен, но отображаемых предметов в нём нет. Записи без корректного
 * времени в журнал не попадают вовсе (`collectPurchaseLog`), поэтому время никогда
 * не выдумывается. Повторные покупки одного предмета не создают дубликатов в этой
 * секции, но и не удаляют события: полный хронологический список событий интервала
 * строит секция ранней стадии (`filterEarlyGamePurchases`).
 */
export function buildMatchItems(purchaseLog: LaningPurchase[] | null): MatchItemEntry[] | null {
  if (purchaseLog === null) {
    return null
  }
  // Улучшение сапог определяется только по подтверждённой истории покупок.
  const hasBootsUpgrade = hasConfirmedBootsUpgrade(purchaseLog)
  const firstSeen = new Map<string, number>()
  for (const purchase of purchaseLog) {
    if (!isDisplayedInFullMatch(purchase.key, { hasBootsUpgrade })) {
      continue
    }
    const existing = firstSeen.get(purchase.key)
    if (existing === undefined || purchase.time < existing) {
      firstSeen.set(purchase.key, purchase.time)
    }
  }
  const items: MatchItemEntry[] = []
  for (const [key, time] of firstSeen) {
    items.push({ key, name: itemDisplayName(key), time, iconUrl: itemIconUrl(key) })
  }
  items.sort((a, b) => (a.time === b.time ? a.key.localeCompare(b.key) : a.time - b.time))
  return items
}