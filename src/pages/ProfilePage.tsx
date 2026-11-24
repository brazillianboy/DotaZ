import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import ProfileActivity from '../components/ProfileActivity'
import ProfileHeader from '../components/ProfileHeader'
import ProfileLaneRoles from '../components/ProfileLaneRoles'
import ProfileOverview from '../components/ProfileOverview'
import ProfileProgress from '../components/ProfileProgress'
import ProfileRecentMatches from '../components/ProfileRecentMatches'
import ProfileSavedAnalyses, { type SavedAnalysesState } from '../components/ProfileSavedAnalyses'
import ProfileTopHeroes from '../components/ProfileTopHeroes'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n/I18nContext'
import { loadHistoryPage } from '../lib/historyFlow'
import { createHistoryReportsService, createRequestGuard } from '../lib/historyReports'
import { createSupabaseHistoryReportsClient } from '../lib/matchReportsSupabase'
import { createOpenDotaPlayerService } from '../lib/opendotaPlayer'
import {
  createPlayerProfileLoader,
  type PlayerProfileData,
  type PlayerSectionErrors,
} from '../lib/playerProfile'
import { accountIdFromSteamId64 } from '../lib/steam/steamId'
import { steamErrorKey } from '../lib/steamClient'
import { getSupabase } from '../lib/supabase'

/** Сколько последних сохранённых отчётов показывается в профиле. */
const SAVED_ANALYSES_LIMIT = 5

type PlayerViewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; key: string; data: PlayerProfileData; fromCache: boolean }
  | { status: 'unavailable'; key: string; errors: PlayerSectionErrors }
  | { status: 'invalid'; key: string }

/**
 * Полный личный профиль Dota 2 (Task 20B).
 *
 * Маршрут защищён `ProtectedRoute`. Личность берётся из проверенной привязки
 * текущего пользователя (`steamIdentity` из Supabase под RLS), а не из URL и не из
 * полей ввода. SteamID64 → account_id вычисляется приложением, статистика приходит
 * из OpenDota, а сохранённые анализы — из Supabase.
 *
 * При смене аккаунта предыдущее состояние не показывается: данные привязаны к
 * ключу `user.id + steamId64`, и устаревший ответ отбрасывается (токен устаревания
 * в загрузчике и `AbortController` в эффекте).
 */
