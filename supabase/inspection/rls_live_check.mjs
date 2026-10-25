#!/usr/bin/env node
/**
 * DotaZ — временная процедура ЖИВОЙ проверки RLS (Task 10).
 *
 * Что делает: входит двумя ОБЫЧНЫМИ пользовательскими сессиями (User A и User B)
 * через `signInWithPassword` (publishable/anon ключ, НЕ service_role) и проверяет
 * изоляцию данных по плану `supabase/inspection/rls_verification_plan.md`.
 *
 * Безопасность:
 *  - используется только публичный (browser-safe) ключ Supabase;
 *  - пароли берутся ТОЛЬКО из переменных окружения процесса и никогда не печатаются;
 *  - access/refresh-токены не печатаются и не сохраняются;
 *  - тестовые записи создаются только с изолированным `match_id = 9999999999`;
 *  - удаление тестовых строк выполняется ТОЛЬКО при явном флаге `--cleanup`.
 *
 * Запуск (PowerShell, из корня проекта; пароли не сохраняйте в файлы):
 *   $env:DOTAZ_USER_A_EMAIL='dotaz-test-a@example.com'
 *   $env:DOTAZ_USER_A_PASSWORD='<пароль A>'
 *   $env:DOTAZ_USER_B_EMAIL='dotaz-test-b@example.com'
 *   $env:DOTAZ_USER_B_PASSWORD='<пароль B>'
 *   node supabase/inspection/rls_live_check.mjs
 *
 * URL и publishable-ключ берутся из переменных окружения VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY, а при их отсутствии — из локального `.env`
 * (эти два значения публичные; пароли из `.env` НЕ читаются).
 *
 * Дополнительно (необязательно): DOTAZ_USER_C_EMAIL / DOTAZ_USER_C_PASSWORD —
 * для проверки кейса 18 (профиль нового пользователя создан триггером).
 *
 * Скрипт временный: после проверки его можно удалить, он не входит в приложение.
 */

import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

const TEST_MATCH_ID = '9999999999'
const cleanup = process.argv.includes('--cleanup')

const results = []

/** Записывает результат проверки: PASS/FAIL. */
function record(id, title, ok, detail) {
  results.push({ id, title, status: ok ? 'PASS' : 'FAIL', detail })
  console.log(`${ok ? 'PASS   ' : 'FAIL   '} #${String(id).padEnd(3)} ${title}${detail ? ` — ${detail}` : ''}`)
}

/** Отмечает проверку, требующую ручных действий владельца. */
function skip(id, title, detail) {
  results.push({ id, title, status: 'NOT RUN', detail })
  console.log(`NOT RUN #${String(id).padEnd(3)} ${title}${detail ? ` — ${detail}` : ''}`)
}

/** Читает только публичные значения из .env (URL и publishable-ключ). */
function readEnvFile(relativePath) {
  try {
    const content = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    const map = {}
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line)
      if (match) map[match[1]] = match[2].trim()
    }
    return map
  } catch {
    return {}
  }
}

const fileEnv = readEnvFile('../../.env')
const url =
  process.env.VITE_SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  ''

const users = {
  a: { email: process.env.DOTAZ_USER_A_EMAIL, password: process.env.DOTAZ_USER_A_PASSWORD },
  b: { email: process.env.DOTAZ_USER_B_EMAIL, password: process.env.DOTAZ_USER_B_PASSWORD },
  c: { email: process.env.DOTAZ_USER_C_EMAIL, password: process.env.DOTAZ_USER_C_PASSWORD },
}

if (!url || !key) {
  console.error('Не найдены URL/publishable-ключ Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).')
  process.exit(2)
}

if (!users.a.email || !users.a.password || !users.b.email || !users.b.password) {
  console.error('Не заданы учётные данные User A и/или User B.')
  console.error('Задайте их переменными окружения процесса (пароли не сохраняйте в файлы):')
  console.error("  $env:DOTAZ_USER_A_EMAIL='dotaz-test-a@example.com'")
  console.error("  $env:DOTAZ_USER_A_PASSWORD='<пароль A>'")
  console.error("  $env:DOTAZ_USER_B_EMAIL='dotaz-test-b@example.com'")
  console.error("  $env:DOTAZ_USER_B_PASSWORD='<пароль B>'")
  process.exit(2)
}

