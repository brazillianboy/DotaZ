import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import AppHeader from './AppHeader'

/**
 * Общий каркас страниц: шапка, основное содержимое, подвал.
 * Скролл возвращается наверх при смене маршрута.
 */
export default function AppLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <AppHeader />
      <main id="main" className="app-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container site-footer__inner">
          <span className="site-footer__brand">
            Dota<span className="brand__accent">Z</span>
          </span>
          <p className="site-footer__note">
            Учебный концепт анализа матчей Dota 2. Интерфейс — дизайн-превью: загрузка
            матчей, аналитика и аккаунты ещё не реализованы.
          </p>
        </div>
      </footer>
    </div>
  )
}