export default function ProfilePage() {
  const { user, loading: authLoading, steamIdentity, isSteamConfigured, startSteamLink } = useAuth()
  const { t } = useI18n()

  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [playerState, setPlayerState] = useState<PlayerViewState>({ status: 'idle' })
  const [reportsState, setReportsState] = useState<SavedAnalysesState>({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)

  const loader = useMemo(() => createPlayerProfileLoader(createOpenDotaPlayerService()), [])
  const reportsGuard = useRef(createRequestGuard())

  const historyService = useMemo(() => {
    const supabase = getSupabase()
    return supabase === null
      ? null
      : createHistoryReportsService(createSupabaseHistoryReportsClient(supabase))
  }, [])

  const currentKey = `${user?.id ?? ''}:${steamIdentity?.steamId64 ?? ''}`
  const accountId =
    steamIdentity === null ? null : accountIdFromSteamId64(steamIdentity.steamId64)

  async function handleLink() {
    if (linking) {
      return
    }
    setLinking(true)
    setLinkError(null)
    const result = await startSteamLink('/profile')
    if (!result.ok) {
      setLinkError(result.steamErrorCode ?? 'link_failed')
      setLinking(false)
    }
  }

  /** Загрузка публичных данных OpenDota (только для выбранного account_id). */
  useEffect(() => {
    if (authLoading || steamIdentity === null) {
      setPlayerState({ status: 'idle' })
      return
    }
    if (accountId === null) {
      setPlayerState({ status: 'invalid', key: currentKey })
      return
    }

    const controller = new AbortController()
    setPlayerState({ status: 'loading' })

    void loader
      .load(accountId, { signal: controller.signal, force: reloadToken > 0 })
      .then((result) => {
        if (result.status === 'stale' || result.status === 'aborted') {
          return
        }
        if (result.status === 'invalid-account') {
          setPlayerState({ status: 'invalid', key: currentKey })
          return
        }
        if (result.status === 'unavailable') {
          setPlayerState({ status: 'unavailable', key: currentKey, errors: result.errors })
          return
        }
        setPlayerState({
          status: 'ready',
          key: currentKey,
          data: result.data,
          fromCache: result.fromCache,
        })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPlayerState({ status: 'unavailable', key: currentKey, errors: {} })
        }
      })

    return () => controller.abort()
    // currentKey/accountId выводятся из user и steamIdentity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, steamIdentity, reloadToken, loader, currentKey, accountId])

  /** Загрузка сохранённых отчётов (только текущего пользователя, RLS на сервере). */
  useEffect(() => {
    if (authLoading || user === null) {
      setReportsState({ status: 'empty' })
      return
    }

    setReportsState({ status: 'loading' })
    const token = reportsGuard.current.begin()

    void loadHistoryPage(
      {
        authStatus: 'authenticated',
        userId: user.id,
        service: historyService,
        pageSize: SAVED_ANALYSES_LIMIT,
      },
      0,
    ).then((result) => {
      if (!reportsGuard.current.isCurrent(token)) {
        return
      }
      if (result.status === 'list') {
        setReportsState(
          result.items.length === 0
            ? { status: 'empty' }
            : { status: 'list', items: result.items, skipped: result.skippedCount },
        )
        return
      }
      if (result.status === 'no-database') {
        setReportsState({ status: 'unavailable', message: result.message })
        return
      }
      if (result.status === 'error') {
        setReportsState({ status: 'error', message: result.error.message })
        return
      }
      setReportsState({ status: 'empty' })
    })

    return () => reportsGuard.current.invalidate()
  }, [authLoading, user, historyService, reloadToken])

  const handleRetry = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  // Защита от устаревшего состояния: данные прошлого аккаунта не показываются.
  const view: PlayerViewState =
    playerState.status === 'ready' ||
    playerState.status === 'unavailable' ||
    playerState.status === 'invalid'
      ? playerState.key === currentKey
        ? playerState
        : { status: 'loading' }
      : playerState

  if (steamIdentity === null) {
    return (
      <section className="stub">
        <div className="container">
          <div className="stub__panel panel">
            <span className="badge badge--warn">{t('profile.badge')}</span>
            <h1 className="stub__title">{t('profile.title')}</h1>
            <p className="stub__text">{t('profile.noSteam')}</p>
            <p className="auth-hint">{t('profile.notLinkedHint')}</p>
            <p className="stub__hint">{t('profile.noSteamDataNote')}</p>

            {isSteamConfigured ? (
              <div className="auth-steam">
                <button
                  type="button"
                  className="btn btn--steam auth-steam__button"
                  onClick={handleLink}
                  disabled={linking}
                >
                  {linking ? t('auth.steam.signingIn') : t('auth.steam.link')}
                </button>
                <p className="auth-hint">{t('auth.steam.linkHint')}</p>
                {linkError !== null && (
                  <p className="auth-alert auth-alert--error" role="alert">
                    {t(steamErrorKey(linkError))}
                  </p>
                )}
              </div>
            ) : (
              <p className="auth-hint" role="status">
                {t('auth.steam.error.notConfigured')}
              </p>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="page page--profile">
      <div className="container">
        <ProfileHeader steamIdentity={steamIdentity} accountId={accountId} />

        {accountId === null && (
          <p className="auth-alert auth-alert--error" role="alert">
            {t('profile.invalidAccount')}
          </p>
        )}

        {(view.status === 'idle' || view.status === 'loading') && (
          <div className="profile-loading panel" role="status" aria-live="polite">
            <p className="stub__text">{t('profile.loading')}</p>
            <p className="stub__hint">{t('profile.loadingHint')}</p>
          </div>
        )}

        {view.status === 'invalid' && (
          <div className="profile-unavailable panel" role="alert">
            <p className="stub__text">{t('profile.invalidAccount')}</p>
          </div>
        )}

        {view.status === 'unavailable' && (
          <div className="profile-unavailable panel" role="alert">
            <p className="stub__text">{t('profile.unavailable')}</p>
            <p className="stub__hint">{t('profile.unavailableHint')}</p>
            <div className="stub__actions">
              <button type="button" className="btn btn--primary" onClick={handleRetry}>
                {t('profile.retryAll')}
              </button>
            </div>
          </div>
        )}

        {view.status === 'ready' && (
          <>
            <ProfileOverview
              record={view.data.record}
              recordError={view.data.errors.record ?? null}
              latestMatch={view.data.recentMatches?.[0] ?? null}
              recentError={view.data.errors.recent ?? null}
              onRetry={handleRetry}
            />

            <div className="profile-grid">
              <ProfileTopHeroes
                heroes={view.data.heroes}
                error={view.data.errors.heroes ?? null}
                onRetry={handleRetry}
              />
              <ProfileLaneRoles
                lanes={view.data.lanes}
                error={view.data.errors.lanes ?? null}
                onRetry={handleRetry}
              />
            </div>

            <ProfileRecentMatches
              matches={view.data.recentMatches}
              skipped={view.data.recentSkipped}
              error={view.data.errors.recent ?? null}
              onRetry={handleRetry}
            />

            <ProfileActivity
              history={view.data.history}
              error={view.data.errors.history ?? null}
              fetchedAt={view.data.fetchedAt}
              onRetry={handleRetry}
            />

            <div className="profile-grid">
              <ProfileSavedAnalyses state={reportsState} onRetry={handleRetry} />
              <ProfileProgress />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
