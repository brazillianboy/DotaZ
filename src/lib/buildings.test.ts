import { describe, expect, it } from 'vitest'

import {
  BARRACKS_BIT_COUNT,
  DOTA_STRUCTURE_WORLD_POSITIONS,
  DOTA_WORLD_BOUNDS,
  MAP_CALIBRATION,
  MAP_CALIBRATION_ANCHORS,
  MAP_IMAGE_SIZE,
  MAP_IMAGE_SRC,
  TOWER_BIT_COUNT,
  buildingPosition,
  decodeAncientStatus,
  decodeBarracksStatus,
  decodeBuildings,
  decodeTowerStatus,
  findBuildingKillTime,
  fitCalibration,
  hasBuildingData,
  parseBuildingKillKey,
  worldToImagePercent,
  worldToImagePixel,
  worldToMapPercent,
} from './buildings'
import type { BuildingStatus } from './buildings'
import { normalizeMatch } from './normalizeMatch'

/**
 * PNG-файлы, реально присутствующие в `public/images`: список разрешается Vite на этапе
 * сборки, поэтому тест падает, если изображение карты убрали из публичного каталога.
 */
const mapAssets = Object.keys(import.meta.glob('/public/images/*.png'))

/** Ключ позиции строения в наборе проверенных координат (`DOTA_STRUCTURE_WORLD_POSITIONS`). */
function buildingPositionKey(building: BuildingStatus): string {
  if (building.kind === 'ancient') {
    return 'ancient'
  }
  if (building.kind === 'barracks') {
    return `barracks-${building.barracksType}-${building.lane}`
  }
  if (building.tier === 4) {
    return `tower-4-${building.id.endsWith('-tower-4-9') ? 0 : 1}`
  }
  return `tower-${building.tier}-${building.lane}`
}

/**
 * Тесты состояния зданий (Task 15).
 *
 * Ключи и время событий взяты из реального матча 9007760151; битмаски этого же
 * матча (`tower_status_radiant = 1974`, `barracks_status_radiant = 63`,
 * `tower_status_dire = 0`, `barracks_status_dire = 0`) совпадают с событиями
 * разрушения — это и проверяется ниже.
 */

const EVENTS = [
  { time: 664, key: 'npc_dota_badguys_tower1_top' },
  { time: 752, key: 'npc_dota_badguys_tower1_bot' },
  { time: 849, key: 'npc_dota_badguys_tower1_mid' },
  { time: 1062, key: 'npc_dota_goodguys_tower1_mid' },
  { time: 1155, key: 'npc_dota_goodguys_tower1_bot' },
  { time: 1795, key: 'npc_dota_badguys_range_rax_bot' },
  { time: 1799, key: 'npc_dota_badguys_melee_rax_bot' },
  { time: 1843, key: 'npc_dota_goodguys_tower1_top' },
  { time: 2070, key: 'npc_dota_badguys_fort' },
]

describe('Декодирование битмасок башен', () => {
  it('снятые биты означают разрушенные башни Radiant', () => {
    const towers = decodeTowerStatus(1974, 'radiant', EVENTS)

    expect(towers).toHaveLength(TOWER_BIT_COUNT)
    expect(
      towers
        .filter((tower) => tower.state === 'destroyed')
        .map((tower) => `${tower.tier}-${tower.lane}`),
    ).toEqual(['1-top', '1-mid', '1-bot'])
  })

  it('полностью снятая маска Dire означает все разрушенные башни', () => {
    const towers = decodeTowerStatus(0, 'dire', EVENTS)

    expect(towers.every((tower) => tower.state === 'destroyed')).toBe(true)
  })

  it('отсутствие маски даёт «неизвестно», а не «разрушено»', () => {
    const towers = decodeTowerStatus(null, 'radiant', null)

    expect(towers.every((tower) => tower.state === 'unknown')).toBe(true)
    expect(towers.every((tower) => tower.destroyedAt === null)).toBe(true)
  })

  it('подтверждённое время привязывается к конкретной башне', () => {
    const towers = decodeTowerStatus(1974, 'radiant', EVENTS)

    expect(towers.find((tower) => tower.tier === 1 && tower.lane === 'top')?.destroyedAt).toBe(1843)
    expect(towers.find((tower) => tower.tier === 2 && tower.lane === 'top')?.destroyedAt).toBeNull()
  })

  it('двум башням T4 время не приписывается (один ключ события)', () => {
    const towers = decodeTowerStatus(0, 'dire', EVENTS)

    for (const tower of towers.filter((item) => item.tier === 4)) {
      expect(tower.state).toBe('destroyed')
      expect(tower.destroyedAt).toBeNull()
    }
  })
})

