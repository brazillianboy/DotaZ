import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { formatPercentValue, formatUtcDateTime } from './formatters'
import {
  DEFAULT_LOCALE,
  interpolate,
  isLocale,
  translations,
  type Locale,
  type TranslationKey,
} from './translations'

/**
 * Контекст локализации (Task 13).
 *
 * Одна точка хранения выбранного языка для всего приложения: переключение не
 * требует перезагрузки страницы и не влияет на данные (запросы, отчёты, анализ).
 * Выбор сохраняется в localStorage — это пользовательская настройка, а не
 * данные аутентификации; при недоступном хранилище интерфейс продолжает работать.
 */

export const LOCALE_STORAGE_KEY = 'dotaz.locale'

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  /** Перевод по ключу словаря с подстановкой переменных. */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
  /** Временная метка в UTC с учётом локали (или `null`, если значения нет). */
  formatDateTime: (value: string | null) => string | null
  /** Процент с учётом локали (значение не изменяется). */
  formatPercent: (value: number) => string
}

/** Чтение сохранённого языка: недоступное хранилище не считается ошибкой. */
export function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(raw) ? raw : null
  } catch {
    return null
  }
}

/** Сохранение выбранного языка; ошибки хранилища игнорируются осознанно. */
export function storeLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Приватный режим или запрет хранилища: язык действует только в текущей сессии.
  }
}

/**
 * Проставляет выбранный язык в `<html lang>` (доступность: корректные метаданные
 * языка документа). Отсутствие DOM (SSR, тесты) не считается ошибкой.
 */
export function applyDocumentLanguage(
  locale: Locale,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): void {
  if (doc === undefined) {
    return
  }
  doc.documentElement.lang = locale
}

function createTranslate(locale: Locale) {
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    const template = translations[locale][key] ?? translations[DEFAULT_LOCALE][key] ?? key
    return interpolate(template, params)
  }
}

/**
 * Значение по умолчанию — русский язык: компоненты, отрисованные без провайдера
 * (например, в изолированных SSR-тестах), показывают русские тексты.
 */
export const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: createTranslate(DEFAULT_LOCALE),
  formatDateTime: (value) => formatUtcDateTime(value, DEFAULT_LOCALE),
  formatPercent: (value) => formatPercentValue(value, DEFAULT_LOCALE),
})

interface I18nProviderProps {
  children: ReactNode
  /** Явно заданный язык (используется в тестах); иначе — сохранённый или русский. */
  initialLocale?: Locale
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? readStoredLocale() ?? DEFAULT_LOCALE,
  )

  useEffect(() => {
    applyDocumentLanguage(locale)
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    storeLocale(next)
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: createTranslate(locale),
      formatDateTime: (input) => formatUtcDateTime(input, locale),
      formatPercent: (input) => formatPercentValue(input, locale),
    }),
    [locale, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Доступ к текущему языку и переводам; без провайдера возвращает русский. */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}