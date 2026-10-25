import type { ReactNode } from 'react'

import { ANALYSIS_RULES_VERSION } from '../lib/analysisRules'
import type { ReportSaveState } from '../lib/matchReportFlow'
import { rulesVersionNotice, type MatchReportView } from '../lib/matchReports'

interface ReportPersistenceNoticeProps {
  view: MatchReportView
  save: ReportSaveState
  /** Ссылка на страницу входа (передаётся снаружи, чтобы компонент не зависел от роутера). */
  loginLink?: ReactNode
  /** Повторная попытка сохранения уже сформированного отчёта (без запроса к OpenDota). */
  onRetrySave?: () => void
  retrying?: boolean
}

/** Отображение времени в UTC без зависимости от локали браузера. */
function formatTimestamp(value: string | null): string | null {
  if (value === null) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return `${parsed.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

interface SavePresentation {
  badge: string
  badgeClass: string
  summary: string
  alert: string | null
}

/**
 * Тексты состояния сохранения. Формулировка «сохранено» используется только тогда,
 * когда запись действительно подтверждена базой данных.
 */
function describeSave(save: ReportSaveState, isPartial: boolean): SavePresentation {
  switch (save.kind) {
    case 'stored':
      return {
        badge: 'Сохранённый отчёт',
        badgeClass: 'badge badge--ok',
        summary:
          'Показан ранее сохранённый личный отчёт: OpenDota не запрашивалась, наблюдения не пересчитывались.',
        alert: null,
      }
    case 'saved':
      return {
        badge: 'Новый отчёт сохранён',
        badgeClass: 'badge badge--ok',
        summary: isPartial
          ? 'Отчёт сформирован и сохранён в личной истории (частичные данные — см. ограничения ниже).'
          : 'Отчёт сформирован и сохранён в личной истории.',
        alert: null,
      }
    case 'conflict-resolved':
      return {
        badge: 'Сохранённый отчёт',
        badgeClass: 'badge badge--ok',
        summary:
          'Отчёт уже был сохранён другим запросом: показана существующая запись, вторая строка не создавалась и данные не перезаписаны.',
        alert: null,
      }
    case 'guest':
      return {
        badge: 'Гостевой режим',
        badgeClass: 'badge badge--warn',
        summary:
          'Отчёт не сохраняется: вы не вошли в аккаунт. Анализ рассчитан из данных OpenDota и показан только на этой странице.',
        alert: null,
      }
    case 'no-database':
      return {
        badge: 'Сохранение недоступно',
        badgeClass: 'badge badge--warn',
        summary:
          'Анализ рассчитан, но личная история недоступна: подключение к базе данных не настроено.',
        alert: save.message,
      }
    case 'database-error':
      return {
        badge: 'Отчёт не сохранён',
        badgeClass: 'badge badge--warn',
        summary: 'Отчёт сформирован, но сохранить его не удалось.',
        alert: save.error.message,
      }
    case 'unresolved':
      return {
        badge: 'Незавершённая запись',
        badgeClass: 'badge badge--warn',
        summary: 'Показан заново рассчитанный отчёт: существующая запись не перезаписывалась.',
        alert: save.message,
      }
    case 'save-failed':
      return {
        badge: 'Отчёт не сохранён',
        badgeClass: 'badge badge--warn',
        summary: 'Отчёт сформирован, но сохранить его не удалось.',
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
  const isPartial = view.status === 'partial'
  const presentation = describeSave(save, isPartial)
  const versionNotice = rulesVersionNotice(view.rulesVersion, ANALYSIS_RULES_VERSION)
  const fetchedAt = formatTimestamp(view.fetchedAt)
  const savedAt = formatTimestamp(view.updatedAt ?? view.createdAt)
  const canRetry =
    (save.kind === 'save-failed' || save.kind === 'database-error') && onRetrySave !== undefined

  return (
    <section className="report-notice panel" aria-labelledby="report-notice-title">
      <h2 className="match-section__title" id="report-notice-title">
        Личный отчёт
      </h2>

      <p className={presentation.badgeClass}>{presentation.badge}</p>
      <p className="stub__text">{presentation.summary}</p>

      {presentation.alert !== null && (
        <p className="auth-alert auth-alert--error" role="alert">
          {presentation.alert}
        </p>
      )}

      {save.kind === 'guest' && loginLink !== undefined && (
        <>
          <p className="stub__text">Чтобы отчёт сохранялся в личную историю, войдите в аккаунт.</p>
          <p>{loginLink}</p>
        </>
      )}

      {isPartial && (
        <p className="report-notice__note" role="note">
          Частичный отчёт: часть данных провайдера недоступна — сохранены только подтверждённые
          значения (отсутствующие показатели остаются пустыми).
        </p>
      )}

      <ul className="stub__list">
        <li>
          Версия правил анализа: <strong>{view.rulesVersion}</strong>
        </li>
        <li>
          Источник данных: <strong>{view.source}</strong>
        </li>
        {fetchedAt !== null && <li>Данные OpenDota получены: {fetchedAt}</li>}
        {view.id !== null && savedAt !== null && <li>Отчёт сохранён: {savedAt}</li>}
        {view.id !== null && <li>Идентификатор отчёта: {view.id}</li>}
      </ul>

      {versionNotice !== null && (
        <p className="report-notice__note" role="note">
          {versionNotice}
        </p>
      )}

      {view.limitations.length > 0 && (
        <div className="report-notice__limitations">
          <h3 className="report-notice__subtitle">Ограничения сохранённых данных</h3>
          <ul className="stub__list">
            {view.limitations.map((limitation) => (
              <li key={limitation.code}>{limitation.text}</li>
            ))}
          </ul>
        </div>
      )}

      {canRetry && (
        <div className="stub__actions">
          <button type="button" className="btn btn--primary" onClick={onRetrySave} disabled={retrying}>
            {retrying ? 'Сохраняем…' : 'Повторить сохранение'}
          </button>
        </div>
      )}
    </section>
  )
}