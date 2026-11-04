import { heroImageUrl, heroName } from '../lib/heroes'
import type { NormalizedPlayer } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import { kdaText, statText, teamText } from '../i18n/viewLabels'

interface PlayerStatsProps {
  player: NormalizedPlayer | null
}

/** Метрика игрока: подпись и подтверждённое значение (или «нет данных»). */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <dt className="metric-card__label">{label}</dt>
      <dd className="metric-card__value">{value}</dd>
    </div>
  )
}

/**
 * Карточка выбранного участника (Task 15; данные — Task 7/13).
 *
 * Показаны только нормализованные подтверждённые факты: отсутствующее значение
 * обозначается как «нет данных», легитимный ноль остаётся нулём. GPM и XPM — это
 * показатели в минуту, а не суммарные золото и опыт. Портрет героя подставляется
 * только из проверенного справочника; для неизвестного `hero_id` — нейтральная подпись.
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

  const hero = heroName(player.hero_id)
  const heroLabel = hero ?? t('team.heroUnknown', { id: player.hero_id ?? '—' })
  const portrait = heroImageUrl(player.hero_id)
  const playerName = player.player_name ?? t('team.unknownPlayer')

  return (
    <section className="match-stats panel" aria-labelledby="player-stats-title">
      <div className="match-stats__head">
        {portrait === null ? (
          <span className="match-stats__portrait match-stats__portrait--empty" aria-hidden="true" />
        ) : (
          <img
            className="match-stats__portrait"
            src={portrait}
            alt={t('team.heroImageAlt', { hero: heroLabel })}
            width={64}
            height={64}
          />
        )}
        <div className="match-stats__identity">
          <h2 className="match-section__title" id="player-stats-title">
            {heroLabel}
          </h2>
          <p className="match-stats__name">{playerName}</p>
          <p className="match-stats__meta">
            {teamText(t, player.team)} · {t('match.stats.slot')} {player.player_slot}
            {player.level === null ? '' : ` · ${t('abilities.level', { level: player.level })}`}
          </p>
        </div>
      </div>

      <dl className="metric-grid">
        <Metric label={t('team.columnKda')} value={kdaText(player.kills, player.deaths, player.assists)} />
        <Metric label={t('team.columnLastHits')} value={statText(t, player.last_hits)} />
        <Metric label={t('team.columnDenies')} value={statText(t, player.denies)} />
        <Metric label={t('team.columnNetWorth')} value={statText(t, player.net_worth)} />
        <Metric label={t('team.columnGpm')} value={statText(t, player.gold_per_min)} />
        <Metric label={t('team.columnXpm')} value={statText(t, player.xp_per_min)} />
        <Metric label={t('team.columnHeroDamage')} value={statText(t, player.hero_damage)} />
        <Metric label={t('team.columnTowerDamage')} value={statText(t, player.tower_damage)} />
        <Metric label={t('team.columnHealing')} value={statText(t, player.hero_healing)} />
      </dl>

      <p className="stub__hint">{t('match.stats.hint')}</p>
    </section>
  )
}
