#!/usr/bin/env node
/**
 * DotaZ — генерация статической таблицы атрибутов героев (Task 19).
 *
 * Источник: OpenDota `GET /api/constants/heroes` (только чтение, без ключей).
 * Скрипт НЕ создаёт второй справочник героев: идентичность (id → name/slug) остаётся
 * в `src/lib/heroCatalog.ts`. Здесь только числовые атрибуты, привязанные к тем же
 * `hero_id`; скрипт проверяет, что набор ID совпадает с каталогом, иначе падает.
 *
 * Запуск:
 *   node scripts/build-hero-attributes.mjs --dry-run
 *   node scripts/build-hero-attributes.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG_PATH = resolve(ROOT, 'src/lib/heroCatalog.ts')
const OUT_PATH = resolve(ROOT, 'src/lib/heroAttributes.ts')
const HEROES_ENDPOINT = 'https://api.opendota.com/api/constants/heroes'
const GENERATED_AT = new Date().toISOString().slice(0, 10)

/** Порядок полей кортежа. Любое изменение требует обновления типа и README. */
export const TUPLE_FIELDS = [
  'heroId', 'primaryAttr', 'attackType', 'roles',
  'baseStr', 'strGain', 'baseAgi', 'agiGain', 'baseInt', 'intGain',
  'baseHealth', 'baseMana', 'baseArmor', 'baseMr',
  'baseAttackMin', 'baseAttackMax', 'attackRange', 'attackRate',
  'baseAttackTime', 'attackPoint', 'projectileSpeed', 'moveSpeed',
  'turnRate', 'legs', 'dayVision', 'nightVision', 'cmEnabled',
]

const PRIMARY_ATTRS = new Set(['str', 'agi', 'int', 'all'])

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Строгий разбор одного героя: неизвестный атрибут или отсутствие ID → ошибка. */
export function toTuple(hero) {
  const heroId = hero.id
  if (!Number.isInteger(heroId) || heroId <= 0) {
    throw new Error(`некорректный hero_id: ${JSON.stringify(hero.id)}`)
  }
  if (!PRIMARY_ATTRS.has(hero.primary_attr)) {
    throw new Error(`hero ${heroId}: неизвестный primary_attr ${hero.primary_attr}`)
  }
  const roles = Array.isArray(hero.roles) ? hero.roles.filter((r) => typeof r === 'string') : []
  return [
    heroId,
    hero.primary_attr,
    typeof hero.attack_type === 'string' ? hero.attack_type : null,
    roles,
    num(hero.base_str), num(hero.str_gain), num(hero.base_agi), num(hero.agi_gain),
    num(hero.base_int), num(hero.int_gain), num(hero.base_health), num(hero.base_mana),
    num(hero.base_armor), num(hero.base_mr), num(hero.base_attack_min), num(hero.base_attack_max),
    num(hero.attack_range), num(hero.attack_rate), num(hero.base_attack_time),
    num(hero.attack_point), num(hero.projectile_speed), num(hero.move_speed),
    num(hero.turn_rate), num(hero.legs), num(hero.day_vision), num(hero.night_vision),
    typeof hero.cm_enabled === 'boolean' ? hero.cm_enabled : null,
  ]
}

/** ID из существующего каталога идентичности — источник правды по набору героев. */
export function catalogHeroIds(source) {
  const ids = new Set()
  const pattern = /^\s{2}(\d+): \{ name:/gm
  let match = pattern.exec(source)
  while (match !== null) {
    ids.add(Number(match[1]))
    match = pattern.exec(source)
  }
  return ids
}

function literal(value) {
  if (value === null) return 'null'
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`
  if (typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map((item) => literal(item)).join(', ')}]`
  return String(value)
}

export function renderFile(tuples) {
  const rows = tuples
    .map((tuple) => `  [${tuple.map((value) => literal(value)).join(', ')}],`)
    .join('\n')
  return `/**
 * Атрибуты героев Dota 2 (Task 19) — СГЕНЕРИРОВАННЫЙ ФАЙЛ, не редактировать вручную.
 *
 * Источник: OpenDota \`GET /api/constants/heroes\` (снимок ${GENERATED_AT}).
 * Идентичность героя (id → название, slug) остаётся в \`heroCatalog.ts\`; здесь только
 * числовые атрибуты для тех же \`hero_id\`. Скрипт генерации проверяет совпадение
 * набора ID с каталогом и падает при расхождении.
 *
 * Значения — базовые (base*), роста (gain) и характеристики, как их отдаёт провайдер.
 * Рассчитанные показатели не сохраняются. Патч провайдером не указывается: это снимок
 * справочника на дату генерации, а не гарантия текущего патча.
 *
 * Порядок полей кортежа (\`HeroAttributeTuple\`):
 * ${TUPLE_FIELDS.map((field, index) => `${index + 1}. ${field}`).join('\n * ')}
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
export const HERO_ATTRIBUTES_GENERATED_AT = '${GENERATED_AT}'

export const HERO_ATTRIBUTE_ROWS: readonly HeroAttributeTuple[] = [
${rows}
]
`
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const response = await fetch(HEROES_ENDPOINT, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`${HEROES_ENDPOINT}: HTTP ${response.status}`)
  }
  const payload = await response.json()
  if (payload === null || typeof payload !== 'object') {
    throw new Error('неожиданный формат ответа справочника героев')
  }
  const heroes = Object.values(payload).filter((hero) => hero !== null && typeof hero === 'object')
  if (heroes.length < 120) {
    throw new Error(`подозрительно мало героев: ${heroes.length}`)
  }
  const tuples = heroes.map(toTuple).sort((a, b) => a[0] - b[0])

  const catalogIds = catalogHeroIds(readFileSync(CATALOG_PATH, 'utf8'))
  const attributeIds = new Set(tuples.map((tuple) => tuple[0]))
  const missing = [...catalogIds].filter((id) => !attributeIds.has(id))
  const extra = [...attributeIds].filter((id) => !catalogIds.has(id))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `набор ID расходится с heroCatalog.ts: нет атрибутов для [${missing.join(', ')}], ` +
        `лишние ID [${extra.join(', ')}]`,
    )
  }

  const content = renderFile(tuples)
  console.log(`Героев: ${tuples.length}; каталог: ${catalogIds.size}; снимок: ${GENERATED_AT}`)
  if (args.has('--dry-run')) {
    console.log('--dry-run: файл не записан')
    return
  }
  writeFileSync(OUT_PATH, content, 'utf8')
  console.log(`Записан файл: ${OUT_PATH}`)
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  main().catch((error) => {
    console.error('Ошибка генерации атрибутов:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
