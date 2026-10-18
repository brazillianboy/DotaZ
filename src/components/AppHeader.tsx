import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

/**
 * Глобальная шапка сайта (Task 2).
 * Пункты «Мета» и «О проекте» из референса пока не имеют маршрутов —
 * они показаны как неактивные элементы, чтобы не создавать «битых» ссылок.
 * Переключатель языка — визуальное превью до реализации локализации (Task 13).
 */
export default function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, signOut } = useAuth()

  async function handleSignOut() {
    if (loggingOut) {
      return
    }
    setLoggingOut(true)
    setLogoutError(null)
    const result = await signOut()
    setLoggingOut(false)
    if (result.ok) {
      if (location.pathname !== '/') {
        navigate('/', { replace: true })
      }
      return
    }
    setLogoutError(result.error ?? 'Не удалось выйти. Повторите попытку.')
  }

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" to="/" aria-label="DotaZ — на главную">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="34" height="34" focusable="false">
              <rect x="2" y="2" width="60" height="60" rx="14" fill="#ef3038" />
              <path d="M20 16h26L32 30h12L22 50l6-16H16z" fill="#ffffff" />
            </svg>
          </span>
          <span className="brand__text">
            Dota<span className="brand__accent">Z</span>
          </span>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-header-panel"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav-toggle__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </span>
          <span className="visually-hidden">{menuOpen ? 'Закрыть меню' : 'Открыть меню'}</span>
        </button>

        <div
          id="site-header-panel"
          className={`site-header__panel${menuOpen ? ' is-open' : ''}`}
        >
          <nav className="main-nav" aria-label="Основная навигация">
            <ul className="main-nav__list">
              <li>
                <NavLink to="/" end className="main-nav__link">
                  Главная
                </NavLink>
              </li>
              <li>
                <NavLink to="/heroes" className="main-nav__link">
                  Персонажи
                </NavLink>
              </li>
              <li>
                <span
                  className="main-nav__link main-nav__link--disabled"
                  aria-disabled="true"
                  title="Раздел появится позже"
                >
                  Мета
                </span>
              </li>
              <li>
                <NavLink to="/history" className="main-nav__link">
                  История
                </NavLink>
              </li>
              <li>
                <span
                  className="main-nav__link main-nav__link--disabled"
                  aria-disabled="true"
                  title="Раздел появится позже"
                >
                  О проекте
                </span>
              </li>
            </ul>
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="lang-select"
              disabled
              aria-disabled="true"
              title="Переключение языка появится позже (Task 13)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" />
                <path
                  d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                />
              </svg>
              <span>RU</span>
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {loading && (
              <span className="header-actions__status" role="status" aria-live="polite">
                Проверка…
              </span>
            )}

            {!loading && !user && (
              <>
                <Link className="btn btn--ghost" to="/login">
                  Войти
                </Link>
                <Link className="btn btn--primary" to="/register">
                  Зарегистрироваться
                </Link>
              </>
            )}

            {!loading && user && (
              <>
                <span className="account-chip" title={user.email}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="8.5" r="3.6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    <path
                      d="M4.8 19.5c1-3.6 3.8-5.5 7.2-5.5s6.2 1.9 7.2 5.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="account-chip__email">{user.email}</span>
                </span>
                {logoutError && (
                  <span className="header-actions__error" role="alert">
                    {logoutError}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleSignOut}
                  disabled={loggingOut}
                >
                  {loggingOut ? 'Выходим…' : 'Выйти'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}