/** Клиент без сохранения сессии: каждый вход выполняется явно. */
function makeClient() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Вход обычным пользователем; при неудаче печатается только текст ошибки Supabase. */
async function signIn(client, label, credentials) {
  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })
  if (error || !data?.user) {
    console.error(`${label}: вход не выполнен — ${error?.message ?? 'пользователь не возвращён'}`)
    process.exit(2)
  }
  return data.user.id
}

/** Короткий код ошибки PostgREST/Postgres для отчёта. */
function errorInfo(error) {
  if (!error) return 'нет ошибки'
  const code = error.code ? `code=${error.code}` : `status=${error.status ?? '?'}`
  const message = (error.message ?? '').slice(0, 160)
  return `${code}: ${message}`
}

/** Вставка изолированной тестовой строки (status='pending' — «готовый» отчёт не выдумывается). */
async function insertTestReport(client, userId, matchId) {
  const { data, error } = await client
    .from('match_reports')
    .insert({ user_id: userId, match_id: matchId, status: 'pending', source: 'OpenDota' })
    .select('id')
    .maybeSingle()
  if (!error) return { id: data?.id ?? null, created: true, error: null }
  if (error.code === '23505') {
    // Повторный запуск проверки: строка уже создана ранее — это не сбой владельца.
    const existing = await client.from('match_reports').select('id').eq('match_id', matchId).maybeSingle()
    return { id: existing.data?.id ?? null, created: false, error: null }
  }
  return { id: null, created: false, error }
}

/** Кейсы 1–6 и 16: владельческая изоляция чтения. */
async function verifyCore(a, b, idA, idB) {
  const ownProfileA = await a.from('profiles').select('id, nickname, created_at').eq('id', idA)
  record(
    1,
    'A читает свой профиль',
    !ownProfileA.error && ownProfileA.data?.length === 1,
    ownProfileA.error ? errorInfo(ownProfileA.error) : `строк: ${ownProfileA.data?.length ?? 0}`,
  )

  const otherProfile = await a.from('profiles').select('id').eq('id', idB)
  record(
    2,
    'A пытается прочитать профиль B',
    !otherProfile.error && otherProfile.data?.length === 0,
    otherProfile.error ? errorInfo(otherProfile.error) : `строк: ${otherProfile.data?.length ?? 0}`,
  )

  const profileA = ownProfileA.data?.[0]
  record(
    16,
    'Профиль существующего пользователя читается владельцем',
    Boolean(profileA) && profileA.id === idA,
    profileA
      ? `nickname=${profileA.nickname === null ? 'NULL' : profileA.nickname}, created_at=${profileA.created_at}`
      : 'строка профиля не найдена (backfill/триггер не сработал?)',
  )

  const reportA = await insertTestReport(a, idA, TEST_MATCH_ID)
  record(
    3,
    `A создаёт отчёт (match_id=${TEST_MATCH_ID})`,
    Boolean(reportA.id),
    reportA.id ? `${reportA.created ? 'создан' : 'уже существовал'} id=${reportA.id}` : errorInfo(reportA.error),
  )

  const reportB = await insertTestReport(b, idB, TEST_MATCH_ID)
  record(
    4,
    'B создаёт отчёт с тем же match_id',
    Boolean(reportB.id),
    reportB.id ? `${reportB.created ? 'создан' : 'уже существовал'} id=${reportB.id}` : errorInfo(reportB.error),
  )

  record(
    12,
    'Один match_id у двух разных пользователей',
    Boolean(reportA.id) && Boolean(reportB.id) && reportA.id !== reportB.id,
    `разные строки с общим match_id=${TEST_MATCH_ID}`,
  )

  const ownReportsA = await a.from('match_reports').select('id, user_id, status').eq('match_id', TEST_MATCH_ID)
  record(
    5,
    'A читает свой отчёт',
    !ownReportsA.error && ownReportsA.data?.length === 1 && ownReportsA.data[0].id === reportA.id,
    ownReportsA.error ? errorInfo(ownReportsA.error) : `строк: ${ownReportsA.data?.length ?? 0}`,
  )

  const foreignReport = await b.from('match_reports').select('id').eq('id', reportA.id)
  record(
    6,
    'B читает отчёт A',
    !foreignReport.error && foreignReport.data?.length === 0,
    foreignReport.error ? errorInfo(foreignReport.error) : `строк: ${foreignReport.data?.length ?? 0}`,
  )

  return { reportA, reportB }
}

