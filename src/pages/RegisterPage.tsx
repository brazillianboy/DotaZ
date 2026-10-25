import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n/I18nContext'
import { authErrorText, type AuthErrorCode } from '../i18n/errors'

type SuccessState = 'check-email' | 'signed-in' | null

/**
 * Регистрация по email и паролю (Task 3, локализация — Task 13).
 *
 * Поддерживаются оба режима Supabase:
 *  - подтверждение email включено  → success 'check-email' (активной сессии нет);
 *  - подтверждение email отключено → success 'signed-in' (сессия активна сразу).
 *
 * Сообщение о результате регистрации не перечисляет существующие аккаунты —
 * формулировка одинакова и в русской, и в английской версии.
 */
export default function RegisterPage() {
  const { signUp, user, loading, isConfigured } = useAuth()
  const { t } = useI18n()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<SuccessState>(null)

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
    if (password !== passwordConfirm) {
      setError(t('auth.error.passwordMismatch'))
      return
    }

    setSubmitting(true)
    const result = await signUp(email.trim(), password)
    setSubmitting(false)

    if (!result.ok) {
      setErrorCode(result.errorCode)
      setError(authErrorText(t, result.errorCode, result.error))
      return
    }

    setSuccess(result.needsEmailConfirmation ? 'check-email' : 'signed-in')
  }

  return (
    <section className="stub">
      <div className="container">
        <div className="stub__panel panel auth-panel">
          <h1 className="stub__title">{t('auth.registerTitle')}</h1>

          {loading && (
            <p className="stub__text" role="status" aria-live="polite">
              {t('auth.checkingSession')}
            </p>
          )}

          {!loading && !isConfigured && (
            <>
              <p className="auth-alert auth-alert--error" role="alert">
                {t('auth.notConfiguredRegister')}
              </p>
              <Link className="btn btn--ghost" to="/">
                {t('common.backHome')}
              </Link>
            </>
          )}

          {!loading && isConfigured && user && (
            <>
              <p className="auth-alert auth-alert--success" role="status">
                {t('auth.alreadyLoggedInNoRegister', { email: user.email ?? '' })}
              </p>
              <Link className="btn btn--primary" to="/">
                {t('common.goHome')}
              </Link>
            </>
          )}

          {!loading && isConfigured && !user && success === 'check-email' && (
            <>
              <div className="auth-alert auth-alert--success" role="status">
                <h2 className="auth-alert__title">{t('auth.checkEmailTitle')}</h2>
                <p>{t('auth.checkEmailText')}</p>
              </div>
              <Link className="btn btn--primary" to="/login">
                {t('auth.goToLogin')}
              </Link>
            </>
          )}

          {!loading && isConfigured && !user && success === 'signed-in' && (
            <>
              <p className="auth-alert auth-alert--success" role="status">
                {t('auth.signedIn')}
              </p>
              <Link className="btn btn--primary" to="/">
                {t('common.goHome')}
              </Link>
            </>
          )}

          {!loading && isConfigured && !user && success === null && (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {error && (
                <p className="auth-alert auth-alert--error" role="alert">
                  {errorCode === null ? error : authErrorText(t, errorCode, error)}
                </p>
              )}

              <div className="auth-field">
                <label className="auth-label" htmlFor="register-email">
                  {t('auth.emailLabel')}
                </label>
                <input
                  className="auth-input"
                  id="register-email"
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
                <label className="auth-label" htmlFor="register-password">
                  {t('auth.passwordLabel')}
                </label>
                <input
                  className="auth-input"
                  id="register-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="register-password-confirm">
                  {t('auth.passwordConfirmLabel')}
                </label>
                <input
                  className="auth-input"
                  id="register-password-confirm"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <button type="submit" className="btn btn--primary auth-submit" disabled={submitting}>
                {submitting ? t('auth.submittingRegister') : t('auth.submitRegister')}
              </button>

              <p className="auth-hint">
                {t('auth.haveAccountHint')} <Link to="/login">{t('auth.loginLink')}</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}