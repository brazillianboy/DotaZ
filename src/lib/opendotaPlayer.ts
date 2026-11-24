import { isLaneRole, type LaneRole } from './benchmarks'
import { OPENDOTA_REQUEST_TIMEOUT_MS, type OpenDotaError } from './opendota'
import {
  computeWinRate,
  MATCHES_MAX_PAGES,
  MATCHES_MAX_RECORDS,
  MATCHES_PAGE_LIMIT,
  matchOutcome,
  RECENT_MATCHES_SAMPLE_LIMIT,
  type PlayerHeroStat,
  type PlayerRecord,
  type RecentMatch,
} from './playerStats'
import { DOTA_ACCOUNT_ID_MAX } from './steam/steamId'

/**
 * Публичные данные игрока OpenDota для личного профиля (Task 20B).
 *
 * Это **не второй API-клиент**: HTTP-запрос выполняет один небольшой хелпер на
 * нативном `fetch`, а таксономия ошибок (`OpenDotaError`) и таймаут взяты из
 * Task 5 (`src/lib/opendota.ts`). Отличие только в формулировках: здесь речь об
 * игроке, а не о матче.
 *
 * Используются четыре документированных ресурса:
 *  - `GET /players/{account_id}/wl` — итог побед/поражений;
 *  - `GET /players/{account_id}/recentMatches` — до 20 последних матчей;
 *  - `GET /players/{account_id}/heroes` — агрегат по героям;
 *  - `GET /players/{account_id}/counts` — агрегат по линиям (`lane_role`).
 *
 * Ответы проверяются защитно: неизвестные и повреждённые значения не превращаются
 * в нули, а отбрасываются. Ключи API (`win`, `lose`, `lane_role`) не переводятся.
 */

/** Базовый адрес OpenDota API. */
export const OPENDOTA_API_BASE = 'https://api.opendota.com/api'

/** Результат одной секции: успех либо локализуемая ошибка. */
export type SectionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: OpenDotaError }

/** Последние матчи: сколько записей оказались непригодными. */
export interface RecentMatchesSection {
  matches: RecentMatch[]
  /** Количество пропущенных записей (неполные или некорректные поля). */
  skipped: number
}

/** Агрегат `counts` → `lane_role` в виде карты «роль → игры/победы». */
export type LaneCounts = Map<number, { games: number; wins: number }>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

/**
 * `GET /players/{id}/wl` → подтверждённый итог.
 * `{win: 0, lose: 0}` — валидный ответ «подтверждённых матчей нет», а не ошибка.
 */
export function parsePlayerRecord(json: unknown): PlayerRecord | null {
  if (!isRecord(json)) {
    return null
  }
  const wins = nonNegativeInteger(json.win)
  const losses = nonNegativeInteger(json.lose)
  if (wins === null || losses === null) {
    return null
  }
  return {
    wins,
    losses,
    total: wins + losses,
    winRatePercent: computeWinRate(wins, losses),
  }
}

function laneRoleOrNull(value: unknown): LaneRole | null {
  return isLaneRole(value) ? value : null
}

/**
 * `GET /players/{id}/recentMatches` → список матчей.
 *
 * Записи без `match_id` или `start_time` пропускаются: такой матч нельзя ни
 * показать, ни отнести к периоду. Остальные поля необязательны и остаются `null`.
 * Порядок — по времени начала по убыванию, независимо от порядка ответа.
 */
export function parseRecentMatches(json: unknown): RecentMatchesSection | null {
  if (!Array.isArray(json)) {
    return null
  }
  const matches: RecentMatch[] = []
  let skipped = 0
  for (const raw of json) {
    if (!isRecord(raw)) {
      skipped += 1
      continue
    }
    const matchId = positiveInteger(raw.match_id)
    const heroId = positiveInteger(raw.hero_id)
    const startTime = positiveInteger(raw.start_time)
    if (matchId === null || heroId === null || startTime === null) {
      skipped += 1
      continue
    }
    const duration = nonNegativeInteger(raw.duration)
    matches.push({
      matchId: String(matchId),
      heroId,
      outcome: matchOutcome(raw.radiant_win, raw.player_slot),
      kills: nonNegativeInteger(raw.kills),
      deaths: nonNegativeInteger(raw.deaths),
      assists: nonNegativeInteger(raw.assists),
      durationSeconds: duration,
      startTime: new Date(startTime * 1000).toISOString(),
      laneRole: laneRoleOrNull(raw.lane_role),
    })
  }
  matches.sort((a, b) => {
    const left = a.startTime === null ? 0 : Date.parse(a.startTime)
    const right = b.startTime === null ? 0 : Date.parse(b.startTime)
    return right - left
  })
  return { matches, skipped }
}

