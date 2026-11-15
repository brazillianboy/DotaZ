import { describe, expect, it } from 'vitest'
import * as ts from 'typescript'

import edgeFunction from '../../../supabase/functions/steam-auth/index.ts?raw'
import steamConfig from '../../../supabase/config.toml?raw'
import exchangeMigration from '../../../supabase/migrations/20261110130000_dotaz_steam_replay_and_exchange.sql?raw'
import identitiesMigration from '../../../supabase/migrations/20261110120000_dotaz_steam_identities.sql?raw'
import { acceptRecoveredUser, buildSteamIdentityEmail, isExistingUserError, isInvalidEmailError, normalizeEmailDomain } from './accounts'
import { handleSteamCallback, redeemSteamExchange } from './handler'
import { OPENID_NS_2_0, STEAM_OPENID_ENDPOINT } from './openid'
import {
  type ExchangeRecord,
  type ExchangeStore,
  computeCodeChallenge,
  createCodeVerifier,
  createExchangeCode,
  hashExchangeCode,
  isValidCodeVerifier,
} from './stores'

const STEAM_ID = '76561198000000001'
const CLAIMED = `https://steamcommunity.com/openid/id/${STEAM_ID}`
const APP_ORIGIN = 'https://dotaz.example'
const STATE = 'STATE_VALUE_1234567890abcdefghij'
const CALLBACK = `${APP_ORIGIN}/api/steam/callback?state=${STATE}`
const NOW = Date.parse('2026-11-10T12:00:00Z')

function memoryExchangeStore() {
  const rows = new Map<string, { record: ExchangeRecord; challenge: string; expires: number }>()
  const store: ExchangeStore = {
    async create({ codeHash, codeChallenge, userId, steamId64, ttlSeconds }) {
      if (rows.has(codeHash)) {
        return false
      }
      rows.set(codeHash, {
        record: { userId, steamId64 },
        challenge: codeChallenge,
        expires: Date.now() + ttlSeconds * 1000,
      })
      return true
    },
    async redeem(codeHash, challenge) {
      const entry = rows.get(codeHash)
      if (entry === undefined) {
        return null
      }
      if (entry.challenge !== challenge || entry.expires <= Date.now()) {
        return null
      }
      rows.delete(codeHash)
      return entry.record
    },
  }
  return { store, rows }
}

function gateway() {
  const users = new Map<string, string>()
  users.set('uuid-user', 'steam+76561198000000001@users.dotaz.invalid')
  return {
    users,
    async findBySteamId() {
      return null
    },
    async findByUserId() {
      return null
    },
    async createUser() {
      return 'uuid-user'
    },
    async saveIdentity() {},
    async issueSessionToken(userId: string) {
      return users.has(userId) ? `token_for_${userId}` : null
    },
  }
}

function openIdSearch(nonce = '2026-11-10T11:59:30Zabcdef'): string {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS_2_0,
    'openid.mode': 'id_res',
    'openid.op_endpoint': STEAM_OPENID_ENDPOINT,
    'openid.claimed_id': CLAIMED,
    'openid.identity': CLAIMED,
    'openid.return_to': CALLBACK,
    'openid.response_nonce': nonce,
    'openid.assoc_handle': '1',
    'openid.signed': 'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.sig': 'sig',
    state: STATE,
  })
  return `?${params.toString()}`
}

function nonceStore() {
  const used = new Set<string>()
  return {
    used,
    async consume({ nonce }: { nonce: string }) {
      if (used.has(nonce)) {
        return 'replay' as const
      }
      used.add(nonce)
      return 'consumed' as const
    },
  }
}

