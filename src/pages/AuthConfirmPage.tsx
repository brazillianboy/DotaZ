import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js'

import { mapAuthError } from '../lib/authErrors'
import { getSupabase } from '../lib/supabase'

type ConfirmStatus = 'pending' | 'success' | 'error'

/**
 * Callback подтверждения email (Task 3, маршрут `/auth/confirm`).
 *
 * Поддерживаются стандартные механизмы Supabase Auth (по одному за раз,
 * в зависимости от шаблона письма проекта):
 *  1. PKCE:            `/auth/confirm?code=...`            → exchangeCodeForSession();
 *  2. token_hash:      `/auth/confirm?token_hash=&type=`   → verifyOtp();
 *  3. implicit flow:   `#access_token=...&refresh_token=`  → detectSessionInUrl клиента.
 *
 * Настройки в дашборде Supabase (Site URL, Redirect URLs) обязательны —
 * см. раздел «Конфигурация Supabase» в отчёте/документации.
 */
export default function AuthConfirmPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<ConfirmStatus>('pending')
  const [message, setMessage] = useState('Выполняем подтверждение аккаунта…')
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) {
      return
    }
    startedRef.current = true

    const supabase = getSupabase()
    if (!supabase) {
      setStatus('error')
      setMessage(
        'Подтверждение недоступно: Supabase не настроен. Проверьте переменные окружения приложения.',
      )
      return
    }

    const errorParam = searchParams.get('error_description') ?? searchParams.get('error')
    if (errorParam) {
      setStatus('error')
      setMessage('Ссылка подтверждения недействительна или устарела. Запросите новое письмо.')
      return
    }

    const code = searchParams.get('code')
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    async function run(client: SupabaseClient) {
      try {
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code)
          if (error) {
            setStatus('error')
            setMessage(mapAuthError(error))
            return
          }
        } else if (tokenHash && type) {
          const { error } = await client.auth.verifyOtp({
            type: type as EmailOtpType,
            token_hash: tokenHash,
          })
          if (error) {
            setStatus('error')
            setMessage(mapAuthError(error))
            return
          }
        } else if (window.location.hash.includes('access_token')) {
          // Implicit flow: клиент (detectSessionInUrl) разбирает hash сам.
          const { data } = await client.auth.getSession()
          if (!data.session) {
            setStatus('error')
            setMessage('Не удалось обработать данные подтверждения. Запросите новое письмо.')
            return
          }
        } else {
          setStatus('error')
          setMessage('Ссылка подтверждения не содержит данных. Запросите новое письмо.')
          return
        }

        setStatus('success')
        setMessage('Email подтверждён — аккаунт активирован. Теперь вы можете войти.')
      } catch (error) {
        setStatus('error')
        setMessage(mapAuthError(error))
      }
    }

    void run(supabase)
  }, [searchParams])

  return (
    <section className="stub">
      <div className="container">
        <div className="stub__panel panel auth-panel">
          <h1 className="stub__title">Подтверждение email</h1>

          {status === 'pending' && (
            <p className="stub__text" role="status" aria-live="polite">
              {message}
            </p>
          )}

          {status === 'success' && (
            <>
              <p className="auth-alert auth-alert--success" role="status">
                {message}
              </p>
              <Link className="btn btn--primary" to="/login">
                Перейти ко входу
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="auth-alert auth-alert--error" role="alert">
                {message}
              </p>
              <Link className="btn btn--ghost" to="/login">
                Перейти ко входу
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}