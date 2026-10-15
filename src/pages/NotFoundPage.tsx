import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="stub stub--404">
      <div className="container">
        <div className="stub__panel panel">
          <p className="notfound__code" aria-hidden="true">
            404
          </p>
          <h1 className="stub__title">Страница не найдена</h1>
          <p className="stub__text">
            Такой страницы не существует — возможно, адрес введён с ошибкой или раздел
            ещё не реализован.
          </p>
          <Link className="btn btn--primary" to="/">
            Вернуться на главную
          </Link>
        </div>
      </div>
    </section>
  )
}