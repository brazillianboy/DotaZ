#!/usr/bin/env node
/**
 * DotaZ — генерация снапшота нормативов 00:00–15:00 (Task 16).
 *
 * Источник: OpenDota Explorer (`GET /api/explorer?sql=...`), только чтение.
 * Ключи не используются: Explorer доступен анонимно (60 запросов/мин, 3000/сутки).
 *
 * Что считается: значения ИМЕННО 15-й минуты из поминутных таймлайнов OpenDota.
 *  - `lh_t`, `gold_t`, `xp_t` — массивы, где индекс i соответствует минуте i;
 *  - в PostgreSQL-массивах индексация с 1, поэтому `lh_t[16]` = минута 15.
 *    Проверено на матче 9073072808 (Explorer 119 == API `lh_t[15]` 119).
 *  - Матч попадает в метрику только при `array_length(<array>, 1) >= 16`,
 *    иначе 15-й минуты в данных нет (значение НЕ подменяется нулём).
 *
 * Запуск (из корня проекта):
 *   node scripts/build-benchmarks.mjs                 # патч по умолчанию
 *   node scripts/build-benchmarks.mjs --patch=7.41 --dry-run
 *   node scripts/build-benchmarks.mjs --patch=7.41 --force
 *
 * Файл снапшота не перезаписывается без `--force` (защита проверенных данных).
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Версия методики: любое изменение фильтров/перцентилей требует новой версии. */
const METHOD_VERSION = '1.0.0'

/** Патч по умолчанию (актуальный на момент исследования: /api/constants/patch). */
const DEFAULT_PATCH = '7.41'

/** Интервал анализа. Индекс 16 в PostgreSQL-массиве = 15-я минута. */
const INTERVAL = { minutes: 15, arrayIndex: 16, label: '00:00–15:00' }

/** Порог показа медианы (продуктовое правило, не заявление о значимости). */
const THRESHOLDS = { full: 200, medianOnly: 50 }

/** Стандартные режимы: All Pick, Captains Mode/Draft, Random/Single Draft,
 *  All Random, Least Played, Balanced Draft, All Draft. */
const GAME_MODES = [1, 2, 3, 4, 5, 12, 16, 17, 22]

/** Исключаются заведомо нерелевантные лобби: tutorial, coop bots, local bots, spectator. */
const EXCLUDED_LOBBY_TYPES = [3, 4, 10, 11]

const EXPLORER_URL = 'https://api.opendota.com/api/explorer'

/** Метрики: ключ в снапшоте → колонка таймлайна. `sqlKey` — алиас в нижнем
 *  регистре: PostgreSQL сворачивает незакавыченные идентификаторы. */
const METRICS = [
  { key: 'lastHits', sqlKey: 'lasthits', column: 'lh_t' },
  { key: 'gold', sqlKey: 'gold', column: 'gold_t' },
  { key: 'xp', sqlKey: 'xp', column: 'xp_t' },
]

function parseIntArray(value) {
  return `(${value.join(',')})`
}

/**
 * Один SQL-запрос на весь патч: перцентили считает СУБД (`percentile_cont`),
 * выборка — отдельно для каждой метрики через `FILTER`.
 */
function buildSql(patch) {
  const columns = METRICS.map(
    ({ sqlKey, column }) => `
       COUNT(*) FILTER (WHERE array_length(pm.${column}, 1) >= ${INTERVAL.arrayIndex}) AS n_${sqlKey},
       percentile_cont(0.25) WITHIN GROUP (ORDER BY pm.${column}[${INTERVAL.arrayIndex}])
         FILTER (WHERE array_length(pm.${column}, 1) >= ${INTERVAL.arrayIndex}) AS ${sqlKey}_p25,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY pm.${column}[${INTERVAL.arrayIndex}])
         FILTER (WHERE array_length(pm.${column}, 1) >= ${INTERVAL.arrayIndex}) AS ${sqlKey}_p50,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY pm.${column}[${INTERVAL.arrayIndex}])
         FILTER (WHERE array_length(pm.${column}, 1) >= ${INTERVAL.arrayIndex}) AS ${sqlKey}_p75`,
  ).join(',')

  return `SELECT pm.hero_id, pm.lane_role,${columns}
   FROM player_matches pm
   JOIN matches m ON m.match_id = pm.match_id
   JOIN match_patch mp ON mp.match_id = pm.match_id
  WHERE mp.patch = '${patch}'
    AND pm.hero_id IS NOT NULL
    AND pm.lane_role BETWEEN 1 AND 4
    AND (array_length(pm.lh_t, 1) >= ${INTERVAL.arrayIndex}
         OR array_length(pm.gold_t, 1) >= ${INTERVAL.arrayIndex}
         OR array_length(pm.xp_t, 1) >= ${INTERVAL.arrayIndex})
    AND m.game_mode IN ${parseIntArray(GAME_MODES)}
    AND m.lobby_type NOT IN ${parseIntArray(EXCLUDED_LOBBY_TYPES)}
  GROUP BY pm.hero_id, pm.lane_role
  ORDER BY pm.hero_id, pm.lane_role`
}

