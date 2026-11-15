// DotaZ — Task 20A: серверная часть авторизации через Steam (усиленная версия).
//
// НЕ задеплоена. Реализует:
//   GET  /steam-auth/login        — старт входа через Steam (OpenID 2.0)
//   GET  /steam-auth/callback     — проверка ответа Steam, выпуск кода обмена
//   POST /steam-auth/exchange     — обмен кода на Supabase-токен (токен в теле)
//   POST /steam-auth/link/start   — старт привязки Steam к текущему аккаунту
//
// Безопасность:
//   * nonce потребляется атомарно в PostgreSQL (не в памяти инстанса);
//   * в URL передаётся только непрозрачный одноразовый код, не токен Supabase;
//   * код привязан к браузеру HttpOnly-cookie и требует совпадения Origin;
//   * service_role и Steam Web API key живут только в секретах функции.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

import {
  type SteamAccountsGateway,
  type SteamIdentity,
  acceptRecoveredUser,
  buildSteamIdentityEmail,
  isExistingUserError,
  isInvalidEmailError,
} from '../../../src/lib/steam/accounts.ts'
import { handleSteamCallback, redeemSteamExchange } from '../../../src/lib/steam/handler.ts'
import { buildSteamLoginUrl } from '../../../src/lib/steam/openid.ts'
import { parsePlayerSummary, profileWithoutMetadata } from '../../../src/lib/steam/profile.ts'
import {
  buildAppRedirectUrl,
  createOAuthState,
  sanitizeInternalPath,
} from '../../../src/lib/steam/redirect.ts'
import type { ExchangeStore, NonceStore } from '../../../src/lib/steam/stores.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? ''
const STATE_SECRET = Deno.env.get('STEAM_STATE_SECRET') ?? ''
/**
 * Домен служебных адресов Steam-пользователей. Настраивается, потому что
 * Supabase может отклонить адрес (`email_address_invalid`).
 */
const STEAM_IDENTITY_EMAIL_DOMAIN =
  Deno.env.get('STEAM_IDENTITY_EMAIL_DOMAIN') ?? 'users.dotaz.invalid'
const APP_ORIGIN = (Deno.env.get('APP_ORIGIN') ?? '').replace(/\/$/, '')
const PUBLIC_FUNCTIONS_URL = (
  Deno.env.get('PUBLIC_FUNCTIONS_URL') ?? `${SUPABASE_URL}/functions/v1`
).replace(/\/$/, '')

const CALLBACK_PATH = '/steam-auth/callback'
const STATE_COOKIE = 'dotaz_steam_state'
const STATE_TTL_SECONDS = 600

let adminClient: SupabaseClient | null = null

/**
 * Ленивое создание Supabase Admin-клиента (service_role).
 *
 * Клиент создаётся только после того, как обработчик убедился в наличии
 * обязательной конфигурации через `missingConfig()`. При энергичной
 * инициализации на уровне модуля `createClient` бросил бы исключение ещё до
 * регистрации HTTP-обработчика (`supabaseUrl is required` / `supabaseKey is
 * required`), и функция упала бы при старте вместо контролируемого 503.
 */
function getAdmin(): SupabaseClient {
  if (adminClient === null) {
    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

function functionsBase(): string {
  return PUBLIC_FUNCTIONS_URL
}

function callbackUrl(state: string): string {
  return `${functionsBase()}/steam-auth/callback?state=${encodeURIComponent(state)}`
}

/**
 * Realm для Steam OpenID 2.0 — origin **callback'а**, то есть домен функции.
 *
 * Нельзя использовать APP_ORIGIN приложения: OpenID 2.0 требует, чтобы
 * `openid.return_to` находился под `openid.realm`. Callback обслуживает Edge
 * Function, поэтому realm обязан совпадать с её origin, иначе Steam отклонит
 * запрос, а наша собственная проверка вернёт `invalid_configuration`.
 * APP_ORIGIN остаётся origin'ом приложения: CORS, проверка `Origin` и редирект
 * пользователя после обмена.
 */
function steamRealm(): string {
  try {
    return new URL(callbackUrl('realm-check')).origin
  } catch {
    return ''
  }
}

// --- Ответы ----------------------------------------------------------------

function corsHeaders(): Record<string, string> {
  // Разрешаем только собственный origin приложения.
  return {
    'Access-Control-Allow-Origin': APP_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(),
    },
  })
}

