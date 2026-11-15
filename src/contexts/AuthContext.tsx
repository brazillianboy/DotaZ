import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { mapAuthError, mapAuthErrorCode, NOT_CONFIGURED_MESSAGE } from '../lib/authErrors'
import type { AuthErrorCode } from '../i18n/errors'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import {
  beginSteamExchange,
  clearSteamVerifier,
  exchangeSteamCode,
  isSteamConfigured,
  readSteamVerifier,
  steamLinkStartUrl,
  steamLoginUrl,
} from '../lib/steamClient'

export interface AuthActionResult {
  ok: boolean
  error: string | null
  /** Стабильный код ошибки: интерфейс выбирает текст на текущем языке (Task 13). */
  errorCode: AuthErrorCode | null
  /** true — Supabase требует подтвердить email, активной сессии ещё нет */
  needsEmailConfirmation: boolean
  /** Стабильный код ошибки Steam-входа (Task 20A); необязательное поле. */
  steamErrorCode?: string | null
}

/** Публичные метаданные привязанного Steam-аккаунта (Task 20A). */
export interface SteamIdentityView {
  steamId64: string
  personaName: string | null
  avatarUrl: string | null
  profileUrl: string | null
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
  /** true — задан VITE_STEAM_AUTH_URL, Steam-вход доступен. */
  isSteamConfigured: boolean
  /** Привязанный Steam-аккаунт текущего пользователя (если есть). */
  steamIdentity: SteamIdentityView | null
  signUp: (email: string, password: string) => Promise<AuthActionResult>
  signIn: (email: string, password: string) => Promise<AuthActionResult>
  signOut: () => Promise<AuthActionResult>
  /** Готовит PKCE-секрет и отправляет браузер на серверный Steam OpenID 2.0. */
  startSteamSignIn: (nextPath: string) => Promise<AuthActionResult>
  /**
   * Обменивает одноразовый код обмена на настоящую сессию Supabase.
   * Код едет в теле POST; токен в URL не попадает.
   */
  completeSteamSignIn: (code: string) => Promise<AuthActionResult>
  /** Запускает привязку Steam к текущему аккаунту (требует активной сессии). */
  startSteamLink: (nextPath: string) => Promise<AuthActionResult>
  /** Перечитывает Steam-привязку текущего пользователя. */
  refreshSteamIdentity: () => Promise<void>
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
  const [steamIdentity, setSteamIdentity] = useState<SteamIdentityView | null>(null)
  const isConfigured = isSupabaseConfigured()
  const steamConfigured = isSteamConfigured()

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

  /** Читает привязанный Steam-аккаунт текущего пользователя (RLS отдаёт только свою строку). */
  const refreshSteamIdentity = useCallback(async (): Promise<void> => {
    const supabase = getSupabase()
    const currentUser = session?.user ?? null
    if (!supabase || currentUser === null) {
      setSteamIdentity(null)
      return
    }
    try {
      const { data, error } = await supabase
        .from('steam_identities')
        .select('steam_id64, persona_name, avatar_url, profile_url')
        .eq('user_id', currentUser.id)
        .maybeSingle()
      if (error !== null || data === null) {
        setSteamIdentity(null)
        return
      }
      setSteamIdentity({
        steamId64: String(data.steam_id64),
        personaName: (data.persona_name as string | null) ?? null,
        avatarUrl: (data.avatar_url as string | null) ?? null,
        profileUrl: (data.profile_url as string | null) ?? null,
      })
    } catch {
      // Отсутствие таблицы или сети не должно ломать вход: личность остаётся сессией Supabase.
      setSteamIdentity(null)
    }
  }, [session])

  useEffect(() => {
    void refreshSteamIdentity()
  }, [refreshSteamIdentity])

  /**
   * Начало входа через Steam: готовит PKCE-секрет и переходит на серверную
   * функцию OpenID 2.0. Клиент не создаёт личность сам — только отправляет браузер.
   */
  const startSteamSignIn = useCallback(async (nextPath: string): Promise<AuthActionResult> => {
    if (!isSteamConfigured()) {
      return {
        ...FAILURE_BASE,
        error: 'Steam authentication is not configured',
        steamErrorCode: 'not_configured',
      }
    }
    const challenge = await beginSteamExchange()
    if (challenge === null) {
      // Без PKCE-секрета вход небезопасен: браузер не сможет погасить код.
      return {
        ...FAILURE_BASE,
        error: 'Steam exchange could not be prepared',
        steamErrorCode: 'temporarily_unavailable',
      }
    }
    const url = steamLoginUrl(nextPath, challenge)
    if (url === null) {
      return {
        ...FAILURE_BASE,
        error: 'Steam authentication is not configured',
        steamErrorCode: 'not_configured',
      }
    }
    window.location.assign(url)
    return { ok: true, error: null, errorCode: null, needsEmailConfirmation: false }
  }, [])

