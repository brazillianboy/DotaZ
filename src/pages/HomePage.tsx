import { Link } from 'react-router-dom'

import MatchPreviewCard from '../components/MatchPreviewCard'

/* Иконки раздела возможностей (inline SVG). */
function IconBars() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <rect x="3" y="12" width="4" height="9" rx="1.5" fill="currentColor" />
      <rect x="10" y="7" width="4" height="14" rx="1.5" fill="currentColor" />
      <rect x="17" y="3" width="4" height="18" rx="1.5" fill="currentColor" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8" r="3.4" fill="currentColor" />
      <circle cx="17" cy="9" r="2.6" fill="currentColor" opacity="0.75" />
      <path d="M3 19c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2z" fill="currentColor" />
      <path d="M15.4 13.8c2.7 0 5 1.7 5 4.4v1.3h-4.3c.1-2-.6-3.9-1.9-5.2z" fill="currentColor" opacity="0.75" />
    </svg>
  )
}

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="12" cy="12" r="3.4" fill="currentColor" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <path d="M4 5c2.6-.8 5.3-.8 8 0v14c-2.7-.8-5.4-.8-8 0z" fill="currentColor" />
      <path d="M20 5c-2.6-.8-5.3-.8-8 0v14c2.7-.8 5.4-.8 8 0z" fill="currentColor" opacity="0.65" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M12 7v5.4l3.6 2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M3.4 12h17.2M12 3.4c2.6 2.6 2.6 14.6 0 17.2M12 3.4c-2.6 2.6-2.6 14.6 0 17.2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
    </svg>
  )
}

/* Планируемые возможности платформы: секция описывает планы, а не текущий функционал. */
const FEATURES = [
  { icon: <IconBars />, title: 'Подробная аналитика', text: 'Статистика, наблюдения и рекомендации.' },
  { icon: <IconUsers />, title: 'Информация о мете', text: 'Актуальные герои и стратегии.' },
  { icon: <IconTarget />, title: 'Анализ линии', text: 'Разбор первых 10 минут матча.' },
  { icon: <IconBook />, title: 'Средние показатели', text: 'Сравнение с другими игроками.' },
  { icon: <IconClock />, title: 'Личная история', text: 'Все проанализированные матчи.' },
  { icon: <IconGlobe />, title: 'Русский и английский', text: 'Выбери удобный язык.' },
]