describe('PKCE-привязка обмена к браузеру (вместо cookie)', () => {
  async function issueExchange() {
    const exchange = memoryExchangeStore()
    const verifier = createCodeVerifier()
    const challenge = await computeCodeChallenge(verifier)
    const fake = gateway()
    const result = await handleSteamCallback({
      search: openIdSearch(),
      expectedReturnTo: CALLBACK,
      expectedRealm: APP_ORIGIN,
      expectedState: STATE,
      fetchImpl: (async () => new Response('is_valid:true')) as unknown as typeof fetch,
      nonceStore: nonceStore(),
      exchangeStore: exchange.store,
      codeChallenge: challenge,
      gateway: fake,
      now: NOW,
    })
    return { exchange, verifier, result, fake }
  }

  it('верный секрет гасит код и выдаёт токен', async () => {
    const { exchange, verifier, result, fake } = await issueExchange()
    if (!result.ok) {
      throw new Error('callback должен быть успешным')
    }
    const redeemed = await redeemSteamExchange({
      code: result.exchangeCode,
      verifier,
      exchangeStore: exchange.store,
      gateway: fake,
    })
    expect(redeemed.ok).toBe(true)
  })

  it('чужой секрет отклоняется и НЕ расходует код', async () => {
    const { exchange, verifier, result, fake } = await issueExchange()
    if (!result.ok) {
      throw new Error('callback должен быть успешным')
    }
    const attackerVerifier = createCodeVerifier()
    const stolen = await redeemSteamExchange({
      code: result.exchangeCode,
      verifier: attackerVerifier,
      exchangeStore: exchange.store,
      gateway: fake,
    })
    expect(stolen).toEqual({ ok: false, reason: 'exchange_invalid' })

    // Настоящий браузер после неудачной попытки атакующего всё ещё может войти.
    const legitimate = await redeemSteamExchange({
      code: result.exchangeCode,
      verifier,
      exchangeStore: exchange.store,
      gateway: fake,
    })
    expect(legitimate.ok).toBe(true)
  })

  it('секрет неверного формата отклоняется до обращения к хранилищу', async () => {
    const exchange = memoryExchangeStore()
    const result = await redeemSteamExchange({
      code: createExchangeCode(),
      verifier: 'short',
      exchangeStore: exchange.store,
      gateway: gateway(),
    })
    expect(result).toEqual({ ok: false, reason: 'exchange_invalid' })
  })

  it('формат секрета: 43 символа base64url', () => {
    const verifier = createCodeVerifier()
    expect(verifier).toHaveLength(43)
    expect(isValidCodeVerifier(verifier)).toBe(true)
    expect(isValidCodeVerifier('a'.repeat(42))).toBe(false)
    expect(isValidCodeVerifier('a'.repeat(44))).toBe(false)
    expect(isValidCodeVerifier('не-base64url-значение-секрета-обмена-браузера')).toBe(false)
  })

  it('без PKCE-challenge сервер не выпускает код обмена', async () => {
    const exchange = memoryExchangeStore()
    const result = await handleSteamCallback({
      search: openIdSearch(),
      expectedReturnTo: CALLBACK,
      expectedRealm: APP_ORIGIN,
      expectedState: STATE,
      fetchImpl: (async () => new Response('is_valid:true')) as unknown as typeof fetch,
      nonceStore: nonceStore(),
      exchangeStore: exchange.store,
      codeChallenge: '',
      gateway: gateway(),
      now: NOW,
    })
    expect(result).toEqual({ ok: false, reason: 'exchange_failed' })
    expect(exchange.rows.size).toBe(0)
  })

  it('challenge хранится в базе, секрет — нет', async () => {
    const { exchange, verifier, result } = await issueExchange()
    if (!result.ok) {
      throw new Error('callback должен быть успешным')
    }
    const stored = [...exchange.rows.values()][0]
    expect(stored.challenge).toBe(await computeCodeChallenge(verifier))
    expect(JSON.stringify([...exchange.rows.entries()])).not.toContain(verifier)
  })

  it('хэш кода не совпадает с самим кодом', async () => {
    const code = createExchangeCode()
    expect(await hashExchangeCode(code)).not.toBe(code)
  })
})


describe('восстановление «осиротевшего» аккаунта', () => {
  it('принимает только совпадающий SteamID64 в метаданных', () => {
    expect(acceptRecoveredUser({ steam_id64: STEAM_ID }, STEAM_ID)).toBe(true)
  })

  it('отвергает совпадение email без метаданных', () => {
    expect(acceptRecoveredUser({}, STEAM_ID)).toBe(false)
    expect(acceptRecoveredUser(null, STEAM_ID)).toBe(false)
    expect(acceptRecoveredUser(undefined, STEAM_ID)).toBe(false)
    expect(acceptRecoveredUser({ email: 'steam+76561198000000001@users.dotaz.invalid' }, STEAM_ID)).toBe(
      false,
    )
  })

  it('отвергает чужой SteamID64 в метаданных', () => {
    expect(acceptRecoveredUser({ steam_id64: '76561198000000002' }, STEAM_ID)).toBe(false)
  })

  it('отвергает нестроковые и невалидные значения', () => {
    expect(acceptRecoveredUser({ steam_id64: 76561198000000001 }, STEAM_ID)).toBe(false)
    expect(acceptRecoveredUser({ steam_id64: '' }, STEAM_ID)).toBe(false)
    expect(acceptRecoveredUser({ steam_id64: 'not-a-steamid' }, STEAM_ID)).toBe(false)
    // Ожидаемый идентификатор тоже должен быть корректным.
    expect(acceptRecoveredUser({ steam_id64: '123' }, '123')).toBe(false)
  })
})

