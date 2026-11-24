import { useI18n } from '../i18n/I18nContext'
import type { OpenDotaError } from '../lib/opendota'
import type { LaneDistribution } from '../lib/playerStats'
import type { TranslationKey } from '../i18n/translations'
import type { LaneRole } from '../lib/benchmarks'

import ProfileErrorNote from './ProfileErrorNote'

/** Подписи линий. Класс линии OpenDota ≠ позиция 1–5 и ≠ core/support. */
export const LANE_LABEL_KEYS: Record<LaneRole, TranslationKey> = {
  1: 'profile.lane.safe',
  2: 'profile.lane.mid',
  3: 'profile.lane.off',
  4: 'profile.lane.jungle',
}

interface ProfileLaneRolesProps {
  lanes: LaneDistribution | null
  error: OpenDotaError | null
  onRetry: () => void
}

/**
 * Линии игрока — полная история (Task 20B.3).
 *
 * Источник — агрегат `GET /players/{id}/counts` → `lane_role`: он покрывает **все**
 * матчи, зафиксированные OpenDota, и отдельно кладёт в бакет `0` те, у которых
 * линия не определена. Здесь распределение строится по всей обследованной
 * популяции (`examined`), а «неопределённая линия» показана тем же рядом, а не
 * спрятана в сноску. Отдельно выводятся четыре честных числа: всего матчей,
 * обследовано, линия определена, линия не определена.
 *
 * Класс линии (`lane_role` 1–4) — это **не** позиция 1–5 и не core/support; роли
 * 1–5 из героя не выводятся. Если данных по линиям мало — явная пометка.
 */
export default function ProfileLaneRoles({ lanes, error, onRetry }: ProfileLaneRolesProps) {
  const { t, formatPercent } = useI18n()

  return (
    <section className="profile-section" aria-labelledby="profile-lanes-title">
      <header className="profile-section__head">
        <h2 className="profile-section__title" id="profile-lanes-title">
          {t('profile.lanes.title')}
        </h2>
        <p className="profile-section__lead">{t('profile.lanes.lead')}</p>
      </header>

      {error !== null ? (
        <ProfileErrorNote error={error} onRetry={onRetry} />
      ) : lanes === null ? (
        <p className="profile-note">{t('profile.lanes.unavailable')}</p>
      ) : !lanes.sufficient || lanes.rows.length === 0 ? (
        <p className="profile-note" role="note">
          {t('profile.lanes.insufficient')}
        </p>
      ) : (
        <div className="profile-lanes panel">
          <dl className="profile-lanes__summary">
            <div>
              <dt>{t('profile.lanes.total')}</dt>
              <dd>{lanes.total ?? t('profile.unavailableShort')}</dd>
            </div>
            <div>
              <dt>{t('profile.lanes.examined')}</dt>
              <dd>{lanes.examined}</dd>
            </div>
            <div>
              <dt>{t('profile.lanes.classified')}</dt>
              <dd>{lanes.knownGames}</dd>
            </div>
            <div>
              <dt>{t('profile.lanes.unknown')}</dt>
              <dd>{lanes.undeterminedGames ?? t('common.noData')}</dd>
            </div>
          </dl>

          <ul className="profile-lanes__list">
            {lanes.rows.map((row) => (
              <li className="profile-lane" key={row.laneRole}>
                <div className="profile-lane__head">
                  <span className="profile-lane__name">{t(LANE_LABEL_KEYS[row.laneRole])}</span>
                  <span className="profile-lane__share">{formatPercent(row.sharePercent)}</span>
                </div>
                <div className="profile-lane__track" aria-hidden="true">
                  <span
                    className="profile-lane__bar"
                    style={{ width: `${Math.max(2, Math.min(100, row.sharePercent))}%` }}
                  />
                </div>
                <p className="profile-lane__meta">
                  {t('profile.heroes.games', { count: row.games })}
                  {' · '}
                  {t('profile.heroes.wins', { count: row.wins })}
                  {row.winRatePercent !== null && (
                    <>
                      {' · '}
                      {t('profile.heroes.winRate')}: {formatPercent(row.winRatePercent)}
                    </>
                  )}
                </p>
              </li>
            ))}

            {lanes.undeterminedGames !== null && lanes.undeterminedGames > 0 && (
              <li className="profile-lane profile-lane--undetermined">
                <div className="profile-lane__head">
                  <span className="profile-lane__name">{t('profile.lanes.unknownBar')}</span>
                  <span className="profile-lane__share">
                    {formatPercent(lanes.undeterminedPercent ?? 0)}
                  </span>
                </div>
                <div className="profile-lane__track" aria-hidden="true">
                  <span
                    className="profile-lane__bar profile-lane__bar--undetermined"
                    style={{
                      width: `${Math.max(2, Math.min(100, lanes.undeterminedPercent ?? 0))}%`,
                    }}
                  />
                </div>
                <p className="profile-lane__meta">
                  {t('profile.heroes.games', { count: lanes.undeterminedGames })}
                </p>
              </li>
            )}
          </ul>

          <p className="profile-note">{t('profile.lanes.method')}</p>
        </div>
      )}
    </section>
  )
}
