import type { SupabaseClient } from '@supabase/supabase-js'

import {
  classifyReportDbError,
  type MatchReportInsert,
  type MatchReportsClient,
  type ReportDbError,
} from './matchReports'

/**
 * Адаптер Supabase → `MatchReportsClient` (Task 11).
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
  }
}
