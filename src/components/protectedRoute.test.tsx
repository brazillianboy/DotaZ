import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'

import { AuthContext, type AuthContextValue } from '../contexts/AuthContext'
import { I18nProvider } from '../i18n/I18nContext'
import { translations, type Locale } from '../i18n/translations'
import ProtectedRoute from './ProtectedRoute'

// Исходник читается как строка (Vite ?raw) — для статической проверки отсутствия хардкода.
import protectedRouteSource from './ProtectedRoute.tsx?raw'

/**
 * Проверки локализации состояния проверки доступа (Task 13).
 *
 * Блок «Проверка авторизации…» показывается при инициализации сессии на защищённых
 * маршрутах (например, `/history`) и ранее содержал русский текст, не зависящий от
 * выбранного языка.
 */

const CYRILLIC = /[А-Яа-яЁё]/

function authValue(): AuthContextValue {
  return {
    user: null,
    session: null,
    loading: true,
    isConfigured: true,
    signUp: async () => ({ ok: false, error: null, errorCode: null, needsEmailConfirmation: false }),
    signIn: async () => ({ ok: false, error: null, errorCode: null, needsEmailConfirmation: false }),
    signOut: async () => ({ ok: false, error: null, errorCode: null, needsEmailConfirmation: false }),
  }
}

function renderGuard(locale: Locale) {
  return renderToStaticMarkup(
    <StaticRouter location="/history">
      <I18nProvider initialLocale={locale}>
        <AuthContext.Provider value={authValue()}>
          <ProtectedRoute>
            <p>private content</p>
          </ProtectedRoute>
        </AuthContext.Provider>
      </I18nProvider>
    </StaticRouter>,
  )
}

describe('ProtectedRoute — локализация проверки доступа', () => {
  it('ключи перевода состояния присутствуют в обоих словарях', () => {
    expect(translations.ru['auth.guard.badge']).toBe('Проверка доступа')
    expect(translations.en['auth.guard.badge']).toBe('Access check')
    expect(translations.en['auth.guard.title']).toBe('Checking authorization…')
    expect(translations.en['auth.guard.text']).toContain('Checking your session')
  })

  it('в русской локали показывает русский статус и не рендерит приватный контент', () => {
    const html = renderGuard('ru')
    expect(html).toContain('Проверка доступа')
    expect(html).toContain('Проверка авторизации…')
    expect(html).not.toContain('private content')
  })

  it('в английской локали показывает английский статус без кириллицы', () => {
    const html = renderGuard('en')
    expect(html).toContain('Access check')
    expect(html).toContain('Checking authorization…')
    expect(html).not.toMatch(CYRILLIC)
  })

  it('не содержит русских литералов в исходнике (только ключи перевода)', () => {
    expect(protectedRouteSource).toContain("t('auth.guard.badge')")
    expect(protectedRouteSource).toContain("t('auth.guard.title')")
    expect(protectedRouteSource).toContain("t('auth.guard.text')")
    expect(protectedRouteSource).not.toContain('Проверка доступа')
    expect(protectedRouteSource).not.toContain('Проверяем вашу сессию')
  })
})