/**
 * `GET /players/{id}/heroes` → агрегат по героям за всё время.
 *
 * Принимаются только записи с `games > 0` и согласованными `win ≤ games`:
 * «герой с 0 матчей» не даёт статистики и в профиль не попадает.
 */
export function parseHeroStats(json: unknown): PlayerHeroStat[] | null {
  if (!Array.isArray(json)) {
    return null
  }
  const stats: PlayerHeroStat[] = []
  for (const raw of json) {
    if (!isRecord(raw)) {
      continue
    }
    const heroId = positiveInteger(raw.hero_id)
    const games = nonNegativeInteger(raw.games)
    const wins = nonNegativeInteger(raw.win)
    if (heroId === null || games === null || wins === null) {
      continue
    }
    if (games <= 0 || wins > games) {
      continue
    }
    stats.push({
      heroId,
      games,
      wins,
      winRatePercent: computeWinRate(wins, games - wins),
    })
  }
  return stats
}

/**
 * `GET /players/{id}/counts` → бакеты `lane_role`.
 *
 * Ответ — объект с несколькими независимыми разрезами (`game_mode`, `region`,
 * `lane_role` и др.). Читается только `lane_role`; ключи проверяются как целые
 * неотрицательные числа, значения — как `{games, win}` с `win ≤ games`.
 */
export function parseLaneCounts(json: unknown): LaneCounts | null {
  if (!isRecord(json)) {
    return null
  }
  const laneRole = json.lane_role
  if (!isRecord(laneRole)) {
    return null
  }
  const counts: LaneCounts = new Map()
  for (const [key, value] of Object.entries(laneRole)) {
    const role = Number(key)
    if (!Number.isInteger(role) || role < 0) {
      continue
    }
    if (!isRecord(value)) {
      continue
    }
    const games = nonNegativeInteger(value.games)
    const wins = nonNegativeInteger(value.win)
    if (games === null || wins === null || wins > games) {
      continue
    }
    counts.set(role, { games, wins })
  }
  return counts
}

/** Сообщения об ошибке для ресурсов игрока (без технических деталей и секретов). */
function playerErrorFromStatus(status: number): OpenDotaError {
  if (status === 404) {
    return {
      kind: 'not_found',
      status,
      message: 'OpenDota не нашёл игрока по этому account ID.',
    }
  }
  if (status === 401 || status === 403) {
    return {
      kind: 'forbidden',
      status,
      message: 'OpenDota не отдаёт данные этого игрока (закрытый профиль или ограничение доступа).',
    }
  }
  if (status === 429) {
    return {
      kind: 'rate_limited',
      status,
      message: 'Слишком много запросов к OpenDota. Подождите минуту и повторите.',
    }
  }
  if (status >= 500 && status <= 599) {
    return {
      kind: 'server_error',
      status,
      message: 'Сервис OpenDota временно недоступен (ошибка сервера). Попробуйте позже.',
    }
  }
  return {
    kind: 'unexpected_status',
    status,
    message: 'OpenDota вернул неожиданный ответ (HTTP ' + status + '). Повторите позже.',
  }
}

const INVALID_PLAYER_RESPONSE =
  'Ответ OpenDota не содержит ожидаемых полей игрока — данные не подтверждены.'

/**
 * GET JSON у OpenDota с таймаутом и внешней отменой (базовый хелпер).
 *
 * Правила те же, что в Task 5: 15 секунд на ответ, отмена при уходе со страницы
 * или смене аккаунта, различимые сетевые ошибки/таймаут/лимиты. Секретов здесь
 * нет; необязательный `api_key` не добавляется — профиль обходится публичными
 * запросами.
 */
