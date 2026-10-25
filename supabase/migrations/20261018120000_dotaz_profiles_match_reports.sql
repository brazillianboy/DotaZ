-- ============================================================================
-- DotaZ — схема профилей и приватных отчётов о матчах (Task 10)
--
-- ВНИМАНИЕ: миграция подготовлена, но НЕ применена. Перед применением:
--   1) выполните read-only аудит: supabase/inspection/read_only_schema_audit.sql;
--   2) убедитесь, что таблиц public.profiles и public.match_reports нет либо их
--      определения совпадают с этой миграцией;
--   3) получите явное подтверждение владельца проекта на применение.
--
-- Аудит 2026-10-18 (read-only через PostgREST с публичным ключом): таблицы
-- public.profiles и public.match_reports в проекте отсутствуют (PGRST205),
-- приложение использовало только Supabase Auth — существующие данные не затрагиваются.
--
-- Аудит владельца в SQL Editor (read-only, supabase/inspection/read_only_schema_audit.sql):
--   • в схеме public нет ни одной таблицы;
--   • supabase_migrations.schema_migrations отсутствует — CLI-миграции не применялись;
--   • пользовательских триггеров на auth.users нет;
--   • функций public.handle_new_user() и public.match_reports_set_updated_at() нет;
--   • в auth.users зарегистрирован ровно один пользователь.
-- Вывод: конфликтов с существующей схемой нет. Единственный существующий пользователь
-- получит строку профиля через идемпотентный backfill (раздел 3.3), будущие регистрации —
-- через триггер on_auth_user_created (раздел 3.2).
--
-- Миграция сознательно НЕ использует CREATE TABLE IF NOT EXISTS: при наличии
-- несовместимых объектов выполнение прервётся, ничего не перезаписывая.
-- Миграция не создаёт ни одной строки в public.match_reports: отчёты заполняет только
-- Task 11 по фактическим данным, поэтому фиктивных «готовых» отчётов не появляется.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Профили пользователей
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Профили пользователей DotaZ. id совпадает с auth.users.id; одна строка на пользователя.';
comment on column public.profiles.nickname is
  'Необязательный отображаемый никнейм; персональные данные не собираются.';

alter table public.profiles enable row level security;

-- Права: доступ только аутентифицированным; анонимные не имеют привилегий.
revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Отчёты о матчах (приватные, принадлежат пользователю)
-- ---------------------------------------------------------------------------
create table public.match_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- match_id хранится строкой: ID OpenDota может превышать безопасный диапазон
  -- JavaScript-чисел, поэтому числовое представление теряло бы точность.
  match_id text not null,
  -- Состояния отчёта: pending — ожидает расчёта, ready — полный,
  -- partial — частичный (часть данных провайдера недоступна), error — ошибка расчёта.
  -- По умолчанию 'pending': строка без payload не должна выглядеть завершённым отчётом.
  status text not null default 'pending'
    constraint match_reports_status_check
    check (status in ('pending', 'ready', 'partial', 'error')),
  match_payload jsonb,
  analysis_payload jsonb,
  rules_version text,
  source text not null default 'OpenDota',
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_reports_user_match_unique unique (user_id, match_id),
  -- 'ready' означает полный отчёт: оба payload обязаны быть заполнены.
  -- Неполные данные оформляются статусом 'partial', а не 'ready' с NULL.
  constraint match_reports_ready_requires_payloads
    check (status <> 'ready' or (match_payload is not null and analysis_payload is not null))
);

comment on table public.match_reports is
  'Приватные отчёты о матчах: один отчёт на пару (user_id, match_id); доступ только владельцу через RLS.';
comment on column public.match_reports.match_payload is
  'Нормализованные данные матча и всех участников (NormalizedMatch из Task 6), JSONB.';
comment on column public.match_reports.analysis_payload is
  'Наблюдения, рекомендации и ограничения по всем участникам (Task 9), JSONB.';
comment on column public.match_reports.rules_version is
  'Версия правил анализа (например, 1.0.0) — сохраняется вместе с отчётом.';
comment on column public.match_reports.fetched_at is
  'Фактическое время получения данных от OpenDota; NULL, если время не зафиксировано.';

alter table public.match_reports enable row level security;

revoke all on table public.match_reports from anon;
grant select, insert, update, delete on table public.match_reports to authenticated;

-- Индекс для личной истории: отчёты пользователя, сначала свежие.
create index match_reports_user_created_idx
  on public.match_reports (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Триггеры
-- ---------------------------------------------------------------------------

-- 3.1 updated_at: обновляется при изменении строки.
-- Триггер не может использоваться для обхода проверки владельца: попытка
-- изменить user_id прерывается исключением (дополнительно к WITH CHECK политики).
create or replace function public.match_reports_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'match_reports.user_id нельзя изменить: владелец отчёта неизменяем';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists match_reports_set_updated_at on public.match_reports;
create trigger match_reports_set_updated_at
  before update on public.match_reports
  for each row
  execute function public.match_reports_set_updated_at();

-- 3.2 Профиль создаётся автоматически при регистрации пользователя.
-- Триггер минимально привилегированный: SECURITY DEFINER только для вставки
-- собственной строки профиля, функция недоступна для вызова из API.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 3.3 Backfill: профили для пользователей, зарегистрированных ДО применения миграции.
-- Аудит владельца подтвердил ровно одного такого пользователя в auth.users.
-- Идемпотентно: on conflict (id) do nothing — при повторном запуске ничего не меняется,
-- существующие профили не перезаписываются (нет ни UPDATE, ни DELETE), nickname остаётся
-- прежним, created_at не подменяется. Отчёты о матчах здесь не создаются: match_reports
-- остаётся пустой до Task 11.
insert into public.profiles (id)
select id
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Политики RLS: доступ только владельцу (auth.uid())
-- ---------------------------------------------------------------------------

-- profiles: чтение, создание и изменение своего профиля.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Удаление профиля продуктом не поддерживается: политика DELETE не создаётся,
-- поэтому удаление строки профиля через API запрещено.

-- match_reports: чтение, создание, изменение и удаление только своих отчётов.
drop policy if exists match_reports_select_own on public.match_reports;
create policy match_reports_select_own on public.match_reports
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists match_reports_insert_own on public.match_reports;
create policy match_reports_insert_own on public.match_reports
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists match_reports_update_own on public.match_reports;
create policy match_reports_update_own on public.match_reports
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists match_reports_delete_own on public.match_reports;
create policy match_reports_delete_own on public.match_reports
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Разграничение доступа
-- ---------------------------------------------------------------------------
-- Обычные аутентифицированные пользователи видят и изменяют только свои строки
-- (условия auth.uid() = ... в USING и WITH CHECK). Роль anon лишена привилегий.
-- Административный доступ (service_role, SQL Editor) обходит RLS по дизайну
-- Supabase и является служебным: его нельзя использовать в браузерном коде.
--
-- Идемпотентность: backfill (3.3), функции (`create or replace`) и политики
-- (`drop policy if exists`) безопасно перезапускаются. Сами таблицы создаются
-- намеренно без IF NOT EXISTS, поэтому повторный прогон файла целиком прервётся
-- на `create table` — это защита от конфликтов, а не ошибка.
--
-- Откат (при необходимости, только по решению владельца):
--   drop table if exists public.match_reports;
--   drop table if exists public.profiles;
--   drop function if exists public.handle_new_user();
--   drop function if exists public.match_reports_set_updated_at();
--   drop trigger if exists on_auth_user_created on auth.users;
-- Внимание: откат удалит данные отчётов и профилей (включая профиль, созданный
-- backfill для существующего пользователя) — выполнять только осознанно.