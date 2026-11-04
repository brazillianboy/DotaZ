import type { BuildingKillEvent, NormalizedMatch } from '../types/match'

/**
 * Состояние зданий матча (Task 15).
 *
 * Модуль чистый: без сети, React и глобального состояния. Все выводы строятся только
 * на подтверждённых полях OpenDota; неизвестное состояние не превращается в
 * «разрушено» и наоборот.
 *
 * ## Семантика битмасок (проверена, не угадана)
 *
 * Установленный бит = здание **стоит** (состояние на конец матча), снятый = разрушено.
 * Проверка выполнена на 24 обработанных матчах: набор снятых битов
 * `tower_status_radiant`/`tower_status_dire` и `barracks_status_radiant`/
 * `barracks_status_dire` совпал с событиями `objectives` типа `building_kill`
 * (ключи `npc_dota_goodguys_*` — здания Radiant, `npc_dota_badguys_*` — здания Dire).
 *
 * Порядок битов башен (11 бит):
 *   0/1/2 — верхняя линия: T1/T2/T3;
 *   3/4/5 — средняя линия: T1/T2/T3;
 *   6/7/8 — нижняя линия: T1/T2/T3;
 *   9 и 10 — две башни T4 (провайдер не различает их позиции).
 *
 * Порядок битов бараков (6 бит):
 *   0/1 — верхняя линия (melee/ranged), 2/3 — средняя, 4/5 — нижняя.
 *
 * ## Время разрушения
 *
 * Показывается только при подтверждённом событии `building_kill` с временем.
 * Итоговая битмаска сама по себе НЕ даёт времени разрушения. События для двух башен T4
 * приходят с одинаковым ключом (`…_tower4`), поэтому позиция конкретной T4 не
 * определяется и время для них не приписывается.
 *
 * ## Координаты: проверенные данные карты Dota 2
 *
 * Координаты строений — не оценки и не результат симметрии, а данные самой игры:
 * дамп сущностей карты (`npc_dota_tower` с ярусами, `npc_dota_barracks` с типом
 * melee/range, `npc_dota_fort` — троны) из `dota-map-coordinates` (патчи 7.22/7.23)
 * и границы мира оттуда же (`data/worlddata.json`: X и Y от −8288 до 8288).
 *
 * Каждая сторона имеет СВОИ координаты (см. `DOTA_STRUCTURE_WORLD_POSITIONS`): реальная
 * карта лишь приблизительно симметрична (трон Radiant (−5920, −5352) против трона Dire
 * (5528, 5000)), поэтому поворот на 180° не применяется.
 *
 * Маркеры ставятся на изображение карты документированным преобразованием
 * `worldToMapPercent` (ось Y инвертируется: в мире +Y — «вверх»). Фон
 * (`MAP_IMAGE_SRC`) построен из того же дампа и покрывает ровно те же границы, поэтому
 * проценты совпадают с пикселями изображения при любом размере контейнера.
 */

/**
 * Изображение карты Dota 2, предоставленное владельцем (финальное).
 *
 * Файл `public/images/dotaz-map-clean.png` — ровно то изображение, которое должно
 * показываться в отчёте: 1254×1254 пикселя, не перерисовывается, не обрезается и не
 * растягивается. Маркеры наносятся в той же системе координат, что и изображение
 * (проценты от его размеров), поэтому они не смещаются при любом масштабе контейнера.
 */
export const MAP_IMAGE_SRC = '/images/dotaz-map-clean.png'

/** Сторона изображения карты в пикселях (используется для перевода пикселей в проценты). */
export const MAP_IMAGE_SIZE = 1254

export type TeamSide = 'radiant' | 'dire'
export type BuildingState = 'standing' | 'destroyed' | 'unknown'
export type BuildingKind = 'tower' | 'barracks' | 'ancient'
export type LaneName = 'top' | 'mid' | 'bot'
export type BarracksType = 'melee' | 'ranged'
export type TowerTier = 1 | 2 | 3 | 4

