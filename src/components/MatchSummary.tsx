import { NO_DATA_LABEL, formatDuration, winnerLabel } from '../lib/matchView'
import type { NormalizedMatch } from '../types/match'

interface MatchSummaryProps {
  match: NormalizedMatch
  requestedId: string
}

/**
 * Сводка матча (Task 7): только фактические поля нормализованной модели.
 * Отсутствующие значения показываются как «Нет данных» и не подменяются нулями.
 */
export default function MatchSummary({ match, requestedId }: MatchSummaryProps) {
  return (
    <section className="match-summary panel" aria-labelledby="match-summary-title">
      <span className="badge badge--warn">Данные OpenDota</span>
      <h1 className="stub__title" id="match-summary-title">
        Матч <span className="accent">{requestedId}</span>
      </h1>
      <dl className="match-facts">
        <div className="match-facts__item">
          <dt>ID матча в ответе</dt>
          <dd>{match.match_id ?? NO_DATA_LABEL}</dd>
        </div>
        <div className="match-facts__item">
          <dt>Длительность</dt>
          <dd>
            {formatDuration(match.duration)}
            {match.duration !== null ? ` (${match.duration} с)` : ''}
          </dd>
        </div>
        <div className="match-facts__item">
          <dt>Победитель</dt>
          <dd>{winnerLabel(match.radiant_win)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>Участников в ответе</dt>
          <dd>{match.players.length > 0 ? match.players.length : NO_DATA_LABEL}</dd>
        </div>
        <div className="match-facts__item">
          <dt>Источник данных</dt>
          <dd>OpenDota</dd>
        </div>
      </dl>
    </section>
  )
}