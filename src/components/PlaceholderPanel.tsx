import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface PlaceholderPanelProps {
  title: string
  description: string
  children?: ReactNode
}

/**
 * Переиспользуемая панель-заглушка для страниц, функционал которых
 * будет реализован в последующих задачах (Task 2 — только каркас).
 */
export default function PlaceholderPanel({ title, description, children }: PlaceholderPanelProps) {
  return (
    <section className="stub">
      <div className="container">
        <div className="stub__panel panel">
          <span className="badge badge--warn">Функция в разработке</span>
          <h1 className="stub__title">{title}</h1>
          <p className="stub__text">{description}</p>
          {children}
          <Link className="btn btn--ghost" to="/">
            ← Вернуться на главную
          </Link>
        </div>
      </div>
    </section>
  )
}