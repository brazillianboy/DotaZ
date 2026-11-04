import { useState } from 'react'

import {
  MAP_IMAGE_SRC,
  decodeBuildings,
  hasBuildingData,
  type BuildingStatus,
  type LaneName,
  type TeamSide,
} from '../lib/buildings'
import type { NormalizedMatch } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import { durationText } from '../i18n/viewLabels'
import type { TranslationKey } from '../i18n/translations'

interface BuildingsMapProps {
  match: NormalizedMatch
}

const LANE_KEYS: Record<LaneName, TranslationKey> = {
  top: 'buildings.laneTop',
  mid: 'buildings.laneMid',
  bot: 'buildings.laneBot',
}

const STATE_KEYS: Record<BuildingStatus['state'], TranslationKey> = {
  standing: 'buildings.standing',
  destroyed: 'buildings.destroyed',
  unknown: 'buildings.unknown',
}

const TEAM_KEYS: Record<TeamSide, TranslationKey> = {
  radiant: 'team.radiantTitle',
  dire: 'team.direTitle',
}

/** Знаки состояний: состояние передаётся не только цветом. */
const STATE_SYMBOLS: Record<BuildingStatus['state'], string> = {
  standing: '✓',
  destroyed: '✕',
  unknown: '?',
}

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

/** Локализованное название здания: вид, ярус и линия. */
function buildingLabel(t: Translate, building: BuildingStatus): string {
  if (building.kind === 'ancient') {
    return t('buildings.ancient')
  }
  const lane = building.lane === null ? null : t(LANE_KEYS[building.lane])
  if (building.kind === 'barracks') {
    const kind =
      building.barracksType === 'melee'
        ? t('buildings.barracksMelee')
        : t('buildings.barracksRanged')
    return lane === null ? kind : `${kind} · ${lane}`
  }
  const tier = building.tier === null ? '' : t('buildings.towerTier', { tier: building.tier })
  return lane === null ? tier : `${tier} · ${lane}`
}

/** Подпись состояния с подтверждённым временем разрушения (если оно есть). */
function stateText(t: Translate, building: BuildingStatus): string {
  const state = t(STATE_KEYS[building.state])
  if (building.destroyedAt === null) {
    return state
  }
  return `${state} · ${t('buildings.destroyedAt', {
    time: durationText(t, building.destroyedAt),
  })}`
}

/**
 * Компактная ячейка состояния здания: знак, подпись состояния и подтверждённое время.
 * Полная расшифровка (название здания, состояние, время) доступна в подсказке.
 */
function StateChip({ t, building }: { t: Translate; building: BuildingStatus }) {
  const time = building.destroyedAt === null ? null : durationText(t, building.destroyedAt)
  return (
    <span
      className={`building-chip building-chip--${building.state}`}
      data-building-id={building.id}
      data-building-state={building.state}
      title={`${buildingLabel(t, building)} · ${stateText(t, building)}`}
    >
      <span className="building-chip__symbol" aria-hidden="true">
        {STATE_SYMBOLS[building.state]}
      </span>
      <span className="building-chip__state">{t(STATE_KEYS[building.state])}</span>
      {time !== null && <span className="building-chip__time">{time}</span>}
    </span>
  )
}

/** Полная подпись маркера: команда, линия/ярус (или тип бараков), состояние и время. */
function markerLabel(t: Translate, building: BuildingStatus): string {
  return `${t(TEAM_KEYS[building.side])} · ${buildingLabel(t, building)} · ${stateText(t, building)}`
}

/** Заливка глифа: стоит — сплошной, разрушено/неизвестно — контурный. */
type GlyphVariant = 'solid' | 'outline'

function glyphVariant(state: BuildingStatus['state']): GlyphVariant {
  return state === 'standing' ? 'solid' : 'outline'
}

/**
 * Глиф башни: зубчатая башня на цоколе — компактный «строительный» символ вместо текста.
 * Сплошная заливка означает «стоит», контур — разрушено или неизвестно.
 */
