import { Link } from 'react-router-dom'

import { formatClock } from '../i18n/formatters'
import { useI18n } from '../i18n/I18nContext'
import { heroInfo } from '../lib/heroes'
import type { OpenDotaError } from '../lib/opendota'
import type { RecentMatch } from '../lib/playerStats'

import HeroAvatar from './HeroAvatar'
import ProfileErrorNote from './ProfileErrorNote'
import { OUTCOME_LABEL_KEYS } from './ProfileOverview'

interface ProfileRecentMatchesProps {
  matches: RecentMatch[] | null
  skipped: number
  error: OpenDotaError | null
  onRetry: () => void
}

/**
 * Последние матчи (Task 20B).
 *
 * Источник — `GET /players/{id}/recentMatches` (до 20 записей). Результат берётся
 * только из пары `radiant_win` + `player_slot`; K/D/A, длительность и дата — из
 * тех же записей и без пересчёта.
 *
 * «Открыть матч» ведёт на существующий маршрут `/matches/:matchId`. Это публичный
 * матч Dota 2, а **не** отметка «анализ сохранён»: сохранённые отчёты DotaZ
 * показываются отдельным разделом, и непроанализированный матч в них не попадает.
 */
export default function ProfileRecentMatches({
  matches,
  skipped,
  error,
  onRetry,
}: ProfileRecentMatchesProps) {
  const { t, formatDateTime } = useI18n()

  return (
    <section className="profile-section" aria-labelledby="profile-recent-title">
      <header className="profile-section__head">
        <h2 className="profile-section__title" id="profile-recent-title">
          {t('profile.recent.title')}
        </h2>
        <p className="profile-section__lead">{t('profile.recent.lead')}</p>
      </header>

      {error !== null && <ProfileErrorNote error={error} onRetry={onRetry} />}

      {matches !== null && matches.length === 0 && (
        <p className="profile-note" role="note">
          {t('profile.recent.empty')}
        </p>
      )}

      {matches !== null && matches.length > 0 && (
        <ul className="profile-matches">
          {matches.map((match) => {
            const heroName = heroInfo(match.heroId)?.name ?? t('profile.heroUnknown', { id: match.heroId })
            const date = formatDateTime(match.startTime)
            const kda =
              match.kills === null || match.deaths === null || match.assists === null
                ? null
                : `${match.kills} / ${match.deaths} / ${match.assists}`
            return (
              <li className="profile-match panel" key={match.matchId}>
                <div className="profile-match__main">
                  <HeroAvatar heroId={match.heroId} className="hero-avatar--sm" />
                  <div className="profile-match__identity">
                    <span className="profile-match__hero">{heroName}</span>
                    <span className="profile-match__meta">
                      {t('profile.recent.matchId')}: <code>{match.matchId}</code>
                    </span>
                  </div>
                  <span className={`profile-outcome profile-outcome--${match.outcome}`}>
                    {t(OUTCOME_LABEL_KEYS[match.outcome])}
                  </span>
                </div>

                <dl className="profile-match__stats">
                  <div>
                    <dt>{t('profile.recent.kda')}</dt>
                    <dd>{kda ?? t('common.noData')}</dd>
                  </div>
                  <div>
                    <dt>{t('profile.recent.duration')}</dt>
                    <dd>
                      {match.durationSeconds === null
                        ? t('common.noData')
                        : formatClock(match.durationSeconds)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('profile.recent.date')}</dt>
                    <dd>{date ?? t('common.noData')}</dd>
                  </div>
                </dl>

                <Link className="profile-match__open" to={`/matches/${match.matchId}`}>
                  {t('profile.recent.open')}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {skipped > 0 && (
        <p className="profile-note" role="note">
          {t('profile.recent.skipped', { count: skipped })}
        </p>
      )}
    </section>
  )
}
