import { describe, expect, it, vi } from 'vitest'

import {
  OPENID_NS_2_0,
  STEAM_OPENID_ENDPOINT,
  buildCheckAuthenticationBody,
  buildSteamLoginUrl,
  isCheckAuthenticationValid,
  parseNonceTimestamp,
  readOpenIdParams,
  sameReturnUrl,
  validateOpenIdResponse,
  verifySteamAssertion,
} from './openid'
import {
  STEAM_ID64_INDIVIDUAL_MAX,
  isSameSteamAccount,
  isSteamId64,
  parseSteamId64,
  steamIdFromAccountId,
  steamIdFromClaimedId,
  steamProfileUrl,
} from './steamId'

const APP_ORIGIN = 'https://dotaz.example'
const CALLBACK = `${APP_ORIGIN}/api/steam/callback?state=STATE_VALUE_1234567890abcdefghij`
const STATE = 'STATE_VALUE_1234567890abcdefghij'
const STEAM_ID = '76561198000000001'
const CLAIMED = `https://steamcommunity.com/openid/id/${STEAM_ID}`
const NOW = Date.parse('2026-11-10T12:00:00Z')

function validParams(overrides: Record<string, string | null> = {}): Map<string, string> {
  const base: Record<string, string> = {
    'openid.ns': OPENID_NS_2_0,
    'openid.mode': 'id_res',
    'openid.op_endpoint': STEAM_OPENID_ENDPOINT,
    'openid.claimed_id': CLAIMED,
    'openid.identity': CLAIMED,
    'openid.return_to': CALLBACK,
    'openid.response_nonce': '2026-11-10T11:59:30Zabcdef',
    'openid.assoc_handle': '1234567890',
    'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.sig': 'c2lnbmF0dXJl',
    state: STATE,
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete base[key]
    } else {
      base[key] = value
    }
  }
  return new Map(Object.entries(base))
}

function validate(overrides: Record<string, string | null> = {}, extra: Record<string, unknown> = {}) {
  return validateOpenIdResponse({
    params: validParams(overrides),
    expectedReturnTo: CALLBACK,
    expectedRealm: APP_ORIGIN,
    expectedState: STATE,
    now: NOW,
    ...extra,
  })
}

