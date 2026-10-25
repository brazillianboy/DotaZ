import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { mapAuthError, mapAuthErrorCode, NOT_CONFIGURED_MESSAGE } from '../lib/authErrors'
import type { AuthErrorCode } from '../i18n/errors'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export interface AuthActionResult {
  ok: boolean
  error: string | null
  /** Стабильный код ошибки: интерфейс выбирает текст на текущем языке (Task 13). */
  errorCode: AuthErrorCode | null
  /** true — Supabase требует подтвердить email, активной сессии ещё нет */
  needsEmailConfirmation: boolean
}

export interface AuthContextValue {
  /** Текущий аутентифицированный пользователь (Supabase Auth — источник истины). */
  user: User | null
  /** Текущая сессия Supabase. */
  session: Session | null
  /** true, пока идёт первичная инициализация/восстановление сессии. */
  loading: boolean
  /** false — отсутствуют VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. */
  isConfigured: boolean
  signUp: (email: string, password: string) => Promise<AuthActionResult>
  signIn: (email: string, password: string) => Promise<AuthActionResult>
  signOut: () => Promise<AuthActionResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

const FAILURE_BASE = { ok: false, needsEmailConfirmation: false, errorCode: null } as const

/**
 * Провайдер состояния аутентификации (Task 3).
 * Инициализирует сессию через официальный API Supabase, подписывается на
 * изменения состояния и корректно отписывается при размонтировании.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const isConfigured = isSupabaseConfigured()

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true

    // Восстановление сессии после перезагрузки приложения.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setSession(null)
          setLoading(false)
        }
      })

    // Синхронизация состояния: вход, выход, обновление токенов, подтверждение email.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setLoading(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    const supabase = getSupabase()
    if (!supabase) {
      return { ...FAILURE_BASE, error: NOT_CONFIGURED_MESSAGE, errorCode: 'not_configured' }
    }
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        return { ...FAILURE_BASE, error: mapAuthError(error), errorCode: mapAuthErrorCode(error) }
      }
      // session === null → проект требует подтверждение email;
      // иначе сессия активна (подтверждение отключено).
      return {
        ok: true,
        error: null,
        errorCode: null,
        needsEmailConfirmation: data.session === null,
      }
    } catch (error) {
      return { ...FAILURE_BASE, error: mapAuthError(error), errorCode: mapAuthErrorCode(error) }
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    const supabase = getSupabase()
    if (!supabase) {
      return { ...FAILURE_BASE, error: NOT_CONFIGURED_MESSAGE, errorCode: 'not_configured' }
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        return { ...FAILURE_BASE, error: mapAuthError(error), errorCode: mapAuthErrorCode(error) }
      }
      return { ok: true, error: null, errorCode: null, needsEmailConfirmation: false }
    } catch (error) {
      return { ...FAILURE_BASE, error: mapAuthError(error), errorCode: mapAuthErrorCode(error) }
    }
  }, [])

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    const supabase = getSupabase()
    if (!supabase) {
      return { ...FAILURE_BASE, error: NOT_CONFIGURED_MESSAGE, errorCode: 'not_configured' }
    }
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        return { ...FAILURE_BASE, error: mapAuthError(error), errorCode: mapAuthErrorCode(error) }
      }
      setSession(null)
      return { ok: true, error: null, errorCode: null, needsEmailConfirmation: false }
    } catch (error) {
      return { ...FAILURE_BASE, error: mapAuthError(error), errorCode: mapAuthErrorCode(error) }
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isConfigured,
      signUp,
      signIn,
      signOut,
    }),
    [session, loading, isConfigured, signUp, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}