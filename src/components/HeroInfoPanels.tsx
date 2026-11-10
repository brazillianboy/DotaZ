import { useI18n } from '../i18n/I18nContext'
import { HERO_ATTRIBUTES_GENERATED_AT, type HeroAttributes } from '../lib/heroes'
import { heroPickShare, type HeroStatsCatalog, type HeroStatsEntry } from '../lib/heroStats'

/** Число из справочника; отсутствующее значение — прочерк, а не ноль. */
function num(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

function percent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}%`
}

/**
 * Характеристики героя (Task 19).
 *
 * Показываются только значения проверенного снимка справочника OpenDota: базовые
 * величины, рост и параметры. Рассчитанные показатели не подставляются, а дата
 * снимка указана явно — это не статистика матчей и не гарантия текущего патча.
 */
export function HeroAttributesPanel({ attributes }: { attributes: HeroAttributes | null }) {
  const { t } = useI18n()

  if (attributes === null) {
    return (
      <section className="lane-report panel" aria-labelledby="hero-attributes-title">
        <h2 className="match-section__title" id="hero-attributes-title">
          {t('hero.section.attributes')}
        </h2>
        <p className="stub__hint">{t('hero.attributes.unavailable')}</p>
      </section>
    )
  }

  const attackTypeText =
    attributes.attackType === 'Melee'
      ? t('heroes.attack.Melee')
      : attributes.attackType === 'Ranged'
        ? t('heroes.attack.Ranged')
        : (attributes.attackType ?? '—')

  const rows: { label: string; value: string }[] = [
    {
      label: t('hero.attributes.damage'),
      value: `${num(attributes.baseAttackMin)}–${num(attributes.baseAttackMax)}`,
    },
    { label: t('hero.attributes.attackRange'), value: num(attributes.attackRange) },
    { label: t('hero.attributes.attackRate'), value: num(attributes.attackRate) },
    { label: t('hero.attributes.baseAttackTime'), value: num(attributes.baseAttackTime) },
    { label: t('hero.attributes.attackPoint'), value: num(attributes.attackPoint) },
    { label: t('hero.attributes.projectileSpeed'), value: num(attributes.projectileSpeed) },
    { label: t('hero.attributes.moveSpeed'), value: num(attributes.moveSpeed) },
    { label: t('hero.attributes.armor'), value: num(attributes.baseArmor) },
    { label: t('hero.attributes.mr'), value: num(attributes.baseMr) },
    { label: t('hero.attributes.health'), value: num(attributes.baseHealth) },
    { label: t('hero.attributes.mana'), value: num(attributes.baseMana) },
    { label: t('hero.attributes.legs'), value: num(attributes.legs) },
    {
      label: t('hero.attributes.vision'),
      value: `${num(attributes.dayVision)} / ${num(attributes.nightVision)}`,
    },
    {
      label: t('hero.attributes.roles'),
      value: attributes.roles.length === 0 ? '—' : attributes.roles.join(', '),
    },
  ]

  const attributeBlocks = [
    { key: 'str', label: t('hero.attributes.str'), base: attributes.baseStr, gain: attributes.strGain },
    { key: 'agi', label: t('hero.attributes.agi'), base: attributes.baseAgi, gain: attributes.agiGain },
    { key: 'int', label: t('hero.attributes.int'), base: attributes.baseInt, gain: attributes.intGain },
  ]

  return (
    <section className="lane-report panel" aria-labelledby="hero-attributes-title">
      <h2 className="match-section__title" id="hero-attributes-title">
        {t('hero.section.attributes')}
      </h2>

      <div className="hero-attr-blocks">
        {attributeBlocks.map((block) => (
          <div className="hero-attr-block" key={block.key} data-attribute={block.key}>
            <span className="hero-attr-block__name">{block.label}</span>
            <span className="hero-attr-block__value">{num(block.base)}</span>
            <span className="hero-attr-block__hint">
              {t('hero.attributes.base')} · +{num(block.gain)} {t('hero.attributes.gain')}
            </span>
          </div>
        ))}
      </div>

      <dl className="hero-attr-grid">
        <div className="hero-attr-grid__item">
          <dt>{t('hero.attributes.attackType')}</dt>
          <dd>{attackTypeText}</dd>
        </div>
        {rows.map((row) => (
          <div className="hero-attr-grid__item" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="stub__hint">
        {t('hero.attributes.snapshot', { date: HERO_ATTRIBUTES_GENERATED_AT })}
      </p>
    </section>
  )
}

export type HeroPanelState = 'loading' | 'ready' | 'error'

interface HeroStatsPanelProps {
  entry: HeroStatsEntry | null
  catalog: HeroStatsCatalog | null
  state: HeroPanelState
}

/**
 * Статистика матчей героя (Task 19).
 *
 * Винрейт считается только при валидных значениях (`wins / games`), доля выборов —
 * только по знаменателю суммы выборов всех героев. Патч провайдером не сообщается,
 * поэтому блок явно называет числа статистикой выборки, а не «метой патча».
 */
export function HeroStatsPanel({ entry, catalog, state }: HeroStatsPanelProps) {
  const { t } = useI18n()

  const blocks =
    entry === null
      ? []
      : [
          { key: 'pub', label: t('hero.stats.pub'), block: entry.pub },
          { key: 'turbo', label: t('hero.stats.turbo'), block: entry.turbo },
          { key: 'pro', label: t('hero.stats.pro'), block: entry.pro },
        ]

  return (
    <section className="lane-report panel" aria-labelledby="hero-stats-title">
      <h2 className="match-section__title" id="hero-stats-title">
        {t('hero.section.stats')}
      </h2>

      {state === 'loading' && (
        <p className="stub__hint" role="status">
          {t('heroes.loading')}
        </p>
      )}

      {state === 'error' && (
        <p className="auth-alert auth-alert--error" role="status">
          {t('hero.stats.unavailable')}
        </p>
      )}

      {state === 'ready' && entry === null && (
        <p className="stub__hint" role="status">
          {t('hero.stats.empty')}
        </p>
      )}

      {state === 'ready' && entry !== null && (
        <>
          <dl className="hero-stats">
            {blocks.map(({ key, label, block }) => (
              <div className="hero-stats__item" key={key} data-scope={key}>
                <dt>{label}</dt>
                <dd>
                  <span className="hero-stats__winrate">{percent(block.winRate)}</span>
                  <span className="hero-stats__games">
                    {t('hero.stats.games', { count: block.games })}
                  </span>
                  <span className="hero-stats__wins">
                    {t('hero.stats.wins', { count: block.wins })}
                  </span>
                  {key === 'pro' && (
                    <span className="hero-stats__bans">
                      {entry.pro.bans === null
                        ? t('hero.stats.bansMissing')
                        : t('hero.stats.bans', { count: entry.pro.bans })}
                    </span>
                  )}
                </dd>
              </div>
            ))}
            <div className="hero-stats__item" data-scope="pick-share">
              <dt>{t('hero.stats.pickShare')}</dt>
              <dd>
                <span className="hero-stats__winrate">
                  {percent(heroPickShare(catalog, entry.heroId))}
                </span>
              </dd>
            </div>
          </dl>

          <p className="stub__hint">{t('hero.stats.pickShareNote')}</p>
          <p className="stub__hint">{t('hero.stats.noPatch')}</p>
          {catalog !== null && (
            <p className="stub__hint">
              {t('hero.stats.retrievedAt', {
                time: new Date(catalog.retrievedAt).toLocaleString(),
              })}
            </p>
          )}
        </>
      )}
    </section>
  )
}
