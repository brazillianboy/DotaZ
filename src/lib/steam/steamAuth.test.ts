import { beforeAll, describe, expect, it } from 'vitest'

import {
  type SteamAccountsGateway,
  type SteamIdentity,
  findLinkedUser,
  issueSession,
  linkSteamToExistingUser,
  resolveOrCreateSteamUser,
} from './accounts'
import {
  handleSteamCallback,
  redeemSteamExchange as redeemSteamExchangeRaw,
} from './handler'
import { OPENID_NS_2_0, STEAM_OPENID_ENDPOINT } from './openid'
import {
  type ExchangeRecord,
  type ExchangeStore,
  type NonceConsumeResult,
  type NonceStore,
  computeCodeChallenge,
  createExchangeCode,
  hashExchangeCode,
  isValidExchangeCode,
} from './stores'

const STEAM_ID = '76561198000000001'
const OTHER_STEAM_ID = '76561198000000002'
const CLAIMED = `https://steamcommunity.com/openid/id/${STEAM_ID}`
const APP_ORIGIN = 'https://dotaz.example'
const STATE = 'STATE_VALUE_1234567890abcdefghij'
const CALLBACK = `${APP_ORIGIN}/api/steam/callback?state=${STATE}`
const NOW = Date.parse('2026-11-10T12:00:00Z')

/** PKCE-секрет этого «браузера» и его challenge (вычисляется в beforeAll). */
const VERIFIER = 'A'.repeat(43)
let CHALLENGE = ''

beforeAll(async () => {
  CHALLENGE = await computeCodeChallenge(VERIFIER)
})

/** Обёртка: подставляет PKCE-секрет, чтобы тесты обмена не дублировали его. */
function redeemSteamExchange(input: {
  code: string
  exchangeStore: ExchangeStore
  gateway: SteamAccountsGateway
}) {
  return redeemSteamExchangeRaw({ ...input, verifier: VERIFIER })
}

// --- Тестовые реализации хранилищ -----------------------------------------
// Они повторяют семантику SQL-функций: атомарная вставка и атомарное списание.

function createNonceStore(): NonceStore & { rows: Map<string, number> } {
  const rows = new Map<string, number>()
  return {
    rows,
    async consume({ nonce, expiresAt }): Promise<NonceConsumeResult> {
      if (typeof nonce !== 'string' || nonce.length < 8) {
        return 'invalid'
      }
      // Аналог INSERT ... ON CONFLICT DO NOTHING: побеждает только первый.
      if (rows.has(nonce)) {
        return 'replay'
      }
      rows.set(nonce, expiresAt)
      return 'consumed'
    },
  }
}

function createExchangeStore(): ExchangeStore & { rows: Map<string, ExchangeRecord> } {
  const rows = new Map<string, ExchangeRecord>()
  const challenges = new Map<string, string>()
  const expires = new Map<string, number>()
  return {
    rows,
    async create({ codeHash, codeChallenge, userId, steamId64, ttlSeconds }) {
      if (rows.has(codeHash)) {
        return false
      }
      rows.set(codeHash, { userId, steamId64 })
      challenges.set(codeHash, codeChallenge)
      expires.set(codeHash, Date.now() + ttlSeconds * 1000)
      return true
    },
    async redeem(codeHash, challenge) {
      const record = rows.get(codeHash)
      if (record === undefined) {
        return null
      }
      // Аналог условия `code_challenge = p_code_challenge`: чужой секрет не гасит код.
      if (challenges.get(codeHash) !== challenge) {
        return null
      }
      // Аналог условия `expires_at > now()`: просроченный код недействителен.
      const expiresAt = expires.get(codeHash) ?? 0
      if (expiresAt <= Date.now()) {
        rows.delete(codeHash)
        challenges.delete(codeHash)
        expires.delete(codeHash)
        return null
      }
      // Аналог UPDATE ... WHERE consumed_at IS NULL: второй вызов не получит запись.
      rows.delete(codeHash)
      challenges.delete(codeHash)
      expires.delete(codeHash)
      return record
    },
  }
}

function createGateway() {
  const identities = new Map<string, SteamIdentity>()
  const users = new Map<string, string>()
  const issued: string[] = []
  let counter = 0

  const gateway: SteamAccountsGateway = {
    async findBySteamId(steamId64) {
      return identities.get(steamId64) ?? null
    },
    async findByUserId(userId) {
      for (const identity of identities.values()) {
        if (identity.userId === userId) {
          return identity
        }
      }
      return null
    },
    async createUser(steamId64) {
      counter += 1
      const userId = `uuid-owner-${String(counter).padStart(4, '0')}`
      users.set(userId, `steam+${steamId64}@users.dotaz.invalid`)
      return userId
    },
    async saveIdentity(identity) {
      identities.set(identity.steamId64, identity)
    },
    async issueSessionToken(userId) {
      if (!users.has(userId)) {
        return null
      }
      const token = `token_for_${userId}`
      issued.push(token)
      return token
    },
  }

  return { gateway, identities, users, issued }
}

