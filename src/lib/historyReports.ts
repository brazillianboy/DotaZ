import type { MatchReportStatus, ReportDbError } from './matchReports'

/**
 * Личная история анализов (Task 12): типы строки списка, строгая валидация
 * метаданных, устойчивая сортировка, сервис чтения только своих отчётов и
 * защита от устаревших ответов.
 *
 * Принципы:
 *  - читаются только метаданные карточки: тяжёлые JSONB-payload в список не тянутся;
 *  - все запросы ограничены текущим пользователем (владелец берётся из сессии);
 *  - ID матча остаётся точной строкой;
 *  - повреждённые метаданные не роняют страницу: запись пропускается и учитывается;
 *  - история только читается: никаких записей, пересчётов и перезаписи отчётов.
 */

/** Размер страницы истории. Небольшой и детерминированный: список грузится порциями. */
export const HISTORY_PAGE_SIZE = 20

/** Порядок сортировки истории: по умолчанию — новые отчёты первыми. */
export type HistorySortOrder = 'newest' | 'oldest'

/** Максимальный размер страницы, который допускается запрашивать. */
export const HISTORY_MAX_PAGE_SIZE = 100

/** Элемент истории: только данные, необходимые карточке списка. */
export interface HistoryReportItem {
  /** Внутренний идентификатор строки (не показывается как основной идентификатор). */
  id: string
  /** Владелец строки; используется для проверки принадлежности и не отображается. */
  userId: string
  /** ID матча — точная строка. */
  matchId: string
  status: MatchReportStatus
  source: string
  rulesVersion: string | null
  /** Дата сохранения отчёта; `null`, если значение отсутствует или некорректно. */
  createdAt: string | null
  /** Фактическое время получения данных OpenDota; `null`, если не зафиксировано. */
  fetchedAt: string | null
  /** Результат матча из сохранённого снимка; `null` — данных нет (не выдумывается). */
  radiantWin: boolean | null
}

export type HistoryRowParseResult =
  | { ok: true; item: HistoryReportItem }
  | { ok: false; reason: 'invalid_row'; message: string }

/** Сообщение о строке с непригодными метаданными. */
export const INVALID_HISTORY_ROW_MESSAGE =
  'Запись истории имеет неожиданный формат и была пропущена.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNullableString(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined) {
    return { ok: true, value: null }
  }
  return typeof value === 'string' ? { ok: true, value } : { ok: false }
}

/**
 * Результат матча из снимка.
 *
 * Значение может прийти как boolean (JSON) или как строка `'true'`/`'false'`
 * (если колонка выбрана через JSON-путь PostgREST). Любое другое значение —
 * «нет данных»; результат никогда не выводится из статистики игроков.
 */
export function parseRadiantWin(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') {
      return true
    }
    if (normalized === 'false') {
      return false
    }
  }
  return null
}

const REPORT_STATUSES: readonly MatchReportStatus[] = ['pending', 'ready', 'partial', 'error']