export interface BuildingStatus {
  /** Стабильный идентификатор: `radiant-tower-1-top`, `dire-barracks-melee-mid`, … */
  id: string
  kind: BuildingKind
  side: TeamSide
  tier: TowerTier | null
  lane: LaneName | null
  barracksType: BarracksType | null
  state: BuildingState
  /** Время разрушения в секундах; только при подтверждённом событии. */
  destroyedAt: number | null
  /** Условная координата X схемы (0–100). */
  x: number
  /** Условная координата Y схемы (0–100). */
  y: number
}

/** Количество битов в масках башен и бараков (проверено по данным матчей). */
export const TOWER_BIT_COUNT = 11
export const BARRACKS_BIT_COUNT = 6

const TOWER_LAYOUT: ReadonlyArray<{ bit: number; tier: TowerTier; lane: LaneName | null }> = [
  { bit: 0, tier: 1, lane: 'top' },
  { bit: 1, tier: 2, lane: 'top' },
  { bit: 2, tier: 3, lane: 'top' },
  { bit: 3, tier: 1, lane: 'mid' },
  { bit: 4, tier: 2, lane: 'mid' },
  { bit: 5, tier: 3, lane: 'mid' },
  { bit: 6, tier: 1, lane: 'bot' },
  { bit: 7, tier: 2, lane: 'bot' },
  { bit: 8, tier: 3, lane: 'bot' },
  { bit: 9, tier: 4, lane: null },
  { bit: 10, tier: 4, lane: null },
]

const BARRACKS_LAYOUT: ReadonlyArray<{
  bit: number
  lane: LaneName
  barracksType: BarracksType
}> = [
  { bit: 0, lane: 'top', barracksType: 'melee' },
  { bit: 1, lane: 'top', barracksType: 'ranged' },
  { bit: 2, lane: 'mid', barracksType: 'melee' },
  { bit: 3, lane: 'mid', barracksType: 'ranged' },
  { bit: 4, lane: 'bot', barracksType: 'melee' },
  { bit: 5, lane: 'bot', barracksType: 'ranged' },
]

/** Ссылка на здание из ключа события `building_kill`. */
export interface BuildingKillRef {
  side: TeamSide
  kind: BuildingKind
  tier: TowerTier | null
  lane: LaneName | null
  barracksType: BarracksType | null
}

const BUILDING_KEY_RE = /^npc_dota_(goodguys|badguys)_(?:tower([1-4])|(melee|range)_rax|fort)(?:_(top|mid|bot))?$/

/**
 * Разбор ключа события разрушения здания.
 * `goodguys` — здания Radiant, `badguys` — здания Dire (конвенция Dota 2).
 * Неизвестный ключ → `null` (событие игнорируется, а не трактуется наугад).
 */
export function parseBuildingKillKey(key: string): BuildingKillRef | null {
  const match = BUILDING_KEY_RE.exec(key)
  if (match === null) {
    return null
  }
  const side: TeamSide = match[1] === 'goodguys' ? 'radiant' : 'dire'
  const lane = (match[4] as LaneName | undefined) ?? null
  if (match[2] !== undefined) {
    return { side, kind: 'tower', tier: Number(match[2]) as TowerTier, lane, barracksType: null }
  }
  if (match[3] !== undefined) {
    return {
      side,
      kind: 'barracks',
      tier: null,
      lane,
      barracksType: match[3] === 'melee' ? 'melee' : 'ranged',
    }
  }
  return { side, kind: 'ancient', tier: null, lane: null, barracksType: null }
}

/**
 * Границы игрового мира Dota 2 в мировых координатах.
 *
 * Источник: `data/worlddata.json` дампа сущностей карты Dota 2 (`dota-map-coordinates`,
 * патчи 7.22/7.23) — значения получены самой игрой, а не подобраны вручную.
 */
export const DOTA_WORLD_BOUNDS = {
  minX: -8288,
  maxX: 8288,
  minY: -8288,
  maxY: 8288,
} as const

/**
 * Преобразование мировых координат Dota 2 в проценты изображения карты.
 *
 * Документированное линейное отображение: мир покрывает ровно границы
 * `DOTA_WORLD_BOUNDS`, изображение — 0…100 % по обеим осям.
 *
 *   xPct = (x − minX) / (maxX − minX) × 100
 *   yPct = (maxY − y) / (maxY − minY) × 100
 *
 * Ось Y инвертируется: в мире +Y направлен «вверх» (к базе Dire), а на изображении ось Y
 * растёт вниз. Обратное преобразование: `x = minX + xPct / 100 × (maxX − minX)`,
 * `y = maxY − yPct / 100 × (maxY − minY)`.
 */
