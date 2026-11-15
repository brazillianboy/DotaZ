-- DotaZ — Task 20A: связь проверенной Steam-личности с пользователем приложения.
--
-- Файл НЕ применён автоматически. Владелец применяет его вручную после проверки
-- (см. README.md, раздел про Task 20A). Миграция аддитивная:
--   * не изменяет существующие таблицы public.profiles и public.match_reports;
--   * не меняет существующие политики RLS;
--   * не удаляет и не переписывает ни одной строки;
--   * не затрагивает auth.users.
--
-- Гарантии целостности:
--   * user_id — первичный ключ: один пользователь приложения имеет не более
--     одной Steam-привязки (вторую привязку отклонит база, а не только приложение);
--   * steam_id64 уникален: один Steam-аккаунт не может быть привязан к двум
--     разным пользователям UUID;
--   * steam_id64 хранится строкой (17 цифр): числовой тип потерял бы точность.
-- Запись возможна только через service_role (Edge Function), потому что политик
-- INSERT/UPDATE/DELETE для роли authenticated не создаётся.

create table public.steam_identities (
  user_id uuid primary key references auth.users (id) on delete cascade,
  steam_id64 text not null,
  persona_name text,
  avatar_url text,
  profile_url text,
  verified_at timestamptz not null,
  profile_synced_at timestamptz,
  created_at timestamptz not null default now(),
  constraint steam_identities_steam_id64_key unique (steam_id64),
  constraint steam_identities_steam_id64_format check (steam_id64 ~ '^[0-9]{17}$'),
  constraint steam_identities_persona_name_length check (
    persona_name is null or char_length(persona_name) between 1 and 64
  ),
  constraint steam_identities_avatar_url_https check (
    avatar_url is null or avatar_url like 'https://%'
  )
);

comment on table public.steam_identities is
  'Проверенные Steam-личности: одна строка на пользователя и одна на SteamID64. Пишет только сервер (service_role).';
comment on column public.steam_identities.steam_id64 is
  'SteamID64 строкой (17 цифр). Никогда не хранится числом: JavaScript теряет точность.';
comment on column public.steam_identities.verified_at is
  'Момент успешной проверки OpenID 2.0 подписи Steam.';

alter table public.steam_identities enable row level security;

-- Владелец видит только свою Steam-привязку. Публичного чтения чужих строк нет.
create policy steam_identities_select_own on public.steam_identities
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Намеренно НЕ создаются политики INSERT/UPDATE/DELETE:
-- ни один клиент не может создать или подменить проверенную Steam-личность.
-- Анонимная и authenticated-роли при попытке записи получат отказ RLS.

-- Дополнительная защита на уровне БД: даже при ошибке в серверном коде
-- первичный ключ и уникальность не позволят переписать владельца или
-- привязать один Steam к двум пользователям.

create or replace function public.steam_identities_block_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'steam_identities.user_id нельзя изменить: владелец привязки неизменяем';
  end if;
  if new.steam_id64 is distinct from old.steam_id64 then
    raise exception 'steam_identities.steam_id64 нельзя изменить: требуется новая проверка Steam';
  end if;
  return new;
end;
$$;

create trigger steam_identities_no_owner_change
  before update on public.steam_identities
  for each row
  execute function public.steam_identities_block_owner_change();

-- Вспомогательная функция для серверной Edge Function: проверяет, что Steam
-- ещё не занят другим пользователем. Выполняется с правами вызывающего и
-- возвращает только булево значение, не раскрывая чужих строк.
create or replace function public.steam_identity_is_taken(p_steam_id64 text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.steam_identities where steam_id64 = p_steam_id64
  );
$$;

revoke all on function public.steam_identity_is_taken(text) from public;
revoke all on function public.steam_identity_is_taken(text) from anon;
revoke all on function public.steam_identity_is_taken(text) from authenticated;
grant execute on function public.steam_identity_is_taken(text) to service_role;
