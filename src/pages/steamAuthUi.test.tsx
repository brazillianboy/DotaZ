import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AppHeader from '../components/AppHeader'
import { type AuthContextValue, AuthContext } from '../contexts/AuthContext'
import { I18nProvider } from '../i18n/I18nContext'
import { en } from '../i18n/translationsEn'
import { ru } from '../i18n/translations'
import LoginPage from './LoginPage'
import ProfilePage from './ProfilePage'
import SteamCallbackPage from './SteamCallbackPage'

const STEAM_ID = '76561198000000001'

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    session: null,
    loading: false,
    isConfigured: true,
    isSteamConfigured: true,
    steamIdentity: null,
    signUp: async () => ({ ok: false, error: null, errorCode: null, needsEmailConfirmation: false }),
    signIn: async () => ({ ok: false, error: null, errorCode: null, needsEmailConfirmation: false }),
    signOut: async () => ({ ok: false, error: null, errorCode: null, needsEmailConfirmation: false }),
    startSteamSignIn: async () => ({ ok: false, error: null, errorCode: null, needsEmailConfirmation: false }),
    completeSteamSignIn: async () => ({
      ok: false,
      error: null,
      errorCode: null,
      needsEmailConfirmation: false,
    }),
    startSteamLink: async () => ({
      ok: false,
      error: null,
      errorCode: null,
      needsEmailConfirmation: false,
    }),
    refreshSteamIdentity: async () => {},
    ...overrides,
  }
}

