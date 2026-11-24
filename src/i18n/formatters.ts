import type { Locale } from './translations'

/**
 * Форматирование дат, времени и чисел с учётом локали (Task 13).
 *
 * Все значения берутся из сохранённых фактов без переинтерпретации:
 *  - временные метки отчётов показываются в UTC с явной меткой (как и раньше);
 *  - числовые показатели матча выводятся как есть, чтобы не искажать факты;
 *  - отсутствующие значения остаются отсутствующими, а не «сегодняшней датой».
 */

const EN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/**
 * Временная метка в UTC.
 *
 * `ru`: `2026-10-21 09:30 UTC` (формат сохранён с Task 11/12).
 * `en`: `21 Oct 2026, 09:30 UTC`.
 * Некорректное значение возвращается как есть; `null` остаётся `null`.
 */
export function formatUtcDateTime(value: string | null, locale: Locale): string | null {
  if (value === null) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  const iso = parsed.toISOString()
  const date = iso.slice(0, 10)
  const time = iso.slice(11, 16)
  if (locale === 'en') {
    const monthIndex = Number(date.slice(5, 7)) - 1
    const month = EN_MONTHS[monthIndex] ?? date.slice(5, 7)
    return `${date.slice(8, 10)} ${month} ${date.slice(0, 4)}, ${time} UTC`
  }
  return `${date} ${time} UTC`
}

/**
 * Дата в UTC без времени (Task 20B): `ru` — `2026-11-18`, `en` — `18 Nov 2026`.
 * Используется для подписей недель активности; значение не сдвигается по часовому
 * поясу, поэтому недели не «переезжают» между локальными зонами.
 * Некорректное значение возвращается как есть; `null` остаётся `null`.
 */
export function formatUtcDate(value: string | null, locale: Locale): string | null {
  if (value === null) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  const date = parsed.toISOString().slice(0, 10)
  if (locale === 'en') {
    const monthIndex = Number(date.slice(5, 7)) - 1
    const month = EN_MONTHS[monthIndex] ?? date.slice(5, 7)
    return `${date.slice(8, 10)} ${month} ${date.slice(0, 4)}`
  }
  return date
}

const RU_MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const

const EN_MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/**
 * Название месяца из ключа `YYYY-MM` (Task 20B.3): `ru` — «Ноябрь 2026»,
 * `en` — «November 2026». Ключ — технический (UTC), название — локализованное.
 */
export function formatUtcMonth(monthKey: string, locale: Locale): string {
  const year = monthKey.slice(0, 4)
  const monthIndex = Number(monthKey.slice(5, 7)) - 1
  const month =
    locale === 'en'
      ? (EN_MONTHS_FULL[monthIndex] ?? monthKey.slice(5, 7))
      : (RU_MONTHS[monthIndex] ?? monthKey.slice(5, 7))
  return `${month} ${year}`
}

const RU_MONTHS_SHORT = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
] as const

const EN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** Короткое название месяца из ключа `YYYY-MM` (GitHub-стиль подписи тепловой карты). */
export function formatUtcMonthShort(monthKey: string, locale: Locale): string {
  const monthIndex = Number(monthKey.slice(5, 7)) - 1
  return (locale === 'en' ? EN_MONTHS_SHORT : RU_MONTHS_SHORT)[monthIndex] ?? monthKey.slice(5, 7)
}

/**
 * Целое число как есть.
 *
 * Показатели матча (GPM, XPM, добивания, золото) не группируются разрядами,
 * чтобы сохранённые факты отображались без искажений.
 */
export function formatInteger(value: number): string {
  return String(value)
}

/** Процент: `ru` — «78 %», `en` — «78 %» (значение не изменяется). */
export function formatPercentValue(value: number, locale: Locale): string {
  return locale === 'en' ? `${value}%` : `${value} %`
}

/** Длительность матча в секундах → «MM:SS» (не зависит от локали). */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}