import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'

import { AuthContext, type AuthContextValue } from '../contexts/AuthContext'
import { I18nProvider } from '../i18n/I18nContext'
import { translations, type Locale } from '../i18n/translations'
import MatchParseNotice from '../components/MatchParseNotice'
import type { MatchParseOutcome } from '../lib/matchParseFlow'
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

describe('MatchPage — автоматическая обработка реплея (Task 14)', () => {
  const outcome = (value: MatchParseOutcome): MatchParseOutcome => value

  function renderNotice(locale: Locale, value: MatchParseOutcome) {
    return renderToStaticMarkup(
      <I18nProvider initialLocale={locale}>
        <MatchParseNotice outcome={value} />
      </I18nProvider>,
    )
  }

  it('шаги обработки переведены в обоих языках', () => {
    expect(translations.ru['match.phase.requestingParse']).toBe('Запрашиваем обработку реплея…')
    expect(translations.en['match.phase.requestingParse']).toBe('Requesting replay parsing…')
    expect(translations.ru['match.phase.waitingParse']).toBe('OpenDota обрабатывает реплей…')
    expect(translations.en['match.phase.waitingParse']).toBe(
      'OpenDota is processing the replay…',
    )
    expect(translations.ru['match.phase.refetching']).toBe(
      'Подготавливаем анализ первых 15 минут…',
    )
    expect(translations.en['match.phase.refetching']).toBe(
      'Preparing the first 15 minutes of analysis…',
    )
    expect(translations.ru['parse.ready']).toContain('Анализ готов')
    expect(translations.en['parse.ready']).toContain('Analysis ready')
    expect(translations.ru['parse.replayUnavailable']).toBe(
      'Реплей недоступен. Показана доступная статистика.',
    )
    expect(translations.en['parse.replayUnavailable']).toBe(
      'Replay unavailable. Showing available statistics.',
    )
  })

  it('страница не содержит ручной кнопки запроса обработки', () => {
    expect(matchPageSource).toContain('ensureDetailedMatchData')
    expect(matchPageSource).toContain("'requesting-parse': 'match.phase.requestingParse'")
    expect(matchPageSource).not.toMatch(/Запросить обработку|Request parsing/i)
  })

  it('показывает статус готовности после подтверждённой обработки', () => {
    const value = outcome({
      kind: 'parsed',
      match: { match_id: '1', duration: 1, radiant_win: true, players: [] },
      jobId: '5',
    })
    const ru = renderNotice('ru', value)
    const en = renderNotice('en', value)

    expect(ru).toContain('Анализ готов')
    expect(en).toContain('Analysis ready')
    expect(en).not.toMatch(CYRILLIC)
  })

  it('честно сообщает о недоступном реплее в обеих локалях', () => {
    const value = outcome({
      kind: 'replay-unavailable',
      reason: 'expired',
      match: { match_id: '1', duration: 1, radiant_win: true, players: [] },
    })
    const ru = renderNotice('ru', value)
    const en = renderNotice('en', value)

    expect(ru).toContain('Реплей недоступен. Показана доступная статистика.')
    expect(en).toContain('Replay unavailable. Showing available statistics.')
    expect(en).not.toMatch(CYRILLIC)
  })

  it('сообщает о продолжающейся обработке и об ограничении частоты запросов', () => {
    const match = { match_id: '1', duration: 1, radiant_win: true, players: [] }
    const pendingRu = renderNotice('ru', outcome({ kind: 'pending', jobId: '5', match }))
    const pendingEn = renderNotice('en', outcome({ kind: 'pending', jobId: null, match }))
    const limitedRu = renderNotice(
      'ru',
      outcome({ kind: 'failed', reason: 'rate-limited', match }),
    )
    const limitedEn = renderNotice(
      'en',
      outcome({ kind: 'failed', reason: 'network', match }),
    )

    expect(pendingRu).toContain('OpenDota продолжает обработку реплея')
    expect(pendingEn).toContain('still processing the replay')
    expect(limitedRu).toContain('ограничил частоту запросов')
    expect(limitedEn).toContain('network is unavailable')
    expect(limitedEn).not.toMatch(CYRILLIC)
  })

  it('не показывает панель, когда обработка не требовалась или была отменена', () => {
    const match = { match_id: '1', duration: 1, radiant_win: true, players: [] }
    expect(renderNotice('ru', outcome({ kind: 'not-needed', match }))).toBe('')
    expect(renderNotice('en', outcome({ kind: 'aborted' }))).toBe('')
  })
})
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