function render(ui: React.ReactNode, path = '/', auth = authValue()): string {
  return renderToStaticMarkup(
    <I18nProvider>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </I18nProvider>,
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Task 20A: страница входа', () => {
  it('в RU основной кнопкой является «Войти через Steam»', () => {
    const html = render(<LoginPage />)
    expect(html).toContain('Войти через Steam')
    expect(html).toContain('или войдите по email')
    expect(html).toContain('временно сохранён')
  })

  it('английский словарь содержит требуемую подпись кнопки', () => {
    // SSR-рендер не переключает язык (нет localStorage), поэтому английский
    // текст проверяется по словарю, а русский — по разметке выше.
    expect(en['auth.steam.signIn']).toBe('Sign in with Steam')
    expect(ru['auth.steam.signIn']).toBe('Войти через Steam')
    expect(en['auth.steam.error.cancelled']).not.toBe(ru['auth.steam.error.cancelled'])
  })

  it('показывает локализованное сообщение об отмене Steam', () => {
    const html = render(<LoginPage />, '/login?steam_error=cancelled')
    expect(html).toContain('Вход через Steam отменён')
  })

  it('показывает ошибку поддельного ответа Steam', () => {
    const html = render(<LoginPage />, '/login?steam_error=invalid_signature')
    expect(html).toContain('Не удалось подтвердить ответ Steam')
  })

  it('неизвестный код ошибки не превращается в успех', () => {
    const html = render(<LoginPage />, '/login?steam_error=<script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('или войдите по email')
  })

  it('сохраняет форму email как временный legacy-вход', () => {
    const html = render(<LoginPage />)
    expect(html).toContain('Email')
    expect(html).toContain('Пароль')
  })
})


describe('Task 20A: шапка и Steam-личность', () => {
  const withSteam = authValue({
    user: { id: 'uuid-1', email: 'steam+76561198000000001@users.dotaz.invalid' } as never,
    steamIdentity: {
      steamId64: STEAM_ID,
      personaName: 'Игрок Один',
      avatarUrl: 'https://avatars.steamstatic.com/abc_full.jpg',
      profileUrl: `https://steamcommunity.com/profiles/${STEAM_ID}`,
    },
  })

  it('показывает аватар и ник привязанного Steam-аккаунта', () => {
    const html = render(<AppHeader />, '/', withSteam)
    expect(html).toContain('Игрок Один')
    expect(html).toContain('https://avatars.steamstatic.com/abc_full.jpg')
    expect(html).toContain('Аватар Steam')
    expect(html).toContain('href="/profile"')
  })

  it('без Steam показывает email и не выдумывает ник', () => {
    const html = render(
      <AppHeader />,
      '/',
      authValue({ user: { id: 'uuid-2', email: 'legacy@example.com' } as never }),
    )
    expect(html).toContain('legacy@example.com')
    expect(html).not.toContain('avatars.steamstatic.com')
    expect(html).toContain('href="/profile"')
  })

  it('при отсутствии аватара показывает нейтральную заглушку, а не пустой img', () => {
    const html = render(
      <AppHeader />,
      '/',
      authValue({
        user: { id: 'uuid-3', email: 'x@example.com' } as never,
        steamIdentity: {
          steamId64: STEAM_ID,
          personaName: null,
          avatarUrl: null,
          profileUrl: null,
        },
      }),
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('Игрок Steam')
  })
})

describe('Task 20A: привязка Steam к существующему аккаунту', () => {
  it('предлагает привязку только авторизованному пользователю без Steam', () => {
    const html = render(<ProfilePage />, '/profile')
    expect(html).toContain('Привязать Steam к текущему аккаунту')
    expect(html).toContain('Сохранённые отчёты и история останутся на месте')
  })

  it('не предлагает привязку, если Steam уже привязан', () => {
    const html = render(
      <ProfilePage />,
      '/profile',
      authValue({
        steamIdentity: {
          steamId64: STEAM_ID,
          personaName: 'Игрок',
          avatarUrl: null,
          profileUrl: null,
        },
      }),
    )
    expect(html).not.toContain('Привязать Steam к текущему аккаунту')
  })

  it('не предлагает привязку, если Steam-вход не настроен', () => {
    const html = render(
      <ProfilePage />,
      '/profile',
      authValue({ isSteamConfigured: false }),
    )
    expect(html).not.toContain('Привязать Steam к текущему аккаунту')
    expect(html).toContain('не настроен')
  })

  it('не содержит поля ручного ввода SteamID', () => {
    const html = render(<ProfilePage />, '/profile')
    expect(html).not.toContain('steamid')
    expect(html).not.toContain('Введите Steam')
  })
})


describe('Task 20A: страница профиля', () => {
  it('показывает проверенный SteamID64 и ник', () => {
    const html = render(
      <ProfilePage />,
      '/profile',
      authValue({
        steamIdentity: {
          steamId64: STEAM_ID,
          personaName: 'Игрок Один',
          avatarUrl: null,
          profileUrl: `https://steamcommunity.com/profiles/${STEAM_ID}`,
        },
      }),
    )
    expect(html).toContain('Личный профиль')
    expect(html).toContain(STEAM_ID)
    expect(html).toContain('Игрок Один')
    expect(html).toContain('Task 20B')
  })

  it('без привязки честно сообщает об отсутствии Steam', () => {
    const html = render(<ProfilePage />, '/profile')
    expect(html).toContain('не привязан Steam-профиль')
    expect(html).not.toContain('SteamID64')
  })
})

describe('Task 20A: страница завершения входа', () => {
  it('не аутентифицирует без кода обмена и не использует steamid из URL', () => {
    // Эффекты в SSR не выполняются, поэтому проверяется безопасное начальное
    // состояние: страница только сообщает о завершении входа.
    const html = render(<SteamCallbackPage />, '/auth/steam/callback')
    expect(html).toContain('Завершаем вход через Steam')
    expect(html).not.toContain('Вернуться ко входу')
  })

  it('не показывает переданный «ник» или steamid из URL', () => {
    const html = render(
      <SteamCallbackPage />,
      `/auth/steam/callback?steamid=${STEAM_ID}&name=Hacker`,
    )
    expect(html).not.toContain('Hacker')
    expect(html).not.toContain(STEAM_ID)
  })

  it('страница обращается к обмену токена, а не доверяет URL', () => {
    // Статическая проверка источника: единственный путь аутентификации —
    // verifyOtp внутри completeSteamSignIn, никакого чтения steamid.
    expect(SteamCallbackPage.toString()).toContain('completeSteamSignIn')
  })

  it('завершает вход даже при StrictMode двойном запуске эффекта (регрессия)', () => {
    // StrictMode дважды вызывает эффект: прежний локальный `let active` сбрасывался
    // первым cleanup'ом, из-за чего navigate и показ ошибки молча пропускались,
    // и пользователь навсегда оставался на «Завершаем вход…».
    expect(SteamCallbackPage.toString()).not.toContain('let active = true')
    expect(SteamCallbackPage.toString()).toContain('navigate(nextPath, { replace: true })')
  })
})
