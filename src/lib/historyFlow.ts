import {
  HISTORY_PAGE_SIZE,
  type HistoryReportItem,
  type HistoryReportsService,
  type HistorySortOrder,
} from './historyReports'
import type { ReportDbError } from './matchReports'

/**
 * Оркестрация личной истории анализов (Task 12).
 *
 * Задача слоя — отделить состояния страницы (ожидание сессии, гость, отсутствие
 * базы, список, ошибка) от React. Модуль не знает про OpenDota и не выполняет
 * записей: история только читается.
 */

/** Состояние аутентификации, влияющее на доступ к истории. */
export type HistoryAuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface HistoryFlowDeps {
  authStatus: HistoryAuthStatus
  /** ID пользователя из проверенной сессии Supabase; `null` для гостя. */
  userId: string | null
  /** Сервис истории; `null`, если Supabase не настроен. */
  service: HistoryReportsService | null
  /** Размер страницы (по умолчанию `HISTORY_PAGE_SIZE`). */
  pageSize?: number
  order?: HistorySortOrder
}

export type HistoryFlowResult =
  | { status: 'waiting-auth' }
  | { status: 'signed-out' }
  | { status: 'no-database'; message: string }
  | { status: 'error'; error: ReportDbError }
  | {
      status: 'list'
      items: HistoryReportItem[]
      /** true — вернулась полная страница: возможно, есть более ранние отчёты. */
      hasMore: boolean
      /** Сколько записей пропущено из-за непригодных метаданных. */
      skippedCount: number
      offset: number
    }

export const HISTORY_NO_DATABASE_MESSAGE =
  'История недоступна: подключение к Supabase не настроено (нет VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).'

/**
 * Можно ли открыть сохранённый отчёт этого элемента.
 *
 * `ready` и `partial` — готовые отчёты (страница матча покажет сохранённый снимок).
 * `pending` и `error` открывать нельзя: такой отчёт ещё не сформирован, и страница
 * матча честно сообщит о незавершённой записи вместо анализа.
 */
export function isOpenableHistoryItem(item: HistoryReportItem): boolean {
  return item.status === 'ready' || item.status === 'partial'
}

/**
 * Загрузка одной страницы истории.
 *
 * Чтение ограничено текущим пользователем (фильтр по `user_id` + серверные RLS),
 * никаких записей не выполняется, OpenDota не используется вовсе.
 * `hasMore` означает «получена полная страница», то есть список **не** выдаётся за
 * полный: интерфейс обязан предложить догрузку более ранних отчётов.
 */
export async function loadHistoryPage(
  deps: HistoryFlowDeps,
  offset = 0,
): Promise<HistoryFlowResult> {
  if (deps.authStatus === 'loading') {
    return { status: 'waiting-auth' }
  }
  if (deps.authStatus !== 'authenticated' || deps.userId === null) {
    return { status: 'signed-out' }
  }
  if (deps.service === null) {
    return { status: 'no-database', message: HISTORY_NO_DATABASE_MESSAGE }
  }

  const pageSize = deps.pageSize ?? HISTORY_PAGE_SIZE
  const result = await deps.service.listPersonalMatchReports({
    userId: deps.userId,
    limit: pageSize,
    offset,
    order: deps.order ?? 'newest',
  })
  if (!result.ok) {
    return { status: 'error', error: result.error }
  }

  return {
    status: 'list',
    items: result.items,
    hasMore: result.items.length === pageSize,
    skippedCount: result.skippedCount,
    offset,
  }
}
