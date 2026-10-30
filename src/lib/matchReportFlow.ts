import { normalizeMatch } from './normalizeMatch'
import type { OpenDotaError, OpenDotaMatchResult } from './opendota'
import type { MatchParseOutcome } from './matchParseFlow'
import type { NormalizedMatch } from '../types/match'
import {
  USABLE_REPORT_STATUSES,
  buildPendingView,
  buildReportInsert,
  isSnapshotDetailed,
  shouldRefreshStoredReport,
  type MatchReportView,
  type MatchReportsService,
  type MatchReportStatus,
  type ReportDbError,
  type ReportRefreshSkipReason,
} from './matchReports'

/**
 * Оркестрация жизненного цикла личного отчёта (Task 11).
 *
 * Порядок работы страницы матча:
 *   1) дождаться достоверного состояния сессии;
 *   2) проверить личный отчёт в базе — подробный сохранённый `ready`/`partial`
 *      используется сразу, без обращения к OpenDota и без пересчёта правил;
 *   3) иначе получить матч у OpenDota; при отсутствии подробных данных автоматически
 *      запустить обработку реплея (Task 14) и нормализовать полученный результат;
 *   4) проанализировать всех участников существующим движком правил;
 *   5) сохранить новый отчёт вставкой (без перезаписи существующих строк) либо
 *      обновить ранее сохранённый отчёт — только при подтверждённом улучшении данных;
 *   6) при конфликте уникальности — прочитать существующую запись (её и показать).
 *
 * Модуль не содержит React и не создаёт клиентов: зависимости передаются снаружи,
 * поэтому сценарии (включая гонки и сбои) проверяются юнит-тестами без живой базы.
 */

/** Состояние аутентификации, влияющее на возможность сохранения. */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

/** Шаги работы, отображаемые в интерфейсе. */
export type MatchReportFlowPhase =
  | 'checking-report'
  | 'fetching-match'
  | 'requesting-parse'
  | 'waiting-parse'
  | 'refetching'
  | 'analyzing'
  | 'saving'

/** Результат работы с сохранением отчёта. */
export type ReportSaveState =
  | { kind: 'stored' }
  | { kind: 'saved' }
  | { kind: 'conflict-resolved' }
  | { kind: 'guest' }
  | { kind: 'no-database'; message: string }
  | { kind: 'database-error'; error: ReportDbError }
  | { kind: 'unresolved'; status: Extract<MatchReportStatus, 'pending' | 'error'>; message: string }
  | { kind: 'save-failed'; error: ReportDbError }
  /** Существующий отчёт обновлён подробными данными (только своя строка). */
  | { kind: 'refreshed' }
  /** Обновление не выполнялось: сохранённый отчёт оставлен как есть. */
  | { kind: 'refresh-skipped'; reason: ReportRefreshSkipReason }
  /** Обновление не подтверждено базой — сохранённый отчёт не изменён. */
  | { kind: 'refresh-failed'; error: ReportDbError }

export type MatchReportFlowResult =
  | { status: 'waiting-auth' }
  | { status: 'aborted' }
  | { status: 'invalid-stored-report'; message: string }
  | { status: 'provider-error'; error: OpenDotaError }
  | { status: 'report'; view: MatchReportView; save: ReportSaveState }

export interface MatchReportFlowDeps {
  authStatus: AuthStatus
  /** ID пользователя из проверенной сессии Supabase; `null` для гостя. */
  userId: string | null
  /** Сервис личных отчётов; `null`, если Supabase не настроен. */
  service: MatchReportsService | null
  fetchMatch: (matchId: string, signal?: AbortSignal) => Promise<OpenDotaMatchResult>
  /**
   * Автоматическая обработка реплея (Task 14): вызывается после загрузки матча и
   * возвращает данные (возможно, дополненные) либо честный статус. Отсутствие
   * функции означает «обработка не подключена» — поведение прежнее.
   */
  parseDetailedData?: (params: {
    matchId: string
    rawMatch: unknown
    match: NormalizedMatch
    signal?: AbortSignal
  }) => Promise<MatchParseOutcome>
  /** Итог автоматической обработки — для честного статуса в интерфейсе. */
  onParseOutcome?: (outcome: MatchParseOutcome) => void
  /** Текущее время в момент успешного получения данных OpenDota. */
  now: () => Date
  onPhase?: (phase: MatchReportFlowPhase) => void
}

/** Сообщение для незавершённой (pending/error) записи, которую нельзя перезаписывать. */
export function unresolvedReportMessage(status: 'pending' | 'error'): string {
  return (
    `В базе уже есть незавершённая запись отчёта (статус: ${status}). ` +
    'Автоматическая перезапись и создание второй строки не выполняются — требуется решение владельца проекта.'
  )
}

/** Сообщение, когда сохранение невозможно из-за отсутствия конфигурации Supabase. */
export const NO_DATABASE_MESSAGE =
  'Сохранение отчётов недоступно: подключение к Supabase не настроено (нет VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).'

