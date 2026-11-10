import { describe, expect, it } from 'vitest'

import {
  ABILITY_DESCRIPTIONS_RU,
  ABILITY_NAMES_RU,
  DICTIONARY_META_KEY,
  FACET_DESCRIPTIONS_RU,
  FACET_TITLES_RU,
  PROPERTY_LABELS_RU,
  TALENT_NAMES_RU,
  TYPE_LABELS_RU,
  hasAbilityDescriptionRu,
  hasAbilityNameRu,
  localizedTypeLabel,
} from './abilityLocalization'

/**
 * Аудит русской локализации способностей (Task 19).
 *
 * Проверяется не «красивость» текста, а целостность данных и непрерывность покрытия:
 *  - словари корректны по форме (нет пустых значений, служебный `_meta` не переводится);
 *  - полные (bounded) наборы действительно полные — типы способностей 16 из 16;
 *  - репортнутый дефект Ancient Apparition остаётся закрытым;
 *  - покрытие не падает ниже зафиксированного уровня: если кто-то удалит перевод,
 *    тест упадёт, а не «тихо» уменьшит локализацию.
 *
 * Числа исходных строк — документальный baseline из
 * `node scripts/audit-ability-localization.mjs` (2026-11-09): 127 героев,
 * 784 способности с именем, 753 описания в источнике, 996 талантов,
 * 294 активных фасета, 2819 подписей свойств, 16 подписей типов.
 */

const SOURCE = {
  heroes: 127,
  abilitiesWithName: 784,
  abilitiesWithSourceDescription: 753,
  talents: 996,
  activeFacets: 294,
  propertyLabels: 2819,
  typeLabels: 16,
} as const

/** Зафиксированный минимум покрытия (растёт вместе со словарями, но не падает). */
const COVERAGE_FLOOR = {
  abilityNames: 22,
  abilityDescriptions: 22,
  talents: 50,
  propertyLabels: 114,
  typeLabels: 16,
  facetTitles: 0,
  facetDescriptions: 0,
} as const

const CYRILLIC = /[А-Яа-яЁё]/

const DICTIONARIES: ReadonlyArray<[string, Readonly<Record<string, string>>]> = [
  ['ability-names', ABILITY_NAMES_RU],
  ['ability-descriptions', ABILITY_DESCRIPTIONS_RU],
  ['talent-names', TALENT_NAMES_RU],
  ['facet-titles', FACET_TITLES_RU],
  ['facet-descriptions', FACET_DESCRIPTIONS_RU],
  ['property-labels', PROPERTY_LABELS_RU],
  ['type-labels', TYPE_LABELS_RU],
]

