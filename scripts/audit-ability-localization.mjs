/**
 * Аудит русской локализации способностей, талантов и фасетов (Task 19).
 *
 * Скрипт только читает публичный справочник OpenDota и словари проекта; он ничего
 * не пишет, не публикует и не изменяет. Два режима:
 *
 *   node scripts/audit-ability-localization.mjs --inventory
 *       печатает полный перечень исходных ключей: уникальные заголовки свойств,
 *       значения behavior / dmg_type / target_type / dispellable / bkbpierce,
 *       имена способностей, талантов и фасетов. Нужен, чтобы словари заводились
 *       ровно по тем ключам, которые реально приходят, а не по догадкам.
 *
 *   node scripts/audit-ability-localization.mjs
 *       считает покрытие: сколько игровых строк переведено, сколько осталось,
 *       и отдельно — сколько описаний отсутствует в самом источнике.
 *
 * Важно: «нет описания в источнике» и «перевод не сделан» — разные категории
 * и считаются раздельно.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERO_ABILITIES = 'https://api.opendota.com/api/constants/hero_abilities'
const ABILITIES = 'https://api.opendota.com/api/constants/abilities'
const HEROES = 'https://api.opendota.com/api/constants/heroes'

const PLACEHOLDER = /^\[object \w+\]$/

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DICTIONARY_DIR = path.join(ROOT, 'src', 'i18n', 'ability-locale')

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} для ${url}`)
  }
  return response.json()
}

function text(value) {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length === 0 || PLACEHOLDER.test(trimmed)) {
    return null
  }
  return trimmed
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function loadDictionary(name) {
  try {
    const raw = await readFile(path.join(DICTIONARY_DIR, name), 'utf8')
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Правило устаревания — ровно то же, что в приложении (`isDeprecatedFlag`):
 * провайдер отдаёт и `'1'`, и `'true'`, и булево значение. Если проверять только
 * `'1'`, устаревшие фасеты попадут в «активные» и завысят покрытие.
 */
function isDeprecated(value) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

/** Обход справочников: возвращает нормализованный набор строк для аудита. */
function collect(heroAbilities, abilitiesCatalog, heroes) {
  const heroKeyById = new Map()
  const heroNameById = new Map()
  for (const hero of Object.values(heroes)) {
    if (isRecord(hero) && typeof hero.id === 'number' && typeof hero.name === 'string') {
      heroKeyById.set(hero.id, hero.name)
      if (typeof hero.localized_name === 'string') {
        heroNameById.set(hero.id, hero.localized_name)
      }
    }
  }

  const labels = new Set()
  const behaviors = new Set()
  const damageTypes = new Set()
  const targetTypes = new Set()
  const dispellableValues = new Set()
  const immunityValues = new Set()

  const abilities = []
  const talents = []
  const facets = new Map()
  /** Строки по героям — для отчёта о покрытии каждого героя отдельно. */
  const heroRows = new Map()

  let heroesChecked = 0
  let heroesWithoutRecord = 0
  let deprecatedFacetsSkipped = 0
  let technicalAbilitiesSkipped = 0

  for (const [heroId, heroKey] of heroKeyById) {
    const record = heroAbilities[heroKey]
    if (!isRecord(record)) {
      heroesWithoutRecord += 1
      continue
    }
    heroesChecked += 1

    const heroRow = {
      heroId,
      heroName: heroNameById.get(heroId) ?? heroKey,
      abilities: [],
      talents: [],
      facets: [],
      labels: new Set(),
      abilityLabels: [],
      technicalAbilities: 0,
      deprecatedFacets: 0,
    }
    heroRows.set(heroId, heroRow)

    for (const abilityName of Array.isArray(record.abilities) ? record.abilities : []) {
      if (typeof abilityName !== 'string' || abilityName.length === 0) {
        continue
      }
      const details = abilitiesCatalog[abilityName]
      if (!isRecord(details)) {
        continue
      }
      const name = text(details.dname)
      if (name !== null) {
        const item = { key: abilityName, heroId, name, description: text(details.desc) }
        abilities.push(item)
        heroRow.abilities.push(item)
      } else {
        technicalAbilitiesSkipped += 1
        heroRow.technicalAbilities += 1
      }
      for (const field of ['behavior', 'dmg_type', 'target_type', 'dispellable', 'bkbpierce']) {
        // Провайдер отдаёт `behavior` и `target_type` и строкой, и массивом строк.
        // Массив разворачивается, иначе значения молча выпадают из подсчёта.
        const rawValue = details[field]
        const values = Array.isArray(rawValue) ? rawValue : [rawValue]
        for (const candidate of values) {
          const value = text(candidate)
          if (value === null || value === 'No') {
            continue
          }
          if (field === 'behavior') behaviors.add(value)
          if (field === 'dmg_type') damageTypes.add(value)
          if (field === 'target_type') targetTypes.add(value)
          if (field === 'dispellable') dispellableValues.add(value)
          if (field === 'bkbpierce') immunityValues.add(value)
        }
      }
      if (Array.isArray(details.attrib)) {
        for (const entry of details.attrib) {
          if (!isRecord(entry)) {
            continue
          }
          const header = text(entry.header)
          if (header !== null) {
            labels.add(header)
            heroRow.labels.add(header)
            heroRow.abilityLabels.push(header)
          }
        }
      }
    }

    for (const talent of Array.isArray(record.talents) ? record.talents : []) {
      if (!isRecord(talent)) {
        continue
      }
      const talentName = text(talent.name)
      const details = talentName === null ? undefined : abilitiesCatalog[talentName]
      const name = isRecord(details) ? text(details.dname) : null
      if (talentName !== null && name !== null) {
        const item = { key: talentName, heroId, name }
        talents.push(item)
        heroRow.talents.push(item)
      }
    }

    for (const facet of Array.isArray(record.facets) ? record.facets : []) {
      if (!isRecord(facet)) {
        continue
      }
      if (isDeprecated(facet.deprecated)) {
        deprecatedFacetsSkipped += 1
        heroRow.deprecatedFacets += 1
        continue
      }
      const facetName = text(facet.name)
      const title = text(facet.title)
      if (facetName === null || title === null) {
        continue
      }
      const item = { key: facetName, heroId, title, description: text(facet.description) }
      heroRow.facets.push(item)
      if (!facets.has(facetName)) {
        facets.set(facetName, item)
      }
    }
  }

  return {
    heroesChecked,
    heroesWithoutRecord,
    deprecatedFacetsSkipped,
    technicalAbilitiesSkipped,
    heroes: [...heroRows.values()].map((row) => ({
      ...row,
      labels: [...row.labels],
    })),
    abilities,
    talents,
    facets: [...facets.values()],
    labels: [...labels].sort((a, b) => a.localeCompare(b, 'en')),
    behaviors: [...behaviors].sort(),
    damageTypes: [...damageTypes].sort(),
    targetTypes: [...targetTypes].sort(),
    dispellableValues: [...dispellableValues].sort(),
    immunityValues: [...immunityValues].sort(),
  }
}


