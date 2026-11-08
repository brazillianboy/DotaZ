#!/usr/bin/env node
/**
 * DotaZ — генерация снапшота нормативов таймингов покупки предметов (Task 18).
 *
 * Источник: OpenDota Explorer (`GET /api/explorer?sql=...`), только чтение.
 * Ключи не используются: Explorer доступен анонимно (лимиты провайдера — 60 запросов/мин,
 * 3000/сутки), поэтому генератор делает 4 запроса по диапазонам `hero_id` и паузы между ними.
 *
 * Что считается (проверено на живом Explorer 07.11.2026):
 *  - `player_matches.purchase_log` — массив `json[]`, элемент = `{"time":-89,"key":"ward_sentry"}`;
 *  - `time` — ЦЕЛЫЕ СЕКУНДЫ от игровых 0:00; предматчевая закупка отрицательна (-89 = -1:29);
 *  - `key` — ключ предмета OpenDota (совпадает с ключами каталога `src/lib/items.ts`);
 *  - для пары «игрок в матче + предмет» берётся ПЕРВАЯ подтверждённая покупка
 *    (`MIN(time)` по группе), поэтому повторные покупки одного предмета не дают
 *    несколько наблюдений и не искажают квартили;
 *  - покупка фиксируется только по `purchase_log`; появление в инвентаре покупкой не считается.
 *
 * Что НЕ считается:
 *  - предметы вне разрешённого каталога (обычные расходники, рецепты, компоненты);
 *  - матчи нестандартных режимов и нерелевантных лобби (фильтры как в Task 16);
 *  - записи без корректного времени: значение не подменяется нулём, наблюдение отбрасывается.
 *
 * Запуск (из корня проекта):
 *   node scripts/build-item-timings.mjs                    # патч по умолчанию 7.41
 *   node scripts/build-item-timings.mjs --patch=7.41 --dry-run
 *   node scripts/build-item-timings.mjs --patch=7.41 --force
 *
 * Файл снапшота не перезаписывается без `--force` (защита проверенных данных).
 * Снапшот кладётся в `public/benchmarks/` и НЕ входит в Git (см. .gitignore),
 * не публикуется и не загружается в Supabase.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Версия методики: любое изменение фильтров/перцентилей требует новой версии. */
export const METHOD_VERSION = '1.0.0'

/** Патч по умолчанию (актуальный на момент исследования: /api/constants/patch). */
export const DEFAULT_PATCH = '7.41'

/**
 * Пороги — продуктовые правила, НЕ заявление о статистической значимости.
 * Три разных порога (те же значения, что в приложении `src/lib/itemTimings.ts`):
 *  - `store` — минимум наблюдений, чтобы бакет вообще попал в снапшот;
 *  - `full` — минимум для показа описательных квартилей p25–p75;
 *  - `classify` — минимум для класса «раньше/типично/позже».
 */
export const THRESHOLDS = { store: 30, full: 100, classify: 100 }

/** Минимум наблюдений на бакет (порог хранения): меньше — бакет не генерируется. */
export const MIN_OBSERVATIONS = THRESHOLDS.store

/** Требование владельца: при меньшей выборке классификация тайминга невозможна. */
export const CLASSIFY_MIN_OBSERVATIONS = THRESHOLDS.classify

/** Правдоподобные границы времени покупки в секундах: -10:00 … 6:00:00. */
export const MIN_PURCHASE_SECONDS = -600
export const MAX_PURCHASE_SECONDS = 21600

/** Стандартные режимы: All Pick, Captains Mode/Draft, Random/Single Draft,
 *  All Random, Least Played, Balanced Draft, All Draft. */
export const GAME_MODES = [1, 2, 3, 4, 5, 12, 16, 17, 22]

/** Исключаются заведомо нерелевантные лобби: tutorial, coop bots, local bots, spectator. */
export const EXCLUDED_LOBBY_TYPES = [3, 4, 10, 11]

/** Допустимые классы линии (`lane_role`): 1 safe, 2 mid, 3 off, 4 jungle. */
export const LANE_ROLES = [1, 2, 3, 4]

/** Диапазоны `hero_id` для шардирования запроса (устойчивость к таймаутам Explorer). */
export const HERO_ID_SHARDS = [
  [1, 40],
  [41, 80],
  [81, 120],
  [121, 250],
]

