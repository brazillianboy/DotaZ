import { groupPlayers, playerLabel, teamLabel } from '../lib/matchView'
import type { NormalizedPlayer } from '../types/match'

interface PlayerSelectorProps {
  players: NormalizedPlayer[]
  selectedSlot: number | null
  onSelect: (playerSlot: number) => void
}

/**
 * Выбор участника матча (Task 7).
 * Участники группируются по стороне из `player_slot` (Radiant / Dire / «Команда не определена»);
 * порядок массива для определения стороны не используется.
 */
export default function PlayerSelector({ players, selectedSlot, onSelect }: PlayerSelectorProps) {
  if (players.length === 0) {
    return (
      <section className="match-players panel" aria-labelledby="players-title">
        <h2 className="match-section__title" id="players-title">
          Участники
        </h2>
        <p className="stub__text">Данные об участниках отсутствуют.</p>
      </section>
    )
  }

  const grouped = groupPlayers(players)
  const groups = [
    { key: 'radiant', title: 'Radiant', items: grouped.radiant },
    { key: 'dire', title: 'Dire', items: grouped.dire },
    { key: 'unknown', title: 'Команда не определена', items: grouped.unknown },
  ].filter((group) => group.items.length > 0)

  return (
    <section className="match-players panel" aria-labelledby="players-title">
      <h2 className="match-section__title" id="players-title">
        Участники
      </h2>

      {groups.map((group) => (
        <div className="players-group" key={group.key}>
          <h3 className="players-group__title">
            {group.title} <span className="players-group__count">({group.items.length})</span>
          </h3>
          <ul className="players-group__list">
            {group.items.map((player) => {
              const isSelected = player.player_slot === selectedSlot
              return (
                <li key={player.player_slot}>
                  <button
                    type="button"
                    className={`player-button${isSelected ? ' player-button--active' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(player.player_slot)}
                  >
                    <span className="player-button__label">{playerLabel(player)}</span>
                    <span className="player-button__team">{teamLabel(player.team)}</span>
                    <span className="player-button__state">
                      {isSelected ? 'Выбран' : '\u00a0'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}