describe('Трон (Ancient)', () => {
  it('определяется только по подтверждённому событию', () => {
    expect(decodeAncientStatus(EVENTS, 'dire').state).toBe('destroyed')
    expect(decodeAncientStatus(EVENTS, 'dire').destroyedAt).toBe(2070)
    expect(decodeAncientStatus(EVENTS, 'radiant').state).toBe('standing')
  })

  it('без событий состояние неизвестно', () => {
    expect(decodeAncientStatus(null, 'dire').state).toBe('unknown')
    expect(decodeAncientStatus([], 'dire').state).toBe('unknown')
  })
})

describe('Разбор ключей и координаты', () => {
  it('разбирает ключи зданий и игнорирует прочие события', () => {
    expect(parseBuildingKillKey('npc_dota_goodguys_tower2_mid')).toEqual({
      side: 'radiant',
      kind: 'tower',
      tier: 2,
      lane: 'mid',
      barracksType: null,
    })
    expect(parseBuildingKillKey('npc_dota_badguys_range_rax_top')?.barracksType).toBe('ranged')
    expect(parseBuildingKillKey('npc_dota_badguys_fort')?.kind).toBe('ancient')
    expect(parseBuildingKillKey('CHAT_MESSAGE_COURIER_LOST')).toBeNull()
  })

  it('находит время только для подтверждённого здания', () => {
    expect(
      findBuildingKillTime(EVENTS, { side: 'dire', kind: 'tower', tier: 1, lane: 'mid' }),
    ).toBe(849)
    expect(
      findBuildingKillTime(EVENTS, { side: 'dire', kind: 'tower', tier: 3, lane: 'mid' }),
    ).toBeNull()
  })

  it('берёт координаты из данных карты, а не из поворота Radiant на 180°', () => {
    const radiant = DOTA_STRUCTURE_WORLD_POSITIONS.radiant
    const dire = DOTA_STRUCTURE_WORLD_POSITIONS.dire

    // Реальная карта лишь приблизительно симметрична: троны отличаются по обеим осям.
    expect(Math.abs(radiant.ancient.x + dire.ancient.x)).toBeGreaterThan(100)
    expect(Math.abs(radiant.ancient.y + dire.ancient.y)).toBeGreaterThan(100)
    // У каждой стороны свой набор координат (не вычисляемый из другого).
    expect(radiant['tower-1-top']).not.toEqual(dire['tower-1-top'])
    expect(radiant['barracks-melee-mid']).not.toEqual(dire['barracks-melee-mid'])
  })
})

describe('Полная карта зданий', () => {
  it('строит здания обеих сторон и различает стороны', () => {
    const match = normalizeMatch({
      tower_status_radiant: 1974,
      tower_status_dire: 0,
      barracks_status_radiant: 63,
      barracks_status_dire: 0,
      objectives: EVENTS.map((event) => ({ type: 'building_kill', ...event })),
    })
    const buildings = decodeBuildings(match)

    expect(buildings.filter((item) => item.side === 'radiant')).toHaveLength(
      TOWER_BIT_COUNT + BARRACKS_BIT_COUNT + 1,
    )
    expect(buildings.filter((item) => item.side === 'dire')).toHaveLength(
      TOWER_BIT_COUNT + BARRACKS_BIT_COUNT + 1,
    )
    expect(
      buildings.filter((item) => item.side === 'radiant' && item.kind === 'tower')[0].x,
    ).toBeLessThan(50)
    expect(hasBuildingData(match)).toBe(true)
  })

  it('без данных о зданиях карта недоступна, состояния неизвестны', () => {
    const match = normalizeMatch({})

    expect(hasBuildingData(match)).toBe(false)
    expect(decodeBuildings(match).every((item) => item.state === 'unknown')).toBe(true)
  })
})

