import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import AnalysisReport from '../components/AnalysisReport'
import MatchSummary from '../components/MatchSummary'
import LaneReport from '../components/LaneReport'
import MatchItems from '../components/MatchItems'
import MatchParseNotice from '../components/MatchParseNotice'
import PlayerSelector from '../components/PlayerSelector'
import PlayerStats from '../components/PlayerStats'
import ReportPersistenceNotice from '../components/ReportPersistenceNotice'
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
import { createBrowserParseAttemptStore } from '../lib/replayParsing'
import { fetchParseJobStatus, requestReplayParse, resolveOpenDotaApiKey } from '../lib/opendotaParse'
import {
  createMatchReportsService,
  findStoredPlayerAnalysis,
  type MatchReportView,
} from '../lib/matchReports'
import { createSupabaseMatchReportsClient } from '../lib/matchReportsSupabase'
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

  const selectedPlayer =
    state.status === 'report' ? findPlayerBySlot(state.view.match.players, selectedSlot) : null

  // Сохранённые наблюдения из снимка отчёта: правила заново не пересчитываются.
  const selectedAnalysis =
    state.status === 'report' ? findStoredPlayerAnalysis(state.view, selectedSlot) : null

  return (
    <section className="stub" aria-busy={state.status === 'loading'}>
      <div className="container">
        {state.status === 'report' ? (
          <div className="match-details">
            <MatchSummary match={state.view.match} requestedId={state.view.matchId} />
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
            <MatchParseNotice outcome={parseOutcome} />
            <div className="match-details__columns">
              <PlayerSelector
                players={state.view.match.players}
                selectedSlot={selectedSlot}
                onSelect={setSelectedSlot}
              />
              <div className="match-details__stack">
                <PlayerStats player={selectedPlayer} />
                <LaneReport player={selectedPlayer} />
              </div>
            </div>
            <MatchItems player={selectedPlayer} />
            <AnalysisReport
              match={state.view.match}
              player={selectedPlayer}
              analysis={selectedAnalysis}
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