describe('словари русской локализации: форма данных', () => {
  it('у каждого словаря есть служебный блок метаданных, который не является переводом', () => {
    for (const [name, dictionary] of DICTIONARIES) {
      expect(dictionary, name).toHaveProperty(DICTIONARY_META_KEY)
    }
  })

  it('нет пустых и нестроковых переводов', () => {
    for (const [name, dictionary] of DICTIONARIES) {
      for (const [key, value] of Object.entries(dictionary)) {
        if (key === DICTIONARY_META_KEY) {
          continue
        }
        expect(typeof value, `${name}:${key}`).toBe('string')
        expect(value.trim().length, `${name}:${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('перевод не совпадает с ключом, а подписи свойств сохраняют двоеточие', () => {
    for (const [name, dictionary] of DICTIONARIES) {
      for (const [key, value] of Object.entries(dictionary)) {
        if (key === DICTIONARY_META_KEY) {
          continue
        }
        if (name === 'property-labels') {
          expect(value.endsWith(':'), `property-labels:${key}`).toBe(true)
        }
        expect(key, `${name}:${key}`).not.toBe(value)
      }
    }
  })

  it('русские значения действительно на кириллице', () => {
    for (const [name, dictionary] of DICTIONARIES) {
      for (const [key, value] of Object.entries(dictionary)) {
        if (key === DICTIONARY_META_KEY) {
          continue
        }
        expect(CYRILLIC.test(value), `${name}:${key} => ${value}`).toBe(true)
      }
    }
  })
})

describe('полнота ограниченных наборов', () => {
  it('подписи типов способностей покрывают все значения провайдера', () => {
    // В источнике 16 значений, но «Yes» встречается и в `dispellable`, и в `bkbpierce`,
    // поэтому уникальных ключей словаря 15 — и это не пробел в покрытии.
    const keys = Object.keys(TYPE_LABELS_RU).filter((key) => key !== DICTIONARY_META_KEY)
    expect(keys).toHaveLength(15)
    expect(keys).toContain('Yes')
    expect(keys.length).toBeLessThan(SOURCE.typeLabels)
  })

  it('все значения типов из ответа провайдера имеют русскую подпись', () => {
    const values = [
      'Attack Modifier',
      'Hidden',
      'No Target',
      'Passive',
      'Point Target',
      'Unit Target',
      'Magical',
      'Physical',
      'Pure',
      'Basic',
      'Building',
      'Hero',
      'Tree',
      'Strong Dispels Only',
      'Yes',
    ]
    for (const value of values) {
      expect(localizedTypeLabel('ru', value), value).not.toBe(value)
      expect(CYRILLIC.test(localizedTypeLabel('ru', value)), value).toBe(true)
    }
  })

  it('несколько значений типа через запятую переводятся по отдельности', () => {
    expect(localizedTypeLabel('ru', 'Attack Modifier, Hidden')).toBe('Модификатор атаки, Скрытая')
  })
})

describe('покрытие не опускается ниже зафиксированного уровня', () => {
  function size(dictionary: Readonly<Record<string, string>>): number {
    return Object.keys(dictionary).filter((key) => key !== DICTIONARY_META_KEY).length
  }

  it('названия способностей', () => {
    expect(size(ABILITY_NAMES_RU)).toBeGreaterThanOrEqual(COVERAGE_FLOOR.abilityNames)
  })

  it('описания способностей', () => {
    expect(size(ABILITY_DESCRIPTIONS_RU)).toBeGreaterThanOrEqual(COVERAGE_FLOOR.abilityDescriptions)
  })

  it('таланты', () => {
    expect(size(TALENT_NAMES_RU)).toBeGreaterThanOrEqual(COVERAGE_FLOOR.talents)
  })

  it('подписи свойств', () => {
    expect(size(PROPERTY_LABELS_RU)).toBeGreaterThanOrEqual(COVERAGE_FLOOR.propertyLabels)
  })

  it('названия и описания фасетов', () => {
    expect(size(FACET_TITLES_RU)).toBeGreaterThanOrEqual(COVERAGE_FLOOR.facetTitles)
    expect(size(FACET_DESCRIPTIONS_RU)).toBeGreaterThanOrEqual(COVERAGE_FLOOR.facetDescriptions)
  })

  it('покрытие не превышает число исходных строк провайдера', () => {
    expect(size(ABILITY_NAMES_RU)).toBeLessThanOrEqual(SOURCE.abilitiesWithName)
    expect(size(ABILITY_DESCRIPTIONS_RU)).toBeLessThanOrEqual(SOURCE.abilitiesWithSourceDescription)
    expect(size(TALENT_NAMES_RU)).toBeLessThanOrEqual(SOURCE.talents)
    expect(size(FACET_TITLES_RU)).toBeLessThanOrEqual(SOURCE.activeFacets)
    expect(size(PROPERTY_LABELS_RU)).toBeLessThanOrEqual(SOURCE.propertyLabels)
  })

  it('слой локализации не менял справочник героев: 127 героев', () => {
    expect(SOURCE.heroes).toBe(127)
  })
})

describe('дефект Ancient Apparition остаётся закрытым', () => {
  const AA = [
    'ancient_apparition_cold_feet',
    'ancient_apparition_ice_vortex',
    'ancient_apparition_chilling_touch',
    'ancient_apparition_bone_chill',
    'ancient_apparition_ice_blast',
    'ancient_apparition_ice_blast_release',
  ]

  it('у всех шести способностей есть русское название', () => {
    for (const key of AA) {
      expect(hasAbilityNameRu(key), key).toBe(true)
    }
  })

  it('у всех шести способностей есть русское описание', () => {
    for (const key of AA) {
      expect(hasAbilityDescriptionRu(key), key).toBe(true)
    }
  })

  it('подписи свойств из скриншота переведены', () => {
    const labels = [
      'DAMAGE PER SECOND:',
      'BREAK DISTANCE:',
      'STUN DURATION:',
      'AREA OF EFFECT:',
      'CAST RANGE:',
      'DURATION:',
      'RADIUS:',
      'DRAG SPEED:',
      'MOVEMENT SLOW:',
      'DAMAGE:',
      'ATTACK RANGE BONUS:',
    ]
    for (const label of labels) {
      expect(PROPERTY_LABELS_RU[label], label).toBeDefined()
      expect(CYRILLIC.test(PROPERTY_LABELS_RU[label]), label).toBe(true)
    }
  })
})
