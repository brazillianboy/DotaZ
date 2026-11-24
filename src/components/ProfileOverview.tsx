import { useI18n } from '../i18n/I18nContext'
import type { OpenDotaError } from '../lib/opendota'
import type { MatchOutcome, PlayerRecord, RecentMatch } from '../lib/playerStats'
import type { TranslationKey } from '../i18n/translations'

import HeroAvatar from './HeroAvatar'
import ProfileErrorNote from './ProfileErrorNote'

/** Подписи результата матча: только три подтверждённых состояния. */
export const OUTCOME_LABEL_KEYS: Record<MatchOutcome, TranslationKey> = {
  win: 'profile.result.win',
  loss: 'profile.result.loss',
  unknown: 'profile.result.unknown',
}

interface ProfileOverviewProps {
  record: PlayerRecord | null
  recordError: OpenDotaError | null
  latestMatch: RecentMatch | null
  recentError: OpenDotaError | null
  onRetry: () => void
}

/**
 * Обзор аккаунта (Task 20B): матчи, победы, поражения, винрейт, последний матч.
 *
 * Источник — ответ OpenDota `/players/{id}/wl` по **всем** матчам аккаунта, а не
 * выборка последних матчей. Отсутствующее значение показывается как «недоступно»
 * и никогда не превращается в ноль; винрейт при нуле подтверждённых матчей — «—»,
 * потому что 0/0 не даёт процента.
 */
export default function ProfileOverview({
  record,
  recordError,
  latestMatch,
  recentError,
  onRetry,
}: ProfileOverviewProps) {
  const { t, formatDateTime, formatPercent } = useI18n()

  const unavailable = t('profile.unavailableShort')
  const total = record === null ? unavailable : String(record.total)
  const wins = record === null ? unavailable : String(record.wins)
  const losses = record === null ? unavailable : String(record.losses)
  const winRate =
    record === null || record.winRatePercent === null
      ? null
      : formatPercent(record.winRatePercent)

  const latestDate = latestMatch === null ? null : formatDateTime(latestMatch.startTime)

  return (
    <section className="profile-section" aria-labelledby="profile-overview-title">
      <header className="profile-section__head">
        <h2 className="profile-section__title" id="profile-overview-title">
          {t('profile.overview.title')}
        </h2>
        <p className="profile-section__lead">{t('profile.overview.lead')}</p>
      </header>

      <div className="profile-stats">
        <div className="profile-stat panel">
          <span className="profile-stat__label">{t('profile.stat.matches')}</span>
          <span className="profile-stat__value">{total}</span>
        </div>
        <div className="profile-stat panel">
          <span className="profile-stat__label">{t('profile.stat.wins')}</span>
          <span className="profile-stat__value profile-stat__value--win">{wins}</span>
        </div>
        <div className="profile-stat panel">
          <span className="profile-stat__label">{t('profile.stat.losses')}</span>
          <span className="profile-stat__value profile-stat__value--loss">{losses}</span>
        </div>
        <div className="profile-stat panel">
          <span className="profile-stat__label">{t('profile.stat.winRate')}</span>
          <span className="profile-stat__value">{winRate ?? unavailable}</span>
          <span className="profile-stat__hint">{t('profile.stat.winRateHint')}</span>
        </div>
      </div>

      {recordError !== null && <ProfileErrorNote error={recordError} onRetry={onRetry} />}

      {record !== null && record.total === 0 && (
        <p className="profile-note" role="note">
          {t('profile.noConfirmedMatches')}
        </p>
      )}

      <div className="profile-latest panel">
        <h3 className="profile-latest__title">{t('profile.stat.lastMatch')}</h3>
        {recentError !== null && latestMatch === null ? (
          <ProfileErrorNote error={recentError} onRetry={onRetry} />
        ) : latestMatch === null ? (
          <p className="profile-note">{t('profile.recent.empty')}</p>
        ) : (
          <p className="profile-latest__row">
            <HeroAvatar heroId={latestMatch.heroId} className="hero-avatar--sm" withName />
            <span className="profile-latest__date">{latestDate ?? t('common.noData')}</span>
            <span className={`profile-outcome profile-outcome--${latestMatch.outcome}`}>
              {t(OUTCOME_LABEL_KEYS[latestMatch.outcome])}
            </span>
          </p>
        )}
      </div>
    </section>
  )
}