export function worldToMapPercent(point: { x: number; y: number }): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = DOTA_WORLD_BOUNDS
  return {
    x: ((point.x - minX) / (maxX - minX)) * 100,
    y: ((maxY - point.y) / (maxY - minY)) * 100,
  }
}

/**
 * Проверенные мировые координаты всех 36 строений (дамп сущностей карты Dota 2,
 * патчи 7.22/7.23: `npc_dota_tower` с `subType` tower1…tower4, `npc_dota_barracks`
 * с `subType` melee/range, `npc_dota_fort` — трон).
 *
 * Координаты взяты ИЗ ДАННЫХ КАРТЫ, а не из симметрии или рисунка: у каждой стороны свои
 * значения (реальная карта лишь приблизительно симметрична — трон Radiant (−5920, −5352),
 * трон Dire (5528, 5000)), поэтому поворот на 180° не применяется.
 *
 * Линия определена по направлению от трона стороны к её дальней башне T1 этой линии
 * (каждая линия имеет ровно одну башню каждого яруса): для Radiant верхняя линия уходит
 * на север, нижняя — на восток, средняя — по диагонали; для Dire верхняя — на запад,
 * нижняя — на юг. Принадлежность остальных строений линии проверена по близости к этому
 * направлению и подтверждена визуально на изображении карты.
 *
 * Две башни T4 в OpenDota неразличимы (один ключ события), поэтому `tower-4-0` —
 * северная из пары, `tower-4-1` — южная; это устойчивое, документированное соответствие.
 */
export const DOTA_STRUCTURE_WORLD_POSITIONS: Readonly<
  Record<TeamSide, Readonly<Record<string, { x: number; y: number }>>>
> = {
  radiant: {
    // Верхняя линия: вдоль левого края на север.
    'tower-1-top': { x: -6256, y: 1816 },
    'tower-2-top': { x: -6160, y: -872 },
    'tower-3-top': { x: -6592, y: -3408 },
    // Средняя линия: диагональ от базы к центру карты.
    'tower-1-mid': { x: -1544, y: -1408 },
    'tower-2-mid': { x: -3472, y: -2656 },
    'tower-3-mid': { x: -4640, y: -4144 },
    // Нижняя линия: вдоль нижнего края на восток.
    'tower-1-bot': { x: 4924, y: -6128 },
    'tower-2-bot': { x: -104, y: -6320 },
    'tower-3-bot': { x: -3952, y: -6112 },
    // Две башни T4 у трона: 0 — северная, 1 — южная.
    'tower-4-0': { x: -5712, y: -4864 },
    'tower-4-1': { x: -5392, y: -5192 },
    // Бараки: пара у выхода своей линии из базы.
    'barracks-melee-top': { x: -6336, y: -3758 },
    'barracks-ranged-top': { x: -6844, y: -3759 },
    'barracks-melee-mid': { x: -4672, y: -4552 },
    'barracks-ranged-mid': { x: -5060, y: -4199 },
    'barracks-melee-bot': { x: -4280, y: -6360 },
    'barracks-ranged-bot': { x: -4279, y: -5853 },
    // Трон (крепость) Radiant.
    ancient: { x: -5920, y: -5352 },
  },
  dire: {
    // Верхняя линия Dire: вдоль верхнего края на запад.
    'tower-1-top': { x: -4672, y: 6016 },
    'tower-2-top': { x: 0, y: 6016 },
    'tower-3-top': { x: 3552, y: 5776 },
    // Средняя линия Dire: диагональ к центру.
    'tower-1-mid': { x: 524, y: 652 },
    'tower-2-mid': { x: 2496, y: 2112 },
    'tower-3-mid': { x: 4272, y: 3759 },
    // Нижняя линия Dire: вниз по правому краю.
    'tower-1-bot': { x: 6269, y: -1729 },
    'tower-2-bot': { x: 6208, y: 384 },
    'tower-3-bot': { x: 6336, y: 3032 },
    // Две башни T4 у трона: 0 — северная, 1 — южная.
    'tower-4-0': { x: 4944, y: 4776 },
    'tower-4-1': { x: 5280, y: 4432 },
    // Бараки: пара у выхода своей линии из базы.
    'barracks-melee-top': { x: 3898, y: 5496 },
    'barracks-ranged-top': { x: 3894, y: 6025 },
    'barracks-melee-mid': { x: 4702, y: 3824 },
    'barracks-ranged-mid': { x: 4336, y: 4183 },
    'barracks-melee-bot': { x: 6592, y: 3392 },
    'barracks-ranged-bot': { x: 6064, y: 3376 },
    // Трон (крепость) Dire.
    ancient: { x: 5528, y: 5000 },
  },
}

