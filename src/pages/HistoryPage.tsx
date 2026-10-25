import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import HistoryList from '../components/HistoryList'
import { useAuth } from '../hooks/useAuth'
import { loadHistoryPage, type HistoryFlowDeps } from '../lib/historyFlow'
import { useI18n } from '../i18n/I18nContext'
import {
  createHistoryReportsService,
  createRequestGuard,
  type HistoryReportItem,
} from '../lib/historyReports'
import type { ReportDbError } from '../lib/matchReports'
import { createSupabaseHistoryReportsClient } from '../lib/matchReportsSupabase'
import { getSupabase } from '../lib/supabase'

type HistoryState =
  | { status: 'loading' }
  | { status: 'waiting-auth' }
  | { status: 'signed-out' }
  | { status: 'no-database'; message: string }
  | { status: 'empty' }
  | { status: 'list'; items: HistoryReportItem[]; hasMore: boolean; skippedCount: number }
  | { status: 'error'; error: ReportDbError }

/**
 * Личная история анализов (Task 12).
 *
 * Страница защищена `ProtectedRoute` (Task 4): гости перенаправляются на `/login`.
 * Данные читаются только для текущего пользователя (фильтр по `user_id` + серверные
 * RLS), тяжёлые payload не загружаются, отчёты не изменяются и не пересчитываются.
 *
 * Защита от устаревших ответов: каждая загрузка получает токен; при смене аккаунта,
 * выходе, повторной попытке или размонтировании токен инвалидируется, поэтому ответ
 * прошлого пользователя не может быть показан новому.
 */
export default function HistoryPage() {
  const { user, loading, isConfigured } = useAuth()
  const { t } = useI18n()
  const [state, setState] = useState<HistoryState>({ status: 'loading' })
  const [loadingMore, setLoadingMore] = useState(false)
  const guardRef = useRef(createRequestGuard())

  const authStatus = loading ? 'loading' : user !== null ? 'authenticated' : 'anonymous'
  const userId = user?.id ?? null

  const service = useMemo(() => {
    const supabase = getSupabase()
    return supabase === null
      ? null
      : createHistoryReportsService(createSupabaseHistoryReportsClient(supabase))
  }, [isConfigured])

  const deps = useMemo<HistoryFlowDeps>(
    () => ({ authStatus, userId, service }),
    [authStatus, userId, service],
  )

  const load = useCallback(
    async (offset: number, mode: 'replace' | 'append') => {
      const token = guardRef.current.begin()
      if (mode === 'replace') {
        setState({ status: 'loading' })
      } else {
        setLoadingMore(true)
      }

      const result = await loadHistoryPage(deps, offset)

      // Ответ устарел (смена аккаунта, повторная попытка, размонтирование) — не применяем.
      if (!guardRef.current.isCurrent(token)) {
        return
      }
      if (mode === 'append') {
        setLoadingMore(false)
      }

      if (result.status === 'waiting-auth') {
        setState({ status: 'waiting-auth' })
        return
      }
      if (result.status === 'signed-out') {
        setState({ status: 'signed-out' })
        return
      }
      if (result.status === 'no-database') {
        setState({ status: 'no-database', message: result.message })
        return
      }
      if (result.status === 'error') {
        setState({ status: 'error', error: result.error })
        return
      }

      if (mode === 'append') {
        setState((previous) =>
          previous.status === 'list'
            ? {
                status: 'list',
                items: [...previous.items, ...result.items],
                hasMore: result.hasMore,
                skippedCount: previous.skippedCount + result.skippedCount,
              }
            : result.items.length === 0
              ? { status: 'empty' }
              : {
                  status: 'list',
                  items: result.items,
                  hasMore: result.hasMore,
                  skippedCount: result.skippedCount,
                },
        )
        return
      }

      setState(
        result.items.length === 0
          ? { status: 'empty' }
          : {
              status: 'list',
              items: result.items,
              hasMore: result.hasMore,
              skippedCount: result.skippedCount,
            },
      )
    },
    [deps],
  )

  useEffect(() => {
    // Смена аккаунта, выход или размонтирование: инвалидируем запросы и сразу
    // очищаем данные предыдущего пользователя (история прошлого аккаунта не видна).
    guardRef.current.invalidate()
    setLoadingMore(false)
    setState({ status: 'loading' })

    if (authStatus === 'loading') {
      setState({ status: 'waiting-auth' })
      return () => {
        guardRef.current.invalidate()
      }
    }
    if (authStatus !== 'authenticated' || userId === null) {
      setState({ status: 'signed-out' })
      return () => {
        guardRef.current.invalidate()
      }
    }

    void load(0, 'replace')
    return () => {
      guardRef.current.invalidate()
    }
  }, [authStatus, userId, load])

  const handleRetry = useCallback(() => {
    void load(0, 'replace')
  }, [load])

  const handleLoadMore = useCallback(() => {
    if (state.status !== 'list') {
      return
    }
    void load(state.items.length, 'append')
  }, [load, state])

  return (
    <section className="stub" aria-busy={state.status === 'loading'}>
      <div className="container">
        <div className="history-page__head">
          <span className="badge badge--warn">{t('history.badge')}</span>
          <h1 className="stub__title">{t('history.title')}</h1>
          <p className="stub__text">{t('history.lead')}</p>
        </div>

        <div className="stub__panel panel">
          {state.status === 'loading' && (
            <p className="stub__text" role="status" aria-live="polite">
              {t('history.loading')}
            </p>
          )}

          {state.status === 'waiting-auth' && (
            <p className="stub__text" role="status" aria-live="polite">
              {t('history.waitingAuth')}
            </p>
          )}

          {state.status === 'signed-out' && (
            <>
              <p className="stub__text" role="status" aria-live="polite">
                {t('history.signedOut')}
              </p>
              <Link className="btn btn--primary" to="/login">
                {t('history.loginLink')}
              </Link>
            </>
          )}

          {state.status === 'no-database' && (
            <>
              <p className="auth-alert auth-alert--error" role="alert">
                {state.message}
              </p>
              <p className="stub__text">{t('history.noDatabaseNote')}</p>
            </>
          )}

          {state.status === 'empty' && (
            <>
              <p className="stub__text" role="status" aria-live="polite">
                {t('history.empty')}
              </p>
              <p className="stub__text">{t('history.emptyHint')}</p>
              <Link className="btn btn--primary" to="/">
                {t('history.emptyCta')}
              </Link>
            </>
          )}

          {state.status === 'error' && (
            <>
              <p className="stub__text" role="alert">
                {t('history.error')}
              </p>
              <p className="auth-alert auth-alert--error">{state.error.message}</p>
              <div className="stub__actions">
                <button type="button" className="btn btn--primary" onClick={handleRetry}>
                  {t('history.retry')}
                </button>
                <Link className="btn btn--ghost" to="/">
                  {t('common.backHome')}
                </Link>
              </div>
            </>
          )}

          {state.status === 'list' && (
            <>
              <HistoryList
                items={state.items}
                hasMore={state.hasMore}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMore}
                skippedCount={state.skippedCount}
              />
              <div className="stub__actions">
                <Link className="btn btn--ghost" to="/">
                  {t('common.backHome')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}