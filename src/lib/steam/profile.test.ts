import { describe, expect, it } from 'vitest'

import {
  STEAM_DISPLAY_NAME_MAX,
  parsePlayerSummary,
  profileWithoutMetadata,
  sanitizeAvatarUrl,
  sanitizeDisplayName,
} from './profile'
import { buildAppRedirectUrl, createOAuthState, isValidOAuthState, sanitizeInternalPath, sanitizeServerRedirectPath } from './redirect'

const STEAM_ID = '76561198000000001'

function summary(overrides: Record<string, unknown> = {}) {
  return {
    response: {
      players: [
        {
          steamid: STEAM_ID,
          personaname: 'Player One',
          avatar: 'https://avatars.steamstatic.com/aaa_medium.jpg',
          avatarfull: 'https://avatars.steamstatic.com/aaa_full.jpg',
          profileurl: 'https://steamcommunity.com/id/whatever/',
          ...overrides,
        },
      ],
    },
  }
}

describe('метаданные Steam: аватар', () => {
  it('принимает только https и хосты Steam', () => {
    expect(sanitizeAvatarUrl('https://avatars.steamstatic.com/abc_full.jpg')).toBe(
      'https://avatars.steamstatic.com/abc_full.jpg',
    )
    expect(sanitizeAvatarUrl('http://avatars.steamstatic.com/abc_full.jpg')).toBeNull()
    expect(sanitizeAvatarUrl('https://evil.example/abc_full.jpg')).toBeNull()
    expect(sanitizeAvatarUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeAvatarUrl('data:image/svg+xml;base64,AAAA')).toBeNull()
    expect(sanitizeAvatarUrl(null)).toBeNull()
    expect(sanitizeAvatarUrl('')).toBeNull()
    expect(sanitizeAvatarUrl(`https://avatars.steamstatic.com/${'a'.repeat(600)}`)).toBeNull()
  })

  it('отвергает URL с учётными данными', () => {
    expect(sanitizeAvatarUrl('https://user:pass@avatars.steamstatic.com/a.jpg')).toBeNull()
  })
})

describe('метаданные Steam: ник', () => {
  it('убирает управляющие символы и схлопывает пробелы, сохраняя написание', () => {
    expect(sanitizeDisplayName('  Игрок\u0000  Один  ')).toBe('Игрок Один')
    expect(sanitizeDisplayName('NaVi★Puppey')).toBe('NaVi★Puppey')
    expect(sanitizeDisplayName('   ')).toBeNull()
    expect(sanitizeDisplayName(42)).toBeNull()
  })

  it('ограничивает длину', () => {
    const long = 'a'.repeat(STEAM_DISPLAY_NAME_MAX + 40)
    expect(sanitizeDisplayName(long)).toHaveLength(STEAM_DISPLAY_NAME_MAX)
  })
})

describe('метаданные Steam: разбор ответа API', () => {
  it('извлекает ник и аватар для того же аккаунта', () => {
    const profile = parsePlayerSummary(summary(), STEAM_ID)
    expect(profile).toEqual({
      steamId64: STEAM_ID,
      personaName: 'Player One',
      avatarUrl: 'https://avatars.steamstatic.com/aaa_full.jpg',
      profileUrl: `https://steamcommunity.com/profiles/${STEAM_ID}`,
    })
  })

  it('не доверяет чужому steamid в ответе', () => {
    expect(parsePlayerSummary(summary({ steamid: '76561198000000002' }), STEAM_ID)).toBeNull()
  })

  it('не подставляет profileurl из ответа', () => {
    const profile = parsePlayerSummary(summary({ profileurl: 'https://evil.example/x' }), STEAM_ID)
    expect(profile?.profileUrl).toBe(`https://steamcommunity.com/profiles/${STEAM_ID}`)
  })

  it('переживает отсутствие данных и мусор', () => {
    expect(parsePlayerSummary(null, STEAM_ID)).toBeNull()
    expect(parsePlayerSummary({}, STEAM_ID)).toBeNull()
    expect(parsePlayerSummary({ response: { players: [] } }, STEAM_ID)).toBeNull()
    const sparse = parsePlayerSummary(
      { response: { players: [{ steamid: STEAM_ID }] } },
      STEAM_ID,
    )
    expect(sparse).toEqual({
      steamId64: STEAM_ID,
      personaName: null,
      avatarUrl: null,
      profileUrl: `https://steamcommunity.com/profiles/${STEAM_ID}`,
    })
  })

  it('заглушка без метаданных сохраняет проверенную личность', () => {
    expect(profileWithoutMetadata(STEAM_ID)).toEqual({
      steamId64: STEAM_ID,
      personaName: null,
      avatarUrl: null,
      profileUrl: null,
    })
  })
})