export const EXPLORER_URL = 'https://api.opendota.com/api/explorer'

/** Ключ предмета OpenDota: строчные латинские буквы, цифры и подчёркивания. */
const ITEM_KEY_PATTERN = /^[a-z][a-z0-9_]*$/

/**
 * Извлекает массив строк из исходника `src/lib/items.ts` по имени экспорта.
 * Каталог не дублируется в генераторе: единственный источник правды — код приложения.
 */
export function extractStringArray(source, exportName) {
  const start = source.indexOf(`export const ${exportName}`)
  if (start < 0) {
    throw new Error(`в src/lib/items.ts не найден экспорт ${exportName}`)
  }
  // Ищем именно присваивание `= [`, иначе первая `[` попадёт в тип `readonly string[]`.
  const assign = source.indexOf('= [', start)
  if (assign < 0) {
    throw new Error(`не удалось найти начало массива ${exportName}`)
  }
  const open = assign + 2
  const close = source.indexOf(']', open)
  if (close < 0) {
    throw new Error(`не удалось найти конец массива ${exportName}`)
  }
  const body = source.slice(open + 1, close)
  const keys = []
  for (const line of body.split('\n')) {
    // Комментарии могут содержать апострофы (например, «Aghanim's»), поэтому
    // хвост строки после `//` не разбирается как значение.
    const code = line.split('//')[0]
    const pattern = /'([^']+)'/g
    let match = pattern.exec(code)
    while (match !== null) {
      keys.push(match[1])
      match = pattern.exec(code)
    }
  }
  return keys
}

/** Извлекает строковую константу (`export const BASIC_BOOTS_KEY = 'boots'`). */
export function extractStringConstant(source, name) {
  const pattern = new RegExp(`export const ${name}\\s*=\\s*'([^']+)'`)
  const match = pattern.exec(source)
  if (match === null) {
    throw new Error(`в src/lib/items.ts не найдена константа ${name}`)
  }
  return match[1]
}

/**
 * Разрешённые предметы: собранные предметы + апгрейды сапог + базовые сапоги.
 * Обычные расходники и рецепты не попадают: их нет ни в одном из этих списков.
 */
export function collectEligibleItemKeys(source) {
  const completed = extractStringArray(source, 'COMPLETED_ITEM_CATALOG')
  const boots = extractStringArray(source, 'BOOTS_UPGRADE_ITEM_KEYS')
  const basicBoots = extractStringConstant(source, 'BASIC_BOOTS_KEY')

  if (completed.length < 50) {
    throw new Error(`каталог собранных предметов подозрительно мал: ${completed.length}`)
  }
  if (boots.length < 5) {
    throw new Error(`список апгрейдов сапог подозрительно мал: ${boots.length}`)
  }

  const keys = [...new Set([basicBoots, ...boots, ...completed])].sort()
  const invalid = keys.filter((key) => !ITEM_KEY_PATTERN.test(key))
  if (invalid.length > 0) {
    throw new Error(`некорректные ключи предметов в каталоге: ${invalid.join(', ')}`)
  }
  return keys
}

/** Читает каталог предметов из кода приложения. */
export function loadEligibleItemKeys(root = ROOT) {
  const source = readFileSync(resolve(root, 'src/lib/items.ts'), 'utf8')
  return collectEligibleItemKeys(source)
}

function quoteItems(keys) {
  return keys.map((key) => `'${key}'`).join(', ')
}

/**
 * SQL одного шарда. Первая покупка предмета на игрока в матче — `MIN(time)`.
 * Перцентили считает СУБД (`percentile_cont`, линейная интерполяция между
 * соседними значениями — метод документирован в README).
 */