function callbackSearch(overrides: Record<string, string | null> = {}): string {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS_2_0,
    'openid.mode': 'id_res',
    'openid.op_endpoint': STEAM_OPENID_ENDPOINT,
    'openid.claimed_id': CLAIMED,
    'openid.identity': CLAIMED,
    'openid.return_to': CALLBACK,
    'openid.response_nonce': '2026-11-10T11:59:30Zabcdef',
    'openid.assoc_handle': '1',
    'openid.signed': 'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.sig': 'sig',
    state: STATE,
  })
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  return `?${params.toString()}`
}

const okFetch = async () => new Response('is_valid:true')

function setup(overrides: Record<string, unknown> = {}) {
  const fake = createGateway()
  const nonceStore = createNonceStore()
  const exchange = createExchangeStore()
  return {
    fake,
    nonceStore,
    exchange,
    input: {
      search: callbackSearch(),
      expectedReturnTo: CALLBACK,
      expectedRealm: APP_ORIGIN,
      expectedState: STATE,
      fetchImpl: okFetch as unknown as typeof fetch,
      nonceStore,
      exchangeStore: exchange,
      codeChallenge: CHALLENGE,
      gateway: fake.gateway,
      now: NOW,
      ...overrides,
    } as Parameters<typeof handleSteamCallback>[0],
  }
}