describe('конфигурация Edge Function: публичные и защищённые маршруты', () => {
  it('JWT-проверка отключена на уровне шлюза для steam-auth', () => {
    expect(steamConfig).toContain('[functions.steam-auth]')
    expect(steamConfig).toContain('verify_jwt = false')
  })

  it('привязка требует действующей сессии через admin.auth.getUser', () => {
    expect(edgeFunction).toContain('getAdmin().auth.getUser(')
    expect(edgeFunction).toContain("authorization.startsWith('Bearer ')")
    expect(edgeFunction).toContain("json({ error: 'invalid_authorization' }, 401)")
  })

  it('публичные маршруты обрабатываются и без JWT', () => {
    for (const route of ['/steam-auth/login', '/steam-auth/callback', '/steam-auth/exchange']) {
      expect(edgeFunction).toContain(route)
    }
  })

  it('проверка Origin обязательна для POST-обменов', () => {
    const originChecks = edgeFunction.match(/get\('Origin'\) !== APP_ORIGIN/g) ?? []
    expect(originChecks.length).toBeGreaterThanOrEqual(2)
  })

  it('CORS не использует подстановочный origin', () => {
    expect(edgeFunction).not.toContain("'Access-Control-Allow-Origin': '*'")
  })

  it('секреты не попадают в ответы', () => {
    expect(edgeFunction).not.toContain('SERVICE_ROLE_KEY:')
    expect(edgeFunction).not.toContain('STEAM_STATE_SECRET:')
  })
})

