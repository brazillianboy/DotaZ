-- ============================================================================
-- DotaZ — read-only аудит фактической схемы Supabase (Task 10)
--
-- Назначение: получить достоверные метаданные существующей базы ПЕРЕД применением
-- миграции supabase/migrations/20261018120000_dotaz_profiles_match_reports.sql.
--
-- Скрипт содержит ТОЛЬКО SELECT-запросы и один DO-блок с RAISE NOTICE: он ничего
-- не изменяет и не удаляет. Выполнять в Supabase Dashboard → SQL Editor. Результаты
-- (включая вкладку Messages для пункта 9) можно передать ассистенту текстом — секретов
-- в них нет. Скрипт безопасен и тогда, когда таблиц ещё нет или нет схемы
-- supabase_migrations (все проверки существования выполняются через каталоги/to_regclass).
-- ============================================================================

-- 1. Таблицы публичной схемы
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2. Колонки целевых таблиц (если они уже существуют)
select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('profiles', 'match_reports')
order by table_name, ordinal_position;

-- 3. Ограничения (PK, FK, UNIQUE, CHECK)
select conrelid::regclass as table_name, conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
  and conrelid::regclass::text in ('profiles', 'match_reports')
order by table_name, conname;

-- 4. Индексы
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename in ('profiles', 'match_reports')
order by tablename, indexname;

-- 5. Включён ли RLS
select relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles', 'match_reports');

-- 6. Существующие политики
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('profiles', 'match_reports')
order by tablename, policyname;

-- 7. Триггеры на целевых таблицах и на auth.users
select event_object_schema as schema_name, event_object_table as table_name,
       trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where (event_object_schema = 'public' and event_object_table in ('profiles', 'match_reports'))
   or (event_object_schema = 'auth' and event_object_table = 'users')
order by table_name, trigger_name;

-- 8. Пользовательские функции, связанные с задачами (профиль/updated_at)
select n.nspname as schema_name, p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('handle_new_user', 'match_reports_set_updated_at')
order by p.proname;

-- 9. История миграций Supabase.
-- ВАЖНО: схема supabase_migrations может отсутствовать (если CLI-миграции не применялись) —
-- тогда прямой запрос к таблице упал бы с ошибкой. Сначала безопасно проверяем наличие
-- объекта через to_regclass (для отсутствующего объекта вернёт NULL, а не ошибку).
select to_regclass('supabase_migrations.schema_migrations') is not null as migrations_table_exists;

-- Если migrations_table_exists = true, история печатается в Messages (только чтение).
-- При отсутствии таблицы блок завершается без изменений в базе.
do $$
declare
  rec record;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'supabase_migrations.schema_migrations отсутствует: CLI-миграции не применялись.';
    return;
  end if;

  raise notice 'Применённые миграции (до 50 последних):';
  for rec in execute
    'select version, name, inserted_at from supabase_migrations.schema_migrations order by inserted_at desc limit 50'
  loop
    raise notice '  % | % | %', rec.version, rec.name, rec.inserted_at;
  end loop;
end
$$;

-- 10. Объём данных в целевых таблицах (оценка необходимости сохранения)
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles') as profiles_exists,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'match_reports') as match_reports_exists;

-- Если обе таблицы существуют, дополнительно (по одной строке за раз, только чтение):
-- select count(*) as profiles_rows from public.profiles;
-- select count(*) as match_reports_rows from public.match_reports;