function redirect(location: string, cookie?: string): Response {
  const headers: Record<string, string> = {
    Location: location,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  }
  if (cookie !== undefined) {
    headers['Set-Cookie'] = cookie
  }
  return new Response(null, { status: 302, headers })
}

// --- Подпись значений (HMAC-SHA256, base64url) ------------------------------

async function hmac(value: string, secret: string): Promise<string> {
  if (secret.length < 32) {
    throw new Error('Секрет подписи слишком короткий')
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// --- Подписанный state (CSRF + привязка к браузеру) -------------------------

interface StatePayload {
  state: string
  next: string
  linkUserId: string | null
  /** SHA-256 (hex) от PKCE-секрета приложения. Привязывает обмен к браузеру. */
  challenge: string
}

async function encodeState(payload: StatePayload): Promise<string> {
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${body}.${await hmac(body, STATE_SECRET)}`
}

async function decodeState(raw: string | undefined): Promise<StatePayload | null> {
  if (typeof raw !== 'string' || !raw.includes('.')) {
    return null
  }
  const [body, signature] = raw.split('.')
  if (body.length === 0 || signature === undefined) {
    return null
  }
  if (!timingSafeEqual(signature, await hmac(body, STATE_SECRET))) {
    return null
  }
  try {
    const padded = body.replace(/-/g, '+').replace(/_/g, '/')
    const parsed = JSON.parse(atob(padded)) as StatePayload
    return typeof parsed.state === 'string' ? parsed : null
  } catch {
    return null
  }
}

function readCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get('Cookie') ?? ''
  return raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

function secureCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

// --- Хранилища на PostgreSQL -----------------------------------------------

const nonceStore: NonceStore = {
  async consume({ nonce, issuedAt, expiresAt }) {
    const { data, error } = await getAdmin().rpc('steam_consume_nonce', {
      p_nonce: nonce,
      p_issued_at: new Date(issuedAt).toISOString(),
      p_expires_at: new Date(expiresAt).toISOString(),
    })
    if (error !== null) {
      // Сбой БД — отказ, а не обход защиты от replay.
      return 'unavailable'
    }
    return data === true ? 'consumed' : 'replay'
  },
}

const exchangeStore: ExchangeStore = {
  async create({ codeHash, codeChallenge, userId, steamId64, ttlSeconds }) {
    const { data, error } = await getAdmin().rpc('steam_create_exchange', {
      p_code_hash: codeHash,
      p_code_challenge: codeChallenge,
      p_user_id: userId,
      p_steam_id64: steamId64,
      p_ttl_seconds: ttlSeconds,
    })
    return error === null && data === true
  },
  async redeem(codeHash, challenge) {
    const { data, error } = await getAdmin().rpc('steam_redeem_exchange', {
      p_code_hash: codeHash,
      p_code_challenge: challenge,
    })
    if (error !== null || !Array.isArray(data) || data.length === 0) {
      return null
    }
    const row = data[0] as { user_id?: unknown; steam_id64?: unknown }
    if (typeof row.user_id !== 'string' || typeof row.steam_id64 !== 'string') {
      return null
    }
    return { userId: row.user_id, steamId64: row.steam_id64 }
  },
}


// --- Шлюз над Supabase Admin ----------------------------------------------

async function readIdentity(userId: string): Promise<SteamIdentity | null> {
  const { data, error } = await getAdmin()
    .from('steam_identities')
    .select('steam_id64, user_id, persona_name, avatar_url, profile_url, verified_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error !== null || data === null) {
    return null
  }
  return {
    steamId64: data.steam_id64 as string,
    userId: data.user_id as string,
    personaName: (data.persona_name as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
    profileUrl: (data.profile_url as string | null) ?? null,
    verifiedAt: data.verified_at as string,
  }
}

const gateway: SteamAccountsGateway = {
  async findBySteamId(steamId64) {
    const { data, error } = await getAdmin()
      .from('steam_identities')
      .select('user_id')
      .eq('steam_id64', steamId64)
      .maybeSingle()
    if (error !== null || data === null) {
      return null
    }
    const identity = await readIdentity(data.user_id as string)
    return identity
  },

  async findByUserId(userId) {
    return readIdentity(userId)
  },

  /**
   * Идемпотентное создание пользователя.
   *
   * Если предыдущая попытка успела создать auth-пользователя, но не успела
   * записать привязку (сбой между сервисами), повторный вход не должен падать
   * навсегда. В этом случае `createUser` вернёт ошибку «email уже занят», и мы
   * восстанавливаем существующего пользователя через `generateLink`.
   *
   * ВАЖНО: восстановленный пользователь принимается **только** если в его
   * `app_metadata.steam_id64` записан тот же SteamID64, который подтвердил Steam.
   * Совпадение email доказательством владения не считается: адрес детерминирован,
   * и без проверки метаданных возможен захват чужого аккаунта.
   *
   * Атомарности между Supabase Auth и PostgreSQL нет: это явный, повторяемый
   * путь восстановления, а не транзакция.
   */
  async createUser(steamId64) {
    const email = buildSteamIdentityEmail(steamId64, STEAM_IDENTITY_EMAIL_DOMAIN)
    if (email === null) {
      throw new Error('Некорректный домен служебных адресов Steam-пользователей')
    }

    const { data, error } = await getAdmin().auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { steam_id64: steamId64, auth_provider: 'steam' },
    })
    if (error === null && data.user !== null) {
      return data.user.id
    }

    if (isInvalidEmailError(error)) {
      // Supabase отклонил адрес: нужен домен, который принимает этот проект.
      throw new Error(
        'Supabase отклонил служебный адрес Steam-пользователя (email_address_invalid): задайте STEAM_IDENTITY_EMAIL_DOMAIN',
      )
    }

    // Восстановление допустимо ТОЛЬКО когда пользователь уже существует.
    // По документации SDK `generateLink` для `magiclink` создаёт пользователя,
    // поэтому вызов при любой другой ошибке породил бы аккаунт без метаданных.
    if (!isExistingUserError(error)) {
      throw new Error('Не удалось создать пользователя для Steam-аккаунта')
    }

    const recovery = await getAdmin().auth.admin.generateLink({ type: 'magiclink', email })
    const recovered = recovery.data?.user
    if (recovery.error !== null || recovered === null || typeof recovered.id !== 'string') {
      throw new Error('Не удалось восстановить пользователя для Steam-аккаунта')
    }

    if (!acceptRecoveredUser(recovered.app_metadata, steamId64)) {
      // Чужой, «пустой» или противоречивый аккаунт с тем же адресом — отказ:
      // ни привязки, ни сессии. Совпадение email владением не считается.
      throw new Error('Восстановленный пользователь не подтверждает этот SteamID64')
    }
    return recovered.id
  },

  async saveIdentity(identity: SteamIdentity) {
    const { error } = await getAdmin().from('steam_identities').insert({
      user_id: identity.userId,
      steam_id64: identity.steamId64,
      persona_name: identity.personaName,
      avatar_url: identity.avatarUrl,
      profile_url: identity.profileUrl,
      verified_at: identity.verifiedAt,
      profile_synced_at: new Date().toISOString(),
    })
    if (error !== null) {
      throw new Error('Не удалось сохранить Steam-привязку')
    }
  },

  async issueSessionToken(userId) {
    // Поддерживаемый путь: одноразовый email-токен Supabase, который клиент
    // обменивает на настоящую сессию через auth.verifyOtp.
    const { data: userData, error: userError } = await getAdmin().auth.admin.getUserById(userId)
    if (userError !== null || userData.user?.email == null) {
      return null
    }
    const { data, error } = await getAdmin().auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
    })
    if (error !== null || data.properties?.hashed_token == null) {
      return null
    }
    return data.properties.hashed_token
  },
}


// --- Публичный профиль Steam (необязательные метаданные) --------------------

async function loadSteamProfile(steamId64: string) {
  if (STEAM_API_KEY.length === 0) {
    return profileWithoutMetadata(steamId64)
  }
  try {
    const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/')
    url.searchParams.set('key', STEAM_API_KEY)
    url.searchParams.set('steamids', steamId64)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) {
      return profileWithoutMetadata(steamId64)
    }
    return parsePlayerSummary(await response.json(), steamId64) ?? profileWithoutMetadata(steamId64)
  } catch {
    // Метаданные необязательны: вход от них не зависит.
    return profileWithoutMetadata(steamId64)
  }
}

// --- Простое ограничение частоты (best effort) -----------------------------

const rateBuckets = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 20

/**
 * Ограничение частоты в памяти инстанса. Это защита от простого перебора, а не
 * распределённый лимитер: строгие лимиты задаются настройками платформы.
 */
function allowRequest(key: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (bucket === undefined || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  bucket.count += 1
  return bucket.count <= RATE_LIMIT
}

function clientKey(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('cf-connecting-ip') ??
    'unknown'
  )
}

// --- Проверка конфигурации -------------------------------------------------

function missingConfig(): string[] {
  const missing: string[] = []
  if (SUPABASE_URL.length === 0) missing.push('SUPABASE_URL')
  if (SERVICE_ROLE_KEY.length === 0) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (STATE_SECRET.length < 32) missing.push('STEAM_STATE_SECRET')
  if (APP_ORIGIN.length === 0) missing.push('APP_ORIGIN')
  return missing
}

// --- GET /steam-auth/login -------------------------------------------------

async function handleLogin(request: Request): Promise<Response> {
  const missing = missingConfig()
  if (missing.length > 0) {
    return json({ error: 'not_configured', missing }, 503)
  }
  if (!allowRequest(`login:${clientKey(request)}`)) {
    return json({ error: 'rate_limited' }, 429)
  }

  const url = new URL(request.url)
  const next = sanitizeInternalPath(url.searchParams.get('next'), '/')
  const challenge = url.searchParams.get('challenge') ?? ''
  if (!/^[0-9a-f]{64}$/.test(challenge)) {
    // Без PKCE-challenge код обмена нечем привязать к браузеру.
    return json({ error: 'invalid_challenge' }, 400)
  }
  const state = createOAuthState()
  const cookie = await encodeState({ state, next, linkUserId: null, challenge })

  // Привязка возможна только через POST /link/start с проверенной сессией.
  if (url.searchParams.get('link') === '1') {
    return json({ error: 'use_link_start' }, 400)
  }

  const steamUrl = buildSteamLoginUrl({
    returnTo: callbackUrl(state),
    realm: steamRealm(),
    state,
  })
  if (steamUrl === null) {
    return json({ error: 'invalid_configuration' }, 500)
  }
  return redirect(steamUrl, secureCookie(STATE_COOKIE, cookie, STATE_TTL_SECONDS))
}

// --- POST /steam-auth/link/start -------------------------------------------

async function handleLinkStart(request: Request): Promise<Response> {
  const missing = missingConfig()
  if (missing.length > 0) {
    return json({ error: 'not_configured', missing }, 503)
  }
  if (request.headers.get('Origin') !== APP_ORIGIN) {
    return json({ error: 'origin_mismatch' }, 403)
  }
  if (!allowRequest(`link:${clientKey(request)}`)) {
    return json({ error: 'rate_limited' }, 429)
  }

  const authorization = request.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) {
    return json({ error: 'invalid_authorization' }, 401)
  }
  const { data, error } = await getAdmin().auth.getUser(authorization.slice('Bearer '.length))
  if (error !== null || data.user === null) {
    return json({ error: 'invalid_session' }, 401)
  }

  const url = new URL(request.url)
  const next = sanitizeInternalPath(url.searchParams.get('next'), '/profile')
  const challenge = url.searchParams.get('challenge') ?? ''
  if (!/^[0-9a-f]{64}$/.test(challenge)) {
    return json({ error: 'invalid_challenge' }, 400)
  }
  const state = createOAuthState()
  const cookie = await encodeState({ state, next, linkUserId: data.user.id, challenge })
  const steamUrl = buildSteamLoginUrl({
    returnTo: callbackUrl(state),
    realm: steamRealm(),
    state,
  })
  if (steamUrl === null) {
    return json({ error: 'invalid_configuration' }, 500)
  }

  const response = json({ url: steamUrl })
  response.headers.append('Set-Cookie', secureCookie(STATE_COOKIE, cookie, STATE_TTL_SECONDS))
  return response
}


// --- GET /steam-auth/callback ---------------------------------------------

async function handleCallback(request: Request): Promise<Response> {
  const missing = missingConfig()
  if (missing.length > 0) {
    return json({ error: 'not_configured', missing }, 503)
  }

  const url = new URL(request.url)
  const payload = await decodeState(readCookie(request, STATE_COOKIE))

  if (payload === null) {
    const target = buildAppRedirectUrl(APP_ORIGIN, '/login?steam_error=state_mismatch')
    return redirect(target ?? APP_ORIGIN, secureCookie(STATE_COOKIE, '', 0))
  }

  const outcome = await handleSteamCallback({
    search: url.search,
    expectedReturnTo: callbackUrl(payload.state),
    expectedRealm: steamRealm(),
    expectedState: payload.state,
    fetchImpl: fetch,
    nonceStore,
    exchangeStore,
    codeChallenge: payload.challenge,
    gateway,
    profile: null,
    linkUserId: payload.linkUserId,
    returnPath: payload.next,
  })

  if (!outcome.ok) {
    const failure = buildAppRedirectUrl(
      APP_ORIGIN,
      `/login?steam_error=${encodeURIComponent(outcome.reason)}`,
    )
    return redirect(failure ?? APP_ORIGIN, secureCookie(STATE_COOKIE, '', 0))
  }

  // Метаданные профиля догружаются отдельно: вход от них не зависит.
  const profile = await loadSteamProfile(outcome.steamId64)
  if (profile.personaName !== null || profile.avatarUrl !== null) {
    await getAdmin()
      .from('steam_identities')
      .update({
        persona_name: profile.personaName,
        avatar_url: profile.avatarUrl,
        profile_url: profile.profileUrl,
        profile_synced_at: new Date().toISOString(),
      })
      .eq('steam_id64', outcome.steamId64)
  }

  // В URL уходит только непрозрачный код. Привязка к браузеру — PKCE:
  // приложение пришлёт секрет в теле обмена, сервер сверит его хэш.
  const target = buildAppRedirectUrl(
    APP_ORIGIN,
    `/auth/steam/callback?code=${encodeURIComponent(outcome.exchangeCode)}&next=${encodeURIComponent(outcome.nextPath)}`,
  )
  const response = redirect(target ?? APP_ORIGIN, secureCookie(STATE_COOKIE, '', 0))
  return response
}

// --- POST /steam-auth/exchange --------------------------------------------

async function handleExchange(request: Request): Promise<Response> {
  const missing = missingConfig()
  if (missing.length > 0) {
    return json({ error: 'not_configured', missing }, 503)
  }
  if (request.headers.get('Origin') !== APP_ORIGIN) {
    return json({ error: 'origin_mismatch' }, 403)
  }
  if (!allowRequest(`exchange:${clientKey(request)}`)) {
    return json({ error: 'rate_limited' }, 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_request' }, 400)
  }
  const payload = body as { code?: unknown; verifier?: unknown } | null
  const code = payload?.code
  const verifier = payload?.verifier
  if (typeof code !== 'string' || code.length === 0 || code.length > 128) {
    return json({ error: 'invalid_request' }, 400)
  }
  if (typeof verifier !== 'string' || verifier.length === 0 || verifier.length > 128) {
    return json({ error: 'invalid_request' }, 400)
  }

  // PKCE-привязка: без верного секрета из этого браузера код не принимается.
  // Cookie не используется, поэтому схема работает и при разных сайтах.
  const outcome = await redeemSteamExchange({ code, verifier, exchangeStore, gateway })
  return outcome.ok
    ? json({ token_hash: outcome.tokenHash, type: 'email' })
    : json({ error: outcome.reason }, 400)
}

// --- Точка входа -----------------------------------------------------------

Deno.serve(async (request: Request): Promise<Response> => {
  const url = new URL(request.url)
  const path = url.pathname

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': APP_ORIGIN,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
      },
    })
  }

  if (path.endsWith('/steam-auth/login') && request.method === 'GET') {
    return handleLogin(request)
  }
  if (path.endsWith('/steam-auth/link/start') && request.method === 'POST') {
    return handleLinkStart(request)
  }
  if (path.endsWith('/steam-auth/callback') && request.method === 'GET') {
    return handleCallback(request)
  }
  if (path.endsWith('/steam-auth/exchange') && request.method === 'POST') {
    return handleExchange(request)
  }
  return json({ error: 'not_found' }, 404)
})
