import { useState } from 'react'

import { heroImageUrl, heroName } from '../lib/heroes'
import { inventoryItems, sortInventoryChronologically, type InventoryItem } from '../lib/inventory'
import { purchaseClockText } from '../lib/items'
import { groupPlayers } from '../lib/matchView'
import type { NormalizedPlayer, PlayerTeam } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import { kdaPart } from '../i18n/viewLabels'

interface TeamOverviewProps {
  players: NormalizedPlayer[]
  selectedSlot: number | null
  onSelect: (playerSlot: number) => void
}

/** Компактная ячейка: подтверждённое число или прочерк (расшифровка — в подсказке секции). */
function cellText(value: number | null): string {
  return value === null ? '—' : String(value)
}

/*
 * Время покупки на иконке форматируется общей функцией `purchaseClockText`
 * (`src/lib/items.ts`): она сохраняет знак (предматчевые покупки — `-мм:сс`) и не
 * подменяет отсутствующее время нулём.
 */

/**
 * Слот предмета финального инвентаря.
 *
 * Размер иконки фиксирован (42×42 на настольных экранах) и не сжимается соседними
 * колонками. Время покупки показывается прямо на иконке только при подтверждённом
 * событии покупки именно этого предмета; иначе иконка выводится без подписи времени.
 * Полное имя и время доступны в подсказке и в подписи изображения. Битое изображение
 * заменяется нейтральной заглушкой.
 */
