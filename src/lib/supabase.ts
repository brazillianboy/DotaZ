import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Инициализация клиента Supabase (Task 3).
 *
 * Используются ТОЛЬКО публичные browser-safe ключи из переменных окружения Vite:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY.
 *
 * Никогда не добавляйте сюда service_role / секретные ключи Supabase,
 * пароли БД и персональные токены (PLAN.md, правило 6; ARCHITECTURE.md, п. 7).
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
}

let supabaseInstance: SupabaseClient | null = null

/**
 * Возвращает единственный экземпляр клиента Supabase (без дублей)
 * или `null`, если конфигурация отсутствует.
 *
 * `persistSession`, `autoRefreshToken`, `detectSessionInUrl` — стандартное
 * управление сессиями официального клиента (восстановление после перезагрузки,
 * обновление токенов, обработка ссылок подтверждения email).
 */
export function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return null
  }
  if (supabaseInstance === null) {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return supabaseInstance
}