async function getOpenDotaJson(
  url: string,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch | null,
): Promise<SectionResult<unknown>> {
  if (fetchImpl === null) {
    return {
      ok: false,
      error: { kind: 'network', message: 'Сеть недоступна: браузер не предоставляет fetch.' },
    }
  }
  if (signal?.aborted) {
    return { ok: false, error: { kind: 'aborted', message: 'Запрос отменён.' } }
  }

  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, OPENDOTA_REQUEST_TIMEOUT_MS)
  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort)

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      return { ok: false, error: playerErrorFromStatus(response.status) }
    }
    try {
      return { ok: true, value: (await response.json()) as unknown }
    } catch {
      return {
        ok: false,
        error: { kind: 'invalid_response', status: response.status, message: INVALID_PLAYER_RESPONSE },
      }
    }
  } catch {
    if (timedOut) {
      return {
        ok: false,
        error: {
          kind: 'timeout',
          message: 'Истекло время ожидания ответа OpenDota (15 секунд). Повторите попытку.',
        },
      }
    }
    if (signal?.aborted) {
      return { ok: false, error: { kind: 'aborted', message: 'Запрос отменён.' } }
    }
    return {
      ok: false,
      error: {
        kind: 'network',
        message: 'Сеть недоступна или OpenDota не отвечает. Проверьте подключение и повторите.',
      },
    }
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

/** GET `/players/{account_id}/{resource}` с проверкой account_id. */
function requestPlayerJson(
  resource: string,
  accountId: number,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch | null,
): Promise<SectionResult<unknown>> {
  if (!Number.isInteger(accountId) || accountId < 0 || accountId > DOTA_ACCOUNT_ID_MAX) {
    return Promise.resolve({
      ok: false,
      error: { kind: 'invalid_response', message: 'Некорректный account ID — запрос не выполняется.' },
    })
  }
  return getOpenDotaJson(`${OPENDOTA_API_BASE}/players/${accountId}/${resource}`, signal, fetchImpl)
}

/** Формат ответа `GET /players/{account_id}/matches` для календаря. */
export interface PlayerMatchFeedItem {
  matchId: string
  startTime: string | null
}

/**
 * Разбор страницы `GET /players/{id}/matches`.
 *
 * Для календаря нужны только `match_id` (для дедупликации) и `start_time`.
 * Записи без обоих полей пропускаются; возвращается массив в порядке ответа
 * (сортировку по времени делает вызывающая сторона).
 */
export function parsePlayerMatchFeed(json: unknown): PlayerMatchFeedItem[] | null {
  if (!Array.isArray(json)) {
    return null
  }
  const items: PlayerMatchFeedItem[] = []
  for (const raw of json) {
    if (!isRecord(raw)) {
      continue
    }
    const matchId = positiveInteger(raw.match_id)
    const startTime = positiveInteger(raw.start_time)
    if (matchId === null || startTime === null) {
      continue
    }
    items.push({ matchId: String(matchId), startTime: new Date(startTime * 1000).toISOString() })
  }
  return items
}

/** Агрегированная история матчей окна с честным признаком полноты. */
export interface MatchFeedResult {
  items: PlayerMatchFeedItem[]
  /** true — пагинация оборвана по лимиту, историю не исчерпали. */
  truncated: boolean
  /** Старейший полученный матч (ISO); `null`, если матчей нет. */
  oldestMatchTime: string | null
}

/** Набор запросов профиля игрока; в тестах подменяется фейковым `fetch`. */
export interface OpenDotaPlayerService {
  fetchRecord(accountId: number, signal?: AbortSignal): Promise<SectionResult<PlayerRecord>>
  fetchRecentMatches(accountId: number, signal?: AbortSignal): Promise<SectionResult<RecentMatchesSection>>
  fetchHeroStats(accountId: number, signal?: AbortSignal): Promise<SectionResult<PlayerHeroStat[]>>
  fetchLaneCounts(accountId: number, signal?: AbortSignal): Promise<SectionResult<LaneCounts>>
  /** История матчей за окно (для ежедневного календаря), с пагинацией и дедупликацией. */
  fetchMatchesWindow(
    accountId: number,
    options: { daysBack: number; signal?: AbortSignal },
  ): Promise<SectionResult<MatchFeedResult>>
}

function invalid(message: string = INVALID_PLAYER_RESPONSE): { ok: false; error: OpenDotaError } {
  return { ok: false, error: { kind: 'invalid_response', message } }
}

/** Короткая пауза для обработки rate-limit (429). */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Загружает историю матчей окна `daysBack` суток через `GET /players/{id}/matches`.
 *
 * Пагинация ограничена (`MATCHES_MAX_PAGES` / `MATCHES_MAX_RECORDS`), запросы идут
 * последовательно (offset), дубликаты по `match_id` отбрасываются. Единственный
 * повтор — при HTTP 429 (rate limit), с короткой паузой. При обрыве пагинации
 * возвращается `truncated: true`, чтобы интерфейс честно показал неполноту.
 */
async function loadPlayerMatchesWindow(
  accountId: number,
  daysBack: number,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch | null,
): Promise<SectionResult<MatchFeedResult>> {
  if (!Number.isInteger(accountId) || accountId < 0 || accountId > DOTA_ACCOUNT_ID_MAX) {
    return { ok: false, error: { kind: 'invalid_response', message: 'Некорректный account ID — запрос не выполняется.' } }
  }
  const days = Number.isInteger(daysBack) && daysBack > 0 ? daysBack : 90
  const items: PlayerMatchFeedItem[] = []
  const seen = new Set<string>()
  let truncated = false
  let page = 0

  for (; page < MATCHES_MAX_PAGES; page += 1) {
    if (signal?.aborted) {
      return { ok: false, error: { kind: 'aborted', message: 'Запрос отменён.' } }
    }
    const offset = page * MATCHES_PAGE_LIMIT
    const url = `${OPENDOTA_API_BASE}/players/${accountId}/matches?limit=${MATCHES_PAGE_LIMIT}&offset=${offset}&date=${days}`
    let response = await getOpenDotaJson(url, signal, fetchImpl)
    if (!response.ok && response.error.kind === 'rate_limited') {
      await delay(1200)
      if (signal?.aborted) {
        return { ok: false, error: { kind: 'aborted', message: 'Запрос отменён.' } }
      }
      response = await getOpenDotaJson(url, signal, fetchImpl)
    }
    if (!response.ok) {
      return response
    }
    const pageItems = parsePlayerMatchFeed(response.value)
    if (pageItems === null) {
      return invalid()
    }

    let added = 0
    for (const item of pageItems) {
      if (seen.has(item.matchId)) {
        continue
      }
      seen.add(item.matchId)
      items.push(item)
      added += 1
    }

    // История исчерпана: пришла неполная страница или только дубли.
    if (pageItems.length < MATCHES_PAGE_LIMIT || added === 0) {
      break
    }
    if (items.length >= MATCHES_MAX_RECORDS) {
      truncated = true
      break
    }
  }
  if (page >= MATCHES_MAX_PAGES) {
    truncated = true
  }

  let oldest: number | null = null
  for (const item of items) {
    if (item.startTime === null) {
      continue
    }
    const time = Date.parse(item.startTime)
    if (Number.isFinite(time) && (oldest === null || time < oldest)) {
      oldest = time
    }
  }

  return {
    ok: true,
    value: {
      items,
      truncated,
      oldestMatchTime: oldest === null ? null : new Date(oldest).toISOString(),
    },
  }
}

/**
 * Фабрика сервиса профиля. Запросы не кэшируются здесь: повторное использование
 * ответов — задача оркестратора (`playerProfile.ts`), чтобы кэш был один.
 */
export function createOpenDotaPlayerService(fetchImpl?: typeof fetch): OpenDotaPlayerService {
  const resolveFetch = (): typeof fetch | null =>
    fetchImpl ?? (typeof fetch === 'function' ? fetch : null)
  /** Максимум матчей, который отдаёт `recentMatches`; зашито в контракт OpenDota. */
  const recentLimit = RECENT_MATCHES_SAMPLE_LIMIT

  return {
    async fetchRecord(accountId, signal) {
      const response = await requestPlayerJson('wl', accountId, signal, resolveFetch())
      if (!response.ok) {
        return response
      }
      const record = parsePlayerRecord(response.value)
      return record === null ? invalid() : { ok: true, value: record }
    },

    async fetchRecentMatches(accountId, signal) {
      const response = await requestPlayerJson('recentMatches', accountId, signal, resolveFetch())
      if (!response.ok) {
        return response
      }
      const section = parseRecentMatches(response.value)
      if (section === null) {
        return invalid()
      }
      // Защита от неожиданно длинного ответа: контракт — не больше 20 матчей.
      if (section.matches.length > recentLimit) {
        return { ok: true, value: { ...section, matches: section.matches.slice(0, recentLimit) } }
      }
      return { ok: true, value: section }
    },

    async fetchHeroStats(accountId, signal) {
      const response = await requestPlayerJson('heroes', accountId, signal, resolveFetch())
      if (!response.ok) {
        return response
      }
      const stats = parseHeroStats(response.value)
      return stats === null ? invalid() : { ok: true, value: stats }
    },

    async fetchLaneCounts(accountId, signal) {
      const response = await requestPlayerJson('counts', accountId, signal, resolveFetch())
      if (!response.ok) {
        return response
      }
      const counts = parseLaneCounts(response.value)
      return counts === null ? invalid() : { ok: true, value: counts }
    },

    async fetchMatchesWindow(accountId, { daysBack, signal }) {
      return loadPlayerMatchesWindow(accountId, daysBack, signal, resolveFetch())
    },
  }
}

