import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n/I18nContext'
import { sanitizeInternalPath } from '../lib/steam/redirect'
import { steamErrorKey } from '../lib/steamClient'

/**
 * Завершение входа через Steam (Task 20A).
 *
 * Серверная функция после проверки OpenID 2.0 возвращает одноразовый **код
 * обмена** (не токен). Код меняется на Supabase-токен POST-запросом в теле, а
 * токен сразу обменивается штатным `verifyOtp`. Ни код, ни токен не остаются в
 * URL надолго: адрес страницы заменяется через `navigate(..., { replace: true })`.
 */
export default function SteamCallbackPage() {
  const { completeSteamSignIn, refreshSteamIdentity } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const started = useRef(false)

  const tokenHash = params.get('code') ?? ''
  const nextPath = sanitizeInternalPath(params.get('next'), '/')

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true

    if (tokenHash.length === 0) {
      setErrorKey('session_failed')
      return
    }

    void (async () => {
      const result = await completeSteamSignIn(tokenHash)
      if (!result.ok) {
        setErrorKey(result.steamErrorCode ?? 'session_failed')
        return
      }
      await refreshSteamIdentity()
      navigate(nextPath, { replace: true })
    })()
  }, [completeSteamSignIn, navigate, nextPath, refreshSteamIdentity, tokenHash])

  return (
    <section className="stub">
      <div className="container">
        <div className="stub__panel panel auth-panel">
          <h1 className="stub__title">{t('auth.steam.confirmTitle')}</h1>
          {errorKey === null ? (
            <p className="stub__text" role="status" aria-live="polite">
              {t('auth.steam.completing')}
            </p>
          ) : (
            <>
              <p className="auth-alert auth-alert--error" role="alert">
                {t(steamErrorKey(errorKey))}
              </p>
              <Link className="btn btn--primary" to="/login">
                {t('auth.steam.backToLogin')}
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
