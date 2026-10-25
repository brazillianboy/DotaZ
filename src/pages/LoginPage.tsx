import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n/I18nContext'
import { authErrorText, type AuthErrorCode } from '../i18n/errors'

/**
 * Безопасный целевой маршрут после входа (Task 4).
 * Принимаются только внутренние пути приложения: внешние адреса,
 * protocol-relative (`//example.com`), обратные слэши и сам `/login` отклоняются —
 * в этом случае используется `/`. Защита от open redirect.
 */
function getSafeRedirectTarget(state: unknown): string {
  if (typeof state !== 'object' || state === null) {
    return '/'
  }
  const from = (state as { from?: unknown }).from
  if (typeof from !== 'string' || from.length === 0) {
    return '/'
  }
  if (!from.startsWith('/') || from.startsWith('//') || from.includes('\\')) {
    return '/'
  }
  if (from.startsWith('/login')) {
    return '/'
  }
  return from
}

/**
 * Вход по email и паролю (Task 3, supabase.auth.signInWithPassword).
 * После успешного входа пользователь возвращается на исходный приватный маршрут
 * (переданный через state при редиректе из ProtectedRoute) либо на главную.
 */
export default function LoginPage() {
  const { signIn, user, loading, isConfigured } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = getSafeRedirectTarget(location.state)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    setError(null)
    setErrorCode(null)

    if (!email.trim()) {
      setError(t('auth.error.emailRequired'))
      return
    }
    if (!password) {
      setError(t('auth.error.passwordRequired'))
      return
    }

    setSubmitting(true)
    const result = await signIn(email.trim(), password)
    setSubmitting(false)

    if (result.ok) {
      navigate(redirectTo, { replace: true })
      return
    }
    setErrorCode(result.errorCode)
    setError(authErrorText(t, result.errorCode, result.error))
  }

  return (
    <section className="stub">
      <div className="container">
        <div className="stub__panel panel auth-panel">
          <h1 className="stub__title">{t('auth.loginTitle')}</h1>

          {loading && (
            <p className="stub__text" role="status" aria-live="polite">
              {t('auth.checkingSession')}
            </p>
          )}

          {!loading && !isConfigured && (
            <>
              <p className="auth-alert auth-alert--error" role="alert">
                {t('auth.notConfiguredLogin')}
              </p>
              <Link className="btn btn--ghost" to="/">
                {t('common.backHome')}
              </Link>
            </>
          )}

          {!loading && isConfigured && user && (
            <>
              <p className="auth-alert auth-alert--success" role="status">
                {t('auth.alreadyLoggedIn', { email: user.email ?? '' })}
              </p>
              <Link className="btn btn--primary" to="/">
                {t('common.goHome')}
              </Link>
            </>
          )}

          {!loading && isConfigured && !user && (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {error && (
                <p className="auth-alert auth-alert--error" role="alert">
                  {errorCode === null ? error : authErrorText(t, errorCode, error)}
                </p>
              )}

              <div className="auth-field">
                <label className="auth-label" htmlFor="login-email">
                  {t('auth.emailLabel')}
                </label>
                <input
                  className="auth-input"
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="login-password">
                  {t('auth.passwordLabel')}
                </label>
                <input
                  className="auth-input"
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <button type="submit" className="btn btn--primary auth-submit" disabled={submitting}>
                {submitting ? t('auth.submittingLogin') : t('auth.submitLogin')}
              </button>

              <p className="auth-hint">
                {t('auth.noAccountHint')}{' '}
                <Link to="/register">{t('auth.registerLink')}</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}