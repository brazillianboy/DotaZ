import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import LanguageSwitcher from '../components/LanguageSwitcher'
import MatchSummary from '../components/MatchSummary'
import { normalizeMatch } from '../lib/normalizeMatch'
import {
  I18nProvider,
  LOCALE_STORAGE_KEY,
  applyDocumentLanguage,
  readStoredLocale,
  storeLocale,
  useI18n,
} from './I18nContext'

/**
 * Тесты контекста локализации (Task 13): SSR-рендер без jsdom (как в остальных
 * компонентных тестах проекта) и изолированные проверки хранилища/DOM-метаданных.
 *
 * Это не браузерная проверка: события кликов здесь не воспроизводятся.
 */

function Probe() {
  const { locale, t } = useI18n()
  return (
    <span>
      {locale}:{t('nav.home')}
    </span>
  )
}

function mockWindow(localStorageImpl: { getItem?: () => string | null; setItem?: () => void }) {
  vi.stubGlobal('window', { localStorage: localStorageImpl })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Провайдер локализации', () => {
  it('по умолчанию (без провайдера) использует русский язык', () => {
    const html = renderToStaticMarkup(<Probe />)
    expect(html).toContain('ru:Главная')
  })

  it('рендерит русский интерфейс при initialLocale="ru"', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="ru">
        <Probe />
      </I18nProvider>,
    )
    expect(html).toContain('ru:Главная')
  })

  it('рендерит английский интерфейс при initialLocale="en"', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <Probe />
      </I18nProvider>,
    )
    expect(html).toContain('en:Home')
  })

  it('локализует компоненты без изменения фактов матча', () => {
    const match = normalizeMatch({
      match_id: 9007760151,
      duration: 2069,
      radiant_win: true,
      players: [],
    })
    const ruHtml = renderToStaticMarkup(
      <I18nProvider initialLocale="ru">
        <MatchSummary match={match} requestedId="9007760151" />
      </I18nProvider>,
    )
    const enHtml = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <MatchSummary match={match} requestedId="9007760151" />
      </I18nProvider>,
    )

    expect(ruHtml).toContain('Матч 9007760151')
    expect(enHtml).toContain('Match 9007760151')
    // Факты не зависят от языка.
    for (const fact of ['9007760151', '34:29', '2069', 'Radiant']) {
      expect(ruHtml, `ru:${fact}`).toContain(fact)
      expect(enHtml, `en:${fact}`).toContain(fact)
    }
  })
})

describe('Переключатель языка', () => {
  it('в русском режиме отмечает активным RU', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="ru">
        <LanguageSwitcher />
      </I18nProvider>,
    )
    expect(html).toContain('aria-label="Язык интерфейса"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('>RU<')
    expect(html).toContain('>EN<')
  })

  it('в английском режиме переводит подписи и заголовки кнопок', () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <LanguageSwitcher />
      </I18nProvider>,
    )
    expect(html).toContain('aria-label="Interface language"')
    expect(html).toContain('lang="ru"')
    expect(html).toContain('lang="en"')
  })
})

describe('Хранилище языковых настроек', () => {
  it('без window возвращает null и не падает при записи', () => {
    expect(readStoredLocale()).toBeNull()
    expect(() => storeLocale('en')).not.toThrow()
  })

  it('читает только поддерживаемые локали', () => {
    mockWindow({ getItem: () => 'en' })
    expect(readStoredLocale()).toBe('en')

    mockWindow({ getItem: () => 'de' })
    expect(readStoredLocale()).toBeNull()
  })

  it('при ошибке доступа к хранилищу возвращает null (fallback)', () => {
    mockWindow({
      getItem: () => {
        throw new Error('storage disabled')
      },
    })
    expect(readStoredLocale()).toBeNull()
  })

  it('записывает выбранный язык в ключ dotaz.locale', () => {
    const setItem = vi.fn()
    mockWindow({ setItem })
    storeLocale('en')
    expect(setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'en')
    expect(LOCALE_STORAGE_KEY).toBe('dotaz.locale')
  })

  it('не выбрасывает исключение, если запись запрещена', () => {
    mockWindow({
      setItem: () => {
        throw new Error('quota exceeded')
      },
    })
    expect(() => storeLocale('ru')).not.toThrow()
  })
})

describe('Метаданные языка документа', () => {
  it('проставляет выбранный язык в html lang', () => {
    const doc = { documentElement: { lang: 'ru' } } as unknown as Document
    applyDocumentLanguage('en', doc)
    expect(doc.documentElement.lang).toBe('en')
    applyDocumentLanguage('ru', doc)
    expect(doc.documentElement.lang).toBe('ru')
  })

  it('без DOM не падает (SSR)', () => {
    expect(() => applyDocumentLanguage('en', undefined)).not.toThrow()
  })
})