describe('структура Edge Function: область видимости и ленивый клиент', () => {
  function topLevelFunctionRanges(source: string): Array<{ name: string; start: number; end: number }> {
    const sf = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const ranges: Array<{ name: string; start: number; end: number }> = []
    function visit(node: ts.Node) {
      if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
        ranges.push({ name: node.name.text, start: node.getStart(sf), end: node.end })
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    return ranges
  }

  function servePosition(source: string): number {
    const sf = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    let position = -1
    function visit(node: ts.Node) {
      if (position !== -1) {
        return
      }
      if (ts.isPropertyAccessExpression(node) && node.getText(sf) === 'Deno.serve') {
        position = node.getStart(sf)
        return
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    return position
  }

  it('Deno.serve зарегистрирован на верхнем уровне модуля', () => {
    const serveAt = servePosition(edgeFunction)
    expect(serveAt).toBeGreaterThan(-1)
    const enclosing = topLevelFunctionRanges(edgeFunction).filter((f) => f.start < serveAt && serveAt < f.end)
    expect(enclosing).toEqual([])
  })

  it('timingSafeEqual закрыта и не поглощает остальной модуль', () => {
    const fn = topLevelFunctionRanges(edgeFunction).find((f) => f.name === 'timingSafeEqual')
    expect(fn).toBeDefined()
    expect(fn!.end).toBeLessThan(servePosition(edgeFunction))
  })

  it('клиент создаётся лениво, а не при загрузке модуля', () => {
    expect(edgeFunction).not.toContain('const admin = createClient')
    expect(edgeFunction).toContain('function getAdmin()')
    expect(edgeFunction).toContain('adminClient = createClient')
  })

  it('отсутствие конфигурации возвращает контролируемый 503 без раскрытия значений', () => {
    expect(edgeFunction).toContain("json({ error: 'not_configured', missing }, 503)")
  })
})

describe('топология: cookie больше не нужны для обмена', () => {
  it('привязка кода к браузеру идёт через PKCE, а не через Set-Cookie', () => {
    expect(edgeFunction).not.toContain('dotaz_steam_bind')
    expect(edgeFunction).toContain('codeChallenge')
  })

  it('токен не попадает в URL: редирект содержит только code', () => {
    expect(edgeFunction).toContain('?code=')
    expect(edgeFunction).not.toContain('token_hash=${')
    expect(edgeFunction).not.toContain('?token_hash=')
  })

  it('клиент отправляет код и секрет в теле POST', () => {
    // Проверка контракта: exchange принимает code и verifier.
    expect(edgeFunction).toContain('payload?.verifier')
  })
})

describe('SQL-миграции: PKCE и привилегии', () => {
  it('в таблице обменов есть code_challenge с ограничением формата', () => {
    expect(exchangeMigration).toContain('code_challenge text not null')
    expect(exchangeMigration).toContain("code_challenge ~ '^[0-9a-f]{64}$'")
  })

  it('списание кода сверяет challenge в том же запросе', () => {
    expect(exchangeMigration).toContain('and e.code_challenge = p_code_challenge')
    expect(exchangeMigration).toContain('and e.consumed_at is null')
    expect(exchangeMigration).toContain('and e.expires_at > now()')
  })

  it('функции объявлены security definer с явным search_path', () => {
    const definers = exchangeMigration.match(/security definer/g) ?? []
    expect(definers.length).toBeGreaterThanOrEqual(3)
    const searchPaths = exchangeMigration.match(/set search_path = public/g) ?? []
    expect(searchPaths.length).toBeGreaterThanOrEqual(3)
  })

  it('исполнение разрешено только service_role', () => {
    expect(exchangeMigration).toContain('to service_role')
    expect(exchangeMigration).toContain('from anon')
    expect(exchangeMigration).toContain('from authenticated')
  })

  it('таблицы закрыты RLS без политик записи', () => {
    expect(exchangeMigration).toContain('enable row level security')
    expect(exchangeMigration).not.toContain('create policy')
  })

  it('привязки: уникальность SteamID64 и owner-only чтение', () => {
    expect(identitiesMigration).toContain('constraint steam_identities_steam_id64_key unique (steam_id64)')
    expect(identitiesMigration).toContain('create policy steam_identities_select_own')
    expect(identitiesMigration).not.toContain('for insert')
    expect(identitiesMigration).not.toContain('for update')
  })

  it('каскад объявлен только на удаление владельца', () => {
    expect(identitiesMigration).toContain('on delete cascade')
    expect(exchangeMigration).toContain('on delete cascade')
  })
})

describe('служебный email Steam-пользователя', () => {
  it('строит адрес по умолчанию из проверенного SteamID64', () => {
    expect(buildSteamIdentityEmail(STEAM_ID)).toBe(
      'steam+76561198000000001@users.dotaz.invalid',
    )
  })

  it('позволяет сменить домен (Supabase может отклонить .invalid)', () => {
    expect(buildSteamIdentityEmail(STEAM_ID, 'steam.example.com')).toBe(
      'steam+76561198000000001@steam.example.com',
    )
    expect(normalizeEmailDomain('  Steam.Example.COM  ')).toBe('steam.example.com')
  })

  it('отвергает некорректный домен и некорректный SteamID64', () => {
    expect(normalizeEmailDomain('')).toBeNull()
    expect(normalizeEmailDomain('localhost')).toBeNull()
    expect(normalizeEmailDomain('bad domain.com')).toBeNull()
    expect(normalizeEmailDomain('-bad.com')).toBeNull()
    expect(normalizeEmailDomain(null)).toBeNull()
    expect(buildSteamIdentityEmail(STEAM_ID, 'localhost')).toBeNull()
    expect(buildSteamIdentityEmail('123', 'steam.example.com')).toBeNull()
  })

  it('адрес содержит полный SteamID64 без потери точности', () => {
    const email = buildSteamIdentityEmail('76561198000000001')
    expect(email).toContain('76561198000000001')
    expect(email).not.toContain('76561198000000000')
  })
})

describe('классификация ошибок Supabase Auth', () => {
  it('распознаёт только коды «пользователь уже существует»', () => {
    expect(isExistingUserError({ code: 'email_exists' })).toBe(true)
    expect(isExistingUserError({ code: 'user_already_exists' })).toBe(true)
  })

  it('не считает существующим пользователя при других ошибках', () => {
    expect(isExistingUserError({ code: 'validation_failed' })).toBe(false)
    expect(isExistingUserError({ code: 'email_address_invalid' })).toBe(false)
    expect(isExistingUserError({ status: 422 })).toBe(false)
    expect(isExistingUserError(new Error('network'))).toBe(false)
    expect(isExistingUserError(null)).toBe(false)
    expect(isExistingUserError(undefined)).toBe(false)
  })

  it('распознаёт отказ Supabase по адресу', () => {
    expect(isInvalidEmailError({ code: 'email_address_invalid' })).toBe(true)
    expect(isInvalidEmailError({ code: 'email_exists' })).toBe(false)
    expect(isInvalidEmailError(null)).toBe(false)
  })

  it('ключевой риск: generateLink создаёт пользователя, поэтому восстановление ограничено', () => {
    // Регрессия: если бы восстановление запускалось при любой ошибке createUser,
    // generateLink (тип magiclink) создал бы аккаунт без app_metadata.steam_id64.
    expect(isExistingUserError({ code: 'unexpected_failure' })).toBe(false)
    expect(isExistingUserError({ code: 'over_request_rate_limit' })).toBe(false)
  })
})