async function main() {
  const inventoryMode = process.argv.includes('--inventory')
  const [heroAbilities, abilitiesCatalog, heroes] = await Promise.all([
    fetchJson(HERO_ABILITIES),
    fetchJson(ABILITIES),
    fetchJson(HEROES),
  ])
  const data = collect(heroAbilities, abilitiesCatalog, heroes)

  if (inventoryMode) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          heroesChecked: data.heroesChecked,
          heroesWithoutRecord: data.heroesWithoutRecord,
          abilityNames: data.abilities.map((item) => item.key),
          talents: data.talents.map((item) => item.key),
          facets: data.facets.map((item) => item.key),
          labels: data.labels,
          behaviors: data.behaviors,
          damageTypes: data.damageTypes,
          targetTypes: data.targetTypes,
          dispellableValues: data.dispellableValues,
          immunityValues: data.immunityValues,
        },
        null,
        2,
      ),
    )
    return
  }

  const [names, descriptions, talentNames, facetTitles, facetDescriptions, labels, types] =
    await Promise.all([
      loadDictionary('ability-names.json'),
      loadDictionary('ability-descriptions.json'),
      loadDictionary('talent-names.json'),
      loadDictionary('facet-titles.json'),
      loadDictionary('facet-descriptions.json'),
      loadDictionary('property-labels.json'),
      loadDictionary('type-labels.json'),
    ])

  const isMissing = (item, dictionary) =>
    typeof dictionary[item.key] !== 'string' || dictionary[item.key].length === 0

  const abilitiesWithoutSource = data.abilities.filter((item) => item.description === null)
  const abilitiesWithSource = data.abilities.filter((item) => item.description !== null)
  const facetsWithSource = data.facets.filter((item) => item.description !== null)

  const typeValues = [
    ...data.behaviors,
    ...data.damageTypes,
    ...data.targetTypes,
    ...data.dispellableValues,
    ...data.immunityValues,
  ]

  const report = {
    generatedAt: new Date().toISOString(),
    heroesChecked: data.heroesChecked,
    heroesWithoutRecord: data.heroesWithoutRecord,
    /** Служебные записи без отображаемого имени — не игровые строки, не считаются долгом. */
    technicalAbilitiesSkipped: data.technicalAbilitiesSkipped,
    deprecatedFacetsSkipped: data.deprecatedFacetsSkipped,
    playerFacingAbilities: data.abilities.length,
    abilityNamesTranslated: data.abilities.filter((item) => !isMissing(item, names)).length,
    abilityNamesMissing: data.abilities.filter((item) => isMissing(item, names)).length,
    abilitiesWithSourceDescription: abilitiesWithSource.length,
    descriptionsTranslated: abilitiesWithSource.filter((item) => !isMissing(item, descriptions))
      .length,
    descriptionsMissing: abilitiesWithSource.filter((item) => isMissing(item, descriptions)).length,
    abilitiesWithoutSourceDescription: abilitiesWithoutSource.length,
    talents: data.talents.length,
    talentsTranslated: data.talents.filter((item) => !isMissing(item, talentNames)).length,
    talentsMissing: data.talents.filter((item) => isMissing(item, talentNames)).length,
    activeFacets: data.facets.length,
    facetTitlesTranslated: data.facets.filter((item) => !isMissing(item, facetTitles)).length,
    facetTitlesMissing: data.facets.filter((item) => isMissing(item, facetTitles)).length,
    facetsWithSourceDescription: facetsWithSource.length,
    facetDescriptionsTranslated: facetsWithSource.filter(
      (item) => !isMissing(item, facetDescriptions),
    ).length,
    facetDescriptionsMissing: facetsWithSource.filter((item) => isMissing(item, facetDescriptions))
      .length,
    facetsWithoutSourceDescription: data.facets.length - facetsWithSource.length,
    propertyLabels: data.labels.length,
    propertyLabelsTranslated: data.labels.filter((label) => typeof labels[label] === 'string')
      .length,
    propertyLabelsMissing: data.labels.filter((label) => typeof labels[label] !== 'string').length,
    typeLabels: typeValues.length,
    typeLabelsTranslated: typeValues.filter((value) => typeof types[value] === 'string').length,
    typeLabelsMissing: typeValues.filter((value) => typeof types[value] !== 'string').length,
  }

  /**
   * Разбивка непереведённых игровых строк по категориям.
   *
   * Считаются ТОЛЬКО уникальные ключи перевода (уникальные названия способностей,
   * уникальные описания, уникальные таланты, уникальные фасеты, уникальные подписи
   * свойств). Повторяющиеся вхождения одной и той же подписи в разных способностях
   * в итог не попадают — иначе число зависело бы от вёрстки, а не от объёма перевода.
   * Отсутствие описания В ИСТОЧНИКЕ и устаревшие/служебные записи в долг не входят.
   */
  const untranslatedBreakdown = {
    abilityNames: report.abilityNamesMissing,
    abilityDescriptions: report.descriptionsMissing,
    talents: report.talentsMissing,
    facetTitles: report.facetTitlesMissing,
    facetDescriptions: report.facetDescriptionsMissing,
    propertyLabels: report.propertyLabelsMissing,
    typeLabels: report.typeLabelsMissing,
  }

  /**
   * Полный итог: сумма ВСЕХ категорий разбивки. Ранее описание активных фасетов
   * не входило в сумму, из-за чего итог занижался ровно на их число.
   */
  const untranslatedPlayerFacing = Object.values(untranslatedBreakdown).reduce(
    (sum, value) => sum + value,
    0,
  )

  report.untranslatedBreakdown = untranslatedBreakdown
  report.untranslatedPlayerFacingStrings = untranslatedPlayerFacing
  report.complete = untranslatedPlayerFacing === 0

  const heroCoverage = (row) => {
    const has = (item, dict) => !isMissing(item, dict)
    const abilitiesWithDesc = row.abilities.filter((item) => item.description !== null)
    const facetsWithDesc = row.facets.filter((item) => item.description !== null)
    const untranslated =
      row.abilities.filter((item) => !has(item, names)).length +
      abilitiesWithDesc.filter((item) => !has(item, descriptions)).length +
      row.talents.filter((item) => !has(item, talentNames)).length +
      row.facets.filter((item) => !has(item, facetTitles)).length +
      facetsWithDesc.filter((item) => !has(item, facetDescriptions)).length +
      row.labels.filter((label) => typeof labels[label] !== 'string').length

    return {
      heroId: row.heroId,
      heroName: row.heroName,
      abilities: row.abilities.length,
      abilityNamesTranslated: row.abilities.filter((item) => has(item, names)).length,
      abilitiesWithSourceDescription: abilitiesWithDesc.length,
      descriptionsTranslated: abilitiesWithDesc.filter((item) => has(item, descriptions)).length,
      talents: row.talents.length,
      talentsTranslated: row.talents.filter((item) => has(item, talentNames)).length,
      activeFacets: row.facets.length,
      facetTitlesTranslated: row.facets.filter((item) => has(item, facetTitles)).length,
      facetsWithSourceDescription: facetsWithDesc.length,
      facetDescriptionsTranslated: facetsWithDesc.filter((item) => has(item, facetDescriptions))
        .length,
      propertyLabels: row.labels.length,
      propertyLabelsTranslated: row.labels.filter((label) => typeof labels[label] === 'string')
        .length,
      missingSourceDescriptions: row.abilities.filter((item) => item.description === null).length,
      technicalAbilities: row.technicalAbilities,
      deprecatedFacets: row.deprecatedFacets,
      untranslatedPlayerFacing: untranslated,
      complete: untranslated === 0,
    }
  }

  report.heroes = [...data.heroes]
    .map(heroCoverage)
    .sort((a, b) => a.heroId - b.heroId)

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(
    'Аудит локализации не выполнен:',
    error instanceof Error ? error.message : String(error),
  )
  process.exitCode = 1
})
