import type { SupabaseClient } from '@supabase/supabase-js'

import type { MatchReportsListClient } from './historyReports'
import {
  classifyReportDbError,
  type MatchReportInsert,
  type MatchReportsClient,
  type ReportDbError,
} from './matchReports'

/**
 * Адаптер Supabase → `MatchReportsClient` и `MatchReportsListClient` (Tasks 11–12).
 *
 * Единственное место, где известны имя таблицы и колонки. Используется обычный
 * пользовательский клиент Supabase (publishable-ключ + сессия пользователя):
 * сервисный ключ (service_role) в браузерном коде не применяется никогда.
 *
 * Все запросы ограничены текущим пользователем, а серверная RLS остаётся вторым
 * независимым барьером. Перезапись не выполняется: только чтение и вставка.
 */

export const MATCH_REPORTS_TABLE = 'match_reports'

/** Колонки, читаемые и возвращаемые после вставки. */
export const MATCH_REPORT_COLUMNS =
  'id,user_id,match_id,status,match_payload,analysis_payload,rules_version,source,fetched_at,created_at,updated_at'

/**
 * Колонки для списка истории (Task 12): только метаданные карточки.
 *
 * Тяжёлые JSONB-payload не загружаются. Результат матча берётся JSON-путём из
 * сохранённого снимка (`match_payload->match->>radiant_win`), поэтому одна
 * страница истории — это один запрос без обращения к провайдеру.
 */
export const HISTORY_REPORT_COLUMNS =
  'id,user_id,match_id,status,source,rules_version,created_at,fetched_at,' +
  'radiant_win:match_payload->match->>radiant_win'

function toReportDbError(error: unknown): ReportDbError | null {
  if (error === null || error === undefined) {
    return null
  }
  return classifyReportDbError(error)
}

export function createSupabaseMatchReportsClient(supabase: SupabaseClient): MatchReportsClient {
  return {
    async selectPersonalReport({ userId, matchId }) {
      const { data, error } = await supabase
        .from(MATCH_REPORTS_TABLE)
        .select(MATCH_REPORT_COLUMNS)
        .eq('user_id', userId)
        .eq('match_id', matchId)
        .maybeSingle()
      return { data: data ?? null, error: toReportDbError(error) }
    },

    async insertPersonalReport(payload: MatchReportInsert) {
      const { data, error } = await supabase
        .from(MATCH_REPORTS_TABLE)
        .insert(payload)
        .select(MATCH_REPORT_COLUMNS)
        .maybeSingle()
      return { data: data ?? null, error: toReportDbError(error) }
    },

    /**
     * Обновление собственной строки отчёта.
     *
     * Обновляемые поля не содержат `user_id` и `match_id`: эти колонки задаются
     * только в фильтре, поэтому строку нельзя «перенести» другому пользователю или
     * на другой матч. Дополнительно работает RLS `match_reports_update_own`.
     */
    async updatePersonalReport(payload: MatchReportInsert) {
      const { user_id, match_id, ...fields } = payload
      const { data, error } = await supabase
        .from(MATCH_REPORTS_TABLE)
        .update(fields)
        .eq('user_id', user_id)
        .eq('match_id', match_id)
        .select(MATCH_REPORT_COLUMNS)
        .maybeSingle()
      return { data: data ?? null, error: toReportDbError(error) }
    },
  }
}

/**
 * Клиент истории: одна страница за один запрос.
 *
 * Сортировка задаётся в базе (`created_at DESC`, затем `id DESC` как устойчивый
 * вторичный ключ) и применяется до пагинации, поэтому порядок остаётся
 * хронологическим для всей истории, а не только для текущей страницы.
 */
export function createSupabaseHistoryReportsClient(
  supabase: SupabaseClient,
): MatchReportsListClient {
  return {
    async selectPersonalReportList({ userId, limit, offset }) {
      const { data, error } = await supabase
        .from(MATCH_REPORTS_TABLE)
        .select(HISTORY_REPORT_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1)
      return { data: data ?? [], error: toReportDbError(error) }
    },
  }
}