describe('Декодирование битмасок бараков', () => {
  it('все шесть битов установлены → бараки стоят', () => {
    const barracks = decodeBarracksStatus(63, 'radiant', EVENTS)

    expect(barracks).toHaveLength(BARRACKS_BIT_COUNT)
    expect(barracks.every((item) => item.state === 'standing')).toBe(true)
  })

  it('разрушенные бараки Dire различаются по типу и получают время', () => {
    const barracks = decodeBarracksStatus(0, 'dire', EVENTS)

    expect(barracks.every((item) => item.state === 'destroyed')).toBe(true)
    expect(
      barracks.find((item) => item.lane === 'bot' && item.barracksType === 'melee')?.destroyedAt,
    ).toBe(1799)
    expect(
      barracks.find((item) => item.lane === 'bot' && item.barracksType === 'ranged')?.destroyedAt,
    ).toBe(1795)
  })
})

/**
 * Карта зданий на изображении владельца (Task 15, итерация 3).
 *
 * Проверяются: точный путь изображения, полнота набора строений (11 башен, 6 бараков и трон
 * на сторону), нахождение всех маркеров внутри карты, расположение сторон по своим углам,
 * корректная замена линии при повороте Dire и различимость соседних строений.
 */
const MAP_MATCH = normalizeMatch({
  tower_status_radiant: 1974,
  tower_status_dire: 0,
  barracks_status_radiant: 63,
  barracks_status_dire: 0,
  objectives: EVENTS.map((event) => ({ type: 'building_kill', ...event })),
})

describe('Карта зданий: изображение и координаты', () => {
  it('использует финальное изображение владельца', () => {
    expect(MAP_IMAGE_SRC).toBe('/images/dotaz-map-clean.png')
    expect(MAP_IMAGE_SIZE).toBe(1254)
  })

  it('каждая сторона имеет 11 башен, 6 бараков и трон', () => {
    const buildings = decodeBuildings(MAP_MATCH)

    for (const side of ['radiant', 'dire'] as const) {
      const list = buildings.filter((building) => building.side === side)

      expect(list.filter((building) => building.kind === 'tower'), side).toHaveLength(
        TOWER_BIT_COUNT,
      )
      expect(
        list.filter((building) => building.kind === 'tower' && building.tier === 4),
        side,
      ).toHaveLength(2)
      expect(list.filter((building) => building.kind === 'barracks'), side).toHaveLength(
        BARRACKS_BIT_COUNT,
      )
      expect(
        list.filter(
          (building) => building.kind === 'barracks' && building.barracksType === 'melee',
        ),
        side,
      ).toHaveLength(3)
      expect(
        list.filter(
          (building) => building.kind === 'barracks' && building.barracksType === 'ranged',
        ),
        side,
      ).toHaveLength(3)
      expect(list.filter((building) => building.kind === 'ancient'), side).toHaveLength(1)
    }
  })

  it('держит все маркеры внутри границ карты (0–100 %)', () => {
    for (const building of decodeBuildings(MAP_MATCH)) {
      expect(building.x, building.id).toBeGreaterThanOrEqual(2)
      expect(building.x, building.id).toBeLessThanOrEqual(98)
      expect(building.y, building.id).toBeGreaterThanOrEqual(2)
      expect(building.y, building.id).toBeLessThanOrEqual(98)
    }
  })

  it('размещает стороны по своим углам карты', () => {
    const radiantTop = buildingPosition('radiant', 'tower-1-top')
    const radiantBot = buildingPosition('radiant', 'tower-1-bot')
    const direTop = buildingPosition('dire', 'tower-1-top')
    const direBot = buildingPosition('dire', 'tower-1-bot')

    // Radiant — левый нижний угол: верхняя линия уходит вверх, нижняя — вправо.
    expect(radiantTop.x).toBeLessThan(50)
    expect(radiantTop.y).toBeLessThan(50)
    expect(radiantBot.x).toBeGreaterThan(50)
    expect(radiantBot.y).toBeGreaterThan(50)
    // Dire — правый верхний угол: его верхняя линия уходит влево, нижняя — вниз.
    expect(direTop.x).toBeLessThan(50)
    expect(direTop.y).toBeLessThan(50)
    expect(direBot.x).toBeGreaterThan(50)
    expect(direBot.y).toBeGreaterThan(50)
    // Троны находятся в своих углах изображения (точные зоны проверяются ниже).
    expect(buildingPosition('radiant', 'ancient').y).toBeGreaterThan(70)
    expect(buildingPosition('dire', 'ancient').y).toBeLessThan(30)
  })

  it('заменяет линию при повороте Dire (верхняя линия не попадает на нижнюю)', () => {
    // Без замены линии поворот на 180° отправил бы верхнюю линию Dire в нижнюю половину карты.
    const direTop = ['tower-1-top', 'tower-2-top', 'tower-3-top'].map((key) =>
      buildingPosition('dire', key),
    )
    const direBot = ['tower-1-bot', 'tower-2-bot', 'tower-3-bot'].map((key) =>
      buildingPosition('dire', key),
    )

    // Верхняя линия Dire идёт по верхнему краю карты, нижняя — вверх по правому краю.
    for (const point of direTop) {
      expect(point.y).toBeLessThan(50)
    }
    for (const point of direBot) {
      expect(point.x).toBeGreaterThan(50)
    }
    // Порядок «дальняя башня → ближняя к базе» сохраняется на обеих линиях.
    expect(direTop[0].x).toBeLessThan(direTop[1].x)
    expect(direTop[1].x).toBeLessThan(direTop[2].x)
    expect(direBot[0].y).toBeGreaterThan(direBot[1].y)
    expect(direBot[1].y).toBeGreaterThan(direBot[2].y)
    // Бараки Dire стоят у своей базы (правый верхний угол).
    expect(buildingPosition('dire', 'barracks-melee-top').y).toBeLessThan(30)
    expect(buildingPosition('dire', 'barracks-melee-bot').x).toBeGreaterThan(70)
  })

  it('не сливает соседние строения: координаты различимы', () => {
    const buildings = decodeBuildings(MAP_MATCH)

    for (let first = 0; first < buildings.length; first += 1) {
      for (let second = first + 1; second < buildings.length; second += 1) {
        const a = buildings[first]
        const b = buildings[second]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)

        // Минимальное расстояние в проверенных данных — башня T3 и бараки её линии
        // (≈ 409 юнитов мира; после калибровки ≈ 2,31 % изображения): в игре они стоят вплотную.
        expect(distance, `${a.id} ↔ ${b.id}`).toBeGreaterThan(2.2)
      }
    }
  })
})

