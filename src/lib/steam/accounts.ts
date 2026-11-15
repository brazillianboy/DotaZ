/**
 * Привязка проверенной Steam-личности к пользователю Supabase (Task 20A).
 *
 * Ключевой принцип: **личность выдаёт только проверенный SteamID64**, а
 * `auth.users.id` никогда не вычисляется из ника, email или SteamID.
 *
 * Модуль не знает про сеть и про Supabase SDK: он работает через узкий
 * интерфейс `SteamAccountsGateway`. Благодаря этому логика привязки и
 * сохранения UUID проверяется тестами на in-memory реализации, а тонкая
 * обвязка над Supabase Admin остаётся в Edge Function.
 */

import { parseSteamId64 } from './steamId.ts'

export interface SteamIdentity {
  steamId64: string
  userId: string
  personaName: string | null
  avatarUrl: string | null
  profileUrl: string | null
  verifiedAt: string
}

/** Результат попытки привязки; коды стабильны и используются в UI. */
export type LinkFailureReason =
  | 'steam_already_linked'
  | 'user_already_linked'
  | 'invalid_steam_id'
  | 'identity_conflict'

export type LinkResult =
  | { ok: true; identity: SteamIdentity }
  | { ok: false; reason: LinkFailureReason }

/**
 * Минимальный контракт хранилища. Реализация в Edge Function использует
 * Supabase Admin API и `service_role` — исключительно на сервере.
 */
export interface SteamAccountsGateway {
  findBySteamId(steamId64: string): Promise<SteamIdentity | null>
  findByUserId(userId: string): Promise<SteamIdentity | null>
  /** Создаёт нового пользователя приложения; возвращает его UUID. */
  createUser(steamId64: string, profile: Omit<SteamIdentity, 'steamId64' | 'userId' | 'verifiedAt'>): Promise<string>
  saveIdentity(identity: SteamIdentity): Promise<void>
  /** Выпускает одноразовый Supabase-токен для существующего пользователя. */
  issueSessionToken(userId: string): Promise<string | null>
}

export interface SteamProfileData {
  personaName: string | null
  avatarUrl: string | null
  profileUrl: string | null
}

/**
 * Возвращает пользователя для уже привязанного Steam-аккаунта.
 * `null` означает «такого пользователя ещё нет» — вызывающий решает, создавать ли.
 */
export async function findLinkedUser(
  gateway: SteamAccountsGateway,
  steamId64: string,
): Promise<string | null> {
  const id = parseSteamId64(steamId64)
  if (id === null) {
    return null
  }
  const identity = await gateway.findBySteamId(id)
  return identity === null ? null : identity.userId
}

/**
 * Создаёт нового пользователя для впервые вошедшего Steam-аккаунта.
 * Повторный вызов для того же SteamID вернёт уже существующего пользователя,
 * поэтому дубликаты не возникают.
 */
export async function resolveOrCreateSteamUser(
  gateway: SteamAccountsGateway,
  steamId64: string,
  profile: SteamProfileData,
  now: Date = new Date(),
): Promise<{ userId: string; created: boolean } | null> {
  const id = parseSteamId64(steamId64)
  if (id === null) {
    return null
  }
  const existing = await gateway.findBySteamId(id)
  if (existing !== null) {
    return { userId: existing.userId, created: false }
  }
  const userId = await gateway.createUser(id, profile)
  await gateway.saveIdentity({
    steamId64: id,
    userId,
    personaName: profile.personaName,
    avatarUrl: profile.avatarUrl,
    profileUrl: profile.profileUrl,
    verifiedAt: now.toISOString(),
  })
  return { userId, created: true }
}

/**
 * Привязывает Steam к **существующему** пользователю (миграция legacy-аккаунта).
 *
 * Гарантии:
 * - SteamID64 уже принадлежит другому пользователю → отказ, никакого переноса;
 * - у пользователя уже есть другая привязка → отказ, без перезаписи;
 * - UUID пользователя не меняется, отчёты и история остаются на месте.
 */