export function buildSql(patch, itemKeys, heroRange = HERO_ID_SHARDS[0]) {
  const [heroFrom, heroTo] = heroRange
  return `WITH raw AS (
  SELECT pm.match_id, pm.player_slot, pm.hero_id, pm.lane_role,
         (u.elem->>'key') AS item_key,
         (u.elem->>'time') AS time_text
  FROM player_matches pm
  JOIN matches m ON m.match_id = pm.match_id
  JOIN match_patch mp ON mp.match_id = pm.match_id
  CROSS JOIN LATERAL unnest(pm.purchase_log) AS u(elem)
  WHERE mp.patch = '${patch}'
    AND pm.hero_id BETWEEN ${heroFrom} AND ${heroTo}
    AND pm.lane_role IN (${LANE_ROLES.join(', ')})
    AND m.game_mode IN (${GAME_MODES.join(', ')})
    AND m.lobby_type NOT IN (${EXCLUDED_LOBBY_TYPES.join(', ')})
    AND json_typeof(u.elem) = 'object'
    AND (u.elem->>'key') IN (${quoteItems(itemKeys)})
    AND (u.elem->>'time') ~ '^-?[0-9]+$'
),
first_purchase AS (
  SELECT match_id, player_slot, hero_id, lane_role, item_key,
         MIN(time_text::numeric) AS purchase_time
  FROM raw
  GROUP BY 1, 2, 3, 4, 5
)
SELECT hero_id,
       lane_role,
       item_key,
       COUNT(*) AS n,
       round(percentile_cont(0.25) WITHIN GROUP (ORDER BY purchase_time)::numeric, 1) AS p25,
       round(percentile_cont(0.50) WITHIN GROUP (ORDER BY purchase_time)::numeric, 1) AS p50,
       round(percentile_cont(0.75) WITHIN GROUP (ORDER BY purchase_time)::numeric, 1) AS p75
FROM first_purchase
WHERE purchase_time BETWEEN ${MIN_PURCHASE_SECONDS} AND ${MAX_PURCHASE_SECONDS}
GROUP BY 1, 2, 3
HAVING COUNT(*) >= ${MIN_OBSERVATIONS}
ORDER BY 1, 2, 3`
}

/**
 * Строгий разбор строки Explorer. Любое несоответствие → `null`
 * (некорректное наблюдение отбрасывается, а не «исправляется»).
 */
export function parseRow(row, eligibleKeys = null) {
  if (row === null || typeof row !== 'object') {
    return null
  }
  const heroId = Number(row.hero_id)
  const laneRole = Number(row.lane_role)
  const itemKey = row.item_key
  const n = Number(row.n)
  const p25 = Number(row.p25)
  const p50 = Number(row.p50)
  const p75 = Number(row.p75)

  if (!Number.isInteger(heroId) || heroId <= 0) {
    return null
  }
  if (!LANE_ROLES.includes(laneRole)) {
    return null
  }
  if (typeof itemKey !== 'string' || !ITEM_KEY_PATTERN.test(itemKey)) {
    return null
  }
  if (eligibleKeys !== null && !eligibleKeys.has(itemKey)) {
    return null
  }
  if (!Number.isInteger(n) || n < MIN_OBSERVATIONS) {
    return null
  }
  if (![p25, p50, p75].every((value) => Number.isFinite(value))) {
    return null
  }
  if (p25 < MIN_PURCHASE_SECONDS || p75 > MAX_PURCHASE_SECONDS) {
    return null
  }
  if (!(p25 <= p50 && p50 <= p75)) {
    return null
  }
  return {
    hero_id: heroId,
    lane_role: laneRole,
    item_key: itemKey,
    stats: { n, p25, p50, p75 },
  }
}

/** Детерминированный порядок: герой → линия → ключ предмета (кодовая точка UTF-8). */
export function compareBuckets(a, b) {
  if (a.hero_id !== b.hero_id) {
    return a.hero_id - b.hero_id
  }
  if (a.lane_role !== b.lane_role) {
    return a.lane_role - b.lane_role
  }
  if (a.item_key === b.item_key) {
    return 0
  }
  return a.item_key < b.item_key ? -1 : 1
}

/**
 * Объединение шардов: дедупликация по ключу бакета и проверка отсутствия повторов.
 * Дубль означает ошибку шардирования — генерация прерывается, а не «усредняется».
 */
export function mergeBuckets(bucketLists) {
  const merged = new Map()
  for (const list of bucketLists) {
    for (const bucket of list) {
      const identity = `${bucket.hero_id}:${bucket.lane_role}:${bucket.item_key}`
      if (merged.has(identity)) {
        throw new Error(`дубль бакета: ${identity}`)
      }
      merged.set(identity, bucket)
    }
  }
  return [...merged.values()].sort(compareBuckets)
}

