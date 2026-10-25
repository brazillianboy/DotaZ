import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useI18n } from '../i18n/I18nContext'

interface PlaceholderPanelProps {
  title: string
  description: string
  children?: ReactNode
}

/**
 * Переиспользуемая панель-заглушка для страниц, функционал которых
 * будет реализован в последующих задачах (Task 2, локализация — Task 13).
 */
export default function PlaceholderPanel({ title, description, children }: PlaceholderPanelProps) {
  const { t } = useI18n()

  return (
    <section className="stub">
      <div className="container">
        <div className="stub__panel panel">
          <span className="badge badge--warn">{t('placeholder.badge')}</span>
          <h1 className="stub__title">{title}</h1>
          <p className="stub__text">{description}</p>
          {children}
          <Link className="btn btn--ghost" to="/">
            {t('common.backHome')}
          </Link>
        </div>
      </div>
    </section>
  )
}