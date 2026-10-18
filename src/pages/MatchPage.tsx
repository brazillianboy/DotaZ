import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import AnalysisReport from '../components/AnalysisReport'
import MatchSummary from '../components/MatchSummary'
import LaneReport from '../components/LaneReport'
import PlayerSelector from '../components/PlayerSelector'
import PlayerStats from '../components/PlayerStats'
import { findPlayerBySlot, pickDefaultPlayerSlot } from '../lib/matchView'
import { normalizeMatch } from '../lib/normalizeMatch'
import {
  fetchMatchById,
  isRetryableError,
  validateMatchId,
  type OpenDotaError,
} from '../lib/opendota'
import type { NormalizedMatch } from '../types/match'

type MatchState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'success'; match: NormalizedMatch; requestedId: string }
  | { status: 'error'; error: OpenDotaError }

/**
 * Страница матча (Tasks 5–7): получает матч из OpenDota по параметру маршрута,
 * нормализует ответ (Task 6) и показывает сводку матча с выбором участника (Task 7).
 *
 * Поддерживаются прямой переход по URL, обновление страницы и навигация.
 * Выбор игрока хранится в локальном состоянии и не вызывает новых запросов.
 */
export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<MatchState>({ status: 'loading' })
  // Устойчивый идентификатор выбранного участника — player_slot.
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  useEffect(() => {
    const validation = validateMatchId(matchId ?? '')
    if (!validation.ok) {
      setState({ status: 'invalid', message: validation.message })
      setSelectedSlot(null)
      return
    }

    const controller = new AbortController()
    // Смена матча: прежние данные и выбранный игрок не показываются.
    setState({ status: 'loading' })
    setSelectedSlot(null)

    fetchMatchById(validation.value, controller.signal).then((result) => {
      // Устаревшие и отменённые ответы не применяем.
      if (controller.signal.aborted) {
        return
      }
      if (result.ok) {
        // Нормализация выполняется сразу после успешного получения данных (Task 6).
        const match = normalizeMatch(result.match)
        setState({
          status: 'success',
          match,
          requestedId: validation.value,
        })
        // По умолчанию выбирается первый доступный участник нового матча.
        setSelectedSlot(pickDefaultPlayerSlot(match.players))
        return
      }
      if (result.error.kind === 'aborted') {
        return
      }
      setState({ status: 'error', error: result.error })
    })

    // Отмена запроса при уходе со страницы или смене маршрута.
    return () => controller.abort()
  }, [matchId, attempt])

  const retry = useCallback(() => {
    setAttempt((value) => value + 1)
  }, [])

  const selectedPlayer =
    state.status === 'success' ? findPlayerBySlot(state.match.players, selectedSlot) : null

  return (
    <section className="stub" aria-busy={state.status === 'loading'}>
      <div className="container">
        {state.status === 'success' ? (
          <div className="match-details">
            <MatchSummary match={state.match} requestedId={state.requestedId} />
            <div className="match-details__columns">
              <PlayerSelector
                players={state.match.players}
                selectedSlot={selectedSlot}
                onSelect={setSelectedSlot}
              />
              <div className="match-details__stack">
                <PlayerStats player={selectedPlayer} />
                <LaneReport player={selectedPlayer} />
              </div>
            </div>
            <AnalysisReport match={state.match} player={selectedPlayer} />
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
                Запрашиваем данные матча у OpenDota…
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
          </div>
        )}
      </div>
    </section>
  )
}