import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import AbilityBuild from '../components/AbilityBuild'
import AnalysisReport from '../components/AnalysisReport'
import BuildingsMap from '../components/BuildingsMap'
import LaneReport from '../components/LaneReport'
import LaningBenchmarks from '../components/LaningBenchmarks'
import PlayerInsights from '../components/PlayerInsights'
import ItemTimings from '../components/ItemTimings'
import MatchHeader from '../components/MatchHeader'
import MatchParseNotice from '../components/MatchParseNotice'
import PlayerStats from '../components/PlayerStats'
import ReportPersistenceNotice from '../components/ReportPersistenceNotice'
import TeamOverview from '../components/TeamOverview'
import { useAuth } from '../hooks/useAuth'
import {
  loadOrCreatePersonalReport,
  retrySaveReport,
  type MatchReportFlowDeps,
  type MatchReportFlowPhase,
  type ReportSaveState,
} from '../lib/matchReportFlow'
import {
  ensureDetailedMatchData,
  type MatchParseOutcome,
  type MatchParsePhase,
} from '../lib/matchParseFlow'
import { loadVisualizationMetadata } from '../lib/matchEnrichment'
import type { NormalizedMatch } from '../types/match'
import { createBrowserParseAttemptStore } from '../lib/replayParsing'
import { fetchParseJobStatus, requestReplayParse, resolveOpenDotaApiKey } from '../lib/opendotaParse'
import {
  createMatchReportsService,
  findStoredPlayerAnalysis,
  type MatchReportView,
} from '../lib/matchReports'
import { createSupabaseMatchReportsClient } from '../lib/matchReportsSupabase'
import type { BenchmarkSnapshot } from '../lib/benchmarks'
import { loadBenchmarkSnapshot } from '../lib/benchmarkSnapshot'
import { loadItemTimingSnapshot, type ItemTimingSnapshot } from '../lib/itemTimings'
import { findPlayerBySlot, pickDefaultPlayerSlot } from '../lib/matchView'
import { fetchMatchById, isRetryableError, validateMatchId, type OpenDotaError } from '../lib/opendota'
import { getSupabase } from '../lib/supabase'
import { useI18n } from '../i18n/I18nContext'
import { matchIdErrorText, openDotaErrorText, type MatchIdErrorCode } from '../i18n/errors'
import type { TranslationKey } from '../i18n/translations'

type MatchState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string; code: MatchIdErrorCode }
  | { status: 'report'; view: MatchReportView; save: ReportSaveState }
  | { status: 'report-error'; message: string }
  | { status: 'error'; error: OpenDotaError }

/** Ключи словаря для шагов работы (Task 11): видно, что именно выполняется сейчас. */
const PHASE_KEYS: Record<MatchReportFlowPhase, TranslationKey> = {
  'checking-report': 'match.phase.checkingReport',
  'fetching-match': 'match.phase.fetching',
  'requesting-parse': 'match.phase.requestingParse',
  'waiting-parse': 'match.phase.waitingParse',
  refetching: 'match.phase.refetching',
  analyzing: 'match.phase.analyzing',
  saving: 'match.phase.saving',
}

/**
 * Фазы автоматической обработки реплея (Task 14) отображаются теми же подписями,
 * что и шаги отчёта: пользователь видит единый прогресс без «второй» шкалы.
 */
const PARSE_PHASE_TO_FLOW: Record<MatchParsePhase, MatchReportFlowPhase> = {
  'inspecting-data': 'fetching-match',
  'requesting-parse': 'requesting-parse',
  'waiting-parse': 'waiting-parse',
  refetching: 'refetching',
}

/**
 * Страница матча (Tasks 5–11).
 *
 * Порядок работы:
 *  1) валидация ID матча (Task 5);
 *  2) ожидание достоверного состояния сессии Supabase (Task 3);
 *  3) поиск сохранённого личного отчёта (Task 11) — при наличии он используется
 *     без обращения к OpenDota и без пересчёта правил;
 *  4) иначе — получение матча у OpenDota (Task 5), нормализация (Task 6),
 *     анализ всех участников (Task 9) и сохранение одного личного отчёта;
 *  5) выбор участника остаётся локальным состоянием: он не вызывает ни запросов,
 *     ни записей в базу.
 */