/** Кейсы 7–11 и 15: изменение/удаление чужих данных, смена владельца, дубликаты. */
async function verifyMutations(a, b, idA, idB, reportA, reportB) {
  // Кейсы 7, 8, 10, 10b и 11 требуют, чтобы тестовые отчёты были созданы (кейсы 3–4).
  const hasOwnReports = Boolean(reportA.id) && Boolean(reportB.id)

  if (hasOwnReports) {
    const updateForeign = await b
      .from('match_reports')
      .update({ status: 'partial' })
      .eq('id', reportA.id)
      .select('id')
    record(
      7,
      'B обновляет отчёт A',
      !updateForeign.error && updateForeign.data?.length === 0,
      updateForeign.error ? errorInfo(updateForeign.error) : `обновлено строк: ${updateForeign.data?.length ?? 0}`,
    )

    const deleteForeign = await b.from('match_reports').delete().eq('id', reportA.id).select('id')
    record(
      8,
      'B удаляет отчёт A',
      !deleteForeign.error && deleteForeign.data?.length === 0,
      deleteForeign.error ? errorInfo(deleteForeign.error) : `удалено строк: ${deleteForeign.data?.length ?? 0}`,
    )
  } else {
    for (const id of [7, 8]) {
      skip(id, 'Обновление/удаление чужого отчёта', 'тестовые отчёты не созданы (см. FAIL кейсов 3/4)')
    }
  }

  const insertForeign = await b
    .from('match_reports')
    .insert({ user_id: idA, match_id: `${TEST_MATCH_ID}-foreign`, status: 'pending' })
    .select('id')
  record(
    9,
    'B вставляет отчёт с user_id пользователя A',
    Boolean(insertForeign.error),
    insertForeign.error ? errorInfo(insertForeign.error) : 'ВСТАВКА ПРОШЛА — политика INSERT не работает',
  )

  if (hasOwnReports) {
    const stealOwnership = await b
      .from('match_reports')
      .update({ user_id: idA })
      .eq('id', reportB.id)
      .select('id, user_id')
    record(
      10,
      'B меняет user_id своего отчёта на A',
      Boolean(stealOwnership.error),
      stealOwnership.error ? errorInfo(stealOwnership.error) : 'ИЗМЕНЕНИЕ ПРОШЛО — владелец не защищён',
    )

    const stillOwnerB = await b.from('match_reports').select('id, user_id').eq('id', reportB.id).maybeSingle()
    record(
      '10b',
      'Отчёт B остался за B после попытки смены владельца',
      stillOwnerB.data?.user_id === idB,
      stillOwnerB.error ? errorInfo(stillOwnerB.error) : `user_id=${stillOwnerB.data?.user_id ?? 'нет строки'}`,
    )

    const duplicate = await a
      .from('match_reports')
      .insert({ user_id: idA, match_id: TEST_MATCH_ID, status: 'pending' })
      .select('id')
    record(
      11,
      'A повторно вставляет (свой user_id, тот же match_id)',
      duplicate.error?.code === '23505',
      duplicate.error ? errorInfo(duplicate.error) : 'ДУБЛИКАТ СОЗДАН — уникальность не работает',
    )
  } else {
    for (const id of [10, '10b', 11]) {
      skip(id, 'Смена владельца и дубликат (user_id, match_id)', 'тестовые отчёты не созданы (см. FAIL кейсов 3/4)')
    }
  }

  const filterForeign = await a.from('match_reports').select('id').eq('user_id', idB)
  record(
    15,
    'A запрашивает отчёты с фильтром user_id = B',
    !filterForeign.error && filterForeign.data?.length === 0,
    filterForeign.error ? errorInfo(filterForeign.error) : `строк: ${filterForeign.data?.length ?? 0}`,
  )
}

/** Кейс 14: ограничения NOT NULL / CHECK отклоняют неполные или некорректные данные. */
async function verifyConstraints(a, idA) {
  const checks = [
    ['без user_id', { match_id: `${TEST_MATCH_ID}-nouser`, status: 'pending' }],
    ['без match_id', { user_id: idA, status: 'pending' }],
    ['status вне списка', { user_id: idA, match_id: `${TEST_MATCH_ID}-bad`, status: 'broken' }],
    ["status='ready' без payload", { user_id: idA, match_id: `${TEST_MATCH_ID}-ready`, status: 'ready' }],
  ]
  const details = []
  let ok = true
  for (const [label, payload] of checks) {
    const { error } = await a.from('match_reports').insert(payload).select('id')
    if (error) {
      details.push(`${label}: ${error.code ?? error.status ?? 'ошибка'}`)
    } else {
      ok = false
      details.push(`${label}: ВСТАВКА ПРОШЛА`)
    }
  }
  record(14, 'Ограничения NOT NULL / CHECK отклоняют неполные данные', ok, details.join('; '))
}

