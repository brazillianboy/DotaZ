import { describe, expect, it } from 'vitest'

// SQL и скрипты читаются как строки средствами Vite (?raw) — без зависимостей от Node API.
import migrationSql from '../../supabase/migrations/20261018120000_dotaz_profiles_match_reports.sql?raw'
import auditSql from '../../supabase/inspection/read_only_schema_audit.sql?raw'
import rlsCheckScript from '../../supabase/inspection/rls_live_check.mjs?raw'

/**
 * Статические проверки артефактов Task 10: миграция (схема + RLS), read-only аудит-скрипт
 * и временный скрипт живой проверки RLS.
 *
 * ВАЖНО: это проверка текста SQL/JS-файлов, а не живой базы данных. Она не подтверждает,
 * что миграция применена и что RLS работает в реальном проекте Supabase — поведение
 * политик подтверждается только запуском `supabase/inspection/rls_live_check.mjs`
 * обычными пользовательскими сессиями (см. `supabase/inspection/rls_verification_plan.md`).
 */

const sql = migrationSql

/** Убирает построчные комментарии, чтобы проверки не срабатывали на пояснениях. */
function stripComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

/** Приводит переводы строк к LF: файлы в репозитории могут иметь CRLF. */
function normalizeNewlines(source: string): string {
  return source.replace(/\r\n/g, '\n')
}

/** Дополнительно убирает содержимое строковых литералов — для проверок отсутствия операторов. */
function stripLiterals(source: string): string {
  return source.replace(/'[^']*'/g, "''")
}

const sqlWithoutComments = stripComments(normalizeNewlines(sql))
const sqlStatementsOnly = stripLiterals(sqlWithoutComments)
const auditWithoutComments = stripComments(normalizeNewlines(auditSql))
const auditStatementsOnly = stripLiterals(auditWithoutComments)

/** Точный оператор backfill профилей существующих пользователей (раздел 3.3 миграции). */
const backfillStatement = [
  'insert into public.profiles (id)',
  'select id',
  'from auth.users',
  'on conflict (id) do nothing;',
].join('\n')

describe('миграция Task 10: структура схемы', () => {
  it('создаёт обе таблицы явно, без IF NOT EXISTS', () => {
    expect(sqlWithoutComments).toContain('create table public.profiles')
    expect(sqlWithoutComments).toContain('create table public.match_reports')
    expect(sqlWithoutComments.toLowerCase()).not.toContain('create table if not exists')
  })

  it('profiles: id — первичный ключ со связью с auth.users', () => {
    expect(sqlWithoutComments).toContain('id uuid primary key references auth.users (id) on delete cascade')
    expect(sqlWithoutComments).toContain('nickname text')
    expect(sqlWithoutComments).toContain('created_at timestamptz not null default now()')
  })

  it('match_reports: обязательные поля и типы соответствуют контракту Tasks 6–9', () => {
    expect(sqlWithoutComments).toContain('user_id uuid not null references auth.users (id) on delete cascade')
    expect(sqlWithoutComments).toContain('match_id text not null')
    expect(sqlWithoutComments).toContain('match_payload jsonb')
    expect(sqlWithoutComments).toContain('analysis_payload jsonb')
    expect(sqlWithoutComments).toContain('rules_version text')
    expect(sqlWithoutComments).toContain('fetched_at timestamptz')
    expect(sqlWithoutComments).toContain('updated_at timestamptz not null default now()')
  })

  it('match_id хранится строкой, чтобы не терять точность больших ID', () => {
    expect(sqlWithoutComments).toContain('match_id text not null')
    expect(sqlWithoutComments).not.toMatch(/match_id\s+(bigint|numeric|integer|double)/)
  })

  it('статус ограничен списком значений, по умолчанию pending', () => {
    expect(sqlWithoutComments).toContain("check (status in ('pending', 'ready', 'partial', 'error'))")
    expect(sqlWithoutComments).toContain("status text not null default 'pending'")
    expect(sqlWithoutComments).not.toContain("default 'ready'")
  })

  it('статус ready требует заполненных payload: фиктивных «готовых» отчётов нет', () => {
    expect(sqlWithoutComments).toContain('constraint match_reports_ready_requires_payloads')
    expect(sqlWithoutComments).toContain(
      "check (status <> 'ready' or (match_payload is not null and analysis_payload is not null))",
    )
  })

  it('payload остаются nullable: pending/partial/error не подделывают данные', () => {
    expect(sqlWithoutComments).toMatch(/\bmatch_payload jsonb,/)
    expect(sqlWithoutComments).toMatch(/\banalysis_payload jsonb,/)
    expect(sqlWithoutComments).not.toMatch(/match_payload jsonb not null/)
    expect(sqlWithoutComments).not.toMatch(/analysis_payload jsonb not null/)
  })

  it('источник и уникальность пары (user_id, match_id) заданы ограничениями БД', () => {
    expect(sqlWithoutComments).toContain("source text not null default 'OpenDota'")
    expect(sqlWithoutComments).toContain('unique (user_id, match_id)')
  })

  it('индекс для личной истории учитывает сортировку по created_at', () => {
    expect(sqlWithoutComments).toContain('on public.match_reports (user_id, created_at desc)')
  })
})

