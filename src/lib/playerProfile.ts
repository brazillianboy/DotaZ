import type { OpenDotaError } from './opendota'
import type { MatchFeedResult, OpenDotaPlayerService, SectionResult } from './opendotaPlayer'
import {
  HEATMAP_HISTORY_WINDOW_DAYS,
  buildLaneDistribution,
  type LaneDistribution,
  type PlayerHeroStat,
  type PlayerRecord,
  type RecentMatch,
} from './playerStats'

/**
 * Оркестрация данных личного профиля (Task 20B).
 *
 * Слой отвечает за то, что легко проверить без React:
 *  - один запрос на секцию, все пять — параллельно, но с независимым результатом;
 *  - частичный успех: если одна секция упала, остальные показываются, а ошибка
 *    привязывается именно к своей секции;
 *  - кэш в памяти на короткий TTL (повторный вход на страницу не дублирует запросы);
 *  - защита от устаревших ответов: каждый вызов `load` получает токен, и ответ
 *    прошлого аккаунта не может быть применён к текущему.
 *
 * Секретов и приватных данных здесь нет: OpenDota отдаёт публичную статистику,
 * а сохранённые отчёты DotaZ читаются отдельно под RLS Supabase.
 */

/** Время жизни кэша ответов профиля. */
export const PLAYER_PROFILE_CACHE_TTL_MS = 60_000

/** Секции профиля, у которых может быть своя ошибка. */
export type PlayerSectionKey = 'record' | 'recent' | 'heroes' | 'lanes' | 'history'

export type PlayerSectionErrors = Partial<Record<PlayerSectionKey, OpenDotaError>>

/** Проверенные данные профиля. `null` в поле — «недоступно», а не ноль. */
export interface PlayerProfileData {
  accountId: number
  record: PlayerRecord | null
  recentMatches: RecentMatch[] | null
  /** Сколько записей последних матчей пропущено из-за неполных полей. */
  recentSkipped: number
  heroes: PlayerHeroStat[] | null
  lanes: LaneDistribution | null
  history: MatchFeedResult | null
  errors: PlayerSectionErrors
  /** Момент получения данных, ISO-8601 (UTC). */
  fetchedAt: string
}

export type PlayerProfileLoadResult =
  | { status: 'ok'; data: PlayerProfileData; fromCache: boolean }
  | { status: 'unavailable'; errors: PlayerSectionErrors }
  | { status: 'invalid-account' }
  | { status: 'aborted' }
  | { status: 'stale' }

export interface PlayerProfileLoadOptions {
  signal?: AbortSignal
  /** true — игнорировать кэш (кнопка «Повторить»). */
  force?: boolean
}

export interface PlayerProfileLoaderOptions {
  /** Источник текущего времени (подменяется в тестах). */
  now?: () => number
  /** TTL кэша в миллисекундах. */
  cacheTtlMs?: number
}

export interface PlayerProfileLoader {
  load(accountId: number, options?: PlayerProfileLoadOptions): Promise<PlayerProfileLoadResult>
}

/** Набор результатов пяти запросов. */
interface SectionResults {
  record: SectionResult<PlayerRecord>
  recent: SectionResult<{ matches: RecentMatch[]; skipped: number }>
  heroes: SectionResult<PlayerHeroStat[]>
  lanes: SectionResult<Map<number, { games: number; wins: number }>>
  history: SectionResult<MatchFeedResult>
}

function collectErrors(results: SectionResults): PlayerSectionErrors {
  const errors: PlayerSectionErrors = {}
  if (!results.record.ok) errors.record = results.record.error
  if (!results.recent.ok) errors.recent = results.recent.error
  if (!results.heroes.ok) errors.heroes = results.heroes.error
  if (!results.lanes.ok) errors.lanes = results.lanes.error
  if (!results.history.ok) errors.history = results.history.error
  return errors
}

/**
 * Загрузчик профиля. Один экземпляр на страницу: кэш и токен устаревания живут
 * вместе с ним и не разделяются между пользователями.
 */
export function createPlayerProfileLoader(
  service: OpenDotaPlayerService,
  options: PlayerProfileLoaderOptions = {},
): PlayerProfileLoader {
  const nowMs = options.now ?? (() => Date.now())
  const cacheTtlMs = options.cacheTtlMs ?? PLAYER_PROFILE_CACHE_TTL_MS
  const cache = new Map<number, { at: number; data: PlayerProfileData }>()
  let current = 0

  return {
    async load(accountId, loadOptions = {}) {
      if (!Number.isInteger(accountId) || accountId < 0) {
        return { status: 'invalid-account' }
      }
      const token = current + 1
      current = token
      const signal = loadOptions.signal
      if (signal?.aborted) {
        return { status: 'aborted' }
      }

      if (loadOptions.force !== true) {
        const cached = cache.get(accountId)
        const at = nowMs()
        if (cached !== undefined && at - cached.at < cacheTtlMs) {
          return { status: 'ok', data: cached.data, fromCache: true }
        }
      }

      const [recordResult, recentResult, heroesResult, lanesResult, historyResult] = await Promise.all([
        service.fetchRecord(accountId, signal),
        service.fetchRecentMatches(accountId, signal),
        service.fetchHeroStats(accountId, signal),
        service.fetchLaneCounts(accountId, signal),
        service.fetchMatchesWindow(accountId, { daysBack: HEATMAP_HISTORY_WINDOW_DAYS, signal }),
      ])

      // Ответ устарел: пользователь сменился, страница ушла или запрос отменён.
      if (token !== current) {
        return { status: 'stale' }
      }
      if (signal?.aborted) {
        return { status: 'aborted' }
      }

      const results: SectionResults = {
        record: recordResult,
        recent: recentResult,
        heroes: heroesResult,
        lanes: lanesResult,
        history: historyResult,
      }
      const errors = collectErrors(results)
      const anyOk =
        recordResult.ok || recentResult.ok || heroesResult.ok || lanesResult.ok || historyResult.ok

      if (!anyOk) {
        const aborted = Object.values(errors).some((error) => error?.kind === 'aborted')
        return aborted ? { status: 'aborted' } : { status: 'unavailable', errors }
      }

      const at = nowMs()
      const recentMatches = recentResult.ok ? recentResult.value.matches : null
      const skipped = recentResult.ok ? recentResult.value.skipped : 0
      const record = recordResult.ok ? recordResult.value : null

      const data: PlayerProfileData = {
        accountId,
        record,
        recentMatches,
        recentSkipped: skipped,
        heroes: heroesResult.ok ? heroesResult.value : null,
        lanes: lanesResult.ok ? buildLaneDistribution(lanesResult.value, record?.total ?? null) : null,
        history: historyResult.ok ? historyResult.value : null,
        errors,
        fetchedAt: new Date(at).toISOString(),
      }

      cache.set(accountId, { at, data })
      return { status: 'ok', data, fromCache: false }
    },
  }
}