describe('state и безопасные редиректы', () => {
  it('создаёт уникальный state корректного формата', () => {
    const first = createOAuthState()
    const second = createOAuthState()
    expect(isValidOAuthState(first)).toBe(true)
    expect(isValidOAuthState(second)).toBe(true)
    expect(first).not.toBe(second)
    expect(first.length).toBeGreaterThanOrEqual(32)
  })

  it('отвергает некорректный state', () => {
    expect(isValidOAuthState('short')).toBe(false)
    expect(isValidOAuthState('a'.repeat(31))).toBe(false)
    expect(isValidOAuthState('a'.repeat(129))).toBe(false)
    expect(isValidOAuthState('has space here in state value 1234567890')).toBe(false)
    expect(isValidOAuthState(null)).toBe(false)
  })

  it('пропускает только внутренние пути', () => {
    expect(sanitizeInternalPath('/history')).toBe('/history')
    expect(sanitizeInternalPath('/matches/123?x=1')).toBe('/matches/123?x=1')
    expect(sanitizeInternalPath('https://evil.example')).toBe('/')
    expect(sanitizeInternalPath('//evil.example')).toBe('/')
    expect(sanitizeInternalPath('/\\evil.example')).toBe('/')
    expect(sanitizeInternalPath('/login')).toBe('/')
    expect(sanitizeInternalPath('/auth/steam/callback?token_hash=x')).toBe('/')
    expect(sanitizeInternalPath('')).toBe('/')
    expect(sanitizeInternalPath(null)).toBe('/')
    expect(sanitizeInternalPath('/a\u0000b')).toBe('/')
  })
})

describe('серверный редирект Task 20A: buildAppRedirectUrl (регрессия)', () => {
  it('возвращает на /auth/steam/callback с кодом обмена, а не на корень', () => {
    expect(buildAppRedirectUrl('http://localhost:5173', '/auth/steam/callback?code=ABC123&next=history')).toBe(
      'http://localhost:5173/auth/steam/callback?code=ABC123&next=history',
    )
  })

  it('возвращает на /login с ошибкой Steam (не выбрасывает ошибку)', () => {
    expect(buildAppRedirectUrl('http://localhost:5173', '/login?steam_error=session_failed')).toBe(
      'http://localhost:5173/login?steam_error=session_failed',
    )
  })

  it('по-прежнему отклоняет внешние и protocol-relative редиректы', () => {
    expect(sanitizeServerRedirectPath('//evil.example')).toBe('/')
    expect(sanitizeServerRedirectPath('https://evil.example')).toBe('/')
    expect(sanitizeServerRedirectPath('/\\evil')).toBe('/')
    expect(sanitizeServerRedirectPath('')).toBe('/')
    expect(sanitizeServerRedirectPath('/a\u0000b')).toBe('/')
  })

  it('отклоняет некорректный origin', () => {
    expect(buildAppRedirectUrl('javascript:alert(1)', '/x')).toBeNull()
    expect(buildAppRedirectUrl('ftp://example.com', '/x')).toBeNull()
    expect(buildAppRedirectUrl('not-a-url', '/x')).toBeNull()
  })

  it('считает /auth/steam/callback и /login безопасными внутренними путями сервера', () => {
    expect(sanitizeServerRedirectPath('/auth/steam/callback?code=x')).toBe('/auth/steam/callback?code=x')
    expect(sanitizeServerRedirectPath('/login?steam_error=x')).toBe('/login?steam_error=x')
  })
})
