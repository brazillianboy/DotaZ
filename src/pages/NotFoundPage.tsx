import { Link } from 'react-router-dom'

import { useI18n } from '../i18n/I18nContext'

export default function NotFoundPage() {
  const { t } = useI18n()

  return (
    <section className="stub stub--404">
      <div className="container">
        <div className="stub__panel panel">
          <p className="notfound__code" aria-hidden="true">
            404
          </p>
          <h1 className="stub__title">{t('notFound.title')}</h1>
          <p className="stub__text">{t('notFound.text')}</p>
          <Link className="btn btn--primary" to="/">
            {t('notFound.home')}
          </Link>
        </div>
      </div>
    </section>
  )
}