/** Итог проверки сохранённого отчёта. */
type StoredCheck =
  | { kind: 'usable'; view: MatchReportView }
  | { kind: 'invalid'; message: string }
  | { kind: 'unresolved'; status: 'pending' | 'error' }
  | { kind: 'database-error'; error: ReportDbError }
  | { kind: 'absent' }

async function checkStoredReport(
  service: MatchReportsService,
  userId: string,
  matchId: string,
): Promise<StoredCheck> {
  const result = await service.getPersonalMatchReport({ userId, matchId })
  if (!result.ok) {
    return result.error.kind === 'invalid_payload'
      ? { kind: 'invalid', message: result.error.message }
      : { kind: 'database-error', error: result.error }
  }
  if (result.report === null) {
    return { kind: 'absent' }
  }
  if (USABLE_REPORT_STATUSES.includes(result.report.status)) {
    return { kind: 'usable', view: result.report }
  }
  return { kind: 'unresolved', status: result.report.status as 'pending' | 'error' }
}

/**
 * Разрешение конфликта уникальности: второй одновременный запрос читает запись
 * победителя и показывает её. Перезапись снимка не выполняется.
 */
async function resolveConflict(params: {
  service: MatchReportsService
  userId: string
  matchId: string
  freshView: () => MatchReportView
}): Promise<MatchReportFlowResult> {
  const reread = await params.service.getPersonalMatchReport({
    userId: params.userId,
    matchId: params.matchId,
  })
  if (!reread.ok) {
    return {
      status: 'report',
      view: params.freshView(),
      save: { kind: 'database-error', error: reread.error },
    }
  }
  if (reread.report !== null) {
    if (USABLE_REPORT_STATUSES.includes(reread.report.status)) {
      return { status: 'report', view: reread.report, save: { kind: 'conflict-resolved' } }
    }
    const status = reread.report.status as 'pending' | 'error'
    return {
      status: 'report',
      view: params.freshView(),
      save: { kind: 'unresolved', status, message: unresolvedReportMessage(status) },
    }
  }
  return {
    status: 'report',
    view: params.freshView(),
    save: {
      kind: 'save-failed',
      error: {
        kind: 'unknown',
        code: null,
        message:
          'После конфликта уникальности существующая строка отчёта не найдена: сохранение не подтверждено.',
      },
    },
  }
}

/**
 * Основной сценарий страницы матча: найти сохранённый отчёт или сформировать и
 * сохранить новый. Существующие строки никогда не перезаписываются.
 */