function TowerGlyph({ variant }: { variant: GlyphVariant }) {
  const filled = variant === 'solid'
  return (
    <svg className="map-marker__glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <g
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0.8 : 1.3}
        strokeLinejoin="round"
      >
        <path d="M4 3h2v3H4z" />
        <path d="M7 3h2v3H7z" />
        <path d="M10 3h2v3h-2z" />
        <path d="M4.2 6h7.6v7H4.2z" />
        <path d="M3 13h10v1.6H3z" />
      </g>
    </svg>
  )
}

/** Глиф бараков: строение с двускатной крышей (отличается от башни силуэтом). */
function BarracksGlyph({ variant }: { variant: GlyphVariant }) {
  const filled = variant === 'solid'
  return (
    <svg className="map-marker__glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <g
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0.8 : 1.3}
        strokeLinejoin="round"
      >
        <path d="M8 2.6 13.6 6.4v7H2.4v-7z" />
        <path d="M6.4 9.4h3.2v4H6.4z" fill="none" strokeWidth={1.1} opacity={0.7} />
      </g>
    </svg>
  )
}

/** Глиф трона: ромб (как в легенде) — единственное строение этого вида. */
function AncientGlyph({ variant }: { variant: GlyphVariant }) {
  const filled = variant === 'solid'
  return (
    <svg className="map-marker__glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M8 1.8 14.2 8 8 14.2 1.8 8z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0.8 : 1.3}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Маркер здания на карте: кнопка с глифом, доступная с клавиатуры.
 *
 * Позиция задаётся процентами от размеров изображения (`left`/`top`), поэтому маркер
 * остаётся на своём строении при любом масштабе карты и не выходит за её границы.
 * Состояние передаётся формой и перечёркиванием, а не только цветом. Подсказка
 * появляется при наведении и при фокусе с клавиатуры; полный текст подписи (команда,
 * линия/ярус, состояние, подтверждённое время) доступен и через `aria-label`.
 */
function MapMarker({ t, building }: { t: Translate; building: BuildingStatus }) {
  const label = markerLabel(t, building)
  const variant = glyphVariant(building.state)
  // Подсказка у краёв карты не должна выходить за пределы панели (нет горизонтального переполнения).
  const tipAlign = building.x < 20 ? ' map-marker__tip--start' : building.x > 80 ? ' map-marker__tip--end' : ''

  return (
    <li className="buildings__marker" style={{ left: `${building.x}%`, top: `${building.y}%` }}>
      <button
        type="button"
        className={`map-marker map-marker--${building.side} map-marker--${building.state} map-marker--${building.kind}`}
        data-map-building-id={building.id}
        data-map-side={building.side}
        data-map-state={building.state}
        data-map-kind={building.kind}
        aria-label={label}
        title={label}
      >
        {building.kind === 'tower' ? (
          <TowerGlyph variant={variant} />
        ) : building.kind === 'barracks' ? (
          <BarracksGlyph variant={variant} />
        ) : (
          <AncientGlyph variant={variant} />
        )}
        {building.state === 'destroyed' && (
          <span className="map-marker__cross" aria-hidden="true">
            ✕
          </span>
        )}
        <span className={`map-marker__tip${tipAlign}`} role="tooltip" aria-hidden="true">
          <span className="map-marker__tip-team">{t(TEAM_KEYS[building.side])}</span>
          <span className="map-marker__tip-name">{buildingLabel(t, building)}</span>
          <span className="map-marker__tip-state">{stateText(t, building)}</span>
        </span>
      </button>
    </li>
  )
}

/**
 * Структурированная сводка одной команды: линии × ярусы башен и бараки,
 * отдельная строка базы (башни T4 и трон). Каждая ячейка — знак состояния,
 * локализованная подпись и подтверждённое время разрушения.
 */
function TeamSummary({
  title,
  buildings,
}: {
  title: string
  buildings: BuildingStatus[]
}) {
  const { t } = useI18n()
  const lanes: LaneName[] = ['top', 'mid', 'bot']
  const towerAt = (lane: LaneName, tier: 1 | 2 | 3): BuildingStatus | undefined =>
    buildings.find(
      (building) => building.kind === 'tower' && building.lane === lane && building.tier === tier,
    )
  const barracksAt = (lane: LaneName): BuildingStatus[] =>
    buildings.filter((building) => building.kind === 'barracks' && building.lane === lane)
  const tierFour = buildings.filter((building) => building.kind === 'tower' && building.tier === 4)
  const ancient = buildings.find((building) => building.kind === 'ancient')
  const empty = <span className="building-chip building-chip--empty">—</span>
  const missing = <span className="building-chip building-chip--unknown">{t('buildings.unknown')}</span>

  return (
    <section className="buildings-summary" aria-label={title}>
      <h4 className="buildings-summary__title">{title}</h4>
      <div className="table-scroll">
        <table className="buildings-table">
          <caption className="visually-hidden">
            {t('buildings.summaryTableLabel', { team: title })}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('buildings.laneColumn')}</th>
              <th scope="col">T1</th>
              <th scope="col">T2</th>
              <th scope="col">T3</th>
              <th scope="col">T4</th>
              <th scope="col">{t('buildings.barracksColumn')}</th>
              <th scope="col">{t('buildings.ancient')}</th>
            </tr>
          </thead>
          <tbody>
            {lanes.map((lane) => {
              const barracks = barracksAt(lane)
              return (
                <tr key={lane}>
                  <th scope="row">{t(LANE_KEYS[lane])}</th>
                  {([1, 2, 3] as const).map((tier) => {
                    const tower = towerAt(lane, tier)
                    return (
                      <td key={tier}>
                        {tower === undefined ? missing : <StateChip t={t} building={tower} />}
                      </td>
                    )
                  })}
                  <td>{empty}</td>
                  <td>
                    {barracks.length === 0
                      ? missing
                      : barracks.map((item) => <StateChip t={t} building={item} key={item.id} />)}
                  </td>
                  <td>{empty}</td>
                </tr>
              )
            })}
            <tr>
              <th scope="row">{t('buildings.baseRow')}</th>
              <td colSpan={3}>{empty}</td>
              <td>
                {tierFour.length === 0
                  ? missing
                  : tierFour.map((item) => <StateChip t={t} building={item} key={item.id} />)}
              </td>
              <td>{empty}</td>
              <td>{ancient === undefined ? missing : <StateChip t={t} building={ancient} />}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * Карта зданий (Task 15).
 *
 * Карта — основной визуальный элемент: фоном служит изображение владельца
 * `public/images/dota-map-reference.png` (константа `MAP_IMAGE_SRC`), которое показывается
 * целиком, без растяжения и обрезки. Маркеры нанесены ПОВЕРХ изображения в процентах от его
 * размеров (единая система координат, см. `src/lib/buildings.ts`), поэтому остаются на своих
 * строениях при любом масштабе и не выходят за границы карты.
 *
 * Состояние берётся из битмасок OpenDota, семантика которых проверена на реальных матчах
 * (см. `src/lib/buildings.ts`); время разрушения — только из подтверждённых событий
 * `building_kill`. Рядом с картой — компактная легенда и короткая сводка
 * «стоит/разрушено/неизвестно»; подробная разбивка по линиям и ярусам вынесена в
 * раскрываемый блок, чтобы секция не превращалась в плотный текст.
 */
export default function BuildingsMap({ match }: BuildingsMapProps) {
  const { t } = useI18n()
  // Фон — изображение карты, построенное из проверенных данных игры (см. `buildings.ts`).
  // Если файл недоступен, интерфейс честно сообщает об этом и показывает маркеры на
  // нейтральном фоне; другое изображение не подставляется.
  const [mapImageFailed, setMapImageFailed] = useState(false)

  if (!hasBuildingData(match)) {
    return (
      <section className="buildings panel" aria-labelledby="buildings-title">
        <h2 className="match-section__title" id="buildings-title">
          {t('buildings.title')}
        </h2>
        <p className="stub__text" role="status">
          {t('buildings.unavailable')}
        </p>
      </section>
    )
  }

  const buildings = decodeBuildings(match)
  const teams: TeamSide[] = ['radiant', 'dire']
  const legendStates: BuildingStatus['state'][] = ['standing', 'destroyed', 'unknown']

  const countByState = (team: TeamSide, state: BuildingStatus['state']): number =>
    buildings.filter((building) => building.side === team && building.state === state).length

  return (
    <section className="buildings panel" aria-labelledby="buildings-title">
      <h2 className="match-section__title" id="buildings-title">
        {t('buildings.title')}
      </h2>
      <p className="stub__text">{t('buildings.lead')}</p>

      <div className="buildings__layout">
        <figure className="buildings__map">
          <div
            className={`buildings__map-frame${
              mapImageFailed ? ' buildings__map-frame--no-image' : ''
            }`}
          >
            <img
              className="buildings__map-image"
              src={MAP_IMAGE_SRC}
              alt={t('buildings.mapImageAlt')}
              loading="lazy"
              decoding="async"
              onError={() => setMapImageFailed(true)}
            />
            {mapImageFailed && (
              <p className="buildings__map-missing" role="status">
                {t('buildings.mapImageMissing')}
              </p>
            )}
            <ul className="buildings__markers" aria-label={t('buildings.mapLabel')}>
              {buildings.map((building) => (
                <MapMarker key={building.id} t={t} building={building} />
              ))}
            </ul>
          </div>
          <figcaption className="buildings__legend">
            <span className="buildings__legend-title">{t('buildings.legendTitle')}</span>
            <ul className="buildings__legend-list">
              {teams.map((team) => (
                <li className={`legend-item legend-item--team legend-item--${team}`} key={team}>
                  <span className="legend-item__marker legend-item__marker--team" aria-hidden="true" />
                  {t(TEAM_KEYS[team])}
                </li>
              ))}
            </ul>
            <ul className="buildings__legend-list">
              {legendStates.map((state) => (
                <li className={`legend-item legend-item--${state}`} key={state}>
                  <span className="legend-item__marker" aria-hidden="true">
                    {STATE_SYMBOLS[state]}
                  </span>
                  {t(STATE_KEYS[state])}
                </li>
              ))}
            </ul>
            <span className="stub__hint">{t('buildings.legendTeams')}</span>
            <span className="stub__hint">{t('buildings.shapeLegend')}</span>
          </figcaption>
        </figure>

        <div className="buildings__summary">
          <h3 className="buildings__summary-title">{t('buildings.mapSummaryTitle')}</h3>
          <ul className="buildings__counters">
            {teams.map((team) => (
              <li
                className={`buildings__counter buildings__counter--${team}`}
                key={team}
                data-team-counters={team}
              >
                <span className="buildings__counter-team">{t(TEAM_KEYS[team])}</span>
                <span className="buildings__counter-values">
                  {t('buildings.counters', {
                    standing: countByState(team, 'standing'),
                    destroyed: countByState(team, 'destroyed'),
                    unknown: countByState(team, 'unknown'),
                  })}
                </span>
              </li>
            ))}
          </ul>
          <p className="stub__hint">{t('buildings.mapNote')}</p>

          <details className="technical-details">
            <summary>{t('common.technicalDetails')}</summary>
            <div className="buildings__tables">
              {teams.map((team) => (
                <TeamSummary
                  key={team}
                  title={t('buildings.teamTitle', { team: t(TEAM_KEYS[team]) })}
                  buildings={buildings.filter((building) => building.side === team)}
                />
              ))}
            </div>
            <p className="stub__hint">{t('buildings.schematicNote')}</p>
            <p className="stub__hint">{t('buildings.tower4Note')}</p>
            <p className="stub__hint">{t('buildings.hint')}</p>
          </details>
        </div>
      </div>
    </section>
  )
}
