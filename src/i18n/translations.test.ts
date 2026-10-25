import { describe, expect, it } from 'vitest'

import { interpolate, isLocale, ru, translations, type TranslationKey } from './translations'
import { formatClock, formatInteger, formatPercentValue, formatUtcDateTime } from './formatters'

/**
 * Тесты ядра локализации (Task 13).
 *
 * Проверяются: паритет словарей, отсутствие пустых значений, интерполяция
 * переменных, значения по умолчанию и форматирование дат/чисел.
 * Это изолированные проверки словарей — они не заменяют браузерную проверку.
 */
describe('Словари локализации', () => {
  const keys = Object.keys(ru) as TranslationKey[]

  it('содержат одинаковый набор ключей в русском и английском словарях', () => {
    const enKeys = Object.keys(translations.en)
    expect(new Set(enKeys)).toEqual(new Set(keys))
    expect(enKeys.length).toBe(keys.length)
  })

  it('не содержат пустых значений', () => {
    for (const key of keys) {
      expect(ru[key].trim().length, `ru:${key}`).toBeGreaterThan(0)
      expect(translations.en[key].trim().length, `en:${key}`).toBeGreaterThan(0)
    }
  })

  it('содержат только известные локали', () => {
    expect(Object.keys(translations).sort()).toEqual(['en', 'ru'])
    expect(isLocale('ru')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })

  it('русский словарь является языком по умолчанию', () => {
    expect(translations.ru['nav.home']).toBe('Главная')
    expect(translations.en['nav.home']).toBe('Home')
  })

  it('сохраняют технические идентификаторы без перевода', () => {
    for (const key of keys) {
      for (const placeholder of ['{status}', '{id}', '{version}', '{ruleId}', '{email}']) {
        const inRu = ru[key].includes(placeholder)
        const inEn = translations.en[key].includes(placeholder)
        expect(inEn, `${key} / ${placeholder}`).toBe(inRu)
      }
    }
  })

  it('переводят ограничения по стабильным кодам правил', () => {
    expect(translations.ru['limitation.laning.events.missing']).toContain('Журналы событий')
    expect(translations.en['limitation.laning.events.missing']).toContain('event logs')
    expect(translations.en['limitation.benchmarks.hero_role_missing']).toContain(
      'benchmarks are not confirmed',
    )
  })
})

describe('Интерполяция переводов', () => {
  it('подставляет значения переменных', () => {
    expect(interpolate('Матч {id}', { id: '9007760151' })).toBe('Матч 9007760151')
    expect(interpolate('HTTP {status}', { status: 429 })).toBe('HTTP 429')
  })

  it('не изменяет шаблон без переменных', () => {
    expect(interpolate('Простой текст')).toBe('Простой текст')
    expect(interpolate('Простой текст', {})).toBe('Простой текст')
  })

  it('оставляет неизвестные плейсхолдеры видимыми (защита от опечаток)', () => {
    expect(interpolate('Значение {missing}', { id: 1 })).toBe('Значение {missing}')
  })

  it('корректно интерполирует ключи с несколькими переменными', () => {
    expect(
      interpolate(translations.en['persistence.rulesMismatch'], { stored: '1.0.0', current: '1.1.0' }),
    ).toContain('1.0.0')
    expect(
      interpolate(translations.en['persistence.rulesMismatch'], { stored: '1.0.0', current: '1.1.0' }),
    ).toContain('1.1.0')
  })
})

describe('Форматирование значений', () => {
  it('форматирует время в UTC с явной меткой', () => {
    expect(formatUtcDateTime('2026-10-21T09:30:00.000Z', 'ru')).toBe('2026-10-21 09:30 UTC')
    expect(formatUtcDateTime('2026-10-21T09:30:00.000Z', 'en')).toBe('21 Oct 2026, 09:30 UTC')
  })

  it('не подменяет отсутствующие даты текущей датой', () => {
    expect(formatUtcDateTime(null, 'ru')).toBeNull()
    expect(formatUtcDateTime(null, 'en')).toBeNull()
  })

  it('возвращает некорректное значение как есть', () => {
    expect(formatUtcDateTime('не дата', 'ru')).toBe('не дата')
  })

  it('не изменяет числовые показатели при смене языка', () => {
    expect(formatInteger(3864)).toBe('3864')
    expect(formatInteger(0)).toBe('0')
    expect(formatPercentValue(78, 'ru')).toBe('78 %')
    expect(formatPercentValue(78, 'en')).toBe('78%')
    expect(formatClock(601)).toBe('10:01')
  })
})