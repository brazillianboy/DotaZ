import { buildMatchItems } from '../lib/items'
import { LANING_INTERVAL_MINUTES } from '../lib/laning'
import type { NormalizedPlayer } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import { durationText, playerText } from '../i18n/viewLabels'

interface MatchItemsProps {
  player: NormalizedPlayer | null
}

/**
 * Предметы за матч (Task 14).
 *
 * Показывает ТОЛЬКО значимые приобретения за весь матч с временем первой покупки
 * (политика `isDisplayedInFullMatch`): собранные предметы, Bottle и базовые
 * Boots of Speed, если они не были улучшены в собранные сапоги. Компоненты,
 * обычные расходники, рецепты и исключения ранней стадии (Refresher Shard, Cheese,
 * Block of Cheese) здесь не показываются — подробный список событий интервала даёт
 * секция 00:00–15:00. Улучшение сапог определяется по подтверждённой истории
 * покупок, а не по финальному инвентарю. Источник данных — уже полученный ответ
 * матча: новые запросы не выполняются. Если журнал покупок отсутствует в ответе,
 * секция честно сообщает об этом; для отчётов старого формата (снимок без журнала)
 * показывается отдельное пояснение — данные в базе не перезаписываются.
 */
export default function MatchItems({ player }: MatchItemsProps) {
  const { t } = useI18n()

  if (player === null) {
    return (
      <section className="match-items panel" aria-labelledby="match-items-title">
        <h2 className="match-section__title" id="match-items-title">
          {t('items.title')}
        </h2>
        <p className="stub__text">{t('items.selectPlayer')}</p>
      </section>
    )
  }

  const items = buildMatchItems(player.purchaseLog)
  const isLegacySnapshot = player.laning.interval.minutes !== LANING_INTERVAL_MINUTES

  return (
    <section className="match-items panel" aria-labelledby="match-items-title">
      <h2 className="match-section__title" id="match-items-title">
        {t('items.title')}
      </h2>
      <p className="match-items__subject">{playerText(t, player)}</p>
      <p className="stub__text">{t('items.lead')}</p>

      {items === null ? (
        <p className="auth-alert auth-alert--error" role="status">
          {isLegacySnapshot ? t('items.legacyUnavailable') : t('items.noLog')}
        </p>
      ) : items.length === 0 ? (
        <p className="stub__text" role="status">
          {t('items.empty')}
        </p>
      ) : (
        <ul className="items-list">
          {items.map((item) => (
            <li className="item-chip" data-item-key={item.key} key={item.key}>
              <span className="item-chip__icon" aria-hidden="true">
                <img
                  className="item-chip__image"
                  src={item.iconUrl}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                />
              </span>
              <span className="item-chip__body">
                <span className="item-chip__name">{item.name}</span>
                <span className="item-chip__time">
                  {durationText(t, Math.max(0, Math.floor(item.time)))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="stub__hint">{t('items.hint')}</p>
    </section>
  )
}