/** Предварительная проверка дублей: пара (match_id, player_slot) должна быть уникальной. */
function buildDuplicateCheckSql(patch) {
  return `SELECT COUNT(*) AS duplicates FROM (
    SELECT pm.match_id, pm.player_slot
      FROM player_matches pm
      JOIN match_patch mp ON mp.match_id = pm.match_id
     WHERE mp.patch = '${patch}'
     GROUP BY pm.match_id, pm.player_slot
    HAVING COUNT(*) > 1
  ) t`
}

/**
 * Строгая валидация строки Explorer. Любое несоответствие — отказ от записи:
 * снапшот не должен содержать выдуманных или противоречивых чисел.
 */
function parseRow(row) {
  if (row === null || typeof row !== 'object') {
    throw new Error('строка ответа не является объектом')
  }
  const heroId = Number(row.hero_id)
  const laneRole = Number(row.lane_role)
  if (!Number.isInteger(heroId) || heroId <= 0) {
    throw new Error(`некорректный hero_id: ${String(row.hero_id)}`)
  }
  if (![1, 2, 3, 4].includes(laneRole)) {
    throw new Error(`некорректный lane_role: ${String(row.lane_role)}`)
  }

  const metrics = {}
  for (const { key, sqlKey } of METRICS) {
    const n = Number(row[`n_${sqlKey}`])
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`hero ${heroId}/role ${laneRole}: некорректный счётчик n_${sqlKey}`)
    }
    const raw = [row[`${sqlKey}_p25`], row[`${sqlKey}_p50`], row[`${sqlKey}_p75`]]
    const missing = raw.filter((value) => value === null || value === undefined).length
    if (n === 0) {
      if (missing !== 3) {
        throw new Error(`hero ${heroId}/role ${laneRole}: n_${key}=0, но перцентили присутствуют`)
      }
      metrics[key] = { n: 0, p25: null, p50: null, p75: null }
      continue
    }
    if (missing !== 0) {
      throw new Error(`hero ${heroId}/role ${laneRole}: неполные перцентили для ${key}`)
    }
    const [p25, p50, p75] = raw.map((value) => Number(value))
    for (const value of [p25, p50, p75]) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`hero ${heroId}/role ${laneRole}: некорректный перцентиль ${key}`)
      }
    }
    if (!(p25 <= p50 && p50 <= p75)) {
      throw new Error(`hero ${heroId}/role ${laneRole}: нарушен порядок перцентилей ${key}`)
    }
    metrics[key] = {
      n,
      p25: round(p25),
      p50: round(p50),
      p75: round(p75),
    }
  }

  return { hero_id: heroId, lane_role: laneRole, metrics }
}

/** Округление до 1 знака: перцентили золота/опыта дробные, LH — целые. */
function round(value) {
  return Math.round(value * 10) / 10
}

function compareBuckets(a, b) {
  return a.hero_id - b.hero_id || a.lane_role - b.lane_role
}

function parseArgs(argv) {
  const options = { patch: DEFAULT_PATCH, force: false, dryRun: false }
  for (const arg of argv.slice(2)) {
    if (arg === '--force') options.force = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg.startsWith('--patch=')) options.patch = arg.slice('--patch='.length).trim()
    else throw new Error(`неизвестный аргумент: ${arg}`)
  }
  if (!/^\d+\.\d+$/.test(options.patch)) {
    throw new Error(`некорректный патч: "${options.patch}" (ожидается формат 7.41)`)
  }
  return options
}

