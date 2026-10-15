import { Link } from 'react-router-dom'

/**
 * Статическая карточка-превью матча для hero-секции (Task 2).
 * Все числа — демонстрационные, зашитые в разметку для показа дизайна.
 * Данные НЕ получены из OpenDota и не являются подтверждённым матчем.
 */
export default function MatchPreviewCard() {
  return (
    <aside className="preview-card" aria-label="Пример карточки матча — дизайн-превью с демонстрационными данными">
      <div className="preview-card__badge">
        <span className="badge badge--warn">Дизайн-превью</span>
      </div>
      <div className="preview-card__head">
        <span className="preview-card__hero" aria-hidden="true">
          <svg viewBox="0 0 40 40" width="40" height="40" focusable="false">
            <defs>
              <linearGradient id="pvHero" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#5b2330" />
                <stop offset="100%" stop-color="#1a2432" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="38" height="38" rx="8" fill="url(#pvHero)" />
            <path
              d="M20 8l8 5v8c0 5.2-3.4 8.9-8 11-4.6-2.1-8-5.8-8-11v-8z"
              fill="#ef3038"
              opacity="0.75"
            />
            <circle cx="20" cy="19" r="3.4" fill="#f5f7fb" />
          </svg>
        </span>
        <div className="preview-card__meta">
          <div className="preview-card__id">9007760151</div>
          <div className="preview-card__name">Lion</div>
        </div>
      </div>

      <dl className="preview-card__stats">
        <div>
          <dt>KDA</dt>
          <dd>6 / 8 / 18</dd>
        </div>
        <div>
          <dt>GPM</dt>
          <dd>432</dd>
        </div>
        <div>
          <dt>XPM</dt>
          <dd>512</dd>
        </div>
      </dl>

      <div className="preview-card__charts">
        <svg viewBox="0 0 150 48" className="chart-line" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="pvArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ef3038" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#ef3038" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d="M2 40 L26 32 L50 34 L74 22 L98 24 L122 12 L148 6 L148 48 L2 48 Z" fill="url(#pvArea)" />
          <polyline
            points="2,40 26,32 50,34 74,22 98,24 122,12 148,6"
            fill="none"
            stroke="#ef3038"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg viewBox="0 0 60 48" className="chart-bars" aria-hidden="true" focusable="false">
          <rect x="4" y="28" width="8" height="18" rx="2" fill="#2c3a4c" />
          <rect x="18" y="20" width="8" height="26" rx="2" fill="#2c3a4c" />
          <rect x="32" y="26" width="8" height="20" rx="2" fill="#2c3a4c" />
          <rect x="46" y="10" width="8" height="36" rx="2" fill="#ef3038" />
        </svg>
      </div>

      <Link className="preview-card__link" to="/matches/9007760151">
        Посмотреть пример анализа →
      </Link>
      <p className="preview-card__note">
        Демонстрационные данные, не из OpenDota.
      </p>
    </aside>
  )
}