/** Кейс 13: анонимный клиент (без сессии) не имеет доступа к данным. */
async function verifyAnonymous() {
  const anonymous = makeClient()
  const anonymousSelect = await anonymous.from('match_reports').select('id').limit(1)
  const denied = Boolean(anonymousSelect.error) || (anonymousSelect.data?.length ?? 0) === 0
  record(
    13,
    'Анонимный клиент (без сессии) читает match_reports',
    denied,
    anonymousSelect.error
      ? `отказ: ${errorInfo(anonymousSelect.error)}`
      : `строк: ${anonymousSelect.data?.length ?? 0}`,
  )
}

/** Кейс 18: профиль пользователя, зарегистрированного ПОСЛЕ применения миграции. */
async function verifyNewUser(idA, idB) {
  if (!users.c.email || !users.c.password) {
    skip(
      18,
      'Профиль нового пользователя (User C)',
      'не заданы DOTAZ_USER_C_EMAIL/PASSWORD: зарегистрируйте нового пользователя в приложении и запустите скрипт с этими переменными',
    )
    return
  }
  const c = makeClient()
  const idC = await signIn(c, 'User C', users.c)
  const profileC = await c.from('profiles').select('id, nickname, created_at').eq('id', idC)
  record(
    18,
    'Профиль нового пользователя создан триггером on_auth_user_created',
    !profileC.error && profileC.data?.length === 1 && profileC.data[0].id === idC,
    profileC.error
      ? errorInfo(profileC.error)
      : `строк: ${profileC.data?.length ?? 0}, nickname=${profileC.data?.[0]?.nickname ?? '—'}`,
  )

  const foreignC = await c.from('match_reports').select('id').in('user_id', [idA, idB])
  record(
    '18b',
    'Новый пользователь не видит отчёты A и B',
    !foreignC.error && foreignC.data?.length === 0,
    foreignC.error ? errorInfo(foreignC.error) : `строк: ${foreignC.data?.length ?? 0}`,
  )
}

/** Очистка: только при явном флаге --cleanup и только собственные тестовые строки. */
async function cleanupTestRows(a, b) {
  if (!cleanup) {
    console.log('\nТестовые строки (match_id=9999999999) ОСТАВЛЕНЫ в базе: удаление выполняется')
    console.log('только по явному решению владельца — повторный запуск с флагом --cleanup.')
    return
  }
  const removedA = await a.from('match_reports').delete().eq('match_id', TEST_MATCH_ID).select('id')
  const removedB = await b.from('match_reports').delete().eq('match_id', TEST_MATCH_ID).select('id')
  console.log(
    `\nОчистка (--cleanup): удалено A=${removedA.data?.length ?? 0}, B=${removedB.data?.length ?? 0}` +
      ` (только свои строки с match_id=${TEST_MATCH_ID}; чужие данные не затрагивались)`,
  )
}

async function main() {
  const a = makeClient()
  const b = makeClient()
  const idA = await signIn(a, 'User A', users.a)
  const idB = await signIn(b, 'User B', users.b)
  console.log(
    `Сессии: User A=${idA}, User B=${idB} (обычные пользовательские сессии; service-role не используется)\n`,
  )

  const { reportA, reportB } = await verifyCore(a, b, idA, idB)
  await verifyMutations(a, b, idA, idB, reportA, reportB)
  await verifyConstraints(a, idA)
  await verifyAnonymous()
  skip(
    17,
    'Повторный запуск backfill (раздел 3.3)',
    'требует административной роли (SQL Editor) — выполняется владельцем вручную',
  )
  await verifyNewUser(idA, idB)
  await cleanupTestRows(a, b)

  const pass = results.filter((item) => item.status === 'PASS').length
  const fail = results.filter((item) => item.status === 'FAIL').length
  const notRun = results.filter((item) => item.status === 'NOT RUN').length
  console.log(`\nИтог: PASS=${pass}, FAIL=${fail}, NOT RUN=${notRun}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(`Проверка прервана: ${error?.message ?? error}`)
  process.exit(2)
})
