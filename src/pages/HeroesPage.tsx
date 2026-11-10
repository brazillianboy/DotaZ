import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useI18n } from '../i18n/I18nContext'
import { heroCatalogEntries, type HeroCatalogEntry } from '../lib/heroes'
import {
  HERO_ATTRIBUTE_FILTERS,
  filterHeroes,
  sortHeroes,
  type HeroAttributeFilter,
  type HeroSortMode,
} from '../lib/heroSearch'
import { heroRateMap, loadHeroStatsCatalog, type HeroStatsCatalog } from '../lib/heroStats'

/** Портрет героя с нейтральной заглушкой при сбое загрузки. */
function HeroPortrait({ entry }: { entry: HeroCatalogEntry }) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="hero-card__fallback" aria-hidden="true">
        {t('heroes.imageFallback')}
      </span>
    )
  }
  return (
    <img
      className="hero-card__portrait"
      src={entry.imageUrl}
      alt=""
      width={96}
      height={54}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

/**
 * Каталог героев (Task 19).
 *
 * Список героев берётся из статического проверенного справочника и доступен всегда.
 * Статистика матчей (`/api/heroStats`) загружается отдельно: её сбой не ломает
 * каталог, поиск и фильтры — скрываются только винрейт и доля выборов.
 */
export default function HeroesPage() {
  const { t } = useI18n()
  const [entries] = useState<HeroCatalogEntry[]>(() => heroCatalogEntries())
  const [query, setQuery] = useState('')
  const [attribute, setAttribute] = useState<HeroAttributeFilter>('any')
  const [sortMode, setSortMode] = useState<HeroSortMode>('name')
  const [stats, setStats] = useState<HeroStatsCatalog | null>(null)
  const [statsState, setStatsState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    loadHeroStatsCatalog()
      .then((catalog) => {
        if (!active) {
          return
        }
        setStats(catalog)
        setStatsState(catalog === null ? 'error' : 'ready')
      })
      .catch(() => {
        if (active) {
          setStatsState('error')
        }
      })
    return () => {
      active = false
    }
  }, [])

  const rates = useMemo(() => heroRateMap(stats), [stats])
  const visible = useMemo(
    () => sortHeroes(filterHeroes(entries, { query, attribute }), sortMode, rates),
    [entries, query, attribute, sortMode, rates],
  )

  const statsKnown = statsState === 'ready' && stats !== null
  const sortOptions: HeroSortMode[] = statsKnown ? ['name', 'winRate', 'pickRate'] : ['name']

  const attributeText = (filter: HeroAttributeFilter): string => {
    if (filter === 'str') return t('heroes.filter.str')
    if (filter === 'agi') return t('heroes.filter.agi')
    if (filter === 'int') return t('heroes.filter.int')
    if (filter === 'universal') return t('heroes.filter.universal')
    return t('heroes.filter.any')
  }

  const sortText = (mode: HeroSortMode): string => {
    if (mode === 'winRate') return t('heroes.sort.winRate')
    if (mode === 'pickRate') return t('heroes.sort.pickRate')
    return t('heroes.sort.name')
  }

  const primaryAttrText = (entry: HeroCatalogEntry): string => {
    if (entry.primaryAttr === 'str') return t('heroes.attr.str')
    if (entry.primaryAttr === 'agi') return t('heroes.attr.agi')
    if (entry.primaryAttr === 'int') return t('heroes.attr.int')
    if (entry.primaryAttr === 'all') return t('heroes.attr.all')
    return '—'
  }

  return (
    <section className="page page--heroes">
      <header className="page__header">
        <h1 className="page__title">{t('heroes.title')}</h1>
        <p className="page__subtitle">{t('heroes.description')}</p>
      </header>

      <div className="hero-filters panel">
        <div className="hero-filters__field">
          <label className="hero-filters__label" htmlFor="hero-search">
            {t('heroes.search.label')}
          </label>
          <div className="hero-filters__search">
            <input
              id="hero-search"
              className="input"
              type="search"
              value={query}
              placeholder={t('heroes.search.placeholder')}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setQuery('')}
                aria-label={t('heroes.search.clear')}
              >
                {t('heroes.search.clear')}
              </button>
            )}
          </div>
        </div>

        <fieldset className="hero-filters__field">
          <legend className="hero-filters__label">{t('heroes.filter.legend')}</legend>
          <div className="hero-filters__chips">
            {HERO_ATTRIBUTE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className="chip"
                aria-pressed={attribute === filter}
                data-active={attribute === filter}
                onClick={() => setAttribute(filter)}
              >
                {attributeText(filter)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="hero-filters__field">
          <label className="hero-filters__label" htmlFor="hero-sort">
            {t('heroes.sort.label')}
          </label>
          <select
            id="hero-sort"
            className="input"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as HeroSortMode)}
          >
            {sortOptions.map((mode) => (
              <option key={mode} value={mode}>
                {sortText(mode)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="stub__hint" role="status">
        {t('heroes.count', { count: visible.length, total: entries.length })}
      </p>

      {statsState === 'loading' && (
        <p className="stub__hint" role="status">
          {t('heroes.loading')}
        </p>
      )}
      {statsState === 'error' && (
        <p className="stub__hint" role="status">
          {t('heroes.statsUnavailable')}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="auth-alert" role="status">
          <p>{t('heroes.empty')}</p>
          <p className="stub__hint">{t('heroes.emptyHint')}</p>
        </div>
      ) : (
        <ul className="hero-grid">
          {visible.map((entry) => {
            const entryStats = stats?.entries.get(entry.heroId) ?? null
            const pickShare = rates.get(entry.heroId)?.pickRate ?? null
            return (
              <li className="hero-card" key={entry.heroId} data-hero-id={entry.heroId}>
                <Link className="hero-card__link" to={`/heroes/${entry.heroId}`}>
                  <HeroPortrait entry={entry} />
                  <span className="hero-card__body">
                    <span className="hero-card__name">{entry.name}</span>
                    <span className="hero-card__attr">{primaryAttrText(entry)}</span>
                    {statsKnown && entryStats !== null && (
                      <span className="hero-card__stats">
                        {entryStats.pub.winRate !== null && (
                          <span className="hero-card__stat">
                            {entryStats.pub.winRate.toFixed(2)}% {t('heroes.card.winRate')}
                          </span>
                        )}
                        {pickShare !== null && (
                          <span className="hero-card__stat">
                            {pickShare.toFixed(2)}% {t('heroes.card.pickRate')}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="hero-card__open">{t('heroes.card.open')}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
