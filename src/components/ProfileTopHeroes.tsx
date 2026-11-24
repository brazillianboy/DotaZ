import { useMemo, useState } from 'react'

import { useI18n } from '../i18n/I18nContext'
import { heroInfo } from '../lib/heroes'
import type { OpenDotaError } from '../lib/opendota'
import { sortHeroStats, type PlayerHeroStat } from '../lib/playerStats'

import HeroAvatar from './HeroAvatar'
import ProfileErrorNote from './ProfileErrorNote'

/** Сколько героев видно без раскрытия списка. */
export const TOP_HEROES_COLLAPSED = 5

/** Верхняя граница раскрытого списка: профиль не превращается в каталог. */
export const TOP_HEROES_EXPANDED_LIMIT = 25

interface ProfileTopHeroesProps {
  heroes: PlayerHeroStat[] | null
  error: OpenDotaError | null
  onRetry: () => void
}

/**
 * Самые играемые герои (Task 20B).
 *
 * Источник — `GET /players/{id}/heroes` (агрегат за всё время). Сортировка — по
 * фактическому количеству матчей, поэтому порядок не «редакторский». Имена
 * героев берутся из существующего справочника и остаются английскими; статистика
 * героя с нулём матчей не показывается.
 */
export default function ProfileTopHeroes({ heroes, error, onRetry }: ProfileTopHeroesProps) {
  const { t, formatPercent } = useI18n()
  const [expanded, setExpanded] = useState(false)

  const sorted = useMemo(() => (heroes === null ? [] : sortHeroStats(heroes)), [heroes])
  const limit = expanded ? TOP_HEROES_EXPANDED_LIMIT : TOP_HEROES_COLLAPSED
  const visible = sorted.slice(0, limit)
  const canExpand = sorted.length > TOP_HEROES_COLLAPSED

  return (
    <section className="profile-section" aria-labelledby="profile-heroes-title">
      <header className="profile-section__head">
        <h2 className="profile-section__title" id="profile-heroes-title">
          {t('profile.heroes.title')}
        </h2>
        <p className="profile-section__lead">{t('profile.heroes.lead')}</p>
      </header>

      {error !== null && <ProfileErrorNote error={error} onRetry={onRetry} />}

      {heroes !== null && sorted.length === 0 && (
        <p className="profile-note" role="note">
          {t('profile.heroes.empty')}
        </p>
      )}

      {visible.length > 0 && (
        <ul className="profile-heroes">
          {visible.map((hero) => (
            <li className="profile-hero panel" key={hero.heroId}>
              <HeroAvatar heroId={hero.heroId} className="hero-avatar--sm" />
              <div className="profile-hero__body">
                <span className="profile-hero__name">
                  {heroInfo(hero.heroId)?.name ?? t('profile.heroUnknown', { id: hero.heroId })}
                </span>
                <span className="profile-hero__line">
                  {t('profile.heroes.games', { count: hero.games })}
                  {' · '}
                  {t('profile.heroes.wins', { count: hero.wins })}
                </span>
              </div>
              <span className="profile-hero__rate">
                {hero.winRatePercent === null
                  ? t('common.noData')
                  : formatPercent(hero.winRatePercent)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canExpand && (
        <button
          type="button"
          className="btn btn--ghost profile-heroes__toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded
            ? t('profile.heroes.showLess')
            : t('profile.heroes.showAll', { count: Math.min(sorted.length, TOP_HEROES_EXPANDED_LIMIT) })}
        </button>
      )}
    </section>
  )
}
