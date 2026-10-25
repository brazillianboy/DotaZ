import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import AnalysisReport from '../components/AnalysisReport'
import MatchSummary from '../components/MatchSummary'
import LaneReport from '../components/LaneReport'
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
  createMatchReportsService,
  findStoredPlayerAnalysis,
  type MatchReportView,
} from '../lib/matchReports'
import { createSupabaseMatchReportsClient } from '../lib/matchReportsSupabase'
import { findPlayerBySlot, pickDefaultPlayerSlot } from '../lib/matchView'
import { fetchMatchById, isRetryableError, validateMatchId, type OpenDotaError } from '../lib/opendota'
import { getSupabase } from '../lib/supabase'

type MatchState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'report'; view: MatchReportView; save: ReportSaveState }
  | { status: 'report-error'; message: string }
  | { status: 'error'; error: OpenDotaError }

/** Тексты шагов работы (Task 11): видно, что именно выполняется сейчас. */
const PHASE_TEXT: Record<MatchReportFlowPhase, string> = {
  'checking-report': 'Проверяем сохранённый отчёт…',
  'fetching-match': 'Запрашиваем данные матча у OpenDota…',
  analyzing: 'Формируем наблюдения по всем участникам…',
  saving: 'Сохраняем отчёт в личную историю…',
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
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<MatchState>({ status: 'loading' })
  const [phase, setPhase] = useState<MatchReportFlowPhase | null>(null)
  // Устойчивый идентификатор выбранного участника — player_slot.
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [retrying, setRetrying] = useState(false)

  /** Достоверное состояние сессии: пока сессия восстанавливается, работать нельзя. */
  const authStatus = authLoading ? 'loading' : user !== null ? 'authenticated' : 'anonymous'

  const service = useMemo(() => {
    const supabase = getSupabase()
    return supabase === null
      ? null
      : createMatchReportsService(createSupabaseMatchReportsClient(supabase))
  }, [isConfigured])

  const flowDeps = useMemo<Omit<MatchReportFlowDeps, 'onPhase'>>(
    () => ({
      authStatus,
      userId: user?.id ?? null,
      service,
      fetchMatch: fetchMatchById,
      now: () => new Date(),
    }),
    [authStatus, user?.id, service],
  )

  useEffect(() => {
    const validation = validateMatchId(matchId ?? '')
    if (!validation.ok) {
      setState({ status: 'invalid', message: validation.message })
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

    loadOrCreatePersonalReport(
      {
        ...flowDeps,
        onPhase: (next) => {
          if (active) {
            setPhase(next)
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
                  Войти в аккаунт
                </Link>
              }
              onRetrySave={handleRetrySave}
              retrying={retrying}
            />
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
            <AnalysisReport
              match={state.view.match}
              player={selectedPlayer}
              analysis={selectedAnalysis}
            />
            <Link className="btn btn--ghost" to="/">
              ← Вернуться на главную
            </Link>
          </div>
        ) : (
          <div className="stub__panel panel">
          {state.status === 'loading' && (
            <>
              <span className="badge badge--warn">Загрузка</span>
              <h1 className="stub__title">
                Матч <span className="accent">{matchId}</span>
              </h1>
              <p className="stub__text" role="status" aria-live="polite">
                {phase === null ? 'Проверяем состояние сессии…' : PHASE_TEXT[phase]}
              </p>
            </>
          )}

          {state.status === 'invalid' && (
            <>
              <span className="badge badge--warn">Некорректный ID</span>
              <h1 className="stub__title">Проверьте ID матча</h1>
              <p className="auth-alert auth-alert--error" role="alert">
                {state.message}
              </p>
              <p className="stub__text">
                Запрос к OpenDota не отправлялся: ID матча должен быть положительным
                целым числом.
              </p>
              <Link className="btn btn--ghost" to="/">
                ← Вернуться на главную
              </Link>
            </>
          )}

          {state.status === 'error' && (
            <>
              <span className="badge badge--warn">Ошибка запроса</span>
              <h1 className="stub__title">
                Не удалось получить матч <span className="accent">{matchId}</span>
              </h1>
              <p className="auth-alert auth-alert--error" role="alert">
                {state.error.message}
              </p>
              <ul className="stub__list">
                <li>Источник данных: OpenDota (запрос завершился ошибкой)</li>
                {typeof state.error.status === 'number' && (
                  <li>HTTP-статус ответа: <strong>{state.error.status}</strong></li>
                )}
                {state.error.kind === 'not_found' && (
                  <li>Проверьте ID матча: возможно, он указан неверно.</li>
                )}
              </ul>
              <div className="stub__actions">
                {isRetryableError(state.error.kind) && (
                  <button type="button" className="btn btn--primary" onClick={retry}>
                    Повторить запрос
                  </button>
                )}
                <Link className="btn btn--ghost" to="/">
                  ← Вернуться на главную
                </Link>
              </div>
            </>
          )}

          {state.status === 'report-error' && (
            <>
              <span className="badge badge--warn">Сохранённый отчёт недоступен</span>
              <h1 className="stub__title">
                Не удалось показать сохранённый отчёт по матчу{' '}
                <span className="accent">{matchId}</span>
              </h1>
              <p className="auth-alert auth-alert--error" role="alert">
                {state.message}
              </p>
              <p className="stub__text">
                Запись в базе данных не изменялась: повреждённый или неизвестный формат отчёта
                не перезаписывается автоматически, новый отчёт для этого матча не создавался.
              </p>
              <div className="stub__actions">
                <Link className="btn btn--ghost" to="/">
                  ← Вернуться на главную
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