/** Снапшот строго по схеме `src/lib/itemTimings.ts` (+ метаданные методики). */
export function buildSnapshot(patch, patchId, buckets, generatedAt = new Date().toISOString()) {
  const observations = buckets.reduce((sum, bucket) => sum + bucket.stats.n, 0)
  const heroes = new Set(buckets.map((bucket) => bucket.hero_id))
  return {
    method_version: METHOD_VERSION,
    source: {
      name: 'OpenDota Explorer',
      url: `${EXPLORER_URL}?sql=`,
      dataset: 'player_matches.purchase_log',
      attribution: 'OpenDota (open source, данные сообщества Valve)',
    },
    generated_at: generatedAt,
    patch,
    patch_id: Number.isInteger(patchId) ? patchId : null,
    thresholds: { ...THRESHOLDS },
    bucket_count: buckets.length,
    totals: {
      observations,
      heroes: heroes.size,
      items: new Set(buckets.map((bucket) => bucket.item_key)).size,
    },
    methodology: {
      time_unit: 'seconds_from_horn',
      first_purchase_only: true,
      purchase_source: 'purchase_log',
      dedupe: 'min(time) per match_id + player_slot + item_key',
      percentiles: 'percentile_cont (linear interpolation)',
      min_observations: MIN_OBSERVATIONS,
      classification_min_observations: CLASSIFY_MIN_OBSERVATIONS,
      purchase_time_bounds: [MIN_PURCHASE_SECONDS, MAX_PURCHASE_SECONDS],
      game_modes: [...GAME_MODES],
      excluded_lobby_types: [...EXCLUDED_LOBBY_TYPES],
      lane_roles: [...LANE_ROLES],
      note: 'Описывает игроков, купивших предмет; медиана не является оптимальным временем.',
    },
    buckets,
  }
}

/** Проверка снапшота перед записью: пустой/несогласованный результат не пишется. */
export function validateSnapshot(snapshot) {
  if (!Array.isArray(snapshot.buckets) || snapshot.buckets.length === 0) {
    throw new Error('в выборке нет ни одного бакета — снапшот не записывается')
  }
  if (snapshot.bucket_count !== snapshot.buckets.length) {
    throw new Error('bucket_count не совпадает с числом бакетов')
  }
  const seen = new Set()
  for (const bucket of snapshot.buckets) {
    const identity = `${bucket.hero_id}:${bucket.lane_role}:${bucket.item_key}`
    if (seen.has(identity)) {
      throw new Error(`дубль бакета: ${identity}`)
    }
    seen.add(identity)
    const { n, p25, p50, p75 } = bucket.stats
    if (!Number.isInteger(n) || n < MIN_OBSERVATIONS) {
      throw new Error(`бакет ${identity}: недопустимое n=${n}`)
    }
    if (!(p25 <= p50 && p50 <= p75)) {
      throw new Error(`бакет ${identity}: нарушен порядок квартилей`)
    }
  }
  return snapshot
}

/** Разбор аргументов CLI. */
export function parseArgs(argv) {
  const options = { patch: DEFAULT_PATCH, dryRun: false, force: false, out: null }
  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--force') {
      options.force = true
    } else if (arg.startsWith('--patch=')) {
      options.patch = arg.slice('--patch='.length)
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length)
    } else {
      throw new Error(`неизвестный аргумент: ${arg}`)
    }
  }
  if (!/^\d+\.\d+$/.test(options.patch)) {
    throw new Error(`некорректный патч: ${options.patch}`)
  }
  return options
}

/** Содержимое снапшота без `generated_at` — для проверки «данные не изменились». */
export function stableJson(snapshot) {
  const clone = { ...snapshot }
  delete clone.generated_at
  return `${JSON.stringify(clone, null, 2)}\n`
}

export function defaultOutputPath(patch, root = ROOT) {
  return resolve(root, `public/benchmarks/item-timings-${patch}.json`)
}

