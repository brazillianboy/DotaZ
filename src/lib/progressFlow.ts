import { parseStoredMatchReport, type ReportDbError } from './matchReports'
import { buildSelfProgressReport, type SelfProgressReport } from './progress'

/**
 * Оркестрация загрузки прогресса (Task 20): только чтение собственных отчётов.
 *
 * Модуль не знает про React и OpenDota. Запросы ограничены текущим пользователем
 * (фильтр `user_id` + серверные RLS). Свой участник определяется по Dota `account_id`
 * (производному от проверенного SteamID64), а не по данным из URL.
 */

/** Размер одной страницы прогресса: достаточно для личной истории, ограничивает payload. */
export const PROGRESS_PAGE_SIZE = 100

/** Клиент списка полных отчётов; реализуется адаптером Supabase, в тестах подменяется. */
export interface ProgressReportsListClient {
  selectPersonalReportsFull(params: {
    userId: string
    limit: number
    offset: number
  }): Promise<{ data: unknown; error: ReportDbError | null }>
}

export type ProgressAuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface ProgressFlowDeps {
  authStatus: ProgressAuthStatus
  userId: string | null
  /** Dota 2 `account_id` текущего пользователя; `null`, если Steam не привязан. */
  selfAccountId: number | null
  client: ProgressReportsListClient | null
}

export type ProgressFlowResult =
  | { status: 'waiting-auth' }
  | { status: 'signed-out' }
  | { status: 'needs-steam' }
  | { status: 'no-database' }
  | { status: 'error'; error: ReportDbError }
  | {
      status: 'ok'
      reports: SelfProgressReport[]
      skippedInvalid: number
      skippedNoSelf: number
    }

async function invalidPayload(message: string): Promise<ProgressFlowResult> {
  return { status: 'error', error: { kind: 'invalid_payload', code: null, message } }
}

/**
 * Загрузка собственных сохранённых отчётов и отображение их на «свои» записи.
 *
 * Каждая строка проходит существующую проверку `parseStoredMatchReport`, затем по
 * `account_id` ищется участник-владелец. Повреждённые и неопределяемые записи не
 * роняют загрузку: они подсчитываются (`skippedInvalid` / `skippedNoSelf`) и честно
 * показываются, а не подменяются чужими участниками.
 */
export async function loadProgressReports(
  deps: ProgressFlowDeps,
): Promise<ProgressFlowResult> {
  if (deps.authStatus === 'loading') {
    return { status: 'waiting-auth' }
  }
  if (deps.authStatus !== 'authenticated' || deps.userId === null) {
    return { status: 'signed-out' }
  }
  if (deps.selfAccountId === null || !Number.isInteger(deps.selfAccountId)) {
    return { status: 'needs-steam' }
  }
  if (deps.client === null) {
    return { status: 'no-database' }
  }

  const { data, error } = await deps.client.selectPersonalReportsFull({
    userId: deps.userId,
    limit: PROGRESS_PAGE_SIZE,
    offset: 0,
  })
  if (error) {
    return { status: 'error', error }
  }
  if (!Array.isArray(data)) {
    return invalidPayload('База данных вернула неожиданный формат списка отчётов.')
  }

  const reports: SelfProgressReport[] = []
  let skippedInvalid = 0
  let skippedNoSelf = 0
  for (const row of data) {
    const parsed = parseStoredMatchReport(row)
    if (!parsed.ok) {
      skippedInvalid += 1
      continue
    }
    const built = buildSelfProgressReport(parsed.view, deps.selfAccountId)
    if (!built.ok) {
      skippedNoSelf += 1
      continue
    }
    reports.push(built.report)
  }

  return { status: 'ok', reports, skippedInvalid, skippedNoSelf }
}