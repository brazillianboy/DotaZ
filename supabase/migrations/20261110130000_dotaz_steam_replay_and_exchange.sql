-- DotaZ — Task 20A (усиление): постоянная защита от replay и одноразовые коды обмена.
--
-- Файл НЕ применён. Миграция аддитивная: существующие таблицы public.profiles и
-- public.match_reports, их владельцы и политики RLS не изменяются.
--
-- Почему это нужно:
--   1) хранилище использованных OpenID nonce в памяти инстанса Edge Function не
--      защищает от повторного предъявления ответа Steam между инстансами;
--   2) передача Supabase token_hash в URL оставляет его в истории браузера и в
--      логах. Вместо этого браузер получает непрозрачный одноразовый код,
--      который обменивается на токен POST-запросом (токен в URL не попадает).
--
-- Обе таблицы доступны только роли service_role: политик для anon/authenticated
-- намеренно нет, поэтому клиент не может ни читать, ни писать эти данные.

-- --- 1. Использованные OpenID nonce -----------------------------------------

create table public.steam_openid_nonces (
  nonce text primary key,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now(),
  constraint steam_openid_nonces_nonce_length check (char_length(nonce) between 8 and 256)
);

comment on table public.steam_openid_nonces is
  'Потреблённые openid.response_nonce. Первичный ключ гарантирует однократность независимо от числа инстансов Edge Function.';
comment on column public.steam_openid_nonces.expires_at is
  'После этого момента запись можно удалять: сам ответ Steam уже недействителен по времени.';

alter table public.steam_openid_nonces enable row level security;
-- Политик нет: доступ только через service_role и security definer функции ниже.

create index steam_openid_nonces_expires_at_idx on public.steam_openid_nonces (expires_at);

-- --- 2. Одноразовые коды обмена ---------------------------------------------

create table public.steam_login_exchanges (
  code_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  steam_id64 text not null,
  -- PKCE-привязка к браузеру: SHA-256 от секрета, который остаётся в приложении.
  -- Cookie не используется, поэтому схема работает и когда приложение и функция
  -- находятся на разных сайтах (SameSite её бы заблокировал).
  code_challenge text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint steam_login_exchanges_hash_length check (char_length(code_hash) = 64),
  constraint steam_login_exchanges_challenge_length check (code_challenge ~ '^[0-9a-f]{64}$'),
  constraint steam_login_exchanges_steam_id64_format check (steam_id64 ~ '^[0-9]{17}$'),
  constraint steam_login_exchanges_expiry_order check (expires_at > created_at)
);

comment on table public.steam_login_exchanges is
  'Короткоживущие одноразовые коды обмена. Хранятся только SHA-256 от кода и от PKCE-секрета; сам код, секрет и Supabase-токен в базе не остаются.';

alter table public.steam_login_exchanges enable row level security;
-- Политик нет: клиент не может создать или прочитать обмен.

create index steam_login_exchanges_expires_at_idx on public.steam_login_exchanges (expires_at);
create index steam_login_exchanges_user_id_idx on public.steam_login_exchanges (user_id);

-- --- 3. Атомарные операции (только service_role) -----------------------------
--
-- Обе функции меняют состояние одной SQL-командой, поэтому конкурентные вызовы
-- не могут «выиграть» дважды: INSERT ... ON CONFLICT DO NOTHING и UPDATE ...
-- WHERE consumed_at IS NULL выполняются под блокировкой строки.

-- Потребляет nonce. Возвращает true только первому вызову.
-- Просроченные записи удаляются здесь же (ограниченная порция, чтобы не держать
-- долгую транзакцию): сам ответ Steam к этому моменту уже недействителен.
create or replace function public.steam_consume_nonce(
  p_nonce text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted boolean;
begin
  if p_nonce is null or char_length(p_nonce) < 8 or char_length(p_nonce) > 256 then
    return false;
  end if;
  if p_issued_at is null or p_expires_at is null or p_expires_at <= p_issued_at then
    return false;
  end if;

  delete from public.steam_openid_nonces
   where expires_at < now() - interval '1 hour';

  insert into public.steam_openid_nonces (nonce, issued_at, expires_at)
  values (p_nonce, p_issued_at, p_expires_at)
  on conflict (nonce) do nothing;

  inserted := found;
  return inserted;
exception
  when others then
    -- Любая ошибка БД трактуется как отказ: без защиты от replay вход запрещён.
    return false;
end;
$$;

-- Создаёт одноразовый код обмена. Хранится только хэш.
create or replace function public.steam_create_exchange(
  p_code_hash text,
  p_code_challenge text,
  p_user_id uuid,
  p_steam_id64 text,
  p_ttl_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_code_hash is null or char_length(p_code_hash) <> 64 then
    return false;
  end if;
  if p_code_challenge is null or p_code_challenge !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  if p_user_id is null or p_steam_id64 is null or p_steam_id64 !~ '^[0-9]{17}$' then
    return false;
  end if;
  if p_ttl_seconds is null or p_ttl_seconds <= 0 or p_ttl_seconds > 300 then
    return false;
  end if;

  delete from public.steam_login_exchanges
   where expires_at < now() - interval '15 minutes';

  insert into public.steam_login_exchanges (code_hash, code_challenge, user_id, steam_id64, expires_at)
  values (
    p_code_hash,
    p_code_challenge,
    p_user_id,
    p_steam_id64,
    now() + make_interval(secs => p_ttl_seconds)
  );
  return true;
exception
  when unique_violation then
    return false;
  when others then
    return false;
end;
$$;

-- Атомарно потребляет код и возвращает пользователя, для которого он выпущен.
-- Повторный или конкурентный вызов вернёт пустой результат. PKCE-challenge
-- сверяется в том же UPDATE: без верного секрета код не потребляется вовсе.
create or replace function public.steam_redeem_exchange(
  p_code_hash text,
  p_code_challenge text
)
returns table (user_id uuid, steam_id64 text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_code_hash is null or char_length(p_code_hash) <> 64 then
    return;
  end if;
  if p_code_challenge is null or p_code_challenge !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  return query
    update public.steam_login_exchanges e
       set consumed_at = now()
     where e.code_hash = p_code_hash
       and e.code_challenge = p_code_challenge
       and e.consumed_at is null
       and e.expires_at > now()
    returning e.user_id, e.steam_id64;
end;
$$;

revoke all on function public.steam_consume_nonce(text, timestamptz, timestamptz) from public;
revoke all on function public.steam_create_exchange(text, text, uuid, text, integer) from public;
revoke all on function public.steam_redeem_exchange(text, text) from public;

revoke all on function public.steam_consume_nonce(text, timestamptz, timestamptz) from anon;
revoke all on function public.steam_create_exchange(text, text, uuid, text, integer) from anon;
revoke all on function public.steam_redeem_exchange(text, text) from anon;

revoke all on function public.steam_consume_nonce(text, timestamptz, timestamptz) from authenticated;
revoke all on function public.steam_create_exchange(text, text, uuid, text, integer) from authenticated;
revoke all on function public.steam_redeem_exchange(text, text) from authenticated;

grant execute on function public.steam_consume_nonce(text, timestamptz, timestamptz) to service_role;
grant execute on function public.steam_create_exchange(text, text, uuid, text, integer) to service_role;
grant execute on function public.steam_redeem_exchange(text, text) to service_role;

