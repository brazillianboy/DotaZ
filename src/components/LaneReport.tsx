import { filterEarlyGamePurchases } from '../lib/items'
import { hasLaningFacts, laningIntervalEndLabel } from '../lib/laning'
import type { NormalizedPlayer } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import { durationText, laneEfficiencyText, playerText, statText } from '../i18n/viewLabels'

interface LaneReportProps {
  player: NormalizedPlayer | null
}

/**
 * Отчёт о ранней стадии матча (Task 8; интервал 00:00–15:00, локализация — Task 13,
 * фильтрация предметов — Task 14).
 *
 * Показывает только фактические значения из ответа OpenDota: поминутные показатели
 * (`lh_t[15]`, `gold_t[15]`, `xp_t[15]`), события первых пятнадцати минут и процент
 * эффективности линии провайдера. Подписи строятся по интервалу, сохранённому в
 * данных: отчёты старого формата (10 минут) отображаются с корректными метками и
 * не выдают 10-минутные значения за 15-минутные. Оценки качества линии не выполняются.
 *
 * Покупки интервала фильтруются политикой ранней стадии (`filterEarlyGamePurchases`):
 * показываются компоненты, собранные предметы и явные исключения (Bottle,
 * Aghanim's Shard, Refresher Shard, Cheese, Block of Cheese); обычные расходники
 * (варды, Tango, Clarity, Smoke, Dust, Town Portal Scroll) скрыты. У секции за весь
 * матч политика другая — там показываются только значимые приобретения. Порядок
 * событий хронологический, повторные покупки одного предмета сохраняются как
 * отдельные события. Сырой журнал в нормализованных данных не изменяется.
 */
export default function LaneReport({ player }: LaneReportProps) {
  const { t, locale } = useI18n()

  if (player === null) {
    return (
      <section className="lane-report panel" aria-labelledby="lane-report-title">
        <h2 className="match-section__title" id="lane-report-title">
          {t('laning.title', { interval: t('period.laning') })}
        </h2>
        <p className="stub__text">{t('laning.empty')}</p>
      </section>
    )
  }

  const laning = player.laning
  const interval = laning.interval.label
  const endLabel = laningIntervalEndLabel(laning.interval.minutes)
  // Политика ранней стадии 00:00–15:00: подробный список событий интервала.
  const purchases = filterEarlyGamePurchases(laning.purchasesFirst)
  /** Сколько подтверждённых покупок скрыто фильтром (обычные расходники) — честный счётчик. */
  const hiddenCount =
    laning.purchasesFirst === null || purchases === null
      ? 0
      : laning.purchasesFirst.length - purchases.length

  return (
    <section className="lane-report panel" aria-labelledby="lane-report-title">
      <h2 className="match-section__title" id="lane-report-title">
        {t('laning.title', { interval })}
      </h2>
      <p className="lane-report__subject">{playerText(t, player)}</p>

      {!hasLaningFacts(laning) ? (
        <p className="auth-alert auth-alert--error" role="status">
          {t('laning.unavailable')}
        </p>
      ) : (
        <>
          <dl className="match-facts match-facts--grid">
            <div className="match-facts__item">
              <dt>{t('laning.lastHits', { minute: endLabel })}</dt>
              <dd>{statText(t, laning.lastHits)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>{t('laning.gold', { minute: endLabel })}</dt>
              <dd>{statText(t, laning.gold)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>{t('laning.xp', { minute: endLabel })}</dt>
              <dd>{statText(t, laning.xp)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>{t('laning.kills', { interval })}</dt>
              <dd>{statText(t, laning.killsFirst)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>{t('laning.deaths', { interval })}</dt>
              <dd>{statText(t, laning.deathsFirst)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>{t('laning.efficiency')}</dt>
              <dd>{laneEfficiencyText(t, laning.laneEfficiencyPct, locale)}</dd>
            </div>
          </dl>

          <div className="lane-purchases">
            <h3 className="lane-purchases__title">
              {t('laning.purchasesTitle', { interval })}{' '}
              {purchases === null ? t('common.noData') : purchases.length}
            </h3>
            {purchases === null && <p className="stub__hint">{t('laning.purchasesMissing')}</p>}
            {purchases !== null && purchases.length === 0 && (
              <p className="stub__hint">{t('laning.purchasesEmpty', { interval })}</p>
            )}
            {purchases !== null && purchases.length > 0 && (
              <ul className="lane-purchases__list">
                {purchases.map((purchase, index) => (
                  <li
                    className="lane-purchase"
                    data-item-key={purchase.key}
                    key={`${purchase.key}-${purchase.time}-${index}`}
                  >
                    <span className="lane-purchase__key">{purchase.key}</span>
                    <span className="lane-purchase__time">
                      {durationText(t, Math.max(0, Math.floor(purchase.time)))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {hiddenCount > 0 && (
              <p className="stub__hint">{t('laning.purchasesHidden', { count: hiddenCount })}</p>
            )}
            {purchases !== null && <p className="stub__hint">{t('laning.purchasesNote')}</p>}
          </div>
        </>
      )}

      <p className="stub__hint">{t('laning.hint', { interval })}</p>
    </section>
  )
}