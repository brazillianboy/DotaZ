import type { NormalizedMatch } from '../types/match'

/**
 * Автоматическая обработка реплея OpenDota (Task 14, часть 3).
 *
 * Модуль чистый и детерминированный: без HTTP, React, Supabase и глобального
 * состояния. Здесь собраны только правила принятия решений, проверка полноты
 * подробных данных, разбор ответов о задаче обработки и ограничения (лимиты
 * попыток, тайм-ауты, окно доступности реплея).
 *
 * Факты об API OpenDota подтверждены живой проверкой (30.10.2026):
 *  - `POST /api/request/{match_id}` → `200 {"job":{"jobId":<число>}}`, без ключа,
 *    CORS разрешён (заголовок `Access-Control-Allow-Origin` повторяет Origin);
 *  - `GET /api/request/{job_id}` → `200`, тело `null` для неизвестной/завершённой
 *    задачи (значение `null` не означает «данные готовы»);
 *  - анонимные лимиты видны в заголовках ответа: 60 запросов в минуту и 3000 в сутки.
 */

/** Базовый адрес endpoint запроса/статуса обработки реплея OpenDota. */
export const OPENDOTA_REQUEST_ENDPOINT = 'https://api.opendota.com/api/request'

/** Сколько дней OpenDota хранит реплеи (ответ мейнтейнера в odota/core#2275). */
export const REPLAY_RETENTION_DAYS = 10

/**
 * Окно, в котором запрос обработки вообще имеет смысл: реплей уже удалён после
 * `REPLAY_RETENTION_DAYS`, поэтому запросы по старым матчам не отправляются
 * вовсе — это экономит лимиты OpenDota и не создаёт заведомо бесполезных задач.
 */
export const REPLAY_REQUEST_WINDOW_DAYS = 14

/** Максимум запросов обработки на один матч (защита от дублирующих POST). */
export const PARSE_REQUEST_MAX_ATTEMPTS = 2

/** Время жизни записи о запущенной задаче: внутри него задача переиспользуется. */
export const PARSE_ATTEMPT_TTL_MS = 15 * 60 * 1000

/** Первая задержка опроса задачи (мс). */
export const PARSE_POLL_INITIAL_DELAY_MS = 4000

/** Максимальная задержка опроса задачи (мс) — потолок экспоненциального роста. */
export const PARSE_POLL_MAX_DELAY_MS = 15000

/** Максимум опросов статуса в одной сессии (жёсткая граница цикла). */
export const PARSE_POLL_MAX_ATTEMPTS = 8

/** Общий бюджет ожидания обработки в одной сессии (мс). */
export const PARSE_POLL_BUDGET_MS = 90000

/** Известные статусы задачи обработки реплея. */
export const PARSE_JOB_STATUSES = ['pending', 'in progress', 'completed', 'failed'] as const

export type ParseJobStatus = (typeof PARSE_JOB_STATUSES)[number]

/** Результат разбора ответа о задаче обработки. */
export type ParseJobReading =
  | { kind: 'pending'; status: ParseJobStatus }
  | { kind: 'completed' }
  | { kind: 'failed' }
  | { kind: 'missing' }
  | { kind: 'invalid' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Идентификатор задачи обработки из ответа `POST /api/request/{match_id}`.
 * Значение может прийти числом или строкой; сохраняется строкой без потери точности.
 */
export function readParseJobId(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null
  }
  const job = payload.job
  if (!isRecord(job)) {
    return null
  }
  const raw = job.jobId
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw > 0 ? String(raw) : null
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw) && !/^0+$/.test(raw)) {
    return raw
  }
  return null
}

/**
 * Разбор ответа `GET /api/request/{job_id}`.
 * `null` — задача не найдена (истёкший реплей, завершённая и удалённая задача):
 * это не подтверждение успеха, поэтому состояние отдельное (`missing`).
 */
export function readParseJob(payload: unknown): ParseJobReading {
  if (payload === null || payload === undefined) {
    return { kind: 'missing' }
  }
  if (!isRecord(payload)) {
    return { kind: 'invalid' }
  }
  const job = payload.job
  if (!isRecord(job)) {
    return { kind: 'invalid' }
  }
  const status = job.status
  if (typeof status !== 'string') {
    return { kind: 'invalid' }
  }
  if (status === 'completed') {
    return { kind: 'completed' }
  }
  if (status === 'failed') {
    return { kind: 'failed' }
  }
  const known = PARSE_JOB_STATUSES.find((item) => item === status)
  if (known === undefined) {
    return { kind: 'invalid' }
  }
  return { kind: 'pending', status: known }
}

/** Поля подробных данных, которые нужны анализу и секции предметов. */
export type DetailedDataField = 'purchase_log' | 'lane_timeline'

