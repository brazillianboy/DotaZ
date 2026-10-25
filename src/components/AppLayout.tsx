import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import AppHeader from './AppHeader'
import { useI18n } from '../i18n/I18nContext'

/**
 * Общий каркас страниц: шапка, основное содержимое, подвал.
 * Скролл возвращается наверх при смене маршрута.
 */
export default function AppLayout() {
  const { pathname } = useLocation()
  const { t } = useI18n()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {t('nav.skipToContent')}
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
          <p className="site-footer__note">{t('footer.note')}</p>
        </div>
      </footer>
    </div>
  )
}