/**
 * Привязка маркеров к фактическому фону (Task 15, финальная правка позиций).
 *
 * Координаты сняты с изображения `public/images/dota-map-reference.png` (600×600):
 * базовое строение Radiant находится в точке ≈(13 %, 82 %), базовое строение Dire —
 * в ≈(86 %, 18 %); база Radiant занимает площадку x ≈ 8–34 %, y ≈ 62–89 %, база Dire —
 * зеркальную x ≈ 66–92 %, y ≈ 11–38 %. Тесты фиксируют эту привязку, чтобы маркеры
 * не «уехали» обратно в лес или в воду.
 */
describe('Привязка к строениям фона', () => {
  it('держит проверенные координаты тронов из данных карты', () => {
    // Значения из дампа сущностей карты Dota 2 (npc_dota_fort).
    expect(DOTA_STRUCTURE_WORLD_POSITIONS.radiant.ancient).toEqual({ x: -5920, y: -5352 })
    expect(DOTA_STRUCTURE_WORLD_POSITIONS.dire.ancient).toEqual({ x: 5528, y: 5000 })
  })

  it('держит строения базы рядом с троном (проверенные координаты)', () => {
    for (const side of ['radiant', 'dire'] as const) {
      const structures = DOTA_STRUCTURE_WORLD_POSITIONS[side]
      const fort = structures.ancient

      for (const [key, point] of Object.entries(structures)) {
        const distance = Math.hypot(point.x - fort.x, point.y - fort.y)

        if (key.startsWith('tower-4')) {
          // Две башни T4 стоят вплотную к трону.
          expect(distance, `${side}:${key}`).toBeLessThan(800)
        } else if (key.startsWith('barracks-')) {
          // Бараки — у выхода своей линии из базы.
          expect(distance, `${side}:${key}`).toBeLessThan(2200)
        }
      }
    }
  })

  it('держит башни линий на своих линиях (порядок «от базы наружу»)', () => {
    // Верхняя линия Radiant идёт вдоль левого края: T3 ниже T2, T2 ниже T1.
    const top = [3, 2, 1].map((tier) => buildingPosition('radiant', `tower-${tier}-top`))
    expect(top[0].y).toBeGreaterThan(top[1].y)
    expect(top[1].y).toBeGreaterThan(top[2].y)

    // Средняя линия — диагональ: башни уходят от базы к центру.
    const mid = [3, 2, 1].map((tier) => buildingPosition('radiant', `tower-${tier}-mid`))
    expect(mid[0].x).toBeLessThan(mid[1].x)
    expect(mid[1].x).toBeLessThan(mid[2].x)
    expect(mid[0].y).toBeGreaterThan(mid[1].y)
    expect(mid[1].y).toBeGreaterThan(mid[2].y)

    // Нижняя линия идёт вдоль нижнего края: дальняя башня правее ближних.
    const bot = [3, 2, 1].map((tier) => buildingPosition('radiant', `tower-${tier}-bot`))
    expect(bot[0].x).toBeLessThan(bot[1].x)
    expect(bot[1].x).toBeLessThan(bot[2].x)
  })
})

