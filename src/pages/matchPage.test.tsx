import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'

import { AuthContext, type AuthContextValue } from '../contexts/AuthContext'
import { I18nProvider } from '../i18n/I18nContext'
import { translations, type Locale } from '../i18n/translations'
import MatchPage from './MatchPage'

// Исходник читается как строка (Vite ?raw) — для статической проверки отсутствия хардкода.
import matchPageSource from './MatchPage.tsx?raw'

/**
 * Регрессионные проверки локализации страницы матча (Task 13).
 *
 * Поводом послужил дефект, найденный при ручной проверке в браузере: ссылка
 * «Вернуться на главную» рядом с личным отчётом оставалась русской при выборе
 * английского языка. Здесь проверяются:
 *  1) значения ключей перевода ссылок в RU и EN;
 *  2) отсутствие русских литералов в исходнике страницы (ссылка и вход в аккаунт);
 *  3) SSR-рендер страницы матча в обеих локалях без кириллицы в английской версии.
 *
 * Ветка отчёта (`status === 'report'`) требует выполнения эффектов загрузки,
 * поэтому текст самой ссылки проверяется по исходнику и словарю — это не
 * браузерная проверка, а защита от возврата хардкода.
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

function renderMatchPage(locale: Locale) {
  return renderToStaticMarkup(
    <StaticRouter location="/matches/9007760151">
      <I18nProvider initialLocale={locale}>
        <AuthContext.Provider value={authValue()}>
          <MatchPage />
        </AuthContext.Provider>
      </I18nProvider>
    </StaticRouter>,
  )
}

describe('MatchPage — локализация ссылок навигации', () => {
  it('ссылка «на главную» переведена в обоих языках', () => {
    expect(translations.ru['common.backHome']).toBe('← Вернуться на главную')
    expect(translations.en['common.backHome']).toBe('← Back to Home')
  })

  it('ссылка входа из панели личного отчёта переведена', () => {
    expect(translations.ru['persistence.guest.loginLink']).toBe('Войти в аккаунт')
    expect(translations.en['persistence.guest.loginLink']).toBe('Log in')
  })

  it('страница использует ключи перевода и не содержит русских литералов', () => {
    expect(matchPageSource).toContain("t('common.backHome')")
    expect(matchPageSource).toContain("t('persistence.guest.loginLink')")
    expect(matchPageSource).not.toContain('Вернуться на главную')
    expect(matchPageSource).not.toContain('Войти в аккаунт')
  })

  it('сохраняет существующий маршрут «на главную» (/)', () => {
    expect(matchPageSource).toMatch(
      /<Link className="btn btn--ghost" to="\/">\s*\{t\('common\.backHome'\)\}/,
    )
  })

  it('рендерит страницу матча без кириллицы в английской локали', () => {
    const ru = renderMatchPage('ru')
    const en = renderMatchPage('en')

    expect(ru).toContain('Проверяем состояние сессии…')
    expect(en).toContain('Checking the session state…')
    expect(en).not.toMatch(CYRILLIC)
  })
})