describe('SteamID64: точность и формат', () => {
  it('принимает корректный идентификатор строкой', () => {
    expect(isSteamId64(STEAM_ID)).toBe(true)
    expect(parseSteamId64(STEAM_ID)).toBe(STEAM_ID)
  })

  it('отвергает number, bigint, объекты и не-17-значные строки', () => {
    expect(isSteamId64(76561198000000001)).toBe(false)
    expect(isSteamId64(BigInt(STEAM_ID))).toBe(false)
    expect(isSteamId64({})).toBe(false)
    expect(isSteamId64('7656119800000000')).toBe(false)
    expect(isSteamId64('765611980000000011')).toBe(false)
    expect(isSteamId64('76561198000abc001')).toBe(false)
  })

  it('не теряет точность: Number искажает соседние аккаунты, строка — нет', () => {
    const a = '76561198000000001'
    const b = '76561198000000002'
    // Именно поэтому SteamID64 нельзя хранить числом.
    expect(Number(a) === Number(b)).toBe(true)
    expect(parseSteamId64(a)).not.toBe(parseSteamId64(b))
    expect(BigInt(a) === BigInt(b)).toBe(false)
  })

  it('отвергает значения вне диапазона индивидуальных аккаунтов', () => {
    expect(isSteamId64('76561197960265727')).toBe(false)
    expect(isSteamId64(STEAM_ID64_INDIVIDUAL_MAX)).toBe(true)
    expect(isSteamId64('76561202255233024')).toBe(false)
    expect(isSteamId64('00000000000000000')).toBe(false)
  })

  it('извлекает идентификатор только из точного префикса Steam', () => {
    expect(steamIdFromClaimedId(CLAIMED)).toBe(STEAM_ID)
    expect(steamIdFromClaimedId(`https://evil.example/openid/id/${STEAM_ID}`)).toBeNull()
    expect(steamIdFromClaimedId(`https://steamcommunity.com/openid/id/123`)).toBeNull()
    expect(steamIdFromClaimedId(null)).toBeNull()
  })

  it('строит ссылку на профиль только из проверенного идентификатора', () => {
    expect(steamProfileUrl(STEAM_ID)).toBe(`https://steamcommunity.com/profiles/${STEAM_ID}`)
    expect(steamProfileUrl('nope')).toBeNull()
  })

  it('восстанавливает идентификатор из account id без потери точности', () => {
    expect(steamIdFromAccountId(0)).toBe('76561197960265728')
    // 76561197960265728 + 39727273 = 76561197999993001
    expect(steamIdFromAccountId(39_727_273)).toBe('76561197999993001')
    expect(steamIdFromAccountId(4294967295)).toBe(STEAM_ID64_INDIVIDUAL_MAX)
    expect(steamIdFromAccountId(-1)).toBeNull()
    expect(steamIdFromAccountId(1.5)).toBeNull()
    expect(steamIdFromAccountId(4294967296)).toBeNull()
  })

  it('сверяет claimed_id и identity по одному аккаунту', () => {
    expect(isSameSteamAccount(CLAIMED, CLAIMED)).toBe(true)
    expect(isSameSteamAccount(CLAIMED, `https://steamcommunity.com/openid/id/76561198000000002`)).toBe(
      false,
    )
    expect(isSameSteamAccount(CLAIMED, null)).toBe(false)
  })

describe('Steam OpenID 2.0: построение запроса', () => {
  it('формирует корректный checkid_setup со всеми обязательными параметрами', () => {
    const url = buildSteamLoginUrl({ returnTo: CALLBACK, realm: APP_ORIGIN, state: STATE })
    expect(url).not.toBeNull()
    const parsed = new URL(url as string)
    expect(`${parsed.origin}${parsed.pathname}`).toBe(STEAM_OPENID_ENDPOINT)
    expect(parsed.searchParams.get('openid.ns')).toBe(OPENID_NS_2_0)
    expect(parsed.searchParams.get('openid.mode')).toBe('checkid_setup')
    expect(parsed.searchParams.get('openid.return_to')).toBe(CALLBACK)
    expect(parsed.searchParams.get('openid.realm')).toBe(APP_ORIGIN)
    expect(parsed.searchParams.get('openid.identity')).toBe(
      'http://specs.openid.net/auth/2.0/identifier_select',
    )
  })

  it('не использует OAuth-подмену и не содержит provider=steam', () => {
    const url = buildSteamLoginUrl({ returnTo: CALLBACK, realm: APP_ORIGIN, state: STATE })
    expect(url).not.toContain('provider=steam')
    expect(url).not.toContain('response_type=code')
  })

  it('отклоняет короткий state, относительный return_to и чужой realm', () => {
    expect(buildSteamLoginUrl({ returnTo: CALLBACK, realm: APP_ORIGIN, state: 'short' })).toBeNull()
    expect(buildSteamLoginUrl({ returnTo: '/callback', realm: APP_ORIGIN, state: STATE })).toBeNull()
    expect(
      buildSteamLoginUrl({ returnTo: CALLBACK, realm: 'https://evil.example', state: STATE }),
    ).toBeNull()
  })
})

describe('Steam OpenID 2.0: проверка ответа', () => {
  it('принимает полностью корректное утверждение', () => {
    const result = validate()
    expect(result).toEqual({
      ok: true,
      steamId64: STEAM_ID,
      claimedId: CLAIMED,
      nonce: '2026-11-10T11:59:30Zabcdef',
    })
  })

  it('распознаёт отмену входа пользователем', () => {
    expect(validate({ 'openid.mode': 'cancel' })).toEqual({ ok: false, reason: 'cancelled' })
  })

  it('распознаёт ошибку провайдера и неизвестный режим', () => {
    expect(validate({ 'openid.mode': 'error' })).toEqual({ ok: false, reason: 'provider_error' })
    expect(validate({ 'openid.mode': 'checkid_setup' })).toEqual({ ok: false, reason: 'bad_mode' })
    expect(validate({ 'openid.mode': null })).toEqual({ ok: false, reason: 'bad_mode' })
  })

  it('отвергает поддельный op_endpoint', () => {
    expect(validate({ 'openid.op_endpoint': 'https://evil.example/openid/login' })).toEqual({
      ok: false,
      reason: 'bad_op_endpoint',
    })
  })
})


describe('Steam OpenID 2.0: подделки и защита от replay', () => {
  it('отвергает поддельный claimed_id и расхождение identity', () => {
    expect(
      validate({ 'openid.claimed_id': 'https://evil.example/openid/id/76561198000000001' }),
    ).toEqual({ ok: false, reason: 'bad_claimed_id' })
    expect(validate({ 'openid.claimed_id': 'https://steamcommunity.com/openid/id/123' })).toEqual({
      ok: false,
      reason: 'bad_claimed_id',
    })
    expect(
      validate({ 'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000002' }),
    ).toEqual({ ok: false, reason: 'identity_mismatch' })
  })

  it('отвергает подменённый return_to и добавленные параметры', () => {
    expect(validate({ 'openid.return_to': 'https://evil.example/api/steam/callback' })).toEqual({
      ok: false,
      reason: 'return_to_mismatch',
    })
    expect(validate({ 'openid.return_to': `${CALLBACK}&next=https://evil.example` })).toEqual({
      ok: false,
      reason: 'return_to_mismatch',
    })
  })

  it('отвергает отсутствующий или чужой state (CSRF)', () => {
    expect(validate({ state: null })).toEqual({ ok: false, reason: 'state_mismatch' })
    expect(validate({ state: 'other_state_value_0987654321' })).toEqual({
      ok: false,
      reason: 'state_mismatch',
    })
    expect(
      validateOpenIdResponse({
        params: validParams(),
        expectedReturnTo: CALLBACK,
        expectedRealm: APP_ORIGIN,
        expectedState: null,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: 'state_mismatch' })
  })

  it('отвергает просроченный и битый nonce', () => {
    expect(validate({ 'openid.response_nonce': '2026-11-10T10:00:00Zabcdef' })).toEqual({
      ok: false,
      reason: 'stale_nonce',
    })
    expect(validate({ 'openid.response_nonce': 'мусор' })).toEqual({
      ok: false,
      reason: 'malformed',
    })
    expect(validate({ 'openid.response_nonce': null })).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })

  it('отвергает повторное предъявление того же nonce (replay)', () => {
    const seen = new Set(['2026-11-10T11:59:30Zabcdef'])
    expect(validate({}, { seenNonces: seen })).toEqual({ ok: false, reason: 'replay' })
  })

  it('разбирает временную метку nonce', () => {
    expect(parseNonceTimestamp('2026-11-10T11:59:30Zabcdef')).toBe(NOW - 30_000)
    expect(parseNonceTimestamp('nope')).toBeNull()
    expect(parseNonceTimestamp(undefined)).toBeNull()
  })

  it('сравнивает return_to строго по составу параметров', () => {
    expect(sameReturnUrl(CALLBACK, CALLBACK)).toBe(true)
    expect(sameReturnUrl(`${APP_ORIGIN}/api/steam/callback`, CALLBACK)).toBe(false)
    expect(sameReturnUrl('https://other.example/x', CALLBACK)).toBe(false)
    expect(sameReturnUrl('не url', CALLBACK)).toBe(false)
  })

  it('читает только параметры OpenID и state', () => {
    const params = readOpenIdParams('?openid.mode=id_res&state=abc&utm=x&evil=1')
    expect([...params.keys()]).toEqual(['openid.mode', 'state'])
  })
})


describe('Steam OpenID 2.0: подтверждение подписи у Steam', () => {
  it('в теле check_authentication нет state и стоит правильный режим', () => {
    const body = buildCheckAuthenticationBody(validParams())
    expect(body.get('openid.mode')).toBe('check_authentication')
    expect(body.get('state')).toBeNull()
    expect(body.get('openid.claimed_id')).toBe(CLAIMED)
  })

  it('разбирает ответ is_valid', () => {
    expect(isCheckAuthenticationValid('is_valid:true')).toBe(true)
    expect(isCheckAuthenticationValid('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n')).toBe(
      true,
    )
    expect(isCheckAuthenticationValid('is_valid:false')).toBe(false)
    expect(isCheckAuthenticationValid('')).toBe(false)
  })

  it('принимает ответ, только если Steam подтвердил подпись', async () => {
    const fetchImpl = vi.fn(async () => new Response('is_valid:true'))
    const result = await verifySteamAssertion({
      params: validParams(),
      expectedReturnTo: CALLBACK,
      expectedRealm: APP_ORIGIN,
      expectedState: STATE,
      now: NOW,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('отвергает ответ, который Steam не подтвердил', async () => {
    const fetchImpl = vi.fn(async () => new Response('is_valid:false'))
    const result = await verifySteamAssertion({
      params: validParams(),
      expectedReturnTo: CALLBACK,
      expectedRealm: APP_ORIGIN,
      expectedState: STATE,
      now: NOW,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, reason: 'invalid_signature' })
  })

  it('fail closed при HTTP-ошибке, сетевом сбое и мусорном ответе', async () => {
    const fail = (impl: () => Promise<Response>) =>
      verifySteamAssertion({
        params: validParams(),
        expectedReturnTo: CALLBACK,
        expectedRealm: APP_ORIGIN,
        expectedState: STATE,
        now: NOW,
        fetchImpl: impl as unknown as typeof fetch,
      })

    expect(await fail(async () => new Response('', { status: 500 }))).toEqual({
      ok: false,
      reason: 'invalid_signature',
    })
    expect(
      await fail(async () => {
        throw new Error('network down')
      }),
    ).toEqual({ ok: false, reason: 'network_error' })
    expect(await fail(async () => new Response('<html>oops</html>'))).toEqual({
      ok: false,
      reason: 'invalid_signature',
    })
  })

  it('не обращается к сети, если локальные проверки уже провалились', async () => {
    const fetchImpl = vi.fn(async () => new Response('is_valid:true'))
    const result = await verifySteamAssertion({
      params: validParams({ state: null }),
      expectedReturnTo: CALLBACK,
      expectedRealm: APP_ORIGIN,
      expectedState: STATE,
      now: NOW,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, reason: 'state_mismatch' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

})