/**
 * Изображение карты (Task 15, проверенные координаты).
 *
 * Фон — карта, построенная из того же дампа сущностей карты Dota 2, что и координаты
 * (сетка проходимости и высоты, патчи 7.22/7.23). Она покрывает ровно игровые границы,
 * поэтому проценты координат совпадают с пикселями изображения.
 */
describe('Изображение карты', () => {
  it('указывает на финальное изображение владельца', () => {
    expect(MAP_IMAGE_SRC).toBe('/images/dotaz-map-clean.png')
  })

  it('находит PNG карты в публичном каталоге', () => {
    // Список разрешается Vite на этапе сборки: тест падает, если файл убран из public.
    // Пропорции и отсутствие обрезки обеспечивает CSS-контейнер (`aspect-ratio: 1 / 1`
    // и `object-fit: contain`) — проверяется в src/styles/matchReportStyles.test.ts.
    expect(mapAssets).toContain('/public/images/dotaz-map-clean.png')
  })
})

/**
 * Полнота и корректность проверенных координат (Task 15, финальная правка позиций).
 *
 * Проверяются: полный набор 36 строений (22 башни, 12 бараков, 2 трона), уникальность
 * идентичностей, соответствие каждого маркера карты своей координате и порядок башен
 * «от базы наружу» на каждой линии.
 */
describe('Проверенные координаты строений', () => {
  const KEYS_PER_SIDE = [
    'tower-1-top',
    'tower-2-top',
    'tower-3-top',
    'tower-1-mid',
    'tower-2-mid',
    'tower-3-mid',
    'tower-1-bot',
    'tower-2-bot',
    'tower-3-bot',
    'tower-4-0',
    'tower-4-1',
    'barracks-melee-top',
    'barracks-ranged-top',
    'barracks-melee-mid',
    'barracks-ranged-mid',
    'barracks-melee-bot',
    'barracks-ranged-bot',
    'ancient',
  ]

  it('содержит ровно 18 строений на сторону (11 башен, 6 бараков, трон)', () => {
    for (const side of ['radiant', 'dire'] as const) {
      expect(Object.keys(DOTA_STRUCTURE_WORLD_POSITIONS[side]).sort()).toEqual(
        [...KEYS_PER_SIDE].sort(),
      )
    }
  })

  it('сопоставляет каждому из 36 маркеров свою проверенную координату', () => {
    const buildings = decodeBuildings(MAP_MATCH)

    expect(buildings).toHaveLength(36)
    for (const building of buildings) {
      const key =
        building.kind === 'ancient'
          ? 'ancient'
          : building.kind === 'barracks'
            ? `barracks-${building.barracksType}-${building.lane}`
            : building.tier === 4
              ? `tower-4-${building.id.endsWith('-tower-4-9') ? 0 : 1}`
              : `tower-${building.tier}-${building.lane}`
      const world = DOTA_STRUCTURE_WORLD_POSITIONS[building.side][key]

      expect(world, `${building.id} → ${key}`).toBeDefined()
      // Маркер карты стоит ровно на калиброванной позиции своего строения.
      expect(buildingPosition(building.side, key)).toEqual(worldToImagePercent(world))
    }
  })

  it('приписывает каждое строение своей стороне (ближе к своему трону)', () => {
    const forts = {
      radiant: DOTA_STRUCTURE_WORLD_POSITIONS.radiant.ancient,
      dire: DOTA_STRUCTURE_WORLD_POSITIONS.dire.ancient,
    }

    for (const side of ['radiant', 'dire'] as const) {
      const other = side === 'radiant' ? 'dire' : 'radiant'

      for (const [key, point] of Object.entries(DOTA_STRUCTURE_WORLD_POSITIONS[side])) {
        if (key === 'ancient') {
          continue
        }
        const own = Math.hypot(point.x - forts[side].x, point.y - forts[side].y)
        const enemy = Math.hypot(point.x - forts[other].x, point.y - forts[other].y)

        expect(own, `${side}:${key}`).toBeLessThan(enemy)
      }
    }
  })

  it('строит башни каждой линии по порядку «от базы наружу»', () => {
    for (const side of ['radiant', 'dire'] as const) {
      const fort = DOTA_STRUCTURE_WORLD_POSITIONS[side].ancient

      for (const lane of ['top', 'mid', 'bot'] as const) {
        const distances = [3, 2, 1].map((tier) => {
          const point = DOTA_STRUCTURE_WORLD_POSITIONS[side][`tower-${tier}-${lane}`]
          return Math.hypot(point.x - fort.x, point.y - fort.y)
        })

        expect(distances[0], `${side}:${lane}`).toBeLessThan(distances[1])
        expect(distances[1], `${side}:${lane}`).toBeLessThan(distances[2])
      }
    }
  })
})