export default function HomePage() {
  return (
    <div className="home">
      {/* ---------- SECTION A: Hero ---------- */}
      <section className="hero">
        {/* Арт-плейсхолдер: оригинальная абстрактная SVG-композиция
            (public/assets/hero-art-placeholder.svg). Защищённые ассеты Dota 2
            не использованы; заменяется согласованным артом по решению владельца. */}
        <div className="hero__art" aria-hidden="true" />
        <div className="hero__veil" aria-hidden="true" />

        <div className="container hero__inner">
          <div className="hero__content">
            <h1 className="hero__title">
              Анализируй свои игры в Dota 2 и становись лучше с{' '}
              <span className="accent">DotaZ</span>
            </h1>
            <p className="hero__lead">
              Разбирай матчи, получай достоверную статистику и обоснованные наблюдения,
              следи за метой. Всё, что нужно для роста — в одной платформе.
            </p>

            <form
              className="match-form"
              aria-label="Форма анализа матча — скоро"
              onSubmit={(event) => event.preventDefault()}
            >
              <fieldset className="match-form__fieldset" disabled>
                <legend className="visually-hidden">
                  Анализ матча пока недоступен — элементы формы отключены
                </legend>
                <div className="match-form__row">
                  <div className="match-input">
                    <span className="match-input__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
                        <rect x="3" y="3" width="18" height="18" rx="5" fill="#c2242c" />
                        <path d="M8 7h8l-4.6 5.6H13L7.5 18l2.2-5.4H7z" fill="#ffffff" />
                      </svg>
                    </span>
                    <input
                      className="match-input__field"
                      type="text"
                      placeholder="Введите ID матча (например, 9007760151)"
                      aria-label="ID матча"
                      aria-describedby="match-form-notice"
                      readOnly
                    />
                  </div>
                  <button type="submit" className="btn btn--primary btn--lg match-form__submit">
                    Анализировать
                    <span aria-hidden="true"> →</span>
                  </button>
                </div>
              </fieldset>

              <div className="match-form__meta">
                <span className="match-form__help">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    <path
                      d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.8.3-1 1-1 1.8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      fill="none"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="16.6" r="1" fill="currentColor" />
                  </svg>
                  Где найти ID матча?
                </span>
                <span className="match-form__example">
                  Пример: <span className="accent">9007760151</span>
                </span>
              </div>

              <p className="match-form__notice" id="match-form-notice">
                <span className="badge badge--warn">Скоро</span>
                Анализ матчей пока недоступен: форма — визуальное превью, запросы не
                отправляются. Функция появится в следующих версиях.
              </p>
            </form>
          </div>

          <div className="hero__aside">
            <MatchPreviewCard />
          </div>
        </div>
      </section>

      {/* ---------- Ряд возможностей (планируемые функции) ---------- */}
      <section className="features" aria-labelledby="features-title">
        <div className="container">
          <h2 className="section-eyebrow" id="features-title">
            Планируемые возможности платформы
          </h2>
          <ul className="features__list">
            {FEATURES.map((feature) => (
              <li className="feature" key={feature.title}>
                <span className="feature__icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <div className="feature__body">
                  <h3 className="feature__title">{feature.title}</h3>
                  <p className="feature__text">{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Как это работает? ---------- */}
      <section className="steps" aria-labelledby="steps-title">
        <div className="container">
          <h2 className="section-title" id="steps-title">
            Как это работает?
          </h2>
          <ol className="steps__list">
            <li className="step panel">
              <div className="step__head">
                <span className="step__num">1</span>
                <h3 className="step__title">Введи ID матча</h3>
              </div>
              <p className="step__text">Скопируй ID из Dota 2 и вставь на сайт.</p>
              <div className="mock mock--input" aria-hidden="true">
                <span className="mock__mark">
                  <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
                    <rect x="3" y="3" width="18" height="18" rx="5" fill="#c2242c" />
                    <path d="M8 7h8l-4.6 5.6H13L7.5 18l2.2-5.4H7z" fill="#ffffff" />
                  </svg>
                </span>
                <span className="mock__value">9007760151</span>
              </div>
            </li>

            <li className="steps__arrow" aria-hidden="true">
              →
            </li>

            <li className="step panel">
              <div className="step__head">
                <span className="step__num">2</span>
                <h3 className="step__title">Мы анализируем</h3>
              </div>
              <p className="step__text">Получаем данные с OpenDota и анализируем матч.</p>
              <div className="mock mock--analyze" aria-hidden="true">
                <span className="mock__search">
                  <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
                    <circle cx="10.5" cy="10.5" r="6.2" stroke="#ef3038" strokeWidth="2" fill="none" />
                    <path d="M15.2 15.2L20 20" stroke="#ef3038" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="mock__bar">
                  <span className="mock__bar-fill" />
                </span>
              </div>
            </li>

            <li className="steps__arrow" aria-hidden="true">
              →
            </li>

            <li className="step panel">
              <div className="step__head">
                <span className="step__num">3</span>
                <h3 className="step__title">Получай результаты</h3>
              </div>
              <p className="step__text">Смотри статистику, наблюдения и рекомендации.</p>
              <div className="mock mock--result" aria-hidden="true">
                <span className="mock__avatar">
                  <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
                    <defs>
                      <linearGradient id="mockAv" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#5b2330" />
                        <stop offset="100%" stop-color="#1a2432" />
                      </linearGradient>
                    </defs>
                    <rect x="1" y="1" width="30" height="30" rx="7" fill="url(#mockAv)" />
                    <circle cx="16" cy="13" r="5" fill="#aebbd0" />
                    <path d="M6 29c1-5.4 5-8 10-8s9 2.6 10 8z" fill="#aebbd0" opacity="0.8" />
                  </svg>
                </span>
                <span className="mock__lines">
                  <span className="mock__line" />
                  <span className="mock__line mock__line--mid" />
                  <span className="mock__line mock__line--short" />
                </span>
                <span className="mock__alert">!</span>
              </div>
            </li>

            <li className="steps__arrow" aria-hidden="true">
              →
            </li>

            <li className="step panel">
              <div className="step__head">
                <span className="step__num">4</span>
                <h3 className="step__title">Становись лучше</h3>
              </div>
              <p className="step__text">Используй рекомендации и улучшай свою игру.</p>
              <div className="mock mock--growth" aria-hidden="true">
                <svg viewBox="0 0 120 48" width="120" height="48" focusable="false">
                  <polyline
                    points="6,42 32,30 54,34 82,16 112,8"
                    fill="none"
                    stroke="#2fd06b"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M96 6h18v18" fill="none" stroke="#2fd06b" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ---------- Нижние карточки-разделы ---------- */}
      <section className="guide" aria-label="Разделы платформы">
        <div className="container">
          <ul className="guide__list">
            <li className="guide-card guide-card--blue">
              <Link className="guide-card__link" to="/heroes">
                <div className="guide-card__body">
                  <h3 className="guide-card__title">Персонажи</h3>
                  <p className="guide-card__text">
                    Винрейты, пики, предметы и средние показатели.
                  </p>
                </div>
                <span className="guide-card__arrow" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>

            <li className="guide-card guide-card--red">
              <article className="guide-card__static">
                <div className="guide-card__body">
                  <h3 className="guide-card__title">
                    Актуальная мета{' '}
                    <span className="badge badge--warn">Скоро</span>
                  </h3>
                  <p className="guide-card__text">
                    Следи за трендами и сильными героями текущего патча.
                  </p>
                  <p className="guide-card__note">Раздел в разработке — пока без ссылки.</p>
                </div>
              </article>
            </li>

            <li className="guide-card guide-card--crimson">
              <Link className="guide-card__link" to="/matches/9007760151">
                <div className="guide-card__body">
                  <h3 className="guide-card__title">Пример анализа</h3>
                  <p className="guide-card__text">
                    Посмотри, как выглядит подробный отчёт по матчу.
                  </p>
                </div>
                <span className="guide-card__arrow" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>

            <li className="guide-card guide-card--green">
              <Link className="guide-card__link" to="/history">
                <div className="guide-card__body">
                  <h3 className="guide-card__title">История матчей</h3>
                  <p className="guide-card__text">Все твои анализы в одном месте.</p>
                </div>
                <span className="guide-card__arrow" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}