export async function loadOrCreatePersonalReport(
  deps: MatchReportFlowDeps,
  matchId: string,
  signal?: AbortSignal,
): Promise<MatchReportFlowResult> {
  // 1. Пока состояние сессии неизвестно, никаких чтений и записей не выполняется.
  if (deps.authStatus === 'loading') {
    return { status: 'waiting-auth' }
  }

  const isAuthenticated = deps.authStatus === 'authenticated' && deps.userId !== null
  const userId = isAuthenticated ? deps.userId : null

  let unresolved: 'pending' | 'error' | null = null
  let storedError: ReportDbError | null = null

  // 2. Поиск личного отчёта: подробный сохранённый отчёт имеет приоритет над OpenDota.
  let storedView: MatchReportView | null = null
  if (isAuthenticated && deps.service !== null) {
    deps.onPhase?.('checking-report')
    const stored = await checkStoredReport(deps.service, userId as string, matchId)
    if (stored.kind === 'usable') {
      if (isSnapshotDetailed(stored.view)) {
        return { status: 'report', view: stored.view, save: { kind: 'stored' } }
      }
      // Отчёт без подробных данных не блокирует автоматическую обработку реплея:
      // строка не перезаписывается, но страница пытается получить подробные данные
      // и обновляет отчёт только при подтверждённом улучшении (см. шаг 7).
      storedView = stored.view
    }
    if (stored.kind === 'invalid') {
      return { status: 'invalid-stored-report', message: stored.message }
    }
    if (stored.kind === 'unresolved') {
      unresolved = stored.status
    }
    if (stored.kind === 'database-error') {
      storedError = stored.error
    }
  }

  // 3. Данные матча у OpenDota (только если сохранённого отчёта нет).
  deps.onPhase?.('fetching-match')
  const fetched = await deps.fetchMatch(matchId, signal)
  if (!fetched.ok) {
    return fetched.error.kind === 'aborted'
      ? { status: 'aborted' }
      : { status: 'provider-error', error: fetched.error }
  }
  if (signal?.aborted) {
    return { status: 'aborted' }
  }

  // 4. Автоматическая обработка реплея (Task 14): если подробных данных нет,
  //    запрос обработки отправляется без отдельной кнопки и без участия пользователя.
  let match = normalizeMatch(fetched.match)
  if (deps.parseDetailedData !== undefined) {
    const outcome = await deps.parseDetailedData({
      matchId,
      rawMatch: fetched.match,
      match,
      signal,
    })
    deps.onParseOutcome?.(outcome)
    if (outcome.kind === 'aborted' || signal?.aborted === true) {
      return { status: 'aborted' }
    }
    match = outcome.match
  }

  // 5. Нормализация (Task 6) и анализ (Task 9) — существующие чистые функции.
  deps.onPhase?.('analyzing')
  const fetchedAt = deps.now().toISOString()
  const freshView = (): MatchReportView =>
    buildPendingView({ userId, requestedId: matchId, match, fetchedAt })

  // 5. Гость: анализ показывается, но в базу ничего не записывается.
  if (!isAuthenticated) {
    return { status: 'report', view: freshView(), save: { kind: 'guest' } }
  }
  if (deps.service === null) {
    return {
      status: 'report',
      view: freshView(),
      save: { kind: 'no-database', message: NO_DATABASE_MESSAGE },
    }
  }
  if (unresolved !== null) {
    return {
      status: 'report',
      view: freshView(),
      save: { kind: 'unresolved', status: unresolved, message: unresolvedReportMessage(unresolved) },
    }
  }
  if (storedError !== null) {
    // Чтение не удалось: сохранять вслепую нельзя, но свежий анализ показываем честно.
    return {
      status: 'report',
      view: freshView(),
      save: { kind: 'database-error', error: storedError },
    }
  }

  // 6. Обновление существующего отчёта подробными данными: только собственная
  //    строка, только при подтверждённом улучшении, без создания дубликатов.
  if (storedView !== null) {
    const skipReason = shouldRefreshStoredReport(storedView, freshView())
    if (skipReason !== null) {
      return {
        status: 'report',
        view: storedView,
        save: { kind: 'refresh-skipped', reason: skipReason },
      }
    }
    deps.onPhase?.('saving')
    const refreshed = await deps.service.refreshPersonalMatchReport(
      buildReportInsert({
        userId: userId as string,
        requestedId: matchId,
        match,
        fetchedAt,
      }),
    )
    if (refreshed.ok) {
      return { status: 'report', view: refreshed.report, save: { kind: 'refreshed' } }
    }
    // Обновление не подтверждено базой: сохранённый отчёт остаётся как есть,
    // успех не объявляется.
    return {
      status: 'report',
      view: storedView,
      save: { kind: 'refresh-failed', error: refreshed.error },
    }
  }

  // 7. Сохранение нового отчёта вставкой (без upsert и без перезаписи).
  deps.onPhase?.('saving')
  const payload = buildReportInsert({
    userId: userId as string,
    requestedId: matchId,
    match,
    fetchedAt,
  })
  const saved = await deps.service.savePersonalMatchReport(payload)
  if (saved.ok) {
    return { status: 'report', view: saved.report, save: { kind: 'saved' } }
  }
  if (saved.error.kind === 'conflict') {
    return resolveConflict({
      service: deps.service,
      userId: userId as string,
      matchId,
      freshView,
    })
  }
  return { status: 'report', view: freshView(), save: { kind: 'save-failed', error: saved.error } }
}

export interface RetrySaveResult {
  view: MatchReportView
  save: ReportSaveState
}

/**
 * Повторная попытка сохранить уже сформированный отчёт — без нового запроса к
 * OpenDota и без пересчёта правил. Выполняется только по явному действию пользователя
 * (автоматических повторов и опроса нет).
 */
export async function retrySaveReport(
  deps: MatchReportFlowDeps,
  view: MatchReportView,
): Promise<RetrySaveResult> {
  if (deps.authStatus !== 'authenticated' || deps.userId === null) {
    return { view, save: { kind: 'guest' } }
  }
  if (deps.service === null) {
    return { view, save: { kind: 'no-database', message: NO_DATABASE_MESSAGE } }
  }

  deps.onPhase?.('saving')
  const payload = buildReportInsert({
    userId: deps.userId,
    requestedId: view.matchId,
    match: view.match,
    fetchedAt: view.fetchedAt,
  })
  const saved = await deps.service.savePersonalMatchReport(payload)
  if (saved.ok) {
    return { view: saved.report, save: { kind: 'saved' } }
  }
  if (saved.error.kind !== 'conflict') {
    return { view, save: { kind: 'save-failed', error: saved.error } }
  }

  const reread = await deps.service.getPersonalMatchReport({
    userId: deps.userId,
    matchId: view.matchId,
  })
  if (!reread.ok) {
    return { view, save: { kind: 'database-error', error: reread.error } }
  }
  if (reread.report !== null) {
    if (USABLE_REPORT_STATUSES.includes(reread.report.status)) {
      return { view: reread.report, save: { kind: 'conflict-resolved' } }
    }
    const status = reread.report.status as 'pending' | 'error'
    return { view, save: { kind: 'unresolved', status, message: unresolvedReportMessage(status) } }
  }
  return {
    view,
    save: {
      kind: 'save-failed',
      error: {
        kind: 'unknown',
        code: null,
        message:
          'После конфликта уникальности существующая строка отчёта не найдена: сохранение не подтверждено.',
      },
    },
  }
}