function ItemSlot({ item }: { item: InventoryItem }) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  const timeLabel = item.acquiredAt === null ? null : purchaseClockText(item.acquiredAt)
  const label = timeLabel === null ? item.name : `${item.name} · ${timeLabel}`

  return (
    <li
      className="item-slot"
      data-item-key={item.key}
      data-item-time={item.acquiredAt === null ? 'none' : String(item.acquiredAt)}
      title={label}
    >
      {failed ? (
        <span className="item-slot__fallback" aria-hidden="true">
          {item.name.slice(0, 2)}
        </span>
      ) : (
        <img
          className="item-slot__icon"
          src={item.iconUrl}
          alt={t('team.itemAlt', { item: label })}
          width={42}
          height={42}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {timeLabel !== null && (
        <span className="item-slot__time" aria-hidden="true">
          {timeLabel}
        </span>
      )}
    </li>
  )
}

/** Финальный инвентарь строки: слоты предметов в хронологическом порядке покупки. */
function ItemsCell({ player }: { player: NormalizedPlayer }) {
  const { t } = useI18n()
  const items = inventoryItems(player.inventory_ids, player.purchaseLog)

  if (items === null) {
    return <span className="team-table__no-items">{t('team.itemsUnavailable')}</span>
  }
  if (items.length === 0) {
    return <span className="team-table__no-items">—</span>
  }
  // Порядок слотов инвентаря не является хронологическим: предметы выстраиваются
  // по подтверждённому времени покупки (без времени — в конце), см. inventory.ts.
  const ordered = sortInventoryChronologically(items)
  return (
    <ul className="inventory-list">
      {ordered.map((item, index) => (
        <ItemSlot item={item} key={`${item.key}-${index}`} />
      ))}
    </ul>
  )
}

interface TeamTableProps {
  team: PlayerTeam | null
  title: string
  players: NormalizedPlayer[]
  selectedSlot: number | null
  onSelect: (playerSlot: number) => void
}

/**
 * Таблица одной команды (Task 15): пять игроков, портрет героя, подтверждённые
 * показатели и финальный инвентарь со временем покупки на иконках.
 *
 * Выбор строки — кнопка внутри заголовка строки (`aria-pressed`), поэтому доступен
 * с клавиатуры. Выбранная строка выделяется фоном и тонкой рамкой, без текстового
 * бейджа. Длинные имена обрезаются многоточием, полное значение доступно в подсказке.
 * Таблица не сжимается: при нехватке места появляется горизонтальная прокрутка.
 */
function TeamTable({ team, title, players, selectedSlot, onSelect }: TeamTableProps) {
  const { t } = useI18n()
  const teamClass = team ?? 'unknown'

  return (
    <section
      className={`team-table panel team-table--${teamClass}`}
      aria-labelledby={`team-${teamClass}-title`}
    >
      <h3 className="match-section__title" id={`team-${teamClass}-title`}>
        {title} <span className="team-table__count">({players.length})</span>
      </h3>

      {players.length === 0 ? (
        <p className="stub__text">{t('team.noPlayers')}</p>
      ) : (
        <div className="table-scroll">
          <table className="team-table__table">
            <caption className="visually-hidden">{t('team.tableLabel', { team: title })}</caption>
            <thead>
              <tr>
                <th scope="col">{t('team.columnHero')}</th>
                <th scope="col">{t('team.columnPlayer')}</th>
                <th scope="col" className="team-table__head-num">
                  {t('team.columnLevel')}
                </th>
                <th scope="col" className="team-table__head-num">
                  {t('team.columnKda')}
                </th>
                <th scope="col" className="team-table__head-num">
                  {t('team.columnLastHits')}
                </th>
                <th scope="col" className="team-table__head-num">
                  {t('team.columnDenies')}
                </th>
                <th scope="col" className="team-table__head-num">
                  {t('team.columnNetWorth')}
                </th>
                <th scope="col" className="team-table__head-num">
                  {t('team.columnGpm')}
                </th>
                <th scope="col" className="team-table__head-num">
                  {t('team.columnXpm')}
                </th>
                <th scope="col" className="team-table__head-num">
                  {t('team.columnHeroDamage')}
                </th>
                <th scope="col" className="team-table__head-num">
                  {t('team.columnTowerDamage')}
                </th>
                <th scope="col" className="team-table__head-num">
                  {t('team.columnHealing')}
                </th>
                <th scope="col">{t('team.columnItems')}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const isSelected = player.player_slot === selectedSlot
                const hero = heroName(player.hero_id)
                const heroLabel = hero ?? t('team.heroUnknown', { id: player.hero_id ?? '—' })
                const portrait = heroImageUrl(player.hero_id)
                const playerName = player.player_name ?? t('team.unknownPlayer')

                return (
                  <tr
                    key={player.player_slot}
                    className={`team-table__row${isSelected ? ' team-table__row--selected' : ''}`}
                  >
                    <th scope="row" className="team-table__hero-cell">
                      <button
                        type="button"
                        className="team-table__select"
                        aria-pressed={isSelected}
                        aria-label={`${playerName} · ${heroLabel}`}
                        onClick={() => onSelect(player.player_slot)}
                      >
                        {portrait === null ? (
                          <span
                            className="team-table__portrait team-table__portrait--empty"
                            aria-hidden="true"
                          />
                        ) : (
                          <img
                            className="team-table__portrait"
                            src={portrait}
                            alt={t('team.heroImageAlt', { hero: heroLabel })}
                            width={40}
                            height={40}
                            loading="lazy"
                          />
                        )}
                        <span className="team-table__hero-name" title={heroLabel}>
                          {heroLabel}
                        </span>
                      </button>
                    </th>
                    <td className="team-table__cell team-table__cell--player" title={playerName}>
                      {playerName}
                    </td>
                    <td className="team-table__cell team-table__cell--num">{cellText(player.level)}</td>
                    <td className="team-table__cell team-table__cell--num team-table__cell--kda">
                      {`${kdaPart(player.kills)} / ${kdaPart(player.deaths)} / ${kdaPart(player.assists)}`}
                    </td>
                    <td className="team-table__cell team-table__cell--num">
                      {cellText(player.last_hits)}
                    </td>
                    <td className="team-table__cell team-table__cell--num">{cellText(player.denies)}</td>
                    <td className="team-table__cell team-table__cell--num">
                      {cellText(player.net_worth)}
                    </td>
                    <td className="team-table__cell team-table__cell--num">
                      {cellText(player.gold_per_min)}
                    </td>
                    <td className="team-table__cell team-table__cell--num">
                      {cellText(player.xp_per_min)}
                    </td>
                    <td className="team-table__cell team-table__cell--num">
                      {cellText(player.hero_damage)}
                    </td>
                    <td className="team-table__cell team-table__cell--num">
                      {cellText(player.tower_damage)}
                    </td>
                    <td className="team-table__cell team-table__cell--num">
                      {cellText(player.hero_healing)}
                    </td>
                    <td className="team-table__cell team-table__cell--items">
                      <ItemsCell player={player} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/**
 * Обзор обеих команд (Task 15): две компактные таблицы 5 + 5 вместо крупных карточек.
 * Участники группируются по стороне из `player_slot`; неизвестная сторона выводится
 * отдельной таблицей с нейтральным заголовком. Выбор строки не выполняет ни запросов,
 * ни записей в базу — это локальное состояние страницы.
 */
export default function TeamOverview({ players, selectedSlot, onSelect }: TeamOverviewProps) {
  const { t } = useI18n()
  const grouped = groupPlayers(players)

  return (
    <div className="team-overview">
      <TeamTable
        team="radiant"
        title={t('team.radiantTitle')}
        players={grouped.radiant}
        selectedSlot={selectedSlot}
        onSelect={onSelect}
      />
      <TeamTable
        team="dire"
        title={t('team.direTitle')}
        players={grouped.dire}
        selectedSlot={selectedSlot}
        onSelect={onSelect}
      />
      {grouped.unknown.length > 0 && (
        <TeamTable
          team={null}
          title={t('match.players.unknownTeam')}
          players={grouped.unknown}
          selectedSlot={selectedSlot}
          onSelect={onSelect}
        />
      )}
      <p className="stub__hint">{t('team.hint', { dash: '—' })}</p>
    </div>
  )
}
