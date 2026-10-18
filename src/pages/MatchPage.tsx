import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

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

/** Длительность в секундах → «MM:SS» (простое представление поля ответа, без расчётов). */
function formatDuration(seconds: number): string {
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/**
 * Страница матча (Task 5): получает матч из OpenDota по параметру маршрута.
 *
 * Поддерживаются прямой переход по URL, обновление страницы и навигация.
 * Параметр маршрута валидируется здесь независимо от главной страницы.
 * Полная нормализация данных и статистика — Task 6+; здесь показывается только
 * подтверждение получения данных и поля, фактически присутствующие в ответе.
 */
export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<MatchState>({ status: 'loading' })

  useEffect(() => {
    const validation = validateMatchId(matchId ?? '')
    if (!validation.ok) {
      setState({ status: 'invalid', message: validation.message })
      return
    }

    const controller = new AbortController()
    setState({ status: 'loading' })

    fetchMatchById(validation.value, controller.signal).then((result) => {
      // Устаревшие и отменённые ответы не применяем.
      if (controller.signal.aborted) {
        return
      }
      if (result.ok) {
        // Нормализация выполняется сразу после успешного получения данных (Task 6).
        setState({
          status: 'success',
          match: normalizeMatch(result.match),
          requestedId: validation.value,
        })
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

  return (
    <section className="stub" aria-busy={state.status === 'loading'}>
      <div className="container">
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

          {state.status === 'success' && (
            <>
              <span className="badge badge--warn">Данные получены</span>
              <h1 className="stub__title">
                Матч <span className="accent">{state.requestedId}</span>
              </h1>
              <p className="stub__text">
                OpenDota вернула данные матча. Ниже — только поля, фактически
                присутствующие в ответе. Подробная статистика игроков, разбор линии
                и наблюдения появятся в следующих задачах.
              </p>
              <ul className="stub__list">
                <li>
                  Запрошенный ID матча: <strong>{state.requestedId}</strong>
                </li>
                <li>
                  ID матча в ответе OpenDota:{' '}
                  {state.match.match_id !== null ? (
                    <strong>{state.match.match_id}</strong>
                  ) : (
                    'нет данных в ответе'
                  )}
                </li>
                <li>
                  Длительность:{' '}
                  {typeof state.match.duration === 'number' ? (
                    <>
                      <strong>{formatDuration(state.match.duration)}</strong> (
                      {state.match.duration} с)
                    </>
                  ) : (
                    'нет данных в ответе'
                  )}
                </li>
                <li>
                  Победитель:{' '}
                  {typeof state.match.radiant_win === 'boolean'
                    ? state.match.radiant_win
                      ? 'Radiant'
                      : 'Dire'
                    : 'нет данных в ответе'}
                </li>
                <li>
                  Участников в ответе:{' '}
                  {state.match.players.length > 0
                    ? state.match.players.length
                    : 'нет данных в ответе'}
                </li>
                <li>
                  Стороны по player_slot: Radiant —{' '}
                  {state.match.players.filter((player) => player.team === 'radiant').length},
                  Dire —{' '}
                  {state.match.players.filter((player) => player.team === 'dire').length}
                </li>
                <li>Источник данных: OpenDota</li>
              </ul>
              <p className="stub__hint">
                Значения приведены как есть из ответа OpenDota; отсутствующие поля не
                заменяются нулями, количество участников не предполагается равным десяти.
              </p>
              <Link className="btn btn--ghost" to="/">
                ← Вернуться на главную
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}