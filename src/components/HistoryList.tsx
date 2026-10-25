import { Link } from 'react-router-dom'

import type { HistoryReportItem } from '../lib/historyReports'
import { isOpenableHistoryItem } from '../lib/historyFlow'
import type { MatchReportStatus } from '../lib/matchReports'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'

interface HistoryListProps {
  items: HistoryReportItem[]
  /** true — загружена полная страница, возможно есть более ранние отчёты. */
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  /** Сколько записей пропущено из-за непригодных метаданных. */
  skippedCount: number
}

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

const STATUS_KEYS: Record<MatchReportStatus, { key: TranslationKey; badgeClass: string }> = {
  ready: { key: 'history.status.ready', badgeClass: 'badge badge--ok' },
  partial: { key: 'history.status.partial', badgeClass: 'badge badge--warn' },
  pending: { key: 'history.status.pending', badgeClass: 'badge badge--warn' },
  error: { key: 'history.status.error', badgeClass: 'badge badge--warn' },
}

/** Результат матча: только из сохранённого снимка, без выводов из статистики игроков. */
export function historyResultText(t: Translate, radiantWin: boolean | null): string {
  if (radiantWin === true) {
    return t('history.result.radiant')
  }
  if (radiantWin === false) {
    return t('history.result.dire')
  }
  return t('common.noData')
}

/**
 * Список сохранённых личных анализов (Task 12, локализация — Task 13).
 *
 * Карточка показывает ID матча, дату сохранения, результат (если подтверждён),
 * статус отчёта, источник и версию правил. Внутренние UUID строк не выводятся.
 * Открытие доступно только для готовых отчётов (`ready`/`partial`): для
 * `pending`/`error` показывается фактическое состояние без действия.
 */
export default function HistoryList({
  items,
  hasMore,
  loadingMore,
  onLoadMore,
  skippedCount,
}: HistoryListProps) {
  const { t, formatDateTime } = useI18n()

  if (items.length === 0) {
    return <p className="stub__text">{t('history.empty')}</p>
  }

  return (
    <div className="history">
      <ul className="history-list">
        {items.map((item) => {
          const status = STATUS_KEYS[item.status]
          const statusText = t(status.key)
          const savedAt = formatDateTime(item.createdAt)
          const openable = isOpenableHistoryItem(item)
          return (
            <li className="history-card panel" key={item.id}>
              <div className="history-card__head">
                <h3 className="history-card__title">
                  {t('history.matchTitle', { id: item.matchId })}
                </h3>
                <span className={status.badgeClass}>{statusText}</span>
              </div>

              <dl className="history-card__meta">
                <div className="history-card__row">
                  <dt>{t('history.savedAtLabel')}</dt>
                  <dd>{savedAt ?? t('common.noData')}</dd>
                </div>
                <div className="history-card__row">
                  <dt>{t('history.resultLabel')}</dt>
                  <dd>{historyResultText(t, item.radiantWin)}</dd>
                </div>
                <div className="history-card__row">
                  <dt>{t('history.sourceLabel')}</dt>
                  <dd>{item.source}</dd>
                </div>
                <div className="history-card__row">
                  <dt>{t('history.rulesLabel')}</dt>
                  <dd>{item.rulesVersion ?? t('history.rulesMissing')}</dd>
                </div>
              </dl>

              {openable ? (
                <Link
                  className="btn btn--primary history-card__action"
                  to={`/matches/${item.matchId}`}
                >
                  {t('history.openReport')}
                </Link>
              ) : (
                <p className="history-card__state" role="note">
                  {t('history.openUnavailable', { status: statusText.toLowerCase() })}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {skippedCount > 0 && (
        <p className="history__note" role="note">
          {t('common.skippedRecords', { count: skippedCount })}
        </p>
      )}

      {hasMore && (
        <div className="history__more">
          <p className="history__note">{t('history.incomplete', { count: items.length })}</p>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? t('history.loadingMore') : t('history.showMore')}
          </button>
        </div>
      )}
    </div>
  )
}