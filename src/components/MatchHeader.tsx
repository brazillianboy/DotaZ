import type { ReactNode } from 'react'

import { gameModeSlug, matchAgeDays, matchScore, regionName, startTimeToIso } from '../lib/matchMeta'
import type { NormalizedMatch } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import { durationText, timestampText } from '../i18n/viewLabels'

interface MatchHeaderProps {
  match: NormalizedMatch
  /** Проверенный ID из адреса: показывается, если в ответе ID отсутствует. */
  requestedId: string
  /** Статус автоматической обработки реплея (Task 14) — рядом с шапкой. */
  children?: ReactNode
}

/**
 * Шапка матча (Task 15).
 *
 * Показывает только подтверждённые данные: победителя, счёт, длительность, ID,
 * режим, регион, время начала и источник. Отсутствующие значения помечаются как
 * «нет данных» и не подменяются выдуманными числами. Победитель выделяется не
 * только цветом: рядом стоит текстовая подпись победы.
 */
export default function MatchHeader({ match, requestedId, children }: MatchHeaderProps) {
  const { t, locale } = useI18n()
  const score = matchScore(match)
  const winner = match.radiant_win === null ? null : match.radiant_win ? 'radiant' : 'dire'
  const winnerLabel =
    winner === 'radiant'
      ? t('matchHeader.winnerRadiant')
      : winner === 'dire'
        ? t('matchHeader.winnerDire')
        : t('matchHeader.winnerUnknown')
  const modeSlug = gameModeSlug(match.game_mode)
  const modeLabel =
    modeSlug === null
      ? t('common.noData')
      : modeSlug
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
  const region = regionName(match.region)
  const startedText = timestampText(startTimeToIso(match.start_time), locale)
  const ageDays = matchAgeDays(match.start_time, new Date())
  const matchId = match.match_id ?? requestedId

  return (
    <header className="match-header panel" aria-labelledby="match-header-title">
      <div className="match-header__bar">
        <div className={`match-header__winner match-header__winner--${winner ?? 'unknown'}`}>
          <span className="match-header__winner-text" role="status">
            {winnerLabel}
          </span>
        </div>

        <div className="match-header__score" aria-label={t('matchHeader.score')}>
          <span className="match-header__score-side match-header__score-side--radiant">
            {t('matchHeader.radiantShort')}
          </span>
          <span className="match-header__score-value">
            {score.radiant === null ? t('common.noData') : score.radiant}
          </span>
          <span className="match-header__score-sep" aria-hidden="true">
            :
          </span>
          <span className="match-header__score-value">
            {score.dire === null ? t('common.noData') : score.dire}
          </span>
          <span className="match-header__score-side match-header__score-side--dire">
            {t('matchHeader.direShort')}
          </span>
        </div>

        <h1 className="match-header__title" id="match-header-title">
          {t('match.title', { id: matchId })}
        </h1>
      </div>

      <dl className="match-header__meta">
        <div className="match-header__meta-item">
          <dt>{t('matchHeader.duration')}</dt>
          <dd>{durationText(t, match.duration)}</dd>
        </div>
        <div className="match-header__meta-item">
          <dt>{t('matchHeader.matchId')}</dt>
          <dd className="match-header__mono">{matchId}</dd>
        </div>
        <div className="match-header__meta-item">
          <dt>{t('matchHeader.gameMode')}</dt>
          <dd>{modeLabel}</dd>
        </div>
        <div className="match-header__meta-item">
          <dt>{t('matchHeader.region')}</dt>
          <dd>{region ?? t('common.noData')}</dd>
        </div>
        <div className="match-header__meta-item">
          <dt>{t('matchHeader.started')}</dt>
          <dd>
            {startedText ?? t('common.noData')}
            {ageDays !== null && ` · ${t('matchHeader.ageDays', { days: ageDays })}`}
          </dd>
        </div>
        <div className="match-header__meta-item">
          <dt>{t('matchHeader.source')}</dt>
          <dd>{t('matchHeader.sourceValue')}</dd>
        </div>
      </dl>

      <p className="stub__hint">
        {score.source === 'players'
          ? t('matchHeader.scorePlayers')
          : score.source === 'provider'
            ? t('matchHeader.scoreProvider')
            : t('matchHeader.scoreUnavailable')}
      </p>

      {children}
    </header>
  )
}
