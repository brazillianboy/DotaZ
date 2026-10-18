import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

type SuccessState = 'check-email' | 'signed-in' | null

/**
 * Регистрация по email и паролю (Task 3, supabase.auth.signUp).
 *
 * Поддерживаются оба режима Supabase:
 *  - подтверждение email включено  → success 'check-email' (активной сессии нет);
 *  - подтверждение email отключено → success 'signed-in' (сессия активна сразу).
 */
export default function RegisterPage() {
  const { signUp, user, loading, isConfigured } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<SuccessState>(null)

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
    if (password !== passwordConfirm) {
      setError('Пароли не совпадают.')
      return
    }

    setSubmitting(true)
    const result = await signUp(email.trim(), password)
    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setSuccess(result.needsEmailConfirmation ? 'check-email' : 'signed-in')
  }

  return (
    <section className="stub">
      <div className="container">
        <div className="stub__panel panel auth-panel">
          <h1 className="stub__title">Регистрация</h1>

          {loading && (
            <p className="stub__text" role="status" aria-live="polite">
              Проверяем сессию…
            </p>
          )}

          {!loading && !isConfigured && (
            <>
              <p className="auth-alert auth-alert--error" role="alert">
                Регистрация недоступна: Supabase не настроен. Добавьте
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
                Вы уже вошли в аккаунт ({user.email}) — регистрация не требуется.
              </p>
              <Link className="btn btn--primary" to="/">
                Перейти на главную
              </Link>
            </>
          )}

          {!loading && isConfigured && !user && success === 'check-email' && (
            <>
              <div className="auth-alert auth-alert--success" role="status">
                <h2 className="auth-alert__title">Проверьте электронную почту</h2>
                <p>
                  Если регистрация доступна для этого адреса, вы получите письмо с
                  дальнейшими инструкциями. Если у вас уже есть аккаунт, попробуйте войти.
                </p>
              </div>
              <Link className="btn btn--primary" to="/login">
                Перейти ко входу
              </Link>
            </>
          )}

          {!loading && isConfigured && !user && success === 'signed-in' && (
            <>
              <p className="auth-alert auth-alert--success" role="status">
                Аккаунт создан — вы вошли в систему.
              </p>
              <Link className="btn btn--primary" to="/">
                Перейти на главную
              </Link>
            </>
          )}

          {!loading && isConfigured && !user && success === null && (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {error && (
                <p className="auth-alert auth-alert--error" role="alert">
                  {error}
                </p>
              )}

              <div className="auth-field">
                <label className="auth-label" htmlFor="register-email">
                  Email
                </label>
                <input
                  className="auth-input"
                  id="register-email"
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
                <label className="auth-label" htmlFor="register-password">
                  Пароль
                </label>
                <input
                  className="auth-input"
                  id="register-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="register-password-confirm">
                  Повторите пароль
                </label>
                <input
                  className="auth-input"
                  id="register-password-confirm"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <button type="submit" className="btn btn--primary auth-submit" disabled={submitting}>
                {submitting ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
              </button>

              <p className="auth-hint">
                Уже есть аккаунт? <Link to="/login">Войдите</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}