/** Итог проверки полноты подробных (replay-derived) данных. */
export interface DetailedDataInspection {
  /** Всего участников в нормализованном матче. */
  players: number
  /** Участники с подтверждённым журналом покупок за матч. */
  playersWithPurchaseLog: number
  /** Участники с подтверждёнными таймлайнами (`lh_t`, `gold_t`, `xp_t`, `kills_log`, `deaths_log`). */
  playersWithLaneTimeline: number
  /** Чего не хватает для полного анализа (пустой список — данные полные). */
  missing: DetailedDataField[]
  /** Все ли обязательные подробные поля подтверждены у всех участников. */
  detailed: boolean
}

/** Подтверждён ли таймлайн ранней стадии у конкретного участника. */
function hasLaneTimeline(player: NormalizedMatch['players'][number]): boolean {
  const { laning } = player
  return (
    laning.lastHits !== null &&
    laning.gold !== null &&
    laning.xp !== null &&
    laning.killsFirst !== null &&
    laning.deathsFirst !== null
  )
}

/**
 * Проверка полноты подробных данных матча.
 *
 * Непарсенные матчи OpenDota отдают только базовую статистику: таймлайны и
 * `purchase_log` отсутствуют. Такие поля нельзя подменить нулями, поэтому они
 * честно считаются отсутствующими — и именно это запускает автоматическую
 * обработку реплея.
 */
export function inspectDetailedData(match: NormalizedMatch): DetailedDataInspection {
  const players = match.players.length
  let playersWithPurchaseLog = 0
  let playersWithLaneTimeline = 0
  for (const player of match.players) {
    if (player.purchaseLog !== null) {
      playersWithPurchaseLog += 1
    }
    if (hasLaneTimeline(player)) {
      playersWithLaneTimeline += 1
    }
  }

  const missing: DetailedDataField[] = []
  if (players === 0 || playersWithPurchaseLog < players) {
    missing.push('purchase_log')
  }
  if (players === 0 || playersWithLaneTimeline < players) {
    missing.push('lane_timeline')
  }

  return {
    players,
    playersWithPurchaseLog,
    playersWithLaneTimeline,
    missing,
    detailed: missing.length === 0,
  }
}

/** Время начала матча (unix, секунды) из сырого ответа OpenDota. */
export function readMatchStartTime(raw: unknown): number | null {
  if (!isRecord(raw)) {
    return null
  }
  const value = raw.start_time
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

/**
 * Мог ли реплей уже исчезнуть у OpenDota.
 * `null` время начала → `false`: отсутствие данных не трактуется как отказ.
 */
export function isReplayLikelyExpired(
  startTimeSeconds: number | null,
  now: Date,
  windowDays: number = REPLAY_REQUEST_WINDOW_DAYS,
): boolean {
  if (startTimeSeconds === null) {
    return false
  }
  const ageMs = now.getTime() - startTimeSeconds * 1000
  return ageMs > windowDays * 24 * 60 * 60 * 1000
}

/** Задержка перед очередным опросом задачи: экспоненциальный рост с потолком. */
export function parsePollDelayMs(
  attempt: number,
  initialMs: number = PARSE_POLL_INITIAL_DELAY_MS,
  maxMs: number = PARSE_POLL_MAX_DELAY_MS,
): number {
  if (!Number.isFinite(attempt) || attempt < 1) {
    return initialMs
  }
  const delay = initialMs * 2 ** (attempt - 1)
  return Math.min(delay, maxMs)
}

/** Стоит ли продолжать опрос: ограничены и число попыток, и общий бюджет времени. */
export function shouldContinuePolling(params: {
  attempts: number
  elapsedMs: number
  maxAttempts?: number
  budgetMs?: number
}): boolean {
  const maxAttempts = params.maxAttempts ?? PARSE_POLL_MAX_ATTEMPTS
  const budgetMs = params.budgetMs ?? PARSE_POLL_BUDGET_MS
  return params.attempts < maxAttempts && params.elapsedMs < budgetMs
}

/**
 * Запись о запущенной задаче обработки.
 *
 * Хранится вне React-состояния (по умолчанию — в `localStorage`), поэтому
 * повторное открытие страницы переиспользует уже созданную задачу вместо
 * отправки нового запроса: дубликаты не создаются, а незавершённая обработка
 * может быть безопасно продолжена позже.
 */
export interface ParseAttemptRecord {
  matchId: string
  jobId: string
  /** Момент отправки последнего запроса обработки (мс, локальное время). */
  requestedAtMs: number
  /** Сколько запросов обработки уже отправлено по этому матчу. */
  requests: number
}

/** Минимальное хранилище записей о задачах обработки (в тестах — в памяти). */
export interface ParseAttemptStore {
  read(matchId: string): ParseAttemptRecord | null
  write(record: ParseAttemptRecord): void
  clear(matchId: string): void
}

/** Префикс ключа `localStorage` для записей о задачах обработки. */
export const PARSE_ATTEMPT_STORAGE_PREFIX = 'dotaz.parse.attempt.'

/** Хранилище записей в памяти (тесты и среда без `localStorage`). */
export function createMemoryParseAttemptStore(): ParseAttemptStore {
  const records = new Map<string, ParseAttemptRecord>()
  return {
    read(matchId) {
      const record = records.get(matchId)
      return record === undefined ? null : { ...record }
    },
    write(record) {
      records.set(record.matchId, { ...record })
    },
    clear(matchId) {
      records.delete(matchId)
    },
  }
}

function isParseAttemptRecord(value: unknown): value is ParseAttemptRecord {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.matchId === 'string' &&
    typeof value.jobId === 'string' &&
    typeof value.requestedAtMs === 'number' &&
    Number.isFinite(value.requestedAtMs) &&
    typeof value.requests === 'number' &&
    Number.isInteger(value.requests) &&
    value.requests >= 0
  )
}

