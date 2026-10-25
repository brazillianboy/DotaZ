import { hasLaningFacts } from '../lib/laning'
import type { NormalizedPlayer } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import { durationText, laneEfficiencyText, playerText, statText } from '../i18n/viewLabels'

interface LaneReportProps {
  player: NormalizedPlayer | null
}

/**
 * Отчёт о стадии линии 00:00–10:00 (Task 8, локализация — Task 13).
 *
 * Показывает только фактические значения из ответа OpenDota: поминутные показатели
 * (`lh_t[10]`, `gold_t[10]`, `xp_t[10]`), события первых десяти минут и процент
 * эффективности линии провайдера. Оценки качества линии, нормативы героя/роли и
 * рекомендации не выполняются. Фиксированный интервал 00:00–10:00 не изменяется.
 */
export default function LaneReport({ player }: LaneReportProps) {
  const { t, locale } = useI18n()

  if (player === null) {
    return (
      <section className="lane-report panel" aria-labelledby="lane-report-title">
        <h2 className="match-section__title" id="lane-report-title">
          {t('laning.title')}
        </h2>
        <p className="stub__text">{t('laning.empty')}</p>
      </section>
    )
  }

  const laning = player.laning

  return (
    <section className="lane-report panel" aria-labelledby="lane-report-title">
      <h2 className="match-section__title" id="lane-report-title">
        {t('laning.title')}
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
              <dt>{t('laning.lastHits')}</dt>
              <dd>{statText(t, laning.lastHitsAt10)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>{t('laning.gold')}</dt>
              <dd>{statText(t, laning.goldAt10)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>{t('laning.xp')}</dt>
              <dd>{statText(t, laning.xpAt10)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>{t('laning.kills')}</dt>
              <dd>{statText(t, laning.killsFirst10)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>{t('laning.deaths')}</dt>
              <dd>{statText(t, laning.deathsFirst10)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>{t('laning.efficiency')}</dt>
              <dd>{laneEfficiencyText(t, laning.laneEfficiencyPct, locale)}</dd>
            </div>
          </dl>

          <div className="lane-purchases">
            <h3 className="lane-purchases__title">
              {t('laning.purchasesTitle')}{' '}
              {laning.purchasesFirst10 === null
                ? t('common.noData')
                : laning.purchasesFirst10.length}
            </h3>
            {laning.purchasesFirst10 === null && (
              <p className="stub__hint">{t('laning.purchasesMissing')}</p>
            )}
            {laning.purchasesFirst10 !== null && laning.purchasesFirst10.length === 0 && (
              <p className="stub__hint">{t('laning.purchasesEmpty')}</p>
            )}
            {laning.purchasesFirst10 !== null && laning.purchasesFirst10.length > 0 && (
              <ul className="lane-purchases__list">
                {laning.purchasesFirst10.map((purchase, index) => (
                  <li
                    className="lane-purchase"
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
          </div>
        </>
      )}

      <p className="stub__hint">{t('laning.hint')}</p>
    </section>
  )
}