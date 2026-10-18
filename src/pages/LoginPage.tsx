import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

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
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = getSafeRedirectTarget(location.state)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    setError(null)

    if (!email.trim()) {
      setError('Укажите email.')
      return
    }
    if (!password) {
      setError('Укажите пароль.')
      return
    }

    setSubmitting(true)
    const result = await signIn(email.trim(), password)
    setSubmitting(false)

    if (result.ok) {
      navigate(redirectTo, { replace: true })
      return
    }
    setError(result.error)
  }

  return (
    <section className="stub">
      <div className="container">
        <div className="stub__panel panel auth-panel">
          <h1 className="stub__title">Вход в аккаунт</h1>

          {loading && (
            <p className="stub__text" role="status" aria-live="polite">
              Проверяем сессию…
            </p>
          )}

          {!loading && !isConfigured && (
            <>
              <p className="auth-alert auth-alert--error" role="alert">
                Авторизация недоступна: Supabase не настроен. Добавьте
                VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в локальный
                .env (см. .env.example) и перезапустите dev-сервер.
              </p>
              <Link className="btn btn--ghost" to="/">
                ← Вернуться на главную
              </Link>
            </>
          )}

          {!loading && isConfigured && user && (
            <>
              <p className="auth-alert auth-alert--success" role="status">
                Вы уже вошли в аккаунт ({user.email}).
              </p>
              <Link className="btn btn--primary" to="/">
                Перейти на главную
              </Link>
            </>
          )}

          {!loading && isConfigured && !user && (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {error && (
                <p className="auth-alert auth-alert--error" role="alert">
                  {error}
                </p>
              )}

              <div className="auth-field">
                <label className="auth-label" htmlFor="login-email">
                  Email
                </label>
                <input
                  className="auth-input"
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="login-password">
                  Пароль
                </label>
                <input
                  className="auth-input"
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <button type="submit" className="btn btn--primary auth-submit" disabled={submitting}>
                {submitting ? 'Входим…' : 'Войти'}
              </button>

              <p className="auth-hint">
                Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}