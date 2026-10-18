import { formatKda, formatStat, playerLabel, teamLabel } from '../lib/matchView'
import type { NormalizedPlayer } from '../types/match'

interface PlayerStatsProps {
  player: NormalizedPlayer | null
}

/**
 * Статистика выбранного участника (Task 7).
 * Показываются только нормализованные факты; отсутствующие значения — «Нет данных»,
 * легитимный ноль отображается как `0`. KDA-коэффициент не рассчитывается.
 */
export default function PlayerStats({ player }: PlayerStatsProps) {
  if (player === null) {
    return (
      <section className="match-stats panel" aria-labelledby="player-stats-title">
        <h2 className="match-section__title" id="player-stats-title">
          Статистика игрока
        </h2>
        <p className="stub__text">Выберите участника, чтобы увидеть его статистику.</p>
      </section>
    )
  }

  return (
    <section className="match-stats panel" aria-labelledby="player-stats-title">
      <h2 className="match-section__title" id="player-stats-title">
        Статистика игрока
      </h2>
      <p className="match-stats__name">{playerLabel(player)}</p>

      <dl className="match-facts match-facts--grid">
        <div className="match-facts__item">
          <dt>Слот</dt>
          <dd>{player.player_slot}</dd>
        </div>
        <div className="match-facts__item">
          <dt>Сторона</dt>
          <dd>{teamLabel(player.team)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>Герой (hero_id)</dt>
          <dd>{formatStat(player.hero_id)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>K / D / A</dt>
          <dd>{formatKda(player.kills, player.deaths, player.assists)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>GPM</dt>
          <dd>{formatStat(player.gold_per_min)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>XPM</dt>
          <dd>{formatStat(player.xp_per_min)}</dd>
        </div>
        <div className="match-facts__item">
          <dt>Last hits</dt>
          <dd>{formatStat(player.last_hits)}</dd>
        </div>
      </dl>

      <p className="stub__hint">
        Значения приведены как есть из ответа OpenDota. «Нет данных» означает отсутствие поля
        в ответе и не заменяется нулём. Last hits — показатель за матч, а не за первые 10 минут.
        Разбор линии и рекомендации появятся в следующих задачах.
      </p>
    </section>
  )
}