describe('миграция Task 10: RLS и права', () => {
  it('RLS включён на обеих таблицах', () => {
    const matches =
      sqlWithoutComments.match(/alter table public\.(profiles|match_reports) enable row level security/g) ?? []
    expect(matches).toHaveLength(2)
  })

  it('политики владельца покрывают нужные операции', () => {
    const expectedPolicies = [
      'profiles_select_own',
      'profiles_insert_own',
      'profiles_update_own',
      'match_reports_select_own',
      'match_reports_insert_own',
      'match_reports_update_own',
      'match_reports_delete_own',
    ]
    for (const policy of expectedPolicies) {
      expect(sqlWithoutComments).toContain(`create policy ${policy}`)
    }
  })

  it('каждая политика опирается на auth.uid() и роль authenticated', () => {
    const policyBlocks = sqlWithoutComments.match(/create policy[\s\S]*?;/g) ?? []
    expect(policyBlocks).toHaveLength(7)
    for (const block of policyBlocks) {
      expect(block).toContain('auth.uid()')
      expect(block).toContain('to authenticated')
    }
  })

  it('INSERT и UPDATE используют WITH CHECK, а не только USING', () => {
    const insertPolicy = sqlWithoutComments.match(/create policy match_reports_insert_own[\s\S]*?;/)?.[0] ?? ''
    const updatePolicy = sqlWithoutComments.match(/create policy match_reports_update_own[\s\S]*?;/)?.[0] ?? ''
    expect(insertPolicy).toContain('with check (auth.uid() = user_id)')
    expect(updatePolicy).toContain('using (auth.uid() = user_id)')
    expect(updatePolicy).toContain('with check (auth.uid() = user_id)')
  })

  it('нет политик с USING (true) и доступа для роли anon', () => {
    expect(sqlWithoutComments).not.toMatch(/using\s*\(\s*true\s*\)/i)
    expect(sqlWithoutComments).not.toContain('to anon')
    expect(sqlWithoutComments).toContain('revoke all on table public.profiles from anon')
    expect(sqlWithoutComments).toContain('revoke all on table public.match_reports from anon')
  })

  it('права выданы только роли authenticated', () => {
    expect(sqlWithoutComments).toContain('grant select, insert, update on table public.profiles to authenticated')
    expect(sqlWithoutComments).toContain(
      'grant select, insert, update, delete on table public.match_reports to authenticated',
    )
  })
})

describe('миграция Task 10: триггеры и безопасность', () => {
  it('триггер updated_at не позволяет сменить владельца отчёта', () => {
    expect(sqlWithoutComments).toContain('new.user_id is distinct from old.user_id')
    expect(sqlWithoutComments).toContain('before update on public.match_reports')
  })

  it('триггер создания профиля минимально привилегирован', () => {
    expect(sqlWithoutComments).toContain('security definer')
    expect(sqlWithoutComments).toContain("set search_path = ''")
    expect(sqlWithoutComments).toContain('on conflict (id) do nothing')
    expect(sqlWithoutComments).toContain(
      'revoke all on function public.handle_new_user() from public, anon, authenticated',
    )
  })

  it('в миграции нет секретов и опасных операций', () => {
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
    expect(sql).not.toContain('sb_secret_')
    expect(sql).not.toMatch(/postgres(ql)?:\/\/[^\s]*:[^\s]*@/i)
    expect(sqlWithoutComments.toLowerCase()).not.toContain('drop table')
    expect(sqlWithoutComments.toLowerCase()).not.toContain('truncate')
  })
})

describe('миграция Task 10: backfill профилей существующих пользователей', () => {
  it('содержит идемпотентный backfill из auth.users', () => {
    expect(sqlWithoutComments).toContain(backfillStatement)
    expect(sqlWithoutComments).toContain('on conflict (id) do nothing')
    expect(sqlWithoutComments).not.toContain('do update')
  })

  it('backfill выполняется после создания profiles и после триггера регистрации', () => {
    const tableIndex = sqlWithoutComments.indexOf('create table public.profiles')
    const triggerIndex = sqlWithoutComments.indexOf('create trigger on_auth_user_created')
    const backfillIndex = sqlWithoutComments.indexOf(backfillStatement)
    expect(tableIndex).toBeGreaterThan(-1)
    expect(triggerIndex).toBeGreaterThan(-1)
    expect(backfillIndex).toBeGreaterThan(tableIndex)
    expect(backfillIndex).toBeGreaterThan(triggerIndex)
  })

  it('backfill копирует только id и не перезаписывает данные профилей', () => {
    expect(backfillStatement).not.toContain('nickname')
    expect(backfillStatement).not.toContain('update')
    expect(sqlWithoutComments).not.toMatch(/update public\.profiles/i)
    expect(sqlWithoutComments).not.toMatch(/delete from public\.profiles/i)
    expect(sqlWithoutComments).not.toMatch(/on conflict \(id\) do update/i)
  })

  it('backfill не создаёт строк в match_reports', () => {
    expect(sqlStatementsOnly).not.toMatch(/insert\s+into\s+public\.match_reports/i)
  })
})

