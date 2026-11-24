import { Link } from 'react-router-dom'

import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'
import type { HistoryReportItem } from '../lib/historyReports'
import { isOpenableHistoryItem } from '../lib/historyFlow'
import type { MatchReportStatus } from '../lib/matchReports'

import { historyResultText } from './HistoryList'

/** Состояние секции сохранённых анализов. */
export type SavedAnalysesState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'list'; items: HistoryReportItem[]; skipped: number }

interface ProfileSavedAnalysesProps {
  state: SavedAnalysesState
  onRetry: () => void
}

const STATUS_LABEL_KEYS: Record<MatchReportStatus, { key: TranslationKey; badgeClass: string }> = {
  ready: { key: 'history.status.ready', badgeClass: 'badge badge--ok' },
  partial: { key: 'history.status.partial', badgeClass: 'badge badge--warn' },
  pending: { key: 'history.status.pending', badgeClass: 'badge badge--warn' },
  error: { key: 'history.status.error', badgeClass: 'badge badge--warn' },
}

/**
 * Сохранённые анализы DotaZ в профиле (Task 20B).
 *
 * Используется существующий сервис истории (`loadHistoryPage` →
 * `createHistoryReportsService` → Supabase-адаптер): второй системы хранения нет,
 * владелец всегда берётся из сессии Supabase и дополнительно ограничен RLS.
 * Показываются только метаданные карточки; отчёты не изменяются и не пересчитываются.
 *
 * Пустая история, ошибка и загрузка — разные состояния и выглядят по-разному.
 */
export default function ProfileSavedAnalyses({ state, onRetry }: ProfileSavedAnalysesProps) {
  const { t, formatDateTime } = useI18n()

  return (
    <section className="profile-section" aria-labelledby="profile-saved-title">
      <header className="profile-section__head">
        <h2 className="profile-section__title" id="profile-saved-title">
          {t('profile.saved.title')}
        </h2>
        <p className="profile-section__lead">{t('profile.saved.lead')}</p>
      </header>

      <div className="profile-saved panel" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && (
          <p className="profile-note" role="status" aria-live="polite">
            {t('profile.saved.loading')}
          </p>
        )}

        {state.status === 'unavailable' && (
          <p className="profile-note" role="note">
            {state.message}
          </p>
        )}

        {state.status === 'error' && (
          <>
            <p className="profile-note profile-note--warn" role="alert">
              {t('profile.saved.error')}
            </p>
            <p className="profile-note">{state.message}</p>
            <button type="button" className="btn btn--ghost" onClick={onRetry}>
              {t('profile.retry')}
            </button>
          </>
        )}

        {state.status === 'empty' && (
          <>
            <p className="profile-note" role="status" aria-live="polite">
              {t('profile.saved.empty')}
            </p>
            <p className="profile-note">{t('profile.saved.emptyHint')}</p>
          </>
        )}

        {state.status === 'list' && (
          <>
            <ul className="profile-saved__list">
              {state.items.map((item) => {
                const status = STATUS_LABEL_KEYS[item.status]
                const savedAt = formatDateTime(item.createdAt)
                return (
                  <li className="profile-saved__item" key={item.id}>
                    <div className="profile-saved__identity">
                      <span className="profile-saved__match">
                        {t('history.matchTitle', { id: item.matchId })}
                      </span>
                      <span className="profile-saved__meta">
                        {t('profile.saved.savedAt')}: {savedAt ?? t('common.noData')}
                        {' · '}
                        {t('history.resultLabel')}: {historyResultText(t, item.radiantWin)}
                      </span>
                    </div>
                    <span className={status.badgeClass}>{t(status.key)}</span>
                    {isOpenableHistoryItem(item) ? (
                      <Link className="profile-saved__open" to={`/matches/${item.matchId}`}>
                        {t('history.openReport')}
                      </Link>
                    ) : (
                      <span className="profile-saved__pending">
                        {t('history.openUnavailable', { status: t(status.key).toLowerCase() })}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            {state.skipped > 0 && (
              <p className="profile-note">{t('common.skippedRecords', { count: state.skipped })}</p>
            )}
          </>
        )}

        <Link className="btn btn--ghost profile-saved__history" to="/history">
          {t('profile.saved.openHistory')}
        </Link>
      </div>
    </section>
  )
}