function buildSnapshot(patch, buckets, patchId) {
  const withSamples = buckets.filter((bucket) =>
    METRICS.some(({ key }) => bucket.metrics[key].n > 0),
  )
  return {
    method_version: METHOD_VERSION,
    source: {
      name: 'OpenDota Explorer',
      url: EXPLORER_URL,
      dataset: 'OpenDota public data sample (parsed matches)',
      attribution: 'Данные: OpenDota (opendota.com). Код OpenDota — MIT.',
    },
    generated_at: new Date().toISOString(),
    patch,
    /** Числовой id патча OpenDota: по нему матч сопоставляется с нормативом. */
    patch_id: patchId,
    interval: INTERVAL,
    thresholds: THRESHOLDS,
    filters: {
      game_mode_in: GAME_MODES,
      lobby_type_not_in: EXCLUDED_LOBBY_TYPES,
      lane_role_in: [1, 2, 3, 4],
      min_timeline_length: INTERVAL.arrayIndex,
      timeline_index: INTERVAL.arrayIndex,
      metrics: METRICS.map(({ key, column }) => ({ key, column: `${column}[${INTERVAL.arrayIndex}]` })),
      statistics: 'percentile_cont p25/p50/p75, per-metric FILTER',
    },
    bucket_count: withSamples.length,
    buckets: withSamples,
  }
}

async function main() {
  const options = parseArgs(process.argv)
  const outPath = resolve(ROOT, 'src', 'data', `benchmarks-${options.patch}.json`)

  if (existsSync(outPath) && !options.force && !options.dryRun) {
    console.error(
      `Снапшот уже существует: ${outPath}\n` +
        'Перезапись без --force запрещена (защита проверенных данных).',
    )
    process.exit(1)
  }

  console.log(`OpenDota Explorer: патч ${options.patch}`)

  // Числовой id патча: нужен приложению для точного сопоставления матча с нормативом.
  const constants = await fetchPatches()
  const patchEntry = constants.find((item) => item.name === options.patch)
  if (patchEntry === undefined) {
    throw new Error(`патч ${options.patch} отсутствует в /api/constants/patch`)
  }
  console.log(`patch_id = ${patchEntry.id} (${patchEntry.date})`)

  const duplicates = await queryExplorer(buildDuplicateCheckSql(options.patch))
  const duplicateCount = Number(duplicates[0]?.duplicates ?? 0)
  if (!Number.isFinite(duplicateCount) || duplicateCount < 0) {
    throw new Error('не удалось проверить дубли наблюдений')
  }
  if (duplicateCount > 0) {
    throw new Error(`обнаружены дубли (match_id, player_slot): ${duplicateCount}`)
  }
  console.log('Проверка дублей: 0')

  const rows = await queryExplorer(buildSql(options.patch))
  console.log(`Строк-бакетов получено: ${rows.length}`)

  const buckets = rows.map(parseRow).sort(compareBuckets)
  const snapshot = buildSnapshot(options.patch, buckets, patchEntry.id)

  if (snapshot.bucket_count === 0) {
    throw new Error('в выборке нет ни одного бакета — снапшот не записывается')
  }

  const totalSamples = buckets.reduce((sum, bucket) => {
    return sum + Math.max(...METRICS.map(({ key }) => bucket.metrics[key].n))
  }, 0)
  console.log(`Бакетов с данными: ${snapshot.bucket_count}, наблюдений (max по метрикам): ${totalSamples}`)

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
}

main().catch((error) => {
  console.error('Ошибка генерации снапшота:', error instanceof Error ? error.message : error)
  process.exit(1)
})

/** Список патчей OpenDota: `[{name, date, id}]` — нужен для числового `patch_id`. */
async function fetchPatches() {
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

/** Содержимое снапшота без `generated_at` — для проверки «данные не изменились». */
function stableJson(snapshot) {
  const clone = { ...snapshot }
  delete clone.generated_at
  return `${JSON.stringify(clone, null, 2)}\n`
}

async function queryExplorer(sql, attempt = 1) {
  const url = `${EXPLORER_URL}?sql=${encodeURIComponent(sql)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Explorer HTTP ${response.status}`)
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
    await new Promise((done) => setTimeout(done, 5000 * attempt))
    return queryExplorer(sql, attempt + 1)
  } finally {
    clearTimeout(timer)
  }
}