export async function linkSteamToExistingUser(
  gateway: SteamAccountsGateway,
  input: { steamId64: string; userId: string; profile: SteamProfileData; now?: Date },
): Promise<LinkResult> {
  const steamId64 = parseSteamId64(input.steamId64)
  if (steamId64 === null) {
    return { ok: false, reason: 'invalid_steam_id' }
  }
  if (typeof input.userId !== 'string' || input.userId.length === 0) {
    return { ok: false, reason: 'identity_conflict' }
  }

  const bySteam = await gateway.findBySteamId(steamId64)
  if (bySteam !== null) {
    return {
      ok: false,
      reason: bySteam.userId === input.userId ? 'identity_conflict' : 'steam_already_linked',
    }
  }

  const byUser = await gateway.findByUserId(input.userId)
  if (byUser !== null) {
    return { ok: false, reason: 'user_already_linked' }
  }

  const identity: SteamIdentity = {
    steamId64,
    userId: input.userId,
    personaName: input.profile.personaName,
    avatarUrl: input.profile.avatarUrl,
    profileUrl: input.profile.profileUrl,
    verifiedAt: (input.now ?? new Date()).toISOString(),
  }
  await gateway.saveIdentity(identity)
  return { ok: true, identity }
}

/**
 * Решение о «восстановленном» пользователе (Task 20A.4).
 *
 * Служебный адрес `steam+<steamid64>@users.dotaz.invalid` детерминирован, поэтому
 * совпадение email **не является** доказательством владения: адрес мог быть
 * зарегистрирован раньше другим способом. Принимаем восстановленного пользователя
 * только если в его `app_metadata.steam_id64` записан тот же SteamID64, который
 * подтвердил Steam.
 *
 * Любая неопределённость (нет метаданных, другой Steam, не строка) — отказ.
 */
export function acceptRecoveredUser(
  appMetadata: unknown,
  expectedSteamId64: string,
): boolean {
  const expected = parseSteamId64(expectedSteamId64)
  if (expected === null) {
    return false
  }
  if (typeof appMetadata !== 'object' || appMetadata === null) {
    return false
  }
  const stored = (appMetadata as { steam_id64?: unknown }).steam_id64
  return typeof stored === 'string' && stored === expected
}

/** Домен по умолчанию для служебных адресов Steam-пользователей (RFC 2606). */
export const DEFAULT_STEAM_EMAIL_DOMAIN = 'users.dotaz.invalid'

const EMAIL_DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/

/**
 * Нормализует домен служебных адресов из конфигурации.
 *
 * Домен настраивается, потому что Supabase может отклонить адрес с кодом
 * `email_address_invalid`. Владелец должен указать домен, который принимает его
 * проект; значение по умолчанию — зарезервированный `.invalid`.
 */
export function normalizeEmailDomain(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null
  }
  const value = raw.trim().toLowerCase()
  if (value.length === 0 || value.length > 190 || !EMAIL_DOMAIN_PATTERN.test(value)) {
    return null
  }
  return value
}

/**
 * Строит служебный адрес Steam-пользователя: `steam+<steamid64>@<domain>`.
 *
 * Адрес **не является** доказательством личности: он детерминирован и служит
 * только техническим логином. Привязка подтверждается исключительно метаданными
 * `app_metadata.steam_id64` (см. `acceptRecoveredUser`).
 */
export function buildSteamIdentityEmail(
  steamId64: string,
  domain: string = DEFAULT_STEAM_EMAIL_DOMAIN,
): string | null {
  const id = parseSteamId64(steamId64)
  const normalized = normalizeEmailDomain(domain)
  if (id === null || normalized === null) {
    return null
  }
  return `steam+${id}@${normalized}`
}

/**
 * Распознаёт ошибку «пользователь уже существует».
 *
 * Критично для восстановления: по документации установленного SDK
 * `generateLink` **сам создаёт** пользователя для типа `magiclink`. Поэтому
 * вызывать его можно только когда пользователь действительно уже есть — иначе
 * появится «осиротевший» аккаунт без метаданных Steam. Любой другой код ошибки
 * восстановление запрещает (fail closed).
 */
export function isExistingUserError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const code = (error as { code?: unknown }).code
  return code === 'email_exists' || code === 'user_already_exists'
}

/** Отклонён ли адрес самим Supabase (повод сменить домен в конфигурации). */
export function isInvalidEmailError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  return (error as { code?: unknown }).code === 'email_address_invalid'
}

/**
 * Выпускает Supabase-совместимую сессию для пользователя.
 * Возвращает одноразовый токен, который клиент обменивает на реальную сессию
 * штатным `auth.verifyOtp`. Произвольные JWT не создаются.
 */
export async function issueSession(
  gateway: SteamAccountsGateway,
  userId: string,
): Promise<string | null> {
  if (typeof userId !== 'string' || userId.length === 0) {
    return null
  }
  const token = await gateway.issueSessionToken(userId)
  return typeof token === 'string' && token.length > 0 ? token : null
}
