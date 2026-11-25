import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import ProgressTrendChart from '../components/ProgressTrendChart'
import { useAuth } from '../hooks/useAuth'
import { localizePeriod } from '../i18n/analysisText'
import { formatClock } from '../i18n/formatters'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'
import { createRequestGuard } from '../lib/historyReports'
import { heroName } from '../lib/heroes'
import { LANING_INTERVAL_MINUTES } from '../lib/laning'
import { createSupabaseProgressReportsClient } from '../lib/matchReportsSupabase'
import {
  buildTrendSeries,
  chronologicalReports,
  filterSelfReports,
  findRecurringObservations,
  LANING_METRIC_KEYS,
  MATCH_METRIC_KEYS,
  metricDef,
  metricValue,
  PROGRESS_METRICS,
  summarizeTrend,
  type ProgressFilter,
  type ProgressMetricKey,
  type SelfProgressReport,
  type TrendDirection,
  type TrendSummary,
} from '../lib/progress'
import { loadProgressReports } from '../lib/progressFlow'
import { accountIdFromSteamId64 } from '../lib/steam/steamId'
import { getSupabase } from '../lib/supabase'

/** Локализованные названия показателей (ключ метрики → ключ словаря). */
const METRIC_LABEL_KEYS: Record<ProgressMetricKey, TranslationKey> = {
  kills: 'progress.metric.kills',
  deaths: 'progress.metric.deaths',
  assists: 'progress.metric.assists',
  kda: 'progress.metric.kda',
  gpm: 'progress.metric.gpm',
  xpm: 'progress.metric.xpm',
  last_hits: 'progress.metric.last_hits',
  denies: 'progress.metric.denies',
  net_worth: 'progress.metric.net_worth',
  level: 'progress.metric.level',
  last_hits_15: 'progress.metric.last_hits_15',
  gold_15: 'progress.metric.gold_15',
  xp_15: 'progress.metric.xp_15',
  kills_15: 'progress.metric.kills_15',
  deaths_15: 'progress.metric.deaths_15',
}

type ProgressState =
  | { status: 'loading' }
  | { status: 'waiting-auth' }
  | { status: 'signed-out' }
  | { status: 'needs-steam' }
  | { status: 'no-database' }
  | { status: 'error'; error: { message: string } }
  | {
      status: 'ok'
      reports: SelfProgressReport[]
      skippedInvalid: number
      skippedNoSelf: number
    }

/** Форматирование значения метрики; «недоступно» оставлено вызывающему коду. */
function formatMetricValue(key: ProgressMetricKey, value: number | null): string {
  if (value === null) {
    return ''
  }
  const decimals = metricDef(key).decimals
  return decimals > 0 ? value.toFixed(decimals) : String(value)
}

/** unix-секунды → ISO-строка даты (UTC), либо `null`. */
function unixToIsoDate(unix: number | null): string | null {
  if (unix === null) {
    return null
  }
  return new Date(unix * 1000).toISOString()
}

/** Начало дня (UTC) из значения `<input type="date">`; пусто → `null`. */
function isoToUnixStart(iso: string): number | null {
  if (iso === '') {
    return null
  }
  const time = Date.parse(`${iso}T00:00:00Z`)
  return Number.isNaN(time) ? null : Math.floor(time / 1000)
}

/** Конец дня (UTC) из значения `<input type="date">`; пусто → `null`. */
function isoToUnixEnd(iso: string): number | null {
  if (iso === '') {
    return null
  }
  const time = Date.parse(`${iso}T23:59:59Z`)
  return Number.isNaN(time) ? null : Math.floor(time / 1000)
}

/** unix-секунды → значение для `<input type="date">`; `null` → пустая строка. */
function unixToDateInput(unix: number | null | undefined): string {
  if (unix === null || unix === undefined) {
    return ''
  }
  return new Date(unix * 1000).toISOString().slice(0, 10)
}

/**
 * Прогресс игрока и сравнение матчей (Task 20).
 *
 * Данные приходят только из сохранённых собственных отчётов (Task 11–12):
 * запрос ограничен текущим пользователем, свой участник находится по Dota 2
 * `account_id` (из SteamID64), а повреждённые/неопределяемые записи честно
 * пропускаются. Никаких новых аналитических выводов и вторых источников нет.
 *
 * Защита от устаревших ответов — токен-генерация (`createRequestGuard`): при
 * смене аккаунта, выходе или повторной попытке предыдущий ответ не применяется.
 */