/**
 * Калибровка изображения владельца (Task 15).
 *
 * Изображение `dotaz-map-clean.png` — стилизованная карта: её рамка и масштаб не совпадают
 * с проекцией игровых границ мира на весь холст, поэтому простое преобразование
 * `worldToMapPercent` к ней неприменимо.
 *
 * Калибровка выполняется по опорным точкам: парам «проверенная мировая координата
 * (из дампа сущностей карты) ↔ пиксель на изображении владельца». Опорные точки —
 * ФОНТАНЫ: это самые угловые строения базы, и именно они однозначно опознаются на
 * изображении в углах базовых площадок (Radiant — нижний левый угол, Dire — верхний
 * правый). Мировые координаты фонтанов: `ent_dota_fountain` (−7456, −6938) и (7472, 6912).
 *
 * По двум опорным точкам однозначно восстанавливается преобразование подобия с отражением
 * оси Y (в мире +Y — «вверх», на изображении ось Y растёт вниз):
 *
 *   pixelX = a·x − b·y + tx
 *   pixelY = −b·x − a·y + ty
 *
 * Коэффициенты НЕ задаются вручную: они вычисляются из опорных точек функцией
 * `fitCalibration` при загрузке модуля, поэтому калибровка и опорные точки не могут
 * разойтись. Калибровочные данные хранятся отдельно от координат строений.
 *
 * Кросс-проверка (не входит в подгонку): оба трона после калибровки попадают внутрь
 * базовых площадок изображения — Radiant ≈ (175, 989) при площадке x 70–370, y 840–1130;
 * Dire ≈ (994, 268) при площадке x 839–1151, y 90–415.
 */
export interface MapCalibrationAnchor {
  /** Название ориентира (для отчёта и тестов). */
  name: string
  /** Проверенная мировая координата (единицы карты Dota 2). */
  world: { x: number; y: number }
  /** Соответствующий пиксель на изображении владельца (1254×1254). */
  pixel: { x: number; y: number }
}

/** Опорные точки калибровки: фонтаны баз (мировая координата ↔ пиксель изображения). */
export const MAP_CALIBRATION_ANCHORS: readonly MapCalibrationAnchor[] = [
  {
    name: 'Radiant fountain',
    world: { x: -7456, y: -6938 },
    pixel: { x: 65, y: 1100 },
  },
  {
    name: 'Dire fountain',
    world: { x: 7472, y: 6912 },
    pixel: { x: 1133, y: 134 },
  },
]

/** Коэффициенты преобразования мир → пиксели изображения. */
export interface MapCalibration {
  a: number
  b: number
  tx: number
  ty: number
}

/**
 * Вычисление коэффициентов по двум опорным точкам (подобие с отражением оси Y).
 * Экспортируется для тестов: коэффициенты обязаны воспроизводить опорные точки.
 */
export function fitCalibration(anchors: readonly MapCalibrationAnchor[]): MapCalibration {
  if (anchors.length < 2) {
    throw new Error('Для калибровки нужны минимум две опорные точки')
  }
  const [first, second] = anchors
  const dx = second.world.x - first.world.x
  const dy = second.world.y - first.world.y
  const dpx = second.pixel.x - first.pixel.x
  const dpy = second.pixel.y - first.pixel.y
  const det = dx * dx + dy * dy

  // Решение системы dx·a − dy·b = dpx; dy·a + dx·b = −dpy
  const a = (dpx * dx - dpy * dy) / det
  const b = (-dpx * dy - dpy * dx) / det

  return {
    a,
    b,
    tx: first.pixel.x - a * first.world.x + b * first.world.y,
    ty: first.pixel.y + b * first.world.x + a * first.world.y,
  }
}

