import { useState } from 'react'

import { useI18n } from '../i18n/I18nContext'
import { formatUtcMonthShort } from '../i18n/formatters'
import type { TranslationKey } from '../i18n/translations'
import type { OpenDotaError } from '../lib/opendota'
import type { MatchFeedResult } from '../lib/opendotaPlayer'
import { buildActivityHeatmap, heatmapYears } from '../lib/playerStats'

import ProfileErrorNote from './ProfileErrorNote'

interface ProfileActivityProps {
  history: MatchFeedResult | null
  error: OpenDotaError | null
  /** Момент получения данных профиля (ISO) — «сейчас» для построения карты. */
  fetchedAt: string
  onRetry: () => void
}

/** Заголовки дней недели (понедельник первым), по локали. */
export const WEEKDAY_KEYS: readonly TranslationKey[] = [
  'profile.calendar.weekday.mon',
  'profile.calendar.weekday.tue',
  'profile.calendar.weekday.wed',
  'profile.calendar.weekday.thu',
  'profile.calendar.weekday.fri',
  'profile.calendar.weekday.sat',
  'profile.calendar.weekday.sun',
]

/** Уровень интенсивности заливки дня (0–4) — количество уровней легенды. */
function intensityLevel(matches: number): number {
  if (matches <= 0) {
    return 0
  }
  if (matches === 1) {
    return 1
  }
  if (matches <= 3) {
    return 2
  }
  if (matches <= 6) {
    return 3
  }
  return 4
}

/**
 * Компактная тепловая карта активности (GitHub-стиль, Task 20B.5).
 *
 * Недели — столбцы, 7 строк от понедельника к воскресенью; мелкие закруглённые
 * ячейки с зелёной интенсивностью на тёмном фоне. Ячейки показывают дату и число
 * матчей в `title`/`aria-label` (hover/фокус) и по тапу выводят строку деталей.
 * Селектор года переключает отображение по уже загруженной истории; дни вне
 * покрытия выборки помечаются «нет данных», а не «0».
 */
export default function ProfileActivity({ history, error, fetchedAt, onRetry }: ProfileActivityProps) {
  const { t, formatDate, locale } = useI18n()
  const [year, setYear] = useState<number | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  if (history === null) {
    return (
      <section className="profile-section" aria-labelledby="profile-calendar-title">
        <header className="profile-section__head">
          <h2 className="profile-section__title" id="profile-calendar-title">
            {t('profile.calendar.title')}
          </h2>
          <p className="profile-section__lead">{t('profile.calendar.lead')}</p>
        </header>
        {error !== null ? (
          <ProfileErrorNote error={error} onRetry={onRetry} />
        ) : (
          <p className="profile-note">{t('profile.calendar.unavailable')}</p>
        )}
      </section>
    )
  }

  const now = new Date(fetchedAt)
  const years = heatmapYears(history.items, now)
  const effectiveYear = year ?? years[0]
  const oldestSeconds = history.oldestMatchTime
    ? Math.floor(Date.parse(history.oldestMatchTime) / 1000)
    : 0
  const coverageStartSeconds = history.truncated && history.oldestMatchTime ? oldestSeconds : 0
  const heat = buildActivityHeatmap(history.items, {
    year: effectiveYear,
    now,
    truncated: history.truncated,
    coverageStartSeconds,
  })
  const todayKey = now.toISOString().slice(0, 10)

  // RENDER_BODY
  return (
    <section className="profile-section" aria-labelledby="profile-calendar-title">
      <header className="profile-section__head">
        <h2 className="profile-section__title" id="profile-calendar-title">
          {t('profile.calendar.title')}
        </h2>
        <p className="profile-section__lead">{t('profile.calendar.lead')}</p>
      </header>

      <div className="profile-heat panel">
        <div className="profile-heat__toolbar">
          <label className="profile-heat__year">
            <span className="profile-heat__year-label">{t('profile.calendar.yearLabel')}</span>
            <select
              className="profile-heat__year-select"
              value={effectiveYear}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <span className="profile-heat__total">
            {t('profile.calendar.yearMatches', { year: effectiveYear, count: heat.totalMatches })}
          </span>
        </div>

        <div className="profile-heat__scroll">
          <div
            className="profile-heat__months"
            aria-hidden="true"
            style={{ gridTemplateColumns: `42px repeat(${heat.weeks.length}, 14px)` }}
          >
            {heat.monthStarts.map((month) => (
              <span
                key={month.monthKey}
                className="profile-heat__month"
                style={{ gridColumn: month.weekIndex + 2 }}
              >
                {formatUtcMonthShort(month.monthKey, locale)}
              </span>
            ))}
          </div>

          <div className="profile-heat__body">
            <div className="profile-heat__weekdays" aria-hidden="true">
              {WEEKDAY_KEYS.map((key) => (
                <span key={key}>{t(key)}</span>
              ))}
            </div>

            <div className="profile-heat__weeks">
              {heat.weeks.map((week, weekIndex) => (
                <div className="profile-heat__week" key={weekIndex}>
                  {week.map((cell, index) => {
                    if (cell === null) {
                      return <span className="profile-heat__blank" key={`blank-${index}`} />
                    }
                    const dateLabel = formatDate(`${cell.dateKey}T00:00:00.000Z`)
                    const label = cell.available
                      ? t('profile.calendar.dayLabel', {
                          date: dateLabel ?? cell.dateKey,
                          count: cell.matches,
                        })
                      : t('profile.calendar.dayNoData', { date: dateLabel ?? cell.dateKey })
                    const isToday = cell.dateKey === todayKey
                    const level = intensityLevel(cell.matches)
                    return (
                      <button
                        type="button"
                        key={cell.dateKey}
                        className={`profile-heat__cell ${
                          cell.available ? `profile-heat__cell--l${level}` : 'profile-heat__cell--na'
                        }${isToday ? ' profile-heat__cell--today' : ''}`}
                        title={label}
                        aria-label={label}
                        data-date={cell.dateKey}
                        onClick={() => setSelected(label)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <output className="profile-heat__live" aria-live="polite">
          {selected ?? t('profile.calendar.legend')}
        </output>

        {heat.totalMatches === 0 && (
          <p className="profile-note">{t('profile.calendar.empty')}</p>
        )}

        <div className="profile-heat__legend">
          <span className="profile-heat__legend-text">{t('profile.calendar.less')}</span>
          <span className="profile-heat__scale" aria-hidden="true">
            <span className="profile-heat__swatch profile-heat__swatch--0" />
            <span className="profile-heat__swatch profile-heat__swatch--1" />
            <span className="profile-heat__swatch profile-heat__swatch--2" />
            <span className="profile-heat__swatch profile-heat__swatch--3" />
            <span className="profile-heat__swatch profile-heat__swatch--4" />
          </span>
          <span className="profile-heat__legend-text">{t('profile.calendar.more')}</span>
        </div>

        {heat.truncated && heat.coverageStart !== null ? (
          <p className="profile-note profile-note--warn" role="note">
            {t('profile.calendar.coverageTruncated', {
              from: formatDate(heat.coverageStart) ?? '—',
            })}
          </p>
        ) : (
          <p className="profile-note" role="note">
            {t('profile.calendar.complete')}
          </p>
        )}
      </div>
    </section>
  )
}
