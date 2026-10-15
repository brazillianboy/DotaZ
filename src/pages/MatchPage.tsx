import { Link, useParams } from 'react-router-dom'

/**
 * Страница матча (Task 2 — заглушка).
 * Параметр `matchId` читается из маршрута `/matches/:matchId` и показывается как есть:
 * бизнес-валидация, запросы к OpenDota и анализ относятся к Task 5 и здесь не выполняются.
 */
export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const displayId = matchId ?? 'не указан'

  return (
    <section className="stub">
      <div className="container">
        <div className="stub__panel panel">
          <span className="badge badge--warn">Дизайн-превью</span>
          <h1 className="stub__title">
            Матч <span className="accent">{displayId}</span>
          </h1>
          <p className="stub__text">
            Загрузка реальных матчей и анализ пока не реализованы (планируется Task 5).
            Запросы к OpenDota не выполняются, статистика не рассчитывается — эта страница
            показывает будущее место отчёта по матчу.
          </p>
          <ul className="stub__list">
            <li>Запрошенный ID матча: <strong>{displayId}</strong></li>
            <li>Источник данных: не подключён</li>
            <li>Статус: ожидает реализации загрузки и обработки матча</li>
          </ul>
          <Link className="btn btn--ghost" to="/">
            ← Вернуться на главную
          </Link>
        </div>
      </div>
    </section>
  )
}