/** Строгая проверка метаданных строки истории перед отображением. */
export function parseHistoryRow(row: unknown): HistoryRowParseResult {
  if (!isRecord(row)) {
    return { ok: false, reason: 'invalid_row', message: INVALID_HISTORY_ROW_MESSAGE }
  }

  const id = asNonEmptyString(row.id)
  const userId = asNonEmptyString(row.user_id)
  const matchId = asNonEmptyString(row.match_id)
  const source = asNonEmptyString(row.source)
  const status = row.status
  const rulesVersion = asNullableString(row.rules_version)
  const createdAt = asNullableString(row.created_at)
  const fetchedAt = asNullableString(row.fetched_at)

  if (
    id === null ||
    userId === null ||
    matchId === null ||
    source === null ||
    typeof status !== 'string' ||
    !REPORT_STATUSES.includes(status as MatchReportStatus) ||
    !rulesVersion.ok ||
    !createdAt.ok ||
    !fetchedAt.ok
  ) {
    return { ok: false, reason: 'invalid_row', message: INVALID_HISTORY_ROW_MESSAGE }
  }

  if (!/^\d+$/.test(matchId)) {
    return { ok: false, reason: 'invalid_row', message: INVALID_HISTORY_ROW_MESSAGE }
  }

  return {
    ok: true,
    item: {
      id,
      userId,
      matchId,
      status: status as MatchReportStatus,
      source,
      rulesVersion: rulesVersion.value,
      createdAt: createdAt.value,
      fetchedAt: fetchedAt.value,
      radiantWin: parseRadiantWin(row.radiant_win),
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Сортировка и представление                                                   */
/* -------------------------------------------------------------------------- */

/** Время сохранения в миллисекундах; `null`, если дата отсутствует или некорректна. */
export function historyTimestamp(item: HistoryReportItem): number | null {
  if (item.createdAt === null) {
    return null
  }
  const parsed = Date.parse(item.createdAt)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Устойчивая сортировка: новые отчёты первыми (`created_at` DESC), при равных
 * отметках — по `id` по убыванию, чтобы порядок был детерминированным.
 * Записи без корректной даты всегда идут после записей с датой.
 */
export function compareHistoryItems(a: HistoryReportItem, b: HistoryReportItem): number {
  const aTime = historyTimestamp(a)
  const bTime = historyTimestamp(b)
  if (aTime !== null && bTime !== null && aTime !== bTime) {
    return bTime - aTime
  }
  if (aTime !== null && bTime === null) {
    return -1
  }
  if (aTime === null && bTime !== null) {
    return 1
  }
  if (a.id === b.id) {
    return 0
  }
  return a.id < b.id ? 1 : -1
}

/** Сортировка копии списка; входной массив не изменяется. */
export function sortHistoryItems(
  items: readonly HistoryReportItem[],
  order: HistorySortOrder = 'newest',
): HistoryReportItem[] {
  const sorted = [...items].sort(compareHistoryItems)
  return order === 'newest' ? sorted : sorted.reverse()
}

/** Дата в UTC без зависимости от локали браузера. */
export function formatHistoryTimestamp(value: string | null): string | null {
  if (value === null) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return `${parsed.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/* -------------------------------------------------------------------------- */
/* Защита от устаревших ответов                                                 */
/* -------------------------------------------------------------------------- */

export interface RequestGuard {
  /** Начинает новый запрос и делает все предыдущие устаревшими. */
  begin(): number
  /** Актуален ли ответ с указанным токеном. */
  isCurrent(token: number): boolean
  /** Инвалидирует текущие запросы (смена аккаунта, выход, размонтирование). */
  invalidate(): void
}

/**
 * Токен-генерация запросов: ответ применяется только если он относится к
 * последнему запущенному запросу. Это защищает от показа истории прошлого
 * аккаунта и от «догоняющих» ответов после повторной попытки.
 */
export function createRequestGuard(): RequestGuard {
  let current = 0
  return {
    begin() {
      current += 1
      return current
    },
    isCurrent(token: number) {
      return token === current
    },
    invalidate() {
      current += 1
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Сервис истории                                                               */
/* -------------------------------------------------------------------------- */

/** Клиент списка отчётов (реализуется адаптером Supabase; в тестах подменяется). */
export interface MatchReportsListClient {
  selectPersonalReportList(params: {
    userId: string
    limit: number
    offset: number
  }): Promise<{ data: unknown; error: ReportDbError | null }>
}

export type HistoryListResult =
  | { ok: true; items: HistoryReportItem[]; skippedCount: number }
  | { ok: false; error: ReportDbError }

export interface HistoryReportsService {
  listPersonalMatchReports(params: {
    userId: string
    limit?: number
    offset?: number
    order?: HistorySortOrder
  }): Promise<HistoryListResult>
}

/** Нормализация параметров страницы: защита от некорректных значений. */
function normalizePageParams(params: { limit?: number; offset?: number }): {
  limit: number
  offset: number
} {
  const rawLimit = params.limit ?? HISTORY_PAGE_SIZE
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, HISTORY_MAX_PAGE_SIZE)
      : HISTORY_PAGE_SIZE
  const rawOffset = params.offset ?? 0
  const offset = Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0
  return { limit, offset }
}

/**
 * Сервис истории: чтение только собственных строк и устойчивость к повреждённым
 * метаданным. Записи с чужим `user_id` (если такие попадут в выборку) пропускаются
 * и учитываются в `skippedCount`, чтобы интерфейс мог честно сообщить о пропуске.
 */
export function createHistoryReportsService(client: MatchReportsListClient): HistoryReportsService {
  return {
    async listPersonalMatchReports({
      userId,
      limit,
      offset,
      order = 'newest',
    }): Promise<HistoryListResult> {
      const page = normalizePageParams({ limit, offset })
      const { data, error } = await client.selectPersonalReportList({
        userId,
        limit: page.limit,
        offset: page.offset,
      })
      if (error) {
        return { ok: false, error }
      }
      if (!Array.isArray(data)) {
        return {
          ok: false,
          error: {
            kind: 'invalid_payload',
            code: null,
            message: 'База данных вернула неожиданный формат списка отчётов.',
          },
        }
      }

      const items: HistoryReportItem[] = []
      let skippedCount = 0
      for (const row of data) {
        const parsed = parseHistoryRow(row)
        if (!parsed.ok || parsed.item.userId !== userId) {
          skippedCount += 1
          continue
        }
        items.push(parsed.item)
      }

      // Сортировка выполняется в базе; здесь лишь упорядочиваются записи с
      // одинаковыми отметками времени внутри уже полученной страницы.
      return { ok: true, items: sortHistoryItems(items, order), skippedCount }
    },
  }
}
