import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import HeroAbilitiesPanel, { type HeroAbilitiesState } from '../components/HeroAbilitiesPanel'
import HeroPopularItemsPanel from '../components/HeroPopularItemsPanel'
import HeroMatchups from '../components/HeroMatchups'
import {
  HeroAttributesPanel,
  HeroStatsPanel,
  type HeroPanelState,
} from '../components/HeroInfoPanels'
import { useI18n } from '../i18n/I18nContext'
import {
  loadHeroAbilityData,
  resetHeroAbilityCaches,
  type HeroAbilityData,
} from '../lib/heroAbilities'
import { heroAttributes, heroImageUrl, heroName, isKnownHero } from '../lib/heroes'
import { loadHeroMatchups, resetHeroMatchupsCache, type MatchupRow } from '../lib/heroMatchups'
import {
  loadHeroItemPopularity,
  resetHeroItemPopularityCache,
  type PopularItemsByPhase,
} from '../lib/heroPopularItems'
import {
  heroStatsEntry,
  loadHeroStatsCatalog,
  resetHeroStatsCache,
  type HeroStatsCatalog,
} from '../lib/heroStats'

/** Ключи перевода основного атрибута: типизированная карта вместо шаблонной строки. */
const PRIMARY_ATTRIBUTE_KEYS = {
  str: 'hero.attributes.str',
  agi: 'hero.attributes.agi',
  int: 'hero.attributes.int',
  all: 'hero.attributes.all',
} as const

/** Разбор параметра маршрута: только положительный целый ID из проверенного справочника. */
export function parseHeroRouteId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return null
  }
  const heroId = Number(raw)
  if (!Number.isInteger(heroId) || heroId <= 0 || !isKnownHero(heroId)) {
    return null
  }
  return heroId
}

function HeroPortrait({ heroId, name }: { heroId: number; name: string }) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  const url = heroImageUrl(heroId)
  if (url === null || failed) {
    return (
      <span className="hero-profile__fallback" aria-hidden="true">
        {t('heroes.imageFallback')}
      </span>
    )
  }
  return (
    <img
      className="hero-profile__portrait"
      src={url}
      alt=""
      width={160}
      height={90}
      onError={() => setFailed(true)}
      data-hero-name={name}
    />
  )
}

/**
 * Профиль героя (Task 19).
 *
 * Справочные характеристики доступны всегда, данные провайдера загружаются четырьмя
 * независимыми запросами: сбой любого из них не ломает остальные блоки. Провайдер не
 * сообщает патч и период наблюдений — интерфейс говорит об этом прямо.
 */
export default function HeroPage() {
  const { t, locale } = useI18n()
  const { heroId: rawId } = useParams<{ heroId: string }>()
  const heroId = parseHeroRouteId(rawId)

  const [stats, setStats] = useState<HeroStatsCatalog | null>(null)
  const [statsState, setStatsState] = useState<HeroPanelState>('loading')
  const [matchups, setMatchups] = useState<MatchupRow[] | null>(null)
  const [matchupsState, setMatchupsState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [abilities, setAbilities] = useState<HeroAbilityData | null>(null)
  const [abilitiesState, setAbilitiesState] = useState<HeroAbilitiesState>('loading')
  const [items, setItems] = useState<PopularItemsByPhase | null>(null)
  const [itemsState, setItemsState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    if (heroId === null) {
      return () => {
        active = false
      }
    }
    setStatsState('loading')
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
  }, [heroId, attempt])

  useEffect(() => {
    if (heroId === null) {
      return
    }
    const controller = new AbortController()
    let active = true
    setMatchupsState('loading')
    loadHeroMatchups(heroId, { signal: controller.signal })
      .then((rows) => {
        if (!active) {
          return
        }
        setMatchups(rows)
        setMatchupsState(rows === null ? 'error' : 'ready')
      })
      .catch(() => {
        if (active) {
          setMatchupsState('error')
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [heroId, attempt])


  useEffect(() => {
    if (heroId === null) {
      return
    }
    let active = true
    setAbilitiesState('loading')
    loadHeroAbilityData(heroId)
      .then((data) => {
        if (!active) {
          return
        }
        setAbilities(data)
        setAbilitiesState(data === null ? 'error' : 'ready')
      })
      .catch(() => {
        if (active) {
          setAbilitiesState('error')
        }
      })
    return () => {
      active = false
    }
  }, [heroId, attempt])

  useEffect(() => {
    if (heroId === null) {
      return
    }
    let active = true
    setItemsState('loading')
    loadHeroItemPopularity(heroId)
      .then((data) => {
        if (!active) {
          return
        }
        setItems(data)
        setItemsState(data === null ? 'error' : 'ready')
      })
      .catch(() => {
        if (active) {
          setItemsState('error')
        }
      })
    return () => {
      active = false
    }
  }, [heroId, attempt])

  const retry = useCallback(() => {
    resetHeroStatsCache()
    resetHeroMatchupsCache()
    resetHeroAbilityCaches()
    resetHeroItemPopularityCache()
    setAttempt((value) => value + 1)
  }, [])

  if (heroId === null) {
    return (
      <section className="page page--heroes">
        <div className="auth-alert" role="status">
          <h1 className="page__title">{t('hero.notFound.title')}</h1>
          <p className="stub__hint">{t('hero.notFound.text')}</p>
          <Link className="btn btn--ghost" to="/heroes">
            {t('hero.back')}
          </Link>
        </div>
      </section>
    )
  }

  const name = heroName(heroId) ?? String(heroId)
  const attributes = heroAttributes(heroId)
  const entry = heroStatsEntry(stats, heroId)
  const failed =
    statsState === 'error' ||
    matchupsState === 'error' ||
    abilitiesState === 'error' ||
    itemsState === 'error'

  return (
    <section className="page page--heroes" data-hero-id={heroId} lang={locale}>
      <header className="hero-profile__header">
        <HeroPortrait heroId={heroId} name={name} />
        <div className="hero-profile__meta">
          <Link className="hero-profile__back" to="/heroes">
            {t('hero.back')}
          </Link>
          <h1 className="page__title">{name}</h1>
          <p className="page__subtitle">
            <span
              className="hero-profile__tag"
              data-primary-attr={attributes?.primaryAttr ?? 'all'}
            >
              {t(PRIMARY_ATTRIBUTE_KEYS[attributes?.primaryAttr ?? 'all'])}
            </span>
            {attributes !== null && attributes.attackType !== null && (
              <span className="hero-profile__tag">{attributes.attackType}</span>
            )}
            {attributes !== null && attributes.roles.length > 0 && (
              <span className="hero-profile__tag">{attributes.roles.join(' · ')}</span>
            )}
          </p>
        </div>
      </header>

      {failed && (
        <div className="auth-alert" role="status">
          <p>{t('hero.stats.noPatch')}</p>
          <button className="btn btn--ghost" type="button" onClick={retry}>
            {t('hero.errors.retry')}
          </button>
        </div>
      )}

      <div className="hero-profile__grid">
        <HeroAttributesPanel attributes={attributes} />
        <HeroStatsPanel entry={entry} catalog={stats} state={statsState} />
      </div>

      <HeroMatchups heroId={heroId} rows={matchups} state={matchupsState} />

      <div className="hero-profile__grid">
        <HeroAbilitiesPanel data={abilities} state={abilitiesState} />
        <HeroPopularItemsPanel data={items} state={itemsState} />
      </div>
    </section>
  )
}