/** Коэффициенты калибровки, вычисленные из опорных точек при загрузке модуля. */
export const MAP_CALIBRATION: MapCalibration = fitCalibration(MAP_CALIBRATION_ANCHORS)

/** Проверенная мировая координата → пиксель изображения владельца. */
export function worldToImagePixel(point: { x: number; y: number }): { x: number; y: number } {
  const { a, b, tx, ty } = MAP_CALIBRATION
  return {
    x: a * point.x - b * point.y + tx,
    y: -b * point.x - a * point.y + ty,
  }
}

/**
 * Проверенная мировая координата → проценты изображения владельца.
 *
 * Пиксели переводятся в проценты от стороны изображения (`MAP_IMAGE_SIZE = 1254`):
 * `xPercent = pixelX / 1254 × 100`, `yPercent = pixelY / 1254 × 100`. Это та же система
 * координат, что и у самого изображения, поэтому маркеры не смещаются при масштабировании.
 */
export function worldToImagePercent(point: { x: number; y: number }): { x: number; y: number } {
  const pixel = worldToImagePixel(point)
  return {
    x: (pixel.x / MAP_IMAGE_SIZE) * 100,
    y: (pixel.y / MAP_IMAGE_SIZE) * 100,
  }
}

/**
 * Координата здания на изображении владельца (проценты 0–100).
 *
 * Берётся проверенная мировая координата строения (данные карты Dota 2) и переводится
 * калиброванным преобразованием `worldToImagePercent`. Неизвестный ключ даёт центр
 * изображения: маркер не выдумывает расположение, но и не выпадает за границы.
 */
export function buildingPosition(side: TeamSide, key: string): { x: number; y: number } {
  const world = DOTA_STRUCTURE_WORLD_POSITIONS[side][key]
  if (world === undefined) {
    return { x: 50, y: 50 }
  }
  return worldToImagePercent(world)
}

/**
 * Состояние по биту маски и подтверждённому событию.
 * Снятый бит = разрушено; установленный бит при наличии события разрушения даёт
 * честное «неизвестно» (противоречие источников не сглаживается).
 */
function resolveState(maskStanding: boolean | null, destroyedAt: number | null): BuildingState {
  if (maskStanding === null) {
    return destroyedAt === null ? 'unknown' : 'destroyed'
  }
  if (!maskStanding) {
    return 'destroyed'
  }
  return destroyedAt === null ? 'standing' : 'unknown'
}

function towerId(side: TeamSide, tier: TowerTier, lane: LaneName | null, index: number): string {
  const lanePart = lane === null ? String(index) : lane
  return `${side}-tower-${tier}-${lanePart}`
}

/** Расшифровка маски башен: 11 позиций (T1–T3 по линиям и две башни T4). */
export function decodeTowerStatus(
  mask: number | null,
  side: TeamSide,
  events: BuildingKillEvent[] | null,
): BuildingStatus[] {
  return TOWER_LAYOUT.map((slot, index) => {
    const maskStanding = mask === null ? null : ((mask >> slot.bit) & 1) === 1
    // Ключ события для двух башен T4 одинаков, поэтому позиция не определяется:
    // время для T4 не приписывается (см. документацию модуля).
    const destroyedAt =
      slot.tier === 4 ? null : findBuildingKillTime(events, { side, kind: 'tower', tier: slot.tier, lane: slot.lane })
    const positionKey =
      slot.tier === 4
        ? `tower-4-${slot.bit === 9 ? 0 : 1}`
        : `tower-${slot.tier}-${slot.lane ?? 'mid'}`
    const position = buildingPosition(side, positionKey)
    return {
      id: towerId(side, slot.tier, slot.lane, index),
      kind: 'tower',
      side,
      tier: slot.tier,
      lane: slot.lane,
      barracksType: null,
      state: resolveState(maskStanding, destroyedAt),
      destroyedAt,
      x: position.x,
      y: position.y,
    }
  })
}