export default function ProgressPage() {
  const { user, loading: authLoading, steamIdentity } = useAuth()
  const { t, locale, formatDate } = useI18n()

  const [state, setState] = useState<ProgressState>({ status: 'loading' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [metric, setMetric] = useState<ProgressMetricKey>('gpm')
  const [filter, setFilter] = useState<ProgressFilter>({})
  const guardRef = useRef(createRequestGuard())

  const accountId =
    steamIdentity === null ? null : accountIdFromSteamId64(steamIdentity.steamId64)

  const client = useMemo(() => {
    const supabase = getSupabase()
    return supabase === null ? null : createSupabaseProgressReportsClient(supabase)
  }, [])

  const authStatus = authLoading ? 'loading' : user !== null ? 'authenticated' : 'anonymous'

  const load = useCallback(async () => {
    const token = guardRef.current.begin()
    setState({ status: 'loading' })

    const result = await loadProgressReports({
      authStatus,
      userId: user?.id ?? null,
      selfAccountId: accountId,
      client,
    })

    if (!guardRef.current.isCurrent(token)) {
      return
    }

    if (result.status === 'waiting-auth') {
      setState({ status: 'waiting-auth' })
    } else if (result.status === 'signed-out') {
      setState({ status: 'signed-out' })
    } else if (result.status === 'needs-steam') {
      setState({ status: 'needs-steam' })
    } else if (result.status === 'no-database') {
      setState({ status: 'no-database' })
    } else if (result.status === 'error') {
      setState({ status: 'error', error: { message: result.error.message } })
    } else {
      setState({
        status: 'ok',
        reports: result.reports,
        skippedInvalid: result.skippedInvalid,
        skippedNoSelf: result.skippedNoSelf,
      })
    }
  }, [authStatus, user, accountId, client])

  useEffect(() => {
    guardRef.current.invalidate()
    setSelected(new Set())
    setState({ status: 'loading' })
    void load()
    return () => guardRef.current.invalidate()
  }, [load])

  const reports = state.status === 'ok' ? state.reports : []

  const heroOptions = useMemo(() => {
    const ids = new Set<number>()
    for (const report of reports) {
      if (report.player.hero_id !== null) {
        ids.add(report.player.hero_id)
      }
    }
    return [...ids].sort((a, b) => a - b)
  }, [reports])

  const roleOptions = useMemo(() => {
    const roles = new Set<number>()
    for (const report of reports) {
      if (report.player.lane_role !== null) {
        roles.add(report.player.lane_role)
      }
    }
    return [1, 2, 3, 4].filter((role) => roles.has(role))
  }, [reports])

  const filteredReports = useMemo(() => filterSelfReports(reports, filter), [reports, filter])

  const selectedReports = useMemo(
    () => chronologicalReports(reports.filter((report) => selected.has(report.matchId))),
    [reports, selected],
  )

  const series = useMemo(() => buildTrendSeries(filteredReports, metric), [filteredReports, metric])
  const recurring = useMemo(() => findRecurringObservations(filteredReports), [filteredReports])

  const improvementRows = useMemo(() => {
    const rows: { key: ProgressMetricKey; label: TranslationKey; summary: TrendSummary }[] = []
    for (const key of [...MATCH_METRIC_KEYS, ...LANING_METRIC_KEYS]) {
      rows.push({ key, label: METRIC_LABEL_KEYS[key], summary: summarizeTrend(filteredReports, key) })
    }
    return rows
  }, [filteredReports])

  const laningReports = selectedReports.filter(
    (report) => report.player.laning.interval.minutes === LANING_INTERVAL_MINUTES,
  )
  const laningIncompatible = selectedReports.length - laningReports.length

const directionText = (direction: TrendDirection): string => {
    if (direction === 'improved') {
      return t('progress.trend.direction.improved')
    }
    if (direction === 'declined') {
      return t('progress.trend.direction.declined')
    }
    return t('progress.trend.direction.stable')
  }

  const roleLabel = (role: number | null): string | null => {
    if (role === 1) return t('bench.role.safe')
    if (role === 2) return t('bench.role.mid')
    if (role === 3) return t('bench.role.off')
    if (role === 4) return t('bench.role.jungle')
    return null
  }

  const heroLabel = (heroId: number | null): string =>
    heroName(heroId) ?? t('team.heroUnknown', { id: heroId ?? '—' })

  const dateLabel = (unix: number | null): string =>
    formatDate(unixToIsoDate(unix)) ?? t('common.noData')

  const playerWon = (report: SelfProgressReport): boolean | null => {
    if (report.player.team === null || report.radiantWin === null) {
      return null
    }
    return report.player.team === 'radiant' ? report.radiantWin : !report.radiantWin
  }

  const resultLabel = (report: SelfProgressReport): string => {
    const won = playerWon(report)
    if (won === true) return t('progress.result.win')
    if (won === false) return t('progress.result.loss')
    return t('progress.comparison.unavailable')
  }

  const metricOptions = PROGRESS_METRICS.map((def) => def.key)

  const toggleSelect = (matchId: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(matchId)) {
        next.delete(matchId)
      } else {
        next.add(matchId)
      }
      return next
    })
  }

  return (
    <section className="page page--progress" aria-busy={state.status === 'loading'}>
      <div className="container">
        <div className="progress-page__head">
          <span className="badge badge--warn">{t('progress.badge')}</span>
          <h1 className="stub__title">{t('progress.title')}</h1>
          <p className="stub__text">{t('progress.lead')}</p>
        </div>

        {state.status === 'loading' && (
          <div className="stub__panel panel">
            <p className="stub__text" role="status" aria-live="polite">
              {t('progress.loading')}
            </p>
          </div>
        )}

        {state.status === 'waiting-auth' && (
          <div className="stub__panel panel">
            <p className="stub__text" role="status" aria-live="polite">
              {t('progress.waitingAuth')}
            </p>
          </div>
        )}

        {state.status === 'signed-out' && (
          <div className="stub__panel panel">
            <p className="stub__text" role="status" aria-live="polite">
              {t('progress.signedOut')}
            </p>
            <Link className="btn btn--primary" to="/login">
              {t('nav.login')}
            </Link>
          </div>
        )}

        {state.status === 'needs-steam' && (
          <div className="stub__panel panel">
            <span className="badge badge--warn">{t('progress.needsSteam')}</span>
            <p className="stub__text">{t('progress.needsSteamHint')}</p>
            <Link className="btn btn--primary" to="/profile">
              {t('nav.profile')}
            </Link>
          </div>
        )}

        {state.status === 'no-database' && (
          <div className="stub__panel panel">
            <p className="auth-alert auth-alert--error" role="alert">
              {t('progress.noDatabase')}
            </p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="stub__panel panel">
            <p className="stub__text" role="alert">
              {t('progress.error')}
            </p>
            <p className="auth-alert auth-alert--error">{state.error.message}</p>
            <div className="stub__actions">
              <button type="button" className="btn btn--primary" onClick={() => void load()}>
                {t('progress.retry')}
              </button>
              <Link className="btn btn--ghost" to="/">
                {t('common.backHome')}
              </Link>
            </div>
          </div>
        )}

{state.status === 'ok' && reports.length === 0 && (
          <div className="stub__panel panel">
            {state.skippedNoSelf > 0 ? (
              <>
                <span className="badge badge--warn">{t('progress.noSelfTitle')}</span>
                <p className="stub__text">{t('progress.noSelfHint')}</p>
              </>
            ) : (
              <>
                <p className="stub__text" role="status" aria-live="polite">
                  {t('progress.empty')}
                </p>
                <p className="stub__text">{t('progress.emptyHint')}</p>
                <Link className="btn btn--primary" to="/">
                  {t('profile.progress.analyzeMatch')}
                </Link>
              </>
            )}
            {state.skippedInvalid > 0 && (
              <p className="history__note" role="note">
                {t('progress.skippedInvalid', { count: state.skippedInvalid })}
              </p>
            )}
            {state.skippedNoSelf > 0 && (
              <p className="history__note" role="note">
                {t('progress.skippedNoSelf', { count: state.skippedNoSelf })}
              </p>
            )}
          </div>
        )}

        {state.status === 'ok' && reports.length > 0 && (
          <>
            {(state.skippedInvalid > 0 || state.skippedNoSelf > 0) && (
              <div className="progress-notice" role="note">
                {state.skippedInvalid > 0 && (
                  <p className="history__note">
                    {t('progress.skippedInvalid', { count: state.skippedInvalid })}
                  </p>
                )}
                {state.skippedNoSelf > 0 && (
                  <p className="history__note">
                    {t('progress.skippedNoSelf', { count: state.skippedNoSelf })}
                  </p>
                )}
              </div>
            )}

            {/* --- Выбор матчей --- */}
            <section className="progress-section panel" aria-labelledby="progress-select-title">
              <header className="progress-section__head">
                <h2 className="progress-section__title" id="progress-select-title">
                  {t('progress.select.title')}
                </h2>
                <p className="stub__hint">{t('progress.select.lead')}</p>
              </header>

              <div className="progress-select__bar">
                <span className="progress-select__count">
                  {t('progress.select.selected', { count: selected.size })}
                </span>
                {selected.size > 0 && (
                  <button type="button" className="btn btn--ghost" onClick={() => setSelected(new Set())}>
                    {t('progress.select.clear')}
                  </button>
                )}
              </div>

              <ul className="progress-select__list">
                {chronologicalReports(reports).map((report) => {
                  const checked = selected.has(report.matchId)
                  return (
                    <li className="progress-select__item" key={report.matchId}>
                      <label className="progress-select__label">
                        <input
                          className="progress-select__checkbox"
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(report.matchId)}
                        />
                        <span className="progress-select__main">
                          <span className="progress-select__hero">{heroLabel(report.player.hero_id)}</span>
                          <span className="progress-select__meta">
                            {t('history.matchTitle', { id: report.matchId })} · {dateLabel(report.startTime)}
                          </span>
                        </span>
                        <Link
                          className="btn btn--ghost progress-select__open"
                          to={`/matches/${report.matchId}`}
                        >
                          {t('progress.comparison.open')}
                        </Link>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>

{/* --- Сравнение матчей --- */}
            <section className="progress-section panel" aria-labelledby="progress-comparison-title">
              <header className="progress-section__head">
                <h2 className="progress-section__title" id="progress-comparison-title">
                  {t('progress.comparison.title')}
                </h2>
                <p className="stub__hint">{t('progress.comparison.lead')}</p>
              </header>

              {selectedReports.length < 2 ? (
                <p className="stub__text" role="note">
                  {t('progress.select.onlyOne')}
                </p>
              ) : (
                <div className="progress-scroll">
                  <table className="progress-table">
                    <caption className="visually-hidden">{t('progress.comparison.title')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('progress.comparison.hero')}</th>
                        <th scope="col">{t('progress.comparison.role')}</th>
                        <th scope="col">{t('progress.comparison.date')}</th>
                        <th scope="col">{t('progress.comparison.duration')}</th>
                        <th scope="col">{t('progress.comparison.result')}</th>
                        {MATCH_METRIC_KEYS.map((key) => (
                          <th scope="col" key={key}>
                            {t(METRIC_LABEL_KEYS[key])}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReports.map((report) => (
                        <tr key={report.matchId}>
                          <th scope="row" className="progress-cell progress-cell--hero">
                            {heroLabel(report.player.hero_id)}
                          </th>
                          <td className="progress-cell">
                            {roleLabel(report.player.lane_role) ?? t('progress.comparison.unavailable')}
                          </td>
                          <td className="progress-cell">{dateLabel(report.startTime)}</td>
                          <td className="progress-cell">
                            {report.duration === null
                              ? t('progress.comparison.unavailable')
                              : formatClock(report.duration)}
                          </td>
                          <td className="progress-cell">{resultLabel(report)}</td>
                          {MATCH_METRIC_KEYS.map((key) => {
                            const value = metricValue(report, key)
                            return (
                              <td className="progress-cell" key={key}>
                                {value === null
                                  ? t('progress.comparison.unavailable')
                                  : formatMetricValue(key, value)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

{/* --- Первые 15 минут --- */}
            <section className="progress-section panel" aria-labelledby="progress-laning-title">
              <header className="progress-section__head">
                <h2 className="progress-section__title" id="progress-laning-title">
                  {t('progress.laning.title')}
                </h2>
                <p className="stub__hint">{t('progress.laning.lead')}</p>
              </header>

              {selectedReports.length < 2 ? (
                <p className="stub__text" role="note">
                  {t('progress.select.onlyOne')}
                </p>
              ) : laningReports.length < 2 ? (
                <p className="stub__text" role="note">
                  {t('progress.laning.incompatible')}
                </p>
              ) : (
                <>
                  <div className="progress-scroll">
                    <table className="progress-table">
                      <caption className="visually-hidden">{t('progress.laning.title')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('progress.comparison.hero')}</th>
                          <th scope="col">{t('progress.comparison.date')}</th>
                          {LANING_METRIC_KEYS.map((key) => (
                            <th scope="col" key={key}>
                              {t(METRIC_LABEL_KEYS[key])}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {laningReports.map((report) => (
                          <tr key={report.matchId}>
                            <th scope="row" className="progress-cell progress-cell--hero">
                              {heroLabel(report.player.hero_id)}
                            </th>
                            <td className="progress-cell">{dateLabel(report.startTime)}</td>
                            {LANING_METRIC_KEYS.map((key) => {
                              const value = metricValue(report, key)
                              return (
                                <td className="progress-cell" key={key}>
                                  {value === null
                                    ? t('progress.comparison.unavailable')
                                    : formatMetricValue(key, value)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {laningIncompatible > 0 && (
                    <p className="history__note" role="note">
                      {t('progress.laning.incompatible')}
                    </p>
                  )}
                </>
              )}
            </section>

{/* --- Фильтры и динамика --- */}
            <section className="progress-section panel" aria-labelledby="progress-trend-title">
              <header className="progress-section__head">
                <h2 className="progress-section__title" id="progress-trend-title">
                  {t('progress.trend.title')}
                </h2>
                <p className="stub__hint">{t('progress.trend.lead')}</p>
              </header>

              <div className="progress-filter" role="group" aria-label={t('progress.filter.title')}>
                <label className="progress-filter__field">
                  <span className="progress-filter__label">{t('progress.filter.hero')}</span>
                  <select
                    className="progress-filter__select"
                    value={filter.heroId ?? ''}
                    onChange={(event) =>
                      setFilter((previous) => ({
                        ...previous,
                        heroId: event.target.value === '' ? null : Number(event.target.value),
                      }))
                    }
                  >
                    <option value="">{t('progress.filter.all')}</option>
                    {heroOptions.map((heroId) => (
                      <option value={heroId} key={heroId}>
                        {heroName(heroId) ?? String(heroId)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="progress-filter__field">
                  <span className="progress-filter__label">{t('progress.filter.role')}</span>
                  <select
                    className="progress-filter__select"
                    value={filter.laneRole ?? ''}
                    onChange={(event) =>
                      setFilter((previous) => ({
                        ...previous,
                        laneRole: event.target.value === '' ? null : Number(event.target.value),
                      }))
                    }
                  >
                    <option value="">{t('progress.filter.all')}</option>
                    {roleOptions.map((role) => (
                      <option value={role} key={role}>
                        {roleLabel(role) ?? String(role)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="progress-filter__field">
                  <span className="progress-filter__label">{t('progress.filter.from')}</span>
                  <input
                    className="progress-filter__input"
                    type="date"
                    value={unixToDateInput(filter.from)}
                    onChange={(event) =>
                      setFilter((previous) => ({ ...previous, from: isoToUnixStart(event.target.value) }))
                    }
                  />
                </label>

                <label className="progress-filter__field">
                  <span className="progress-filter__label">{t('progress.filter.to')}</span>
                  <input
                    className="progress-filter__input"
                    type="date"
                    value={unixToDateInput(filter.to)}
                    onChange={(event) =>
                      setFilter((previous) => ({ ...previous, to: isoToUnixEnd(event.target.value) }))
                    }
                  />
                </label>

                <button type="button" className="btn btn--ghost" onClick={() => setFilter({})}>
                  {t('progress.filter.reset')}
                </button>
              </div>

              <label className="progress-metric-picker">
                <span className="progress-filter__label">{t('progress.trend.metricLabel')}</span>
                <select
                  className="progress-filter__select"
                  value={metric}
                  onChange={(event) => setMetric(event.target.value as ProgressMetricKey)}
                >
                  {metricOptions.map((key) => (
                    <option value={key} key={key}>
                      {t(METRIC_LABEL_KEYS[key])}
                    </option>
                  ))}
                </select>
              </label>

              <ProgressTrendChart
                points={series}
                formatDate={(unix) => dateLabel(unix)}
                formatValue={(value) => formatMetricValue(metric, value)}
              />

              <p className="history__note" role="note">
                {t('progress.trend.sample', { count: series.length })}
              </p>
            </section>

{/* --- Повторяющиеся наблюдения --- */}
            <section className="progress-section panel" aria-labelledby="progress-observations-title">
              <header className="progress-section__head">
                <h2 className="progress-section__title" id="progress-observations-title">
                  {t('progress.observations.title')}
                </h2>
                <p className="stub__hint">{t('progress.observations.lead')}</p>
              </header>

              {recurring.length === 0 ? (
                <p className="stub__text" role="note">
                  {t('progress.observations.empty')}
                </p>
              ) : (
                <ul className="progress-observations">
                  {recurring.map((group) => (
                    <li className="progress-observation" key={group.ruleId}>
                      <div className="progress-observation__head">
                        <code className="progress-observation__rule">
                          {group.ruleVersion === null
                            ? group.ruleId
                            : t('progress.observations.ruleVersion', {
                                ruleId: group.ruleId,
                                version: group.ruleVersion,
                              })}
                        </code>
                        <span className="progress-observation__count">
                          {t('progress.observations.occurrences', {
                            count: group.count,
                            total: group.totalMatches,
                          })}
                        </span>
                      </div>
                      <p className="progress-observation__metric">
                        {group.metric} · {localizePeriod(group.period, locale)}
                      </p>
                      <p className="progress-observation__supporting">
                        {t('progress.observations.supporting', { matches: group.matchIds.join(', ') })}
                      </p>
                      {group.frequencyComparable && (
                        <p className="progress-observation__frequency">
                          {t('progress.observations.frequency', {
                            first: group.firstHalfCount,
                            second: group.secondHalfCount,
                          })}
                        </p>
                      )}
                      {group.excludedByVersion > 0 && (
                        <p className="history__note">
                          {t('progress.observations.versionMismatch', { count: group.excludedByVersion })}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* --- История изменений --- */}
            <section className="progress-section panel" aria-labelledby="progress-improvement-title">
              <header className="progress-section__head">
                <h2 className="progress-section__title" id="progress-improvement-title">
                  {t('progress.improvement.title')}
                </h2>
                <p className="stub__hint">{t('progress.improvement.lead')}</p>
              </header>

              <ul className="progress-improvements">
                {improvementRows.map(({ key, label, summary: rowSummary }) => (
                  <li className="progress-improvement" key={key}>
                    <span className="progress-improvement__label">{t(label)}</span>
                    {rowSummary.status === 'insufficient' ? (
                      <span className="progress-improvement__value progress-improvement__value--muted">
                        {t('progress.trend.insufficient', { count: rowSummary.count })}
                      </span>
                    ) : (
                      <span className="progress-improvement__value">
                        <span className={`progress-direction progress-direction--${rowSummary.direction}`}>
                          {directionText(rowSummary.direction)}
                        </span>
                        <span className="progress-improvement__fromto">
                          {t('progress.improvement.fromTo', {
                            first: formatMetricValue(key, rowSummary.first.value),
                            last: formatMetricValue(key, rowSummary.last.value),
                          })}
                        </span>
                        <span className="progress-improvement__delta">
                          {t('progress.improvement.delta', {
                            delta: rowSummary.delta > 0 ? `+${rowSummary.delta}` : String(rowSummary.delta),
                          })}
                        </span>
                        <span className="progress-improvement__sample">
                          {t('progress.trend.sample', { count: rowSummary.count })}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </section>
  )
}