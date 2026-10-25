import { Link } from 'react-router-dom'

import {
  formatHistoryTimestamp,
  type HistoryReportItem,
} from '../lib/historyReports'
import { isOpenableHistoryItem } from '../lib/historyFlow'
import type { MatchReportStatus } from '../lib/matchReports'

interface HistoryListProps {
  items: HistoryReportItem[]
  /** true — загружена полная страница, возможно есть более ранние отчёты. */
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  /** Сколько записей пропущено из-за непригодных метаданных. */
  skippedCount: number
}

const STATUS_PRESENTATION: Record<MatchReportStatus, { text: string; badgeClass: string }> = {
  ready: { text: 'Полный отчёт', badgeClass: 'badge badge--ok' },
  partial: { text: 'Частичный отчёт', badgeClass: 'badge badge--warn' },
  pending: { text: 'Ожидает расчёта', badgeClass: 'badge badge--warn' },
  error: { text: 'Ошибка расчёта', badgeClass: 'badge badge--warn' },
}

/** Результат матча: только из сохранённого снимка, без выводов из статистики игроков. */
export function historyResultText(radiantWin: boolean | null): string {
  if (radiantWin === true) {
    return 'Победа Radiant'
  }
  if (radiantWin === false) {
    return 'Победа Dire'
  }
  return 'Нет данных'
}

/**
 * Список сохранённых личных анализов (Task 12).
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
  if (items.length === 0) {
    return (
      <p className="stub__text">У вас пока нет сохранённых анализов.</p>
    )
  }

  return (
    <div className="history">
      <ul className="history-list">
        {items.map((item) => {
          const status = STATUS_PRESENTATION[item.status]
          const savedAt = formatHistoryTimestamp(item.createdAt)
          const openable = isOpenableHistoryItem(item)
          return (
            <li className="history-card panel" key={item.id}>
              <div className="history-card__head">
                <h3 className="history-card__title">Матч {item.matchId}</h3>
                <span className={status.badgeClass}>{status.text}</span>
              </div>

              <dl className="history-card__meta">
                <div className="history-card__row">
                  <dt>Сохранён</dt>
                  <dd>{savedAt ?? 'Нет данных'}</dd>
                </div>
                <div className="history-card__row">
                  <dt>Результат</dt>
                  <dd>{historyResultText(item.radiantWin)}</dd>
                </div>
                <div className="history-card__row">
                  <dt>Источник</dt>
                  <dd>{item.source}</dd>
                </div>
                <div className="history-card__row">
                  <dt>Версия правил</dt>
                  <dd>{item.rulesVersion ?? 'не указана'}</dd>
                </div>
              </dl>

              {openable ? (
                <Link className="btn btn--primary history-card__action" to={`/matches/${item.matchId}`}>
                  Открыть отчёт
                </Link>
              ) : (
                <p className="history-card__state" role="note">
                  Открытие недоступно: {status.text.toLowerCase()}.
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {skippedCount > 0 && (
        <p className="history__note" role="note">
          Часть записей не показана: непригодные метаданные ({skippedCount}). Данные не
          изменялись и не удалялись.
        </p>
      )}

      {hasMore && (
        <div className="history__more">
          <p className="history__note">
            Показаны последние {items.length} отчётов. Более ранние можно догрузить — список
            не является полным.
          </p>
          <button type="button" className="btn btn--ghost" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Загружаем…' : 'Показать ещё'}
          </button>
        </div>
      )}
    </div>
  )
}