  /**
   * Обмен одноразового кода обмена на настоящую сессию Supabase.
   *
   * Код не является токеном: он одноразовый, короткоживущий и привязан к
   * браузеру. Токен Supabase приходит в теле ответа серверной функции и сразу
   * обменивается штатным `verifyOtp`; в URL он не появляется.
   */
  const completeSteamSignIn = useCallback(async (code: string): Promise<AuthActionResult> => {
    const supabase = getSupabase()
    if (!supabase) {
      return { ...FAILURE_BASE, error: NOT_CONFIGURED_MESSAGE, errorCode: 'not_configured' }
    }
    if (typeof code !== 'string' || code.length === 0) {
      return { ...FAILURE_BASE, error: 'Missing exchange code', steamErrorCode: 'exchange_invalid' }
    }

    const verifier = readSteamVerifier()
    if (verifier === null) {
      // Секрет живёт в этой же вкладке. Нет секрета — код не наш, вход отклоняем.
      return { ...FAILURE_BASE, error: 'Missing exchange verifier', steamErrorCode: 'exchange_invalid' }
    }

    const exchanged = await exchangeSteamCode(code, verifier)
    if (!exchanged.ok) {
      clearSteamVerifier()
      return { ...FAILURE_BASE, error: 'Steam exchange failed', steamErrorCode: exchanged.error }
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        type: 'email',
        token_hash: exchanged.tokenHash,
      })
      if (error || data.session === null) {
        return {
          ...FAILURE_BASE,
          error: error ? mapAuthError(error) : 'Steam session failed',
          steamErrorCode: 'session_failed',
        }
      }
      setSession(data.session)
      return { ok: true, error: null, errorCode: null, needsEmailConfirmation: false }
    } catch {
      return { ...FAILURE_BASE, error: 'Steam session failed', steamErrorCode: 'session_failed' }
    } finally {
      // Секрет одноразовый: после попытки обмена он больше не нужен.
      clearSteamVerifier()
    }
  }, [])

  /**
   * Привязка Steam к текущему аккаунту.
   *
   * Требует действующей сессии: сервер принимает решение о владельце только по
   * проверенному access token, а не по параметрам запроса.
   */
  const startSteamLink = useCallback(
    async (nextPath: string): Promise<AuthActionResult> => {
      const accessToken = session?.access_token
      if (typeof accessToken !== 'string' || accessToken.length === 0) {
        return {
          ...FAILURE_BASE,
          error: 'Steam linking is not available',
          steamErrorCode: 'not_configured',
        }
      }
      const challenge = await beginSteamExchange()
      const url = challenge === null ? null : steamLinkStartUrl(nextPath, challenge)
      if (url === null) {
        return {
          ...FAILURE_BASE,
          error: 'Steam linking is not available',
          steamErrorCode: 'not_configured',
        }
      }
      try {
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!response.ok) {
          return {
            ...FAILURE_BASE,
            error: 'Steam linking failed',
            steamErrorCode: response.status === 401 ? 'invalid_session' : 'link_failed',
          }
        }
        const parsed = (await response.json()) as { url?: unknown }
        if (typeof parsed.url !== 'string' || !parsed.url.startsWith('https://steamcommunity.com/')) {
          return { ...FAILURE_BASE, error: 'Steam linking failed', steamErrorCode: 'link_failed' }
        }
        // Переход на проверенный адрес Steam; редиректы проверяет сервер.
        window.location.assign(parsed.url)
        return { ok: true, error: null, errorCode: null, needsEmailConfirmation: false }
      } catch {
        return { ...FAILURE_BASE, error: 'Steam linking failed', steamErrorCode: 'network_error' }
      }
    },
    [session],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isConfigured,
      isSteamConfigured: steamConfigured,
      steamIdentity,
      signUp,
      signIn,
      signOut,
      startSteamSignIn,
      completeSteamSignIn,
      startSteamLink,
      refreshSteamIdentity,
    }),
    [
      session,
      loading,
      isConfigured,
      steamConfigured,
      steamIdentity,
      signUp,
      signIn,
      signOut,
      startSteamSignIn,
      completeSteamSignIn,
      startSteamLink,
      refreshSteamIdentity,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}