import type { NormalizedMatch } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import { durationText, winnerText } from '../i18n/viewLabels'

interface MatchSummaryProps {
  match: NormalizedMatch
  requestedId: string
}

/**
 * Сводка матча (Task 7, локализация — Task 13): только фактические поля
 * нормализованной модели. Отсутствующие значения показываются как «нет данных»
 * и не подменяются нулями; числа не изменяются при смене языка.
 */
export default function MatchSummary({ match, requestedId }: MatchSummaryProps) {
  const { t } = useI18n()

  return (
    <section className="match-summary panel" aria-labelledby="match-summary-title">
      <span className="badge badge--warn">{t('match.badge')}</span>
      <h1 className="stub__title" id="match-summary-title">
        {t('match.title', { id: requestedId })}
      </h1>
      <dl className="match-facts">
        <div className="match-facts__item">
          <dt>{t('match.idInResponse')}</dt>
          <dd>{match.match_id ?? t('common.noData')}</dd>
        </div>
        <div className="match-facts__item">
          <dt>{t('match.duration')}</dt>
          <dd>
            {durationText(t, match.duration)}
            {match.duration !== null ? ` ${t('match.durationSeconds', { seconds: match.duration })}` : ''}
          </dd>
        </div>
        <div className="match-facts__item">
          <dt>{t('match.winner')}</dt>
          <dd>{winnerText(t, match.radiant_win)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>{t('match.playersInResponse')}</dt>
          <dd>{match.players.length > 0 ? match.players.length : t('common.noData')}</dd>
        </div>
        <div className="match-facts__item">
          <dt>{t('match.source')}</dt>
          <dd>OpenDota</dd>
        </div>
      </dl>
    </section>
  )
}