/** Расшифровка маски бараков: 6 позиций (melee/ranged для трёх линий). */
export function decodeBarracksStatus(
  mask: number | null,
  side: TeamSide,
  events: BuildingKillEvent[] | null,
): BuildingStatus[] {
  return BARRACKS_LAYOUT.map((slot) => {
    const maskStanding = mask === null ? null : ((mask >> slot.bit) & 1) === 1
    const destroyedAt = findBuildingKillTime(events, {
      side,
      kind: 'barracks',
      lane: slot.lane,
      barracksType: slot.barracksType,
    })
    const position = buildingPosition(side, `barracks-${slot.barracksType}-${slot.lane}`)
    return {
      id: `${side}-barracks-${slot.barracksType}-${slot.lane}`,
      kind: 'barracks',
      side,
      tier: null,
      lane: slot.lane,
      barracksType: slot.barracksType,
      state: resolveState(maskStanding, destroyedAt),
      destroyedAt,
      x: position.x,
      y: position.y,
    }
  })
}

/**
 * Состояние трона (Ancient) по подтверждённым событиям: маски для него нет.
 * Событие разрушения → `destroyed`; событий зданий в ответе нет → `unknown`;
 * события есть, но трона среди них нет → трон устоял (`standing`).
 */
export function decodeAncientStatus(
  events: BuildingKillEvent[] | null,
  side: TeamSide,
): BuildingStatus {
  const destroyedAt = findBuildingKillTime(events, { side, kind: 'ancient' })
  const state: BuildingState =
    destroyedAt !== null ? 'destroyed' : events === null || events.length === 0 ? 'unknown' : 'standing'
  const position = buildingPosition(side, 'ancient')
  return {
    id: `${side}-ancient`,
    kind: 'ancient',
    side,
    tier: null,
    lane: null,
    barracksType: null,
    state,
    destroyedAt,
    x: position.x,
    y: position.y,
  }
}

/**
 * Полный список зданий матча: башни, бараки и трон каждой стороны.
 * Порядок стабилен (Radiant, затем Dire), что упрощает тесты и текст-дубликат карты.
 */
export function decodeBuildings(match: NormalizedMatch): BuildingStatus[] {
  const events = match.buildingKills
  return [
    ...decodeTowerStatus(match.tower_status_radiant, 'radiant', events),
    ...decodeBarracksStatus(match.barracks_status_radiant, 'radiant', events),
    decodeAncientStatus(events, 'radiant'),
    ...decodeTowerStatus(match.tower_status_dire, 'dire', events),
    ...decodeBarracksStatus(match.barracks_status_dire, 'dire', events),
    decodeAncientStatus(events, 'dire'),
  ]
}

/** Есть ли в матче хоть какие-то подтверждённые данные о зданиях. */
export function hasBuildingData(match: NormalizedMatch): boolean {
  return (
    match.tower_status_radiant !== null ||
    match.tower_status_dire !== null ||
    match.barracks_status_radiant !== null ||
    match.barracks_status_dire !== null ||
    (match.buildingKills !== null && match.buildingKills.length > 0)
  )
}

/** Подтверждённое время разрушения конкретного здания или `null`. */
export function findBuildingKillTime(
  events: BuildingKillEvent[] | null,
  ref: { side: TeamSide; kind: BuildingKind; tier?: TowerTier | null; lane?: LaneName | null; barracksType?: BarracksType | null },
): number | null {
  if (events === null) {
    return null
  }
  let earliest: number | null = null
  for (const event of events) {
    const parsed = parseBuildingKillKey(event.key)
    if (parsed === null) {
      continue
    }
    if (parsed.side !== ref.side || parsed.kind !== ref.kind) {
      continue
    }
    if (ref.kind === 'tower') {
      if (parsed.tier !== (ref.tier ?? null)) {
        continue
      }
      // Линия обязательна: без неё событие одной башни приписалось бы другой.
      if (parsed.lane !== (ref.lane ?? null)) {
        continue
      }
    }
    if (ref.kind === 'barracks') {
      if (parsed.lane !== (ref.lane ?? null) || parsed.barracksType !== (ref.barracksType ?? null)) {
        continue
      }
    }
    if (earliest === null || event.time < earliest) {
      earliest = event.time
    }
  }
  return earliest
}
