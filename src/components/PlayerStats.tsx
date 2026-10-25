import type { NormalizedPlayer } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import { kdaText, playerText, statText, teamText } from '../i18n/viewLabels'

interface PlayerStatsProps {
  player: NormalizedPlayer | null
}

/**
 * Статистика выбранного участника (Task 7, локализация — Task 13).
 * Показываются только нормализованные факты; отсутствующие значения — «нет данных»,
 * легитимный ноль отображается как `0`. KDA-коэффициент не рассчитывается.
 */
export default function PlayerStats({ player }: PlayerStatsProps) {
  const { t } = useI18n()

  if (player === null) {
    return (
      <section className="match-stats panel" aria-labelledby="player-stats-title">
        <h2 className="match-section__title" id="player-stats-title">
          {t('match.stats.title')}
        </h2>
        <p className="stub__text">{t('match.stats.empty')}</p>
      </section>
    )
  }

  return (
    <section className="match-stats panel" aria-labelledby="player-stats-title">
      <h2 className="match-section__title" id="player-stats-title">
        {t('match.stats.title')}
      </h2>
      <p className="match-stats__name">{playerText(t, player)}</p>

      <dl className="match-facts match-facts--grid">
        <div className="match-facts__item">
          <dt>{t('match.stats.slot')}</dt>
          <dd>{player.player_slot}</dd>
        </div>
        <div className="match-facts__item">
          <dt>{t('match.stats.team')}</dt>
          <dd>{teamText(t, player.team)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>{t('match.stats.heroId')}</dt>
          <dd>{statText(t, player.hero_id)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>{t('match.stats.kda')}</dt>
          <dd>{kdaText(player.kills, player.deaths, player.assists)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>{t('match.stats.gpm')}</dt>
          <dd>{statText(t, player.gold_per_min)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>{t('match.stats.xpm')}</dt>
          <dd>{statText(t, player.xp_per_min)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>{t('match.stats.lastHits')}</dt>
          <dd>{statText(t, player.last_hits)}</dd>
        </div>
      </dl>

      <p className="stub__hint">{t('match.stats.hint')}</p>
    </section>
  )
}