describe('read-only скрипт аудита схемы', () => {
  it('безопасно проверяет наличие supabase_migrations.schema_migrations', () => {
    expect(auditSql).toContain("to_regclass('supabase_migrations.schema_migrations')")
    expect(auditWithoutComments).toContain(
      "if to_regclass('supabase_migrations.schema_migrations') is null then",
    )
  })

  it('обращается к отсутствующей таблице только через динамический запрос', () => {
    // Обращение к supabase_migrations.schema_migrations допустимо лишь внутри строки,
    // передаваемой в execute: вне литерала (после его удаления) прямых запросов нет.
    expect(auditSql).toContain('from supabase_migrations.schema_migrations')
    expect(auditStatementsOnly).not.toContain('from supabase_migrations.schema_migrations')
  })

  it('остаётся строго read-only: нет DML/DDL-операторов', () => {
    expect(auditStatementsOnly).not.toMatch(
      /\b(insert|update|delete|create|drop|alter|truncate|grant|revoke|merge|copy|call|vacuum|analyze|refresh)\b/i,
    )
  })

  it('читает только системные каталоги и целевые таблицы', () => {
    expect(auditWithoutComments).toContain('information_schema.tables')
    expect(auditWithoutComments).toContain('information_schema.columns')
    expect(auditWithoutComments).toContain('pg_constraint')
    expect(auditWithoutComments).toContain('pg_indexes')
    expect(auditWithoutComments).toContain('pg_policies')
  })
})

describe('скрипт живой проверки RLS (rls_live_check.mjs)', () => {
  it('использует только обычные пользовательские сессии, без service-role', () => {
    expect(rlsCheckScript).toContain('signInWithPassword')
    expect(rlsCheckScript).toContain('VITE_SUPABASE_PUBLISHABLE_KEY')
    // Упоминания service_role в пояснениях допустимы, а использование — нет.
    expect(rlsCheckScript).not.toMatch(/SERVICE_ROLE|sb_secret_|eyJ[A-Za-z0-9_-]{10,}/)
    expect(rlsCheckScript).not.toMatch(/auth\.admin/)
  })

  it('не печатает значения паролей и токенов', () => {
    expect(rlsCheckScript).not.toMatch(
      /console\.(log|error)\([^)]*(access_token|refresh_token|process\.env\.[A-Z0-9_]*PASSWORD)/,
    )
    expect(rlsCheckScript).not.toMatch(/console\.(log|error)\([^)]*\.password/i)
  })

  it('удаляет тестовые строки только при явном флаге --cleanup', () => {
    expect(rlsCheckScript).toContain("process.argv.includes('--cleanup')")
    const cleanupStart = rlsCheckScript.indexOf('async function cleanupTestRows')
    const mainStart = rlsCheckScript.indexOf('async function main()')
    expect(cleanupStart).toBeGreaterThan(-1)
    expect(mainStart).toBeGreaterThan(cleanupStart)
    const cleanupBody = rlsCheckScript.slice(cleanupStart, mainStart)
    const guardIndex = cleanupBody.indexOf('if (!cleanup)')
    const returnIndex = cleanupBody.indexOf('return')
    const deleteIndex = cleanupBody.indexOf('.delete(')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(returnIndex).toBeGreaterThan(guardIndex)
    expect(deleteIndex).toBeGreaterThan(returnIndex)
    // Удаление тестовых строк по match_id возможно только внутри функции очистки.
    const beforeCleanup = rlsCheckScript.split('async function cleanupTestRows')[0]
    expect(beforeCleanup).not.toMatch(/\.delete\(\)\.eq\('match_id'/)
  })

  it('использует изолированный match_id и не создаёт «готовых» отчётов', () => {
    expect(rlsCheckScript).toContain("const TEST_MATCH_ID = '9999999999'")
    expect(rlsCheckScript).toMatch(
      /insert\(\{ user_id: userId, match_id: matchId, status: 'pending', source: 'OpenDota' \}\)/,
    )
  })

  it('покрывает все кейсы плана проверки (1–16, 18) и помечает кейс 17 как ручной', () => {
    for (const caseId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18]) {
      expect(rlsCheckScript).toMatch(new RegExp(`record\\(\\s*${caseId},`))
    }
    expect(rlsCheckScript).toMatch(/skip\(\s*17,/)
    expect(rlsCheckScript).toMatch(/record\(\s*'10b',/)
  })
})