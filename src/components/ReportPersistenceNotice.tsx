import type { ReactNode } from 'react'

import { ANALYSIS_RULES_VERSION } from '../lib/analysisRules'
import type { ReportSaveState } from '../lib/matchReportFlow'
import { rulesVersionNotice, type MatchReportView } from '../lib/matchReports'
import { localizeLimitation } from '../i18n/analysisText'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'

interface ReportPersistenceNoticeProps {
  view: MatchReportView
  save: ReportSaveState
  /** Ссылка на страницу входа (передаётся снаружи, чтобы компонент не зависел от роутера). */
  loginLink?: ReactNode
  /** Повторная попытка сохранения уже сформированного отчёта (без запроса к OpenDota). */
  onRetrySave?: () => void
  retrying?: boolean
}

interface SavePresentation {
  badge: TranslationKey
  badgeClass: string
  summary: TranslationKey
  alert: string | null
}

/**
 * Ключи словаря для состояния сохранения. Формулировка «сохранено» используется
 * только тогда, когда запись действительно подтверждена базой данных.
 */
function describeSave(save: ReportSaveState): SavePresentation {
  switch (save.kind) {
    case 'stored':
      return {
        badge: 'persistence.stored.badge',
        badgeClass: 'badge badge--ok',
        summary: 'persistence.stored.summary',
        alert: null,
      }
    case 'saved':
      return {
        badge: 'persistence.saved.badge',
        badgeClass: 'badge badge--ok',
        summary: 'persistence.saved.summary',
        alert: null,
      }
    case 'conflict-resolved':
      return {
        badge: 'persistence.conflict.badge',
        badgeClass: 'badge badge--ok',
        summary: 'persistence.conflict.summary',
        alert: null,
      }
    case 'guest':
      return {
        badge: 'persistence.guest.badge',
        badgeClass: 'badge badge--warn',
        summary: 'persistence.guest.summary',
        alert: null,
      }
    case 'no-database':
      return {
        badge: 'persistence.noDatabase.badge',
        badgeClass: 'badge badge--warn',
        summary: 'persistence.noDatabase.summary',
        alert: save.message,
      }
    case 'database-error':
      return {
        badge: 'persistence.failed.badge',
        badgeClass: 'badge badge--warn',
        summary: 'persistence.failed.summary',
        alert: save.error.message,
      }
    case 'unresolved':
      return {
        badge: 'persistence.unresolved.badge',
        badgeClass: 'badge badge--warn',
        summary: 'persistence.unresolved.summary',
        alert: save.message,
      }
    case 'save-failed':
      return {
        badge: 'persistence.failed.badge',
        badgeClass: 'badge badge--warn',
        summary: 'persistence.failed.summary',
        alert: save.error.message,
      }
  }
}

/**
 * Панель состояния личного отчёта (Task 11).
 *
 * Сообщение «сохранено» показывается только при подтверждённой записи в базе.
 * Отдельно выводятся: частичность данных, версия правил (и расхождение с текущей),
 * источник, фактические временные метки и ограничения снимка.
 */
export default function ReportPersistenceNotice({
  view,
  save,
  loginLink,
  onRetrySave,
  retrying = false,
}: ReportPersistenceNoticeProps) {
  const { t, locale, formatDateTime } = useI18n()
  const isPartial = view.status === 'partial'
  const presentation = describeSave(save)
  const summary =
    save.kind === 'saved' && isPartial
      ? t('persistence.saved.summaryPartial')
      : t(presentation.summary)
  const versionNotice = rulesVersionNotice(view.rulesVersion, ANALYSIS_RULES_VERSION)
  const fetchedAt = formatDateTime(view.fetchedAt)
  const savedAt = formatDateTime(view.updatedAt ?? view.createdAt)
  const canRetry =
    (save.kind === 'save-failed' || save.kind === 'database-error') && onRetrySave !== undefined

  return (
    <section className="report-notice panel" aria-labelledby="report-notice-title">
      <h2 className="match-section__title" id="report-notice-title">
        {t('persistence.title')}
      </h2>

      <p className={presentation.badgeClass}>{t(presentation.badge)}</p>
      <p className="stub__text">{summary}</p>

      {presentation.alert !== null && (
        <p className="auth-alert auth-alert--error" role="alert">
          {presentation.alert}
        </p>
      )}

      {save.kind === 'guest' && loginLink !== undefined && (
        <>
          <p className="stub__text">{t('persistence.guest.loginHint')}</p>
          <p>{loginLink}</p>
        </>
      )}

      {isPartial && (
        <p className="report-notice__note" role="note">
          {t('persistence.partialNote')}
        </p>
      )}

      <ul className="stub__list">
        <li>
          {t('persistence.rulesVersionLabel')} <strong>{view.rulesVersion}</strong>
        </li>
        <li>
          {t('persistence.sourceLabel')} <strong>{view.source}</strong>
        </li>
        {fetchedAt !== null && <li>{t('persistence.fetchedAt', { value: fetchedAt })}</li>}
        {view.id !== null && savedAt !== null && (
          <li>{t('persistence.savedAt', { value: savedAt })}</li>
        )}
        {view.id !== null && <li>{t('persistence.reportId', { id: view.id })}</li>}
      </ul>

      {versionNotice !== null && (
        <p className="report-notice__note" role="note">
          {versionNotice}
        </p>
      )}

      {view.limitations.length > 0 && (
        <div className="report-notice__limitations">
          <h3 className="report-notice__subtitle">{t('persistence.limitationsTitle')}</h3>
          <ul className="stub__list">
            {view.limitations.map((limitation) => (
              <li key={limitation.code}>{localizeLimitation(limitation, locale).text}</li>
            ))}
          </ul>
        </div>
      )}

      {canRetry && (
        <div className="stub__actions">
          <button type="button" className="btn btn--primary" onClick={onRetrySave} disabled={retrying}>
            {retrying ? t('persistence.retrying') : t('persistence.retry')}
          </button>
        </div>
      )}
    </section>
  )
}