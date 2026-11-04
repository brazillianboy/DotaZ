import { useEffect, useState } from 'react'

import {
  buildAbilityTimeline,
  loadAbilityCatalog,
  type AbilityCatalog,
  type AbilityUpgradeStep,
} from '../lib/abilities'
import { heroImageUrl, heroName } from '../lib/heroes'
import { groupPlayers } from '../lib/matchView'
import type { NormalizedPlayer, PlayerTeam } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'

interface AbilityBuildProps {
  players: NormalizedPlayer[]
  selectedSlot: number | null
  onSelect: (playerSlot: number) => void
}

type CatalogState = { status: 'loading' } | { status: 'ready'; catalog: AbilityCatalog | null }

interface AbilityTeamProps {
  team: PlayerTeam
  title: string
  players: NormalizedPlayer[]
  catalog: AbilityCatalog | null
  catalogUnavailable: boolean
  selectedSlot: number | null
  onSelect: (playerSlot: number) => void
}

function AbilityTeam({
  team,
  title,
  players,
  catalog,
  catalogUnavailable,
  selectedSlot,
  onSelect,
}: AbilityTeamProps) {
  const { t } = useI18n()

  return (
    <section
      className={`ability-team panel ability-team--${team}`}
      aria-labelledby={`ability-team-${team}`}
    >
      <h3 className="match-section__title" id={`ability-team-${team}`}>
        {title} <span className="team-table__count">({players.length})</span>
      </h3>
      {catalogUnavailable && (
        <p className="stub__hint" role="status">
          {t('abilities.catalogUnavailable')}
        </p>
      )}
      {players.length === 0 ? (
        <p className="stub__text">{t('team.noPlayers')}</p>
      ) : (
        <ul className="ability-list">
          {players.map((player) => (
            <AbilityPlayerRow
              key={player.player_slot}
              player={player}
              catalog={catalog}
              selected={player.player_slot === selectedSlot}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Прокачка способностей обеих команд (Task 15).
 *
 * Данные берутся из записи `ability_upgrades_arr` уже полученного ответа матча;
 * названия, иконки и признак таланта — из справочников OpenDota, которые
 * загружаются один раз за сессию с кэшем в памяти (смена языка не создаёт запросов).
 * Если справочник недоступен или ID неизвестен, показывается честное состояние
 * без выдуманных названий; при отсутствии записи — отдельное пояснение.
 */
export default function AbilityBuild({ players, selectedSlot, onSelect }: AbilityBuildProps) {
  const { t } = useI18n()
  const hasUpgrades = players.some((player) => player.ability_upgrades !== null)
  const [state, setState] = useState<CatalogState>({ status: 'loading' })

  useEffect(() => {
    if (!hasUpgrades) {
      return
    }
    let active = true
    void loadAbilityCatalog().then((catalog) => {
      if (active) {
        setState({ status: 'ready', catalog })
      }
    })
    return () => {
      active = false
    }
  }, [hasUpgrades])

  if (!hasUpgrades) {
    return (
      <section className="ability-build panel" aria-labelledby="ability-build-title">
        <h2 className="match-section__title" id="ability-build-title">
          {t('abilities.title')}
        </h2>
        <p className="stub__text" role="status">
          {t('abilities.unavailable')}
        </p>
      </section>
    )
  }

  const catalog = state.status === 'ready' ? state.catalog : null
  const catalogUnavailable = state.status === 'ready' && catalog === null
  const grouped = groupPlayers(players)

  return (
    <section className="ability-build" aria-labelledby="ability-build-title">
      <h2 className="match-section__title" id="ability-build-title">
        {t('abilities.title')}
      </h2>
      <p className="stub__text">{t('abilities.lead')}</p>
      {state.status === 'loading' && (
        <p className="stub__hint" role="status">
          {t('abilities.loading')}
        </p>
      )}

      <AbilityTeam
        team="radiant"
        title={t('abilities.teamTitle', { team: t('team.radiantTitle') })}
        players={grouped.radiant}
        catalog={catalog}
        catalogUnavailable={catalogUnavailable}
        selectedSlot={selectedSlot}
        onSelect={onSelect}
      />
      <AbilityTeam
        team="dire"
        title={t('abilities.teamTitle', { team: t('team.direTitle') })}
        players={grouped.dire}
        catalog={catalog}
        catalogUnavailable={catalogUnavailable}
        selectedSlot={selectedSlot}
        onSelect={onSelect}
      />

      <p className="stub__hint">{t('abilities.hint')}</p>
    </section>
  )
}

/** Подсказка шага прокачки: уровень, порядок и название подтверждённой записи. */
function stepTitle(
  step: AbilityUpgradeStep,
  order: number,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  const name = step.displayName ?? (step.name === null ? t('abilities.unknownName') : step.name)
  const base =
    step.name === null
      ? t('abilities.unknownAbility', { id: step.abilityId })
      : `${name} · ${step.isTalent ? t('abilities.talent') : t('abilities.ability')}`
  return `${base} · ${t('abilities.level', { level: step.level })} · ${t('abilities.orderLabel', { order })}`
}

interface AbilityPlayerRowProps {
  player: NormalizedPlayer
  catalog: AbilityCatalog | null
  selected: boolean
  onSelect: (playerSlot: number) => void
}

function AbilityPlayerRow({ player, catalog, selected, onSelect }: AbilityPlayerRowProps) {
  const { t } = useI18n()
  const hero = heroName(player.hero_id)
  const heroLabel = hero ?? t('team.heroUnknown', { id: player.hero_id ?? '—' })
  const portrait = heroImageUrl(player.hero_id)
  const playerName = player.player_name ?? t('team.unknownPlayer')
  const timeline = buildAbilityTimeline(player.ability_upgrades, catalog)
  /** Таланты отдельным списком: полные названия не помещаются в компактную шкалу. */
  const talents = timeline === null ? [] : timeline.filter((step) => step.isTalent)

  return (
    <li className={`ability-player${selected ? ' ability-player--selected' : ''}`}>
      <button
        type="button"
        className="ability-player__head"
        aria-pressed={selected}
        aria-label={`${playerName} · ${heroLabel}`}
        onClick={() => onSelect(player.player_slot)}
      >
        {portrait === null ? (
          <span className="ability-player__portrait ability-player__portrait--empty" aria-hidden="true" />
        ) : (
          <img
            className="ability-player__portrait"
            src={portrait}
            alt={t('abilities.heroImageAlt', { hero: heroLabel })}
            width={40}
            height={40}
            loading="lazy"
          />
        )}
        <span className="ability-player__names">
          <span className="ability-player__hero">{heroLabel}</span>
          <span className="ability-player__name">{playerName}</span>
        </span>
        {player.level !== null && (
          <span className="ability-player__level">{t('abilities.level', { level: player.level })}</span>
        )}
      </button>

      {timeline === null ? (
        <p className="stub__hint">{t('abilities.unavailable')}</p>
      ) : timeline.length === 0 ? (
        <p className="stub__hint">{t('abilities.empty')}</p>
      ) : (
        <>
          <div className="ability-steps-scroll">
            <ol className="ability-steps">
              {timeline.map((step, index) => (
                <li
                  className={`ability-step${step.isTalent ? ' ability-step--talent' : ''}`}
                  key={`${step.abilityId}-${step.level}`}
                  title={stepTitle(step, index + 1, t)}
                >
                  <span className="ability-step__level">{step.level}</span>
                  {step.isTalent ? (
                    // Талант показывается компактной меткой: длинные технические названия
                    // не разрывают шкалу, полный текст доступен в подсказке и в списке ниже.
                    <span className="ability-step__talent" aria-hidden="true">
                      {t('abilities.talentMark')}
                    </span>
                  ) : step.iconUrl === null ? (
                    <span className="ability-step__text">
                      {step.displayName ?? t('abilities.unknownAbility', { id: step.abilityId })}
                    </span>
                  ) : (
                    <img
                      className="ability-step__icon"
                      src={step.iconUrl}
                      alt={t('abilities.abilityImageAlt', {
                        ability: step.displayName ?? step.name ?? String(step.abilityId),
                      })}
                      width={32}
                      height={32}
                      loading="lazy"
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>

          {talents.length > 0 && (
            <details className="ability-talents">
              <summary>{t('abilities.talentsSummary', { count: talents.length })}</summary>
              <ul className="ability-talents__list">
                {talents.map((step) => (
                  <li key={`${step.abilityId}-${step.level}`}>
                    {step.displayName ?? t('abilities.unknownAbility', { id: step.abilityId })} ·{' '}
                    {t('abilities.level', { level: step.level })}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </li>
  )
}