export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const { user, loading: authLoading, isConfigured } = useAuth()
  const { t } = useI18n()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<MatchState>({ status: 'loading' })
  const [phase, setPhase] = useState<MatchReportFlowPhase | null>(null)
  // Устойчивый идентификатор выбранного участника — player_slot.
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [retrying, setRetrying] = useState(false)
  /** Итог автоматической обработки реплея (Task 14) для честного статуса в интерфейсе. */
  const [parseOutcome, setParseOutcome] = useState<MatchParseOutcome | null>(null)
  /**
   * Обработчик фаз парсинга передаётся в поток через ссылку: сам поток создаётся
   * в `useMemo`, а обновлять состояние React можно только из актуального эффекта.
   */
  const parsePhaseHandler = useRef<((phase: MatchParsePhase) => void) | null>(null)
  /**
   * Отображаемый матч, дополненный недостающими метаданными визуализаций (Task 15).
   * Сохранённый отчёт при этом не изменяется: дополнение живёт только в состоянии
   * страницы и не записывается в Supabase.
   */
  const [enrichedMatch, setEnrichedMatch] = useState<NormalizedMatch | null>(null)
  /** Нормативы 15-й минуты (Task 16): `undefined` — ещё грузятся, `null` — недоступны. */
  const [benchmarkSnapshot, setBenchmarkSnapshot] = useState<BenchmarkSnapshot | null | undefined>(
    undefined,
  )
  /** Нормативы таймингов предметов (Task 18): `undefined` — грузятся, `null` — недоступны. */
  const [itemTimingSnapshot, setItemTimingSnapshot] = useState<ItemTimingSnapshot | null | undefined>(
    undefined,
  )
  const [enrichmentState, setEnrichmentState] = useState<'idle' | 'loading' | 'enriched' | 'unavailable'>(
    'idle',
  )

  /** Достоверное состояние сессии: пока сессия восстанавливается, работать нельзя. */
  const authStatus = authLoading ? 'loading' : user !== null ? 'authenticated' : 'anonymous'

  /** Записи о запущенных задачах обработки: дубликаты запросов не создаются. */
  const parseStore = useMemo(
    () => createBrowserParseAttemptStore(typeof window === 'undefined' ? null : window.localStorage),
    [],
  )
  /** Необязательный ключ OpenDota из окружения сборки (только повышение лимитов). */
  const parseApiKey = useMemo(
    () => resolveOpenDotaApiKey(import.meta.env as unknown as Record<string, unknown>),
    [],
  )

  const service = useMemo(() => {
    const supabase = getSupabase()
    return supabase === null
      ? null
      : createMatchReportsService(createSupabaseMatchReportsClient(supabase))
  }, [isConfigured])

  const flowDeps = useMemo<Omit<MatchReportFlowDeps, 'onPhase' | 'onParseOutcome'>>(
    () => ({
      authStatus,
      userId: user?.id ?? null,
      service,
      fetchMatch: fetchMatchById,
      // Автоматическая обработка реплея: запрос отправляется без отдельной кнопки.
      parseDetailedData: ({ matchId: id, rawMatch, match: normalized, signal: innerSignal }) =>
        ensureDetailedMatchData({
          matchId: id,
          rawMatch,
          match: normalized,
          fetchMatch: fetchMatchById,
          requestParse: requestReplayParse,
          fetchJobStatus: fetchParseJobStatus,
          now: () => new Date(),
          store: parseStore,
          apiKey: parseApiKey,
          signal: innerSignal,
          onPhase: (next) => parsePhaseHandler.current?.(next),
        }),
      now: () => new Date(),
    }),
    [authStatus, user?.id, service, parseStore, parseApiKey],
  )

  useEffect(() => {
    const validation = validateMatchId(matchId ?? '')
    if (!validation.ok) {
      setState({ status: 'invalid', message: validation.message, code: validation.code })
      setSelectedSlot(null)
      setPhase(null)
      return
    }

    // Пока состояние сессии не восстановлено, ни чтение, ни запись не выполняются.
    if (authStatus === 'loading') {
      setState({ status: 'loading' })
      setPhase(null)
      return
    }

    const controller = new AbortController()
    let active = true
    // Смена матча: прежние данные, выбранный игрок и состояние сохранения сбрасываются.
    setState({ status: 'loading' })
    setSelectedSlot(null)
    setPhase('checking-report')
    setRetrying(false)
    setParseOutcome(null)
    // Фазы автоматической обработки реплея показываются теми же подписями прогресса.
    parsePhaseHandler.current = (next) => {
      if (active) {
        setPhase(PARSE_PHASE_TO_FLOW[next])
      }
    }

    loadOrCreatePersonalReport(
      {
        ...flowDeps,
        onPhase: (next) => {
          if (active) {
            setPhase(next)
          }
        },
        onParseOutcome: (outcome) => {
          if (active) {
            setParseOutcome(outcome)
          }
        },
      },
      validation.value,
      controller.signal,
    ).then((result) => {
      // Устаревшие и отменённые ответы не применяем.
      if (!active || controller.signal.aborted || result.status === 'aborted') {
        return
      }
      if (result.status === 'waiting-auth') {
        setPhase(null)
        return
      }
      if (result.status === 'provider-error') {
        setPhase(null)
        setState({ status: 'error', error: result.error })
        return
      }
      if (result.status === 'invalid-stored-report') {
        setPhase(null)
        setState({ status: 'report-error', message: result.message })
        return
      }
      setPhase(null)
      setState({ status: 'report', view: result.view, save: result.save })
      // По умолчанию выбирается первый доступный участник нового матча.
      setSelectedSlot(pickDefaultPlayerSlot(result.view.match.players))
    })

    // Отмена запроса при уходе со страницы или смене маршрута.
    return () => {
      active = false
      controller.abort()
      parsePhaseHandler.current = null
    }
  }, [matchId, attempt, authStatus, flowDeps])

  /**
   * Дополнение визуализаций для старых снимков (Task 15).
   *
   * Выполняется ровно один read-only запрос матча и только если в снимке нет метаданных
   * для Ability Build / карты зданий / инвентаря. Сохранённый отчёт не изменяется,
   * обработка реплея не запрашивается, запись в Supabase не выполняется: результат
   * живёт только в состоянии страницы. Повторные запросы к тому же матчу исключены
   * кэшем модуля, отмена выполняется через AbortController.
   */
  const reportMatch = state.status === 'report' ? state.view.match : null
  const reportMatchId = state.status === 'report' ? state.view.matchId : null

  useEffect(() => {
    if (reportMatch === null || reportMatchId === null) {
      setEnrichedMatch(null)
      setEnrichmentState('idle')
      return
    }
    const controller = new AbortController()
    let active = true
    setEnrichmentState('loading')
    loadVisualizationMetadata({
      matchId: reportMatchId,
      match: reportMatch,
      fetchMatch: fetchMatchById,
      signal: controller.signal,
    })
      .then((outcome) => {
        if (!active) {
          return
        }
        if (outcome.kind === 'enriched') {
          setEnrichedMatch(outcome.match)
          setEnrichmentState('enriched')
          return
        }
        setEnrichedMatch(null)
        setEnrichmentState(outcome.kind === 'unavailable' ? 'unavailable' : 'idle')
      })
      .catch(() => {
        if (active) {
          setEnrichmentState('unavailable')
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [reportMatch, reportMatchId])

  const retry = useCallback(() => {
    setAttempt((value) => value + 1)
  }, [])

  /** Повторное сохранение уже сформированного отчёта — без нового запроса к OpenDota. */
  const handleRetrySave = useCallback(() => {
    if (state.status !== 'report') {
      return
    }
    const view = state.view
    setRetrying(true)
    retrySaveReport(flowDeps, view)
      .then((result) => {
        setState({ status: 'report', view: result.view, save: result.save })
      })
      .finally(() => {
        setRetrying(false)
      })
  }, [flowDeps, state])

  useEffect(() => {
    let active = true
    void loadBenchmarkSnapshot().then((snapshot) => {
      if (active) {
        setBenchmarkSnapshot(snapshot)
      }
    })
    void loadItemTimingSnapshot().then((snapshot) => {
      if (active) {
        setItemTimingSnapshot(snapshot)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const selectedPlayer =
    state.status === 'report'
      ? findPlayerBySlot((enrichedMatch ?? state.view.match).players, selectedSlot)
      : null

  // Сохранённые наблюдения из снимка отчёта: правила заново не пересчитываются.
  const selectedAnalysis =
    state.status === 'report' ? findStoredPlayerAnalysis(state.view, selectedSlot) : null

  return (
    <section className="stub" aria-busy={state.status === 'loading'}>
      <div className="container">
        {state.status === 'report' ? (
          <div className="match-dashboard">
            <MatchHeader match={enrichedMatch ?? state.view.match} requestedId={state.view.matchId}>
              <MatchParseNotice outcome={parseOutcome} />
            </MatchHeader>

            {enrichmentState === 'unavailable' && (
              <p className="stub__hint" role="status">
                {t('enrich.unavailable')}
              </p>
            )}
            {enrichmentState === 'enriched' && (
              <p className="stub__hint" role="status">
                {t('enrich.loaded')}
              </p>
            )}

            <TeamOverview
              players={(enrichedMatch ?? state.view.match).players}
              selectedSlot={selectedSlot}
              onSelect={setSelectedSlot}
            />

            <BuildingsMap match={enrichedMatch ?? state.view.match} />

            <AbilityBuild
              players={(enrichedMatch ?? state.view.match).players}
              selectedSlot={selectedSlot}
              onSelect={setSelectedSlot}
            />

            <section className="player-analysis" aria-labelledby="player-analysis-title">
              <h2 className="match-section__title" id="player-analysis-title">
                {t('match.analysisTitle')}
              </h2>
              <PlayerStats player={selectedPlayer} />
              <LaneReport player={selectedPlayer} />
        {benchmarkSnapshot !== undefined && (
          <>
            <LaningBenchmarks
              player={selectedPlayer}
              patch={(enrichedMatch ?? state.view.match).patch}
              snapshot={benchmarkSnapshot}
            />
            <PlayerInsights
              player={selectedPlayer}
              patch={(enrichedMatch ?? state.view.match).patch}
              snapshot={benchmarkSnapshot}
            />
          </>
        )}
        {itemTimingSnapshot !== undefined && (
          <ItemTimings
            player={selectedPlayer}
            patch={(enrichedMatch ?? state.view.match).patch}
            snapshot={itemTimingSnapshot}
          />
        )}
              <AnalysisReport
                match={enrichedMatch ?? state.view.match}
                player={selectedPlayer}
                analysis={selectedAnalysis}
              />
            </section>

            <ReportPersistenceNotice
              view={state.view}
              save={state.save}
              loginLink={
                <Link className="btn btn--ghost" to="/login">
                  {t('persistence.guest.loginLink')}
                </Link>
              }
              onRetrySave={handleRetrySave}
              retrying={retrying}
            />

            <Link className="btn btn--ghost" to="/">
              {t('common.backHome')}
            </Link>
          </div>
        ) : (
          <div className="stub__panel panel">
          {state.status === 'loading' && (
            <>
              <span className="badge badge--warn">{t('match.loadingBadge')}</span>
              <h1 className="stub__title">{t('match.title', { id: matchId ?? '' })}</h1>
              <p className="stub__text" role="status" aria-live="polite">
                {phase === null ? t('match.phase.session') : t(PHASE_KEYS[phase])}
              </p>
            </>
          )}

          {state.status === 'invalid' && (
            <>
              <span className="badge badge--warn">{t('match.invalid.badge')}</span>
              <h1 className="stub__title">{t('match.invalid.title')}</h1>
              <p className="auth-alert auth-alert--error" role="alert">
                {matchIdErrorText(t, state.code)}
              </p>
              <p className="stub__text">{t('match.invalid.note')}</p>
              <Link className="btn btn--ghost" to="/">
                {t('common.backHome')}
              </Link>
            </>
          )}

          {state.status === 'error' && (
            <>
              <span className="badge badge--warn">{t('match.error.badge')}</span>
              <h1 className="stub__title">{t('match.error.title', { id: matchId ?? '' })}</h1>
              <p className="auth-alert auth-alert--error" role="alert">
                {openDotaErrorText(t, state.error.kind, {
                  status: state.error.status,
                  fallback: state.error.message,
                })}
              </p>
              <ul className="stub__list">
                <li>{t('match.error.sourceLine')}</li>
                {typeof state.error.status === 'number' && (
                  <li>
                    {t('errors.opendota.httpStatus', { status: state.error.status })}
                  </li>
                )}
                {state.error.kind === 'not_found' && <li>{t('errors.opendota.checkId')}</li>}
              </ul>
              <div className="stub__actions">
                {isRetryableError(state.error.kind) && (
                  <button type="button" className="btn btn--primary" onClick={retry}>
                    {t('match.error.retry')}
                  </button>
                )}
                <Link className="btn btn--ghost" to="/">
                  {t('common.backHome')}
                </Link>
              </div>
            </>
          )}

          {state.status === 'report-error' && (
            <>
              <span className="badge badge--warn">{t('match.reportError.badge')}</span>
              <h1 className="stub__title">
                {t('match.reportError.title', { id: matchId ?? '' })}
              </h1>
              <p className="auth-alert auth-alert--error" role="alert">
                {state.message}
              </p>
              <p className="stub__text">{t('match.reportError.note')}</p>
              <div className="stub__actions">
                <Link className="btn btn--ghost" to="/">
                  {t('common.backHome')}
                </Link>
              </div>
            </>
          )}
          </div>
        )}
      </div>
    </section>
  )
}