/**
 * Калибровка изображения владельца и преобразование мировых координат (Task 15).
 *
 * Сначала проверяется справочная проекция границ мира (`worldToMapPercent`), затем —
 * калибровка по опорным точкам, которая применяется к маркерам карты: коэффициенты
 * обязаны воспроизводить опорные точки, а проверенные строения — попадать в свои зоны
 * на изображении владельца.
 */
describe('Преобразование мир → изображение владельца', () => {
  it('использует границы игрового мира из данных карты', () => {
    expect(DOTA_WORLD_BOUNDS).toEqual({ minX: -8288, maxX: 8288, minY: -8288, maxY: 8288 })
  })

  it('переводит центр и углы мира в проценты изображения', () => {
    expect(worldToMapPercent({ x: 0, y: 0 })).toEqual({ x: 50, y: 50 })
    // Верхний левый угол изображения — максимальный Y мира, нижний правый — минимальный.
    expect(worldToMapPercent({ x: -8288, y: 8288 })).toEqual({ x: 0, y: 0 })
    expect(worldToMapPercent({ x: 8288, y: -8288 })).toEqual({ x: 100, y: 100 })
  })

  it('инвертирует ось Y в справочной проекции границ мира', () => {
    const radiant = worldToMapPercent(DOTA_STRUCTURE_WORLD_POSITIONS.radiant.ancient)
    const dire = worldToMapPercent(DOTA_STRUCTURE_WORLD_POSITIONS.dire.ancient)

    // Справочная проекция (границы мира на весь холст): Radiant — нижний левый угол,
    // Dire — верхний правый.
    expect(radiant.y).toBeGreaterThan(50)
    expect(dire.y).toBeLessThan(50)
  })

  it('калибровка воспроизводит свои опорные точки', () => {
    for (const anchor of MAP_CALIBRATION_ANCHORS) {
      const pixel = worldToImagePixel(anchor.world)

      expect(pixel.x, anchor.name).toBeCloseTo(anchor.pixel.x, 6)
      expect(pixel.y, anchor.name).toBeCloseTo(anchor.pixel.y, 6)
    }
  })

  it('коэффициенты калибровки вычисляются из опорных точек, а не заданы вручную', () => {
    expect(MAP_CALIBRATION).toEqual(fitCalibration(MAP_CALIBRATION_ANCHORS))
    // Масштаб и наклон зафиксированы как регрессия: подобие с отражением оси Y.
    expect(MAP_CALIBRATION.a).toBeCloseTo(0.070712, 5)
    expect(MAP_CALIBRATION.b).toBeCloseTo(-0.000896, 5)
  })

  it('переводит пиксели изображения в проценты (сторона 1254)', () => {
    const pixel = { x: 627, y: 313.5 }

    expect((pixel.x / MAP_IMAGE_SIZE) * 100).toBeCloseTo(50, 6)
    expect((pixel.y / MAP_IMAGE_SIZE) * 100).toBeCloseTo(25, 6)
    // Мировой центр по калибровке попадает в центр изображения владельца.
    const center = worldToImagePixel({ x: 0, y: 0 })
    expect(center.x).toBeCloseTo(598, 0)
    expect(center.y).toBeCloseTo(616, 0)
  })

  it('ставит троны внутрь базовых площадок изображения (кросс-проверка)', () => {
    const radiant = worldToImagePixel(DOTA_STRUCTURE_WORLD_POSITIONS.radiant.ancient)
    const dire = worldToImagePixel(DOTA_STRUCTURE_WORLD_POSITIONS.dire.ancient)

    // Базовые площадки определены по изображению владельца: Radiant — x 70–370, y 840–1130;
    // Dire — x 839–1151, y 90–415. Кросс-проверка не участвовала в подгонке калибровки.
    expect(radiant.x).toBeGreaterThan(70)
    expect(radiant.x).toBeLessThan(370)
    expect(radiant.y).toBeGreaterThan(840)
    expect(radiant.y).toBeLessThan(1130)
    expect(dire.x).toBeGreaterThan(839)
    expect(dire.x).toBeLessThan(1151)
    expect(dire.y).toBeGreaterThan(90)
    expect(dire.y).toBeLessThan(415)
  })

  it('держит все 36 маркеров внутри изображения владельца', () => {
    for (const building of decodeBuildings(MAP_MATCH)) {
      const pixel = worldToImagePixel(DOTA_STRUCTURE_WORLD_POSITIONS[building.side][buildingPositionKey(building)])

      expect(pixel.x, building.id).toBeGreaterThan(0)
      expect(pixel.x, building.id).toBeLessThan(MAP_IMAGE_SIZE)
      expect(pixel.y, building.id).toBeGreaterThan(0)
      expect(pixel.y, building.id).toBeLessThan(MAP_IMAGE_SIZE)
    }
  })

  it('сохраняет порядок башен «от базы наружу» в пикселях изображения', () => {
    for (const side of ['radiant', 'dire'] as const) {
      const fort = worldToImagePixel(DOTA_STRUCTURE_WORLD_POSITIONS[side].ancient)

      for (const lane of ['top', 'mid', 'bot'] as const) {
        const distances = [3, 2, 1].map((tier) => {
          const pixel = worldToImagePixel(
            DOTA_STRUCTURE_WORLD_POSITIONS[side][`tower-${tier}-${lane}`],
          )
          return Math.hypot(pixel.x - fort.x, pixel.y - fort.y)
        })

        expect(distances[0], `${side}:${lane}`).toBeLessThan(distances[1])
        expect(distances[1], `${side}:${lane}`).toBeLessThan(distances[2])
      }
    }
  })

  it('держит пары бараков рядом друг с другом (ближний и дальний бой)', () => {
    for (const side of ['radiant', 'dire'] as const) {
      for (const lane of ['top', 'mid', 'bot'] as const) {
        const melee = worldToImagePixel(
          DOTA_STRUCTURE_WORLD_POSITIONS[side][`barracks-melee-${lane}`],
        )
        const ranged = worldToImagePixel(
          DOTA_STRUCTURE_WORLD_POSITIONS[side][`barracks-ranged-${lane}`],
        )

        expect(Math.hypot(melee.x - ranged.x, melee.y - ranged.y), `${side}:${lane}`).toBeLessThan(
          60,
        )
      }
    }
  })

  it('обратимо: пиксели переводятся назад в мировые координаты', () => {
    const point = { x: -1544, y: -1408 }
    const pixel = worldToImagePixel(point)
    const { a, b, tx, ty } = MAP_CALIBRATION
    const det = a * a + b * b
    // Обратное преобразование той же модели (подобие с отражением оси Y).
    const backX = (a * (pixel.x - tx) - b * (pixel.y - ty)) / det
    const backY = (-b * (pixel.x - tx) - a * (pixel.y - ty)) / det

    expect(backX).toBeCloseTo(point.x, 6)
    expect(backY).toBeCloseTo(point.y, 6)
  })
})
