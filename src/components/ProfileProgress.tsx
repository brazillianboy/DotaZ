import { Link } from 'react-router-dom'

import { useI18n } from '../i18n/I18nContext'

/**
 * Точка интеграции основной Task 20 (прогресс игрока) в профиль (Task 20B).
 *
 * Долгосрочный прогресс, динамика показателей и сравнение матчей — самостоятельная
 * задача Task 20 и реализуется на отдельной странице `/progress`. Здесь дана ссылка
 * на неё, а вторичные ссылки ведут в уже работающие разделы. Никаких выдуманных
 * трендов, рейтинга или «улучшения» в самом профиле нет.
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
          <span className="badge badge--ok profile-progress__badge">{t('profile.progress.badge')}</span>
        </p>
        <p className="profile-progress__text">{t('profile.progress.text')}</p>
        <p className="profile-note">{t('profile.progress.current')}</p>
        <div className="profile-progress__actions">
          <Link className="btn btn--primary" to="/progress">
            {t('profile.progress.open')}
          </Link>
          <Link className="btn btn--ghost" to="/history">
            {t('profile.progress.history')}
          </Link>
        </div>
      </div>
    </section>
  )
}