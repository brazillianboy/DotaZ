import { Link } from 'react-router-dom'

import { useI18n } from '../i18n/I18nContext'

/**
 * Точка интеграции основной Task 20 (прогресс игрока) в профиль (Task 20B).
 *
 * Task 20 — «история прогресса и сравнение матчей» — самостоятельная задача и в
 * Task 20B **не** реализуется, не подменяется и не помечается выполненной. Здесь
 * честно сказано, что долгосрочный прогресс пока недоступен, и даны ссылки на уже
 * работающие разделы. Никаких выдуманных трендов, рейтинга или «улучшения» нет.
 */
export default function ProfileProgress() {
  const { t } = useI18n()

  return (
    <section className="profile-section" aria-labelledby="profile-progress-title">
      <header className="profile-section__head">
        <h2 className="profile-section__title" id="profile-progress-title">
          {t('profile.progress.title')}
        </h2>
      </header>

      <div className="profile-progress panel">
        <p className="profile-note">
          <span className="badge badge--warn profile-progress__badge">{t('profile.progress.badge')}</span>
        </p>
        <p className="profile-progress__text">{t('profile.progress.text')}</p>
        <p className="profile-note">{t('profile.progress.current')}</p>
        <div className="profile-progress__actions">
          <Link className="btn btn--ghost" to="/history">
            {t('profile.progress.history')}
          </Link>
          <Link className="btn btn--ghost" to="/">
            {t('profile.progress.analyzeMatch')}
          </Link>
        </div>
      </div>
    </section>
  )
}