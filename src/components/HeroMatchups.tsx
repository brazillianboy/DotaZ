import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useI18n } from '../i18n/I18nContext'
import {
  HERO_MATCHUPS_LIMIT,
  HERO_MATCHUPS_MIN_GAMES,
  rankMatchups,
  type MatchupRow,
} from '../lib/heroMatchups'
import { heroImageUrl, heroName } from '../lib/heroes'

export type HeroMatchupsState = 'loading' | 'ready' | 'error'

interface HeroMatchupsProps {
  /** Запрошенный герой: точка отсчёта для винрейта. */
  heroId: number
  rows: MatchupRow[] | null
  state: HeroMatchupsState
}

/** Портрет соперника с нейтральной заглушкой при сбое загрузки изображения. */
function OpponentPortrait({ heroId }: { heroId: number }) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  const url = heroImageUrl(heroId)
  if (url === null || failed) {
    return (
      <span className="hero-matchup__fallback" aria-hidden="true">
        {t('heroes.imageFallback').slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      className="hero-matchup__portrait"
      src={url}
      alt=""
      width={40}
      height={24}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function MatchupList({
  title,
  rows,
  emptyText,
}: {
  title: string
  rows: MatchupRow[]
  emptyText: string
}) {
  const { t } = useI18n()

  return (
    <div className="hero-matchups__group">
      <h3 className="hero-matchups__title">{title}</h3>
      {rows.length === 0 ? (
        <p className="stub__hint">{emptyText}</p>
      ) : (
        <ol className="hero-matchups__list">
          {rows.map((row) => {
            const name = heroName(row.opponentId) ?? t('common.noData')
            return (
              <li className="hero-matchup" key={row.opponentId} data-opponent-id={row.opponentId}>
                <Link
                  className="hero-matchup__link"
                  to={`/heroes/${row.opponentId}`}
                  title={t('hero.matchups.open')}
                >
                  <OpponentPortrait heroId={row.opponentId} />
                  <span className="hero-matchup__name">{name}</span>
                </Link>
                <span className="hero-matchup__stats">
                  <span className="hero-matchup__winrate">
                    {t('hero.matchups.winRate', { value: `${row.winRate.toFixed(2)}%` })}
                  </span>
                  <span className="hero-matchup__games">
                    {t('hero.matchups.games', { count: row.games })}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/**
 * Матчапы героя (Task 19): две группы по пять соперников максимум.
 *
 * Показываются только пары с выборкой не меньше 100 матчей; группы не пересекаются,
 * поэтому при нехватке данных одна из них короче. Винрейт — наблюдение по выборке
 * OpenDota, а не «контрпик»: провайдер не сообщает ни патч, ни период наблюдений.
 */
export default function HeroMatchups({ heroId, rows, state }: HeroMatchupsProps) {
  const { t } = useI18n()

  const ranked = rows === null ? null : rankMatchups(rows)
  const hasAnyQualified = ranked !== null && ranked.qualifiedCount > 0

  return (
    <section className="lane-report panel" aria-labelledby="hero-matchups-title">
      <h2 className="match-section__title" id="hero-matchups-title">
        {t('hero.section.matchups')}
      </h2>
      <p className="stub__hint">{t('hero.matchups.lead')}</p>
      <p className="stub__hint">{t('hero.matchups.minGames', { count: HERO_MATCHUPS_MIN_GAMES })}</p>

      {state === 'loading' && (
        <p className="stub__hint" role="status">
          {t('hero.matchups.loading')}
        </p>
      )}

      {state === 'error' && (
        <p className="auth-alert auth-alert--error" role="status">
          {t('hero.matchups.error')}
        </p>
      )}

      {state === 'ready' && rows !== null && rows.length === 0 && (
        <p className="stub__hint" role="status">
          {t('hero.matchups.empty')}
        </p>
      )}

      {state === 'ready' && ranked !== null && !hasAnyQualified && rows !== null && rows.length > 0 && (
        <p className="stub__hint" role="status">
          {t('hero.matchups.insufficient', { count: HERO_MATCHUPS_MIN_GAMES })}
        </p>
      )}

      {state === 'ready' && hasAnyQualified && ranked !== null && (
        <div className="hero-matchups">
          <MatchupList
            title={t('hero.matchups.strongest')}
            rows={ranked.strongest}
            emptyText={t('hero.matchups.noSample')}
          />
          <MatchupList
            title={t('hero.matchups.weakest')}
            rows={ranked.weakest}
            emptyText={
              ranked.weakestLimited
                ? t('hero.matchups.limited')
                : t('hero.matchups.noSample')
            }
          />
        </div>
      )}

      {state === 'ready' && ranked !== null && ranked.limitedCoverage && hasAnyQualified && (
        <p className="stub__hint">{t('hero.matchups.limited')}</p>
      )}

      <p className="stub__hint">
        {t('hero.matchups.source', { hero: heroId, limit: HERO_MATCHUPS_LIMIT })}
      </p>
    </section>
  )
}