/**
 * Хранилище записей в `localStorage`.
 * Любые ошибки доступа к хранилищу (приватный режим, квота, повреждённая запись)
 * приводят к работе без сохранения: это безопаснее, чем падение страницы.
 */
export function createBrowserParseAttemptStore(
  storage: Storage | null | undefined,
): ParseAttemptStore {
  if (storage === null || storage === undefined) {
    return createMemoryParseAttemptStore()
  }
  return {
    read(matchId) {
      try {
        const raw = storage.getItem(PARSE_ATTEMPT_STORAGE_PREFIX + matchId)
        if (raw === null) {
          return null
        }
        const parsed: unknown = JSON.parse(raw)
        return isParseAttemptRecord(parsed) && parsed.matchId === matchId ? parsed : null
      } catch {
        return null
      }
    },
    write(record) {
      try {
        storage.setItem(PARSE_ATTEMPT_STORAGE_PREFIX + record.matchId, JSON.stringify(record))
      } catch {
        // Сохранение недоступно — работа продолжается без записи.
      }
    },
    clear(matchId) {
      try {
        storage.removeItem(PARSE_ATTEMPT_STORAGE_PREFIX + matchId)
      } catch {
        // Удаление недоступно — запись просто останется до истечения срока.
      }
    },
  }
}

/** Актуальна ли запись: внутри срока жизни задача переиспользуется, а не создаётся заново. */
export function isAttemptActive(
  record: ParseAttemptRecord,
  nowMs: number,
  ttlMs: number = PARSE_ATTEMPT_TTL_MS,
): boolean {
  return nowMs - record.requestedAtMs < ttlMs
}

/** Решение о действии с обработкой реплея. */
export type ParseAction =
  | { kind: 'not-needed' }
  | { kind: 'replay-unavailable'; reason: 'expired' }
  | { kind: 'reuse-job'; jobId: string }
  | { kind: 'request'; requests: number }
  | { kind: 'give-up'; reason: 'attempts-exhausted' }

/**
 * Единое решение: нужна ли обработка реплея и допустима ли отправка запроса.
 *
 * Порядок проверок важен:
 *  1) подробные данные уже есть → ничего не делаем;
 *  2) реплей заведомо удалён (матч старше окна хранения) → запрос не отправляем;
 *  3) есть активная задача → переиспользуем её (дубликаты не создаются);
 *  4) исчерпан лимит запросов → новых запросов нет (честный статус «обработка
 *     не завершена», без бесконечного цикла).
 */
export function decideParseAction(params: {
  match: NormalizedMatch
  startTimeSeconds: number | null
  attempt: ParseAttemptRecord | null
  now: Date
  maxRequests?: number
  ttlMs?: number
}): ParseAction {
  if (inspectDetailedData(params.match).detailed) {
    return { kind: 'not-needed' }
  }
  if (isReplayLikelyExpired(params.startTimeSeconds, params.now)) {
    return { kind: 'replay-unavailable', reason: 'expired' }
  }

  const maxRequests = params.maxRequests ?? PARSE_REQUEST_MAX_ATTEMPTS
  const ttlMs = params.ttlMs ?? PARSE_ATTEMPT_TTL_MS
  const attempt = params.attempt
  if (attempt !== null && isAttemptActive(attempt, params.now.getTime(), ttlMs)) {
    return { kind: 'reuse-job', jobId: attempt.jobId }
  }
  if (attempt !== null && attempt.requests >= maxRequests) {
    return { kind: 'give-up', reason: 'attempts-exhausted' }
  }
  return { kind: 'request', requests: (attempt?.requests ?? 0) + 1 }
}
