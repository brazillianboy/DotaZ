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

/** Обход справочников: возвращает нормализованный набор строк для аудита. */
function collect(heroAbilities, abilitiesCatalog, heroes) {
  const heroKeyById = new Map()
  for (const hero of Object.values(heroes)) {
    if (isRecord(hero) && typeof hero.id === 'number' && typeof hero.name === 'string') {
      heroKeyById.set(hero.id, hero.name)
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

  let heroesChecked = 0
  let heroesWithoutRecord = 0

  for (const heroKey of heroKeyById.values()) {
    const record = heroAbilities[heroKey]
    if (!isRecord(record)) {
      heroesWithoutRecord += 1
      continue
    }
    heroesChecked += 1

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
        abilities.push({ key: abilityName, name, description: text(details.desc) })
      }
      for (const field of ['behavior', 'dmg_type', 'target_type', 'dispellable', 'bkbpierce']) {
        const value = text(details[field])
        if (value === null || value === 'No') {
          continue
        }
        if (field === 'behavior') behaviors.add(value)
        if (field === 'dmg_type') damageTypes.add(value)
        if (field === 'target_type') targetTypes.add(value)
        if (field === 'dispellable') dispellableValues.add(value)
        if (field === 'bkbpierce') immunityValues.add(value)
      }
      if (Array.isArray(details.attrib)) {
        for (const entry of details.attrib) {
          if (!isRecord(entry)) {
            continue
          }
          const header = text(entry.header)
          if (header !== null) {
            labels.add(header)
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
        talents.push({ key: talentName, name })
      }
    }

    for (const facet of Array.isArray(record.facets) ? record.facets : []) {
      if (!isRecord(facet) || String(facet.deprecated) === '1') {
        continue
      }
      const facetName = text(facet.name)
      const title = text(facet.title)
      if (facetName === null || title === null) {
        continue
      }
      if (!facets.has(facetName)) {
        facets.set(facetName, { key: facetName, title, description: text(facet.description) })
      }
    }
  }

  return {
    heroesChecked,
    heroesWithoutRecord,
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

  const report = {
    generatedAt: new Date().toISOString(),
    heroesChecked: data.heroesChecked,
    heroesWithoutRecord: data.heroesWithoutRecord,
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
    facetsWithoutSourceDescription: data.facets.length - facetsWithSource.length,
    propertyLabels: data.labels.length,
    propertyLabelsTranslated: data.labels.filter((label) => typeof labels[label] === 'string')
      .length,
    propertyLabelsMissing: data.labels.filter((label) => typeof labels[label] !== 'string').length,
    typeLabels: [
      ...data.behaviors,
      ...data.damageTypes,
      ...data.targetTypes,
      ...data.dispellableValues,
      ...data.immunityValues,
    ].length,
    typeLabelsTranslated: [
      ...data.behaviors,
      ...data.damageTypes,
      ...data.targetTypes,
      ...data.dispellableValues,
      ...data.immunityValues,
    ].filter((value) => typeof types[value] === 'string').length,
  }

  const untranslatedPlayerFacing =
    report.abilityNamesMissing +
    report.descriptionsMissing +
    report.talentsMissing +
    report.facetTitlesMissing +
    report.propertyLabelsMissing

  report.untranslatedPlayerFacingStrings = untranslatedPlayerFacing
  report.complete = untranslatedPlayerFacing === 0

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(
    'Аудит локализации не выполнен:',
    error instanceof Error ? error.message : String(error),
  )
  process.exitCode = 1
})
