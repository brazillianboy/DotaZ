/**
 * Аудит покрытия способностей, талантов и фасетов (Task 19).
 *
 * Скрипт ничего не публикует и не пишет файлов: три запроса к OpenDota, подсчёт
 * покрытия по КАТЕГОРИЯМ и отчёт в stdout. Нужен, чтобы не путать «описаний нет у
 * 2/3 всех записей справочника» (там есть устаревшие, технические и неигровые
 * записи) с реальным покрытием по героям каталога.
 *
 * Запуск: node scripts/audit-hero-abilities.mjs
 */

const HERO_ABILITIES = 'https://api.opendota.com/api/constants/hero_abilities'
const ABILITIES = 'https://api.opendota.com/api/constants/abilities'
const HEROES = 'https://api.opendota.com/api/constants/heroes'

const PLACEHOLDER = /^\[object \w+\]$/

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

function addKeys(target, record) {
  for (const field of Object.keys(record)) {
    target.add(field)
  }
}

async function main() {
  const [heroAbilities, abilitiesCatalog, heroes] = await Promise.all([
    fetchJson(HERO_ABILITIES),
    fetchJson(ABILITIES),
    fetchJson(HEROES),
  ])

  const heroNames = new Map()
  const heroKeyById = new Map()
  for (const hero of Object.values(heroes)) {
    if (isRecord(hero) && typeof hero.id === 'number') {
      heroNames.set(hero.id, typeof hero.localized_name === 'string' ? hero.localized_name : '')
      if (typeof hero.name === 'string') {
        heroKeyById.set(hero.id, hero.name)
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    catalogAbilitiesRecords: Object.keys(abilitiesCatalog).length,
    catalogAbilitiesWithDescription: 0,
    catalogAbilitiesWithDisplayName: 0,
    heroCatalogSize: heroNames.size,
    heroesChecked: 0,
    heroesWithoutRecord: [],
    currentAbilities: 0,
    currentAbilitiesWithDescription: 0,
    currentAbilitiesWithoutDescription: 0,
    currentAbilitiesWithIcon: 0,
    currentAbilitiesMissingInCatalog: 0,
    abilitiesWithoutDisplayName: 0,
    innateLikeAbilities: 0,
    talentsChecked: 0,
    talentsWithDisplayName: 0,
    facetsChecked: 0,
    facetsWithDescription: 0,
    facetsDeprecated: 0,
    facetsActive: 0,
    heroesWithNonFourAbilities: 0,
    heroesWithoutTalents: [],
    heroesWithoutFacets: [],
    heroAbilityFieldKeys: new Set(),
    talentFieldKeys: new Set(),
    facetFieldKeys: new Set(),
    abilityDetailFieldKeys: new Set(),
    heroesWithSixOrMoreAbilities: [],
  }

  for (const raw of Object.values(abilitiesCatalog)) {
    if (!isRecord(raw)) {
      continue
    }
    addKeys(summary.abilityDetailFieldKeys, raw)
    if (text(raw.desc) !== null) {
      summary.catalogAbilitiesWithDescription += 1
    }
    if (text(raw.dname) !== null) {
      summary.catalogAbilitiesWithDisplayName += 1
    }
  }

  for (const [heroId, heroKey] of heroKeyById) {
    const record = heroAbilities[heroKey]
    if (!isRecord(record)) {
      summary.heroesWithoutRecord.push(heroId)
      continue
    }
    summary.heroesChecked += 1
    addKeys(summary.heroAbilityFieldKeys, record)

    const abilityNames = (Array.isArray(record.abilities) ? record.abilities : []).filter(
      (item) => typeof item === 'string' && item.length > 0,
    )
    let heroWithDescription = 0
    for (const abilityName of abilityNames) {
      summary.currentAbilities += 1
      const details = abilitiesCatalog[abilityName]
      if (!isRecord(details)) {
        summary.currentAbilitiesMissingInCatalog += 1
        continue
      }
      if (text(details.desc) !== null) {
        summary.currentAbilitiesWithDescription += 1
        heroWithDescription += 1
      } else {
        summary.currentAbilitiesWithoutDescription += 1
      }
      if (text(details.dname) === null) {
        summary.abilitiesWithoutDisplayName += 1
      }
      if (text(details.img) !== null) {
        summary.currentAbilitiesWithIcon += 1
      }
      if (details.is_innate === true || details.innate === true || details.innate === '1') {
        summary.innateLikeAbilities += 1
      }
    }

    if (abilityNames.length !== 4) {
      summary.heroesWithNonFourAbilities += 1
    }
    if (abilityNames.length >= 6) {
      summary.heroesWithSixOrMoreAbilities.push({
        heroId,
        hero: heroNames.get(heroId) ?? heroKey,
        abilities: abilityNames.length,
        withDescription: heroWithDescription,
      })
    }

    const talents = Array.isArray(record.talents) ? record.talents : []
    for (const talent of talents) {
      if (!isRecord(talent)) {
        continue
      }
      addKeys(summary.talentFieldKeys, talent)
      summary.talentsChecked += 1
      const talentName = typeof talent.name === 'string' ? talent.name : ''
      const details = abilitiesCatalog[talentName]
      if (isRecord(details) && text(details.dname) !== null) {
        summary.talentsWithDisplayName += 1
      }
    }
    if (talents.length === 0) {
      summary.heroesWithoutTalents.push(heroId)
    }

    const facets = Array.isArray(record.facets) ? record.facets : []
    for (const facet of facets) {
      if (!isRecord(facet)) {
        continue
      }
      addKeys(summary.facetFieldKeys, facet)
      summary.facetsChecked += 1
      if (String(facet.deprecated) === '1') {
        summary.facetsDeprecated += 1
        continue
      }
      summary.facetsActive += 1
      if (text(facet.description) !== null) {
        summary.facetsWithDescription += 1
      }
    }
    if (facets.length === 0) {
      summary.heroesWithoutFacets.push(heroId)
    }
  }

  const report = {
    ...summary,
    currentAbilitiesDescriptionCoverage:
      summary.currentAbilities === 0
        ? null
        : Math.round((summary.currentAbilitiesWithDescription / summary.currentAbilities) * 10000) /
          100,
    heroAbilityFieldKeys: [...summary.heroAbilityFieldKeys],
    talentFieldKeys: [...summary.talentFieldKeys],
    facetFieldKeys: [...summary.facetFieldKeys],
    abilityDetailFieldKeys: [...summary.abilityDetailFieldKeys].slice(0, 60),
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error('Аудит не выполнен:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