/** Один запрос к Explorer: таймаут 180 с, до 3 попыток с линейным backoff. */
export async function queryExplorer(sql, attempt = 1) {
  const url = `${EXPLORER_URL}?sql=${encodeURIComponent(sql)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 180000)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      let detail = ''
      try {
        const body = await response.json()
        detail = typeof body?.err === 'string' ? `: ${body.err}` : ''
      } catch {
        detail = ''
      }
      throw new Error(`Explorer HTTP ${response.status}${detail}`)
    }
    const payload = await response.json()
    if (payload === null || typeof payload !== 'object' || !Array.isArray(payload.rows)) {
      throw new Error('Explorer вернул неожиданный формат ответа')
    }
    return payload.rows
  } catch (error) {
    if (attempt >= 3) {
      throw error
    }
    // Уважаем лимиты провайдера: пауза перед повтором.
    await new Promise((done) => setTimeout(done, 8000 * attempt))
    return queryExplorer(sql, attempt + 1)
  } finally {
    clearTimeout(timer)
  }
}

/** Список патчей OpenDota: `[{name, date, id}]` — нужен для числового `patch_id`. */
export async function fetchPatches() {
  const response = await fetch('https://api.opendota.com/api/constants/patch', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`/api/constants/patch HTTP ${response.status}`)
  }
  const payload = await response.json()
  if (!Array.isArray(payload)) {
    throw new Error('/api/constants/patch: неожиданный формат ответа')
  }
  return payload
    .filter((item) => item && typeof item.name === 'string' && Number.isInteger(item.id))
    .map((item) => ({ name: item.name, date: String(item.date ?? ''), id: item.id }))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const outPath =
    options.out === null ? defaultOutputPath(options.patch) : resolve(ROOT, options.out)
  console.log(`Патч: ${options.patch}`)
  console.log(`Файл: ${outPath}`)

  if (existsSync(outPath) && !options.force) {
    throw new Error('снапшот уже существует — перезапись только с --force')
  }

  const itemKeys = loadEligibleItemKeys()
  const eligible = new Set(itemKeys)
  console.log(`Разрешённых предметов в каталоге: ${itemKeys.length}`)

  const patches = await fetchPatches()
  const patchEntry = patches.find((entry) => entry.name === options.patch)
  if (patchEntry === undefined) {
    throw new Error(`патч ${options.patch} не найден в /api/constants/patch`)
  }
  console.log(`patch_id: ${patchEntry.id} (${patchEntry.date})`)

  const shardResults = []
  for (const range of HERO_ID_SHARDS) {
    const sql = buildSql(options.patch, itemKeys, range)
    console.log(`Запрос hero_id ${range[0]}–${range[1]}…`)
    const rows = await queryExplorer(sql)
    let rejected = 0
    const buckets = []
    for (const row of rows) {
      const parsed = parseRow(row, eligible)
      if (parsed === null) {
        rejected += 1
      } else {
        buckets.push(parsed)
      }
    }
    console.log(`  строк: ${rows.length}, принято: ${buckets.length}, отклонено: ${rejected}`)
    shardResults.push(buckets)
    // Пауза между запросами: не приближаемся к лимиту 60 запросов/мин.
    await new Promise((done) => setTimeout(done, 2000))
  }

  const buckets = mergeBuckets(shardResults)
  console.log(`Бакетов после объединения шардов: ${buckets.length}`)

  const snapshot = validateSnapshot(buildSnapshot(options.patch, patchEntry.id, buckets))
  const { observations, heroes, items } = snapshot.totals
  console.log(`Наблюдений: ${observations}; героев: ${heroes}; предметов: ${items}`)

  const json = `${JSON.stringify(snapshot, null, 2)}\n`

  if (options.dryRun) {
    console.log('--dry-run: файл не записан')
    return
  }

  if (existsSync(outPath)) {
    const previous = readFileSync(outPath, 'utf8')
    try {
      if (stableJson(JSON.parse(previous)) === stableJson(snapshot)) {
        console.log('Данные совпадают с существующим снапшотом — перезапись не требуется')
        return
      }
    } catch {
      // Повреждённый файл не блокирует явную перезапись с --force.
    }
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, json, 'utf8')
  console.log(`Записан снапшот: ${outPath}`)
  console.log('Файл не входит в Git и не подлежит публикации без подтверждения прав.')
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main().catch((error) => {
    console.error('Ошибка генерации снапшота:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
