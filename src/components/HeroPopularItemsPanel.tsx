import { useI18n } from '../i18n/I18nContext'
import { itemDisplayName, itemIconUrl } from '../lib/items'
import type { ItemPhase, PopularItemsByPhase } from '../lib/heroPopularItems'

const PHASES: readonly ItemPhase[] = ['start', 'early', 'mid', 'late']

/**
 * Популярные предметы героя (Task 19).
 *
 * Показываются счётчики вхождений из выборки OpenDota: знаменатель провайдер не
 * публикует, поэтому проценты не вычисляются. Популярность не равна оптимальности —
 * это описание выборки, а не рекомендация сборки.
 */
export default function HeroPopularItemsPanel({
  data,
  state,
}: {
  data: PopularItemsByPhase | null
  state: 'loading' | 'ready' | 'error'
}) {
  const { t } = useI18n()

  return (
    <section className="lane-report panel" aria-labelledby="hero-items-title">
      <h2 className="match-section__title" id="hero-items-title">
        {t('hero.section.items')}
      </h2>

      {state === 'loading' && (
        <p className="stub__hint" role="status">
          {t('hero.items.loading')}
        </p>
      )}

      {state === 'error' && (
        <p className="auth-alert auth-alert--error" role="status">
          {t('hero.items.error')}
        </p>
      )}

      {state === 'ready' && data === null && (
        <p className="stub__hint" role="status">
          {t('hero.items.empty')}
        </p>
      )}

      {state === 'ready' && data !== null && (
        <>
          <div className="hero-items">
            {PHASES.map((phase) => (
              <div className="hero-items__phase" key={phase} data-phase={phase}>
                <h3 className="hero-items__title">{t(`hero.items.phase.${phase}`)}</h3>
                {data[phase].length === 0 ? (
                  <p className="stub__hint">—</p>
                ) : (
                  <ul className="hero-items__list">
                    {data[phase].map((item) => (
                      <li className="hero-item" key={`${phase}-${item.itemKey}`}>
                        <img
                          className="hero-item__icon"
                          src={itemIconUrl(item.itemKey)}
                          alt=""
                          width={28}
                          height={20}
                          loading="lazy"
                        />
                        <span className="hero-item__name">{itemDisplayName(item.itemKey)}</span>
                        <span className="hero-item__count">
                          {t('hero.items.count', { count: item.count })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <p className="stub__hint">{t('hero.items.note')}</p>
        </>
      )}
    </section>
  )
}