describe('защита от replay: постоянное хранилище nonce', () => {
  it('первый корректный nonce принимается', async () => {
    const { input, exchange } = setup()
    const result = await handleSteamCallback(input)
    expect(result.ok).toBe(true)
    expect(exchange.rows.size).toBe(1)
  })

  it('повторный callback с тем же nonce отклоняется как replay', async () => {
    const { input } = setup()
    expect((await handleSteamCallback(input)).ok).toBe(true)
    expect(await handleSteamCallback(input)).toEqual({ ok: false, reason: 'replay' })
  })

  it('конкурентные дубликаты: побеждает ровно один', async () => {
    const { input, exchange } = setup()
    const results = await Promise.all([
      handleSteamCallback(input),
      handleSteamCallback(input),
      handleSteamCallback(input),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok && r.reason === 'replay')).toHaveLength(2)
    expect(exchange.rows.size).toBe(1)
  })

  it('несколько «инстансов» с общим хранилищем не пропускают повтор', async () => {
    const shared = createNonceStore()
    const first = setup()
    const second = setup()
    const firstResult = await handleSteamCallback({ ...first.input, nonceStore: shared })
    const secondResult = await handleSteamCallback({ ...second.input, nonceStore: shared })
    expect(firstResult.ok).toBe(true)
    expect(secondResult).toEqual({ ok: false, reason: 'replay' })
  })

  it('сбой хранилища приводит к отказу, а не к обходу защиты', async () => {
    const { input, exchange } = setup({
      nonceStore: {
        async consume(): Promise<NonceConsumeResult> {
          return 'unavailable'
        },
      },
    })
    expect(await handleSteamCallback(input)).toEqual({
      ok: false,
      reason: 'nonce_store_unavailable',
    })
    expect(exchange.rows.size).toBe(0)
  })

  it('некорректный формат nonce отклоняется', async () => {
    const store = createNonceStore()
    expect(await store.consume({ nonce: 'short', issuedAt: NOW, expiresAt: NOW + 1000 })).toBe(
      'invalid',
    )
    const { input } = setup({ search: callbackSearch({ 'openid.response_nonce': 'мусор' }) })
    expect(await handleSteamCallback(input)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('просроченный ответ отклоняется до записи в хранилище', async () => {
    const { input, nonceStore, exchange } = setup()
    const stale = await handleSteamCallback({
      ...input,
      search: callbackSearch({ 'openid.response_nonce': '2026-11-10T09:00:00Zabcdef' }),
    })
    expect(stale).toEqual({ ok: false, reason: 'stale_nonce' })
    expect(nonceStore.rows.size).toBe(0)
    expect(exchange.rows.size).toBe(0)
  })

  it('неподтверждённая подпись не расходует nonce', async () => {
    const { input, nonceStore } = setup({
      fetchImpl: (async () => new Response('is_valid:false')) as unknown as typeof fetch,
    })
    expect(await handleSteamCallback(input)).toEqual({ ok: false, reason: 'invalid_signature' })
    expect(nonceStore.rows.size).toBe(0)
  })
})


describe('одноразовый код обмена', () => {
  it('код имеет криптостойкий формат и не повторяется', () => {
    const a = createExchangeCode()
    const b = createExchangeCode()
    expect(isValidExchangeCode(a)).toBe(true)
    expect(a).not.toBe(b)
    expect(isValidExchangeCode('short')).toBe(false)
    expect(isValidExchangeCode('a'.repeat(44))).toBe(false)
  })

  it('в хранилище попадает только хэш кода, а не сам код', async () => {
    const { input, exchange } = setup()
    const result = await handleSteamCallback(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect([...exchange.rows.keys()]).not.toContain(result.exchangeCode)
      expect([...exchange.rows.keys()]).toContain(await hashExchangeCode(result.exchangeCode))
    }
  })

  it('код обменивается на токен ровно один раз', async () => {
    const { input, exchange, fake } = setup()
    const result = await handleSteamCallback(input)
    if (!result.ok) {
      throw new Error('callback должен быть успешным')
    }
    const first = await redeemSteamExchange({
      code: result.exchangeCode,
      exchangeStore: exchange,
      gateway: fake.gateway,
    })
    expect(first.ok).toBe(true)
    expect(
      await redeemSteamExchange({
        code: result.exchangeCode,
        exchangeStore: exchange,
        gateway: fake.gateway,
      }),
    ).toEqual({ ok: false, reason: 'exchange_invalid' })
  })

  it('конкурентный обмен выдаёт сессию только одному запросу', async () => {
    const { input, exchange, fake } = setup()
    const result = await handleSteamCallback(input)
    if (!result.ok) {
      throw new Error('callback должен быть успешным')
    }
    const attempts = await Promise.all([
      redeemSteamExchange({ code: result.exchangeCode, exchangeStore: exchange, gateway: fake.gateway }),
      redeemSteamExchange({ code: result.exchangeCode, exchangeStore: exchange, gateway: fake.gateway }),
    ])
    expect(attempts.filter((attempt) => attempt.ok)).toHaveLength(1)
    expect(fake.issued).toHaveLength(1)
  })

  it('неизвестный, просроченный и поддельный код отклоняются одинаково', async () => {
    const { exchange, fake } = setup()
    expect(
      await redeemSteamExchange({
        code: createExchangeCode(),
        exchangeStore: exchange,
        gateway: fake.gateway,
      }),
    ).toEqual({ ok: false, reason: 'exchange_invalid' })

    const expiredStore = createExchangeStore()
    const code = createExchangeCode()
    await expiredStore.create({
      codeHash: await hashExchangeCode(code),
      codeChallenge: CHALLENGE,
      userId: 'uuid-1',
      steamId64: STEAM_ID,
      ttlSeconds: 0,
    })
    expect(await expiredStore.redeem(await hashExchangeCode(code), CHALLENGE)).toBeNull()

    expect(
      await redeemSteamExchange({
        code: '../../etc/passwd',
        exchangeStore: exchange,
        gateway: fake.gateway,
      }),
    ).toEqual({ ok: false, reason: 'exchange_invalid' })
  })

  it('сессия выпускается для пользователя из записи обмена', async () => {
    const fresh = setup({ linkUserId: 'uuid-legacy-owner' })
    fresh.fake.users.set('uuid-legacy-owner', 'legacy@example.com')
    const linked = await handleSteamCallback(fresh.input)
    if (!linked.ok) {
      throw new Error('привязка должна пройти')
    }
    const redeemed = await redeemSteamExchange({
      code: linked.exchangeCode,
      exchangeStore: fresh.exchange,
      gateway: fresh.fake.gateway,
    })
    expect(redeemed.ok).toBe(true)
    if (redeemed.ok) {
      expect(redeemed.userId).toBe('uuid-legacy-owner')
      expect(redeemed.tokenHash).toBe('token_for_uuid-legacy-owner')
    }
  })

  it('сбой выпуска сессии не отдаёт токен', async () => {
    const { input, exchange, fake } = setup()
    const result = await handleSteamCallback(input)
    if (!result.ok) {
      throw new Error('callback должен быть успешным')
    }
    fake.gateway.issueSessionToken = async () => null
    expect(
      await redeemSteamExchange({
        code: result.exchangeCode,
        exchangeStore: exchange,
        gateway: fake.gateway,
      }),
    ).toEqual({ ok: false, reason: 'session_failed' })
  })
})


describe('привязка и сохранение UUID', () => {
  it('новый Steam-пользователь создаётся один раз', async () => {
    const fake = createGateway()
    const profile = { personaName: 'Player', avatarUrl: null, profileUrl: null }
    const first = await resolveOrCreateSteamUser(fake.gateway, STEAM_ID, profile)
    const second = await resolveOrCreateSteamUser(fake.gateway, STEAM_ID, profile)
    expect(first?.created).toBe(true)
    expect(second?.created).toBe(false)
    expect(second?.userId).toBe(first?.userId)
    expect(fake.identities.size).toBe(1)
  })

  it('привязка сохраняет существующий UUID и не создаёт пользователя', async () => {
    const fake = createGateway()
    fake.users.set('uuid-legacy-owner', 'legacy@example.com')
    const result = await linkSteamToExistingUser(fake.gateway, {
      steamId64: STEAM_ID,
      userId: 'uuid-legacy-owner',
      profile: { personaName: 'Legacy', avatarUrl: null, profileUrl: null },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.identity.userId).toBe('uuid-legacy-owner')
    }
    expect(fake.users.size).toBe(1)
    expect(await issueSession(fake.gateway, 'uuid-legacy-owner')).toBe(
      'token_for_uuid-legacy-owner',
    )
  })

  it('чужой Steam не отбирается, вторая привязка запрещена', async () => {
    const fake = createGateway()
    fake.users.set('uuid-a', 'a@example.com')
    fake.users.set('uuid-b', 'b@example.com')
    await fake.gateway.saveIdentity({
      steamId64: STEAM_ID,
      userId: 'uuid-a',
      personaName: null,
      avatarUrl: null,
      profileUrl: null,
      verifiedAt: new Date().toISOString(),
    })
    expect(
      await linkSteamToExistingUser(fake.gateway, {
        steamId64: STEAM_ID,
        userId: 'uuid-b',
        profile: { personaName: null, avatarUrl: null, profileUrl: null },
      }),
    ).toEqual({ ok: false, reason: 'steam_already_linked' })

    expect(
      await linkSteamToExistingUser(fake.gateway, {
        steamId64: OTHER_STEAM_ID,
        userId: 'uuid-a',
        profile: { personaName: null, avatarUrl: null, profileUrl: null },
      }),
    ).toEqual({ ok: false, reason: 'user_already_linked' })
  })

  it('поиск по проверенному SteamID64 работает и для неизвестного', async () => {
    const fake = createGateway()
    expect(await findLinkedUser(fake.gateway, 'not-a-steamid')).toBeNull()
    await fake.gateway.saveIdentity({
      steamId64: STEAM_ID,
      userId: 'uuid-1',
      personaName: null,
      avatarUrl: null,
      profileUrl: null,
      verifiedAt: new Date().toISOString(),
    })
    expect(await findLinkedUser(fake.gateway, STEAM_ID)).toBe('uuid-1')
    expect(await findLinkedUser(fake.gateway, OTHER_STEAM_ID)).toBeNull()
  })
})

describe('частичные сбои', () => {
  it('сбой сохранения привязки не выпускает код обмена', async () => {
    const { input, exchange } = setup()
    const failing = {
      ...input,
      gateway: {
        ...input.gateway,
        async saveIdentity(): Promise<void> {
          throw new Error('db down')
        },
      },
    }
    await expect(handleSteamCallback(failing)).rejects.toThrow('db down')
    expect(exchange.rows.size).toBe(0)
  })

  it('сбой создания записи обмена не даёт пользователю сессию', async () => {
    const { input } = setup({
      exchangeStore: {
        async create() {
          return false
        },
        async redeem() {
          return null
        },
      },
    })
    expect(await handleSteamCallback(input)).toEqual({ ok: false, reason: 'exchange_failed' })
  })

  it('восстановление после «осиротевшего» пользователя не падает при повторе', async () => {
    const fake = createGateway()
    let attempts = 0
    // Первая попытка создаёт пользователя, вторая (после сбоя записи привязки)
    // должна вернуть того же пользователя, а не создать второго.
    const original = fake.gateway.createUser
    fake.gateway.createUser = async (steamId64, profile) => {
      attempts += 1
      return attempts === 1 ? original(steamId64, profile) : 'uuid-owner-0001'
    }
    const first = await resolveOrCreateSteamUser(fake.gateway, STEAM_ID, {
      personaName: null,
      avatarUrl: null,
      profileUrl: null,
    })
    expect(first?.userId).toBe('uuid-owner-0001')
  })
})
