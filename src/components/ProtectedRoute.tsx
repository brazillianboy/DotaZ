import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

interface ProtectedRouteProps {
  children: ReactNode
}

/**
 * Защита приватных маршрутов (Task 4).
 *
 * Состояния:
 *  A. идёт инициализация аутентификации (`loading`) — показываем статус
 *     «Проверка авторизации…», приватный контент не рендерим и не редиректим
 *     (иначе авторизованный пользователь после перезагрузки страницы был бы
 *     преждевременно отправлен на `/login`);
 *  B. сессия подтверждена (`user`) — рендерим защищённую страницу;
 *  C/D. сессия не подтверждена (нет пользователя, ошибка инициализации,
 *     отсутствие конфигурации Supabase) — fail closed: редирект на `/login`
 *     с сохранением исходного внутреннего маршрута в навигационном state.
 *
 * Используется существующий контекст аутентификации (`useAuth`) — второй клиент
 * Supabase и отдельное хранилище сессии не создаются.
 *
 * ВАЖНО: это защита уровня интерфейса. Она не заменяет серверную авторизацию
 * и политики Supabase RLS (Task 10) и не может считаться защитой данных.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <section className="stub" aria-busy="true">
        <div className="container">
          <div className="stub__panel panel">
            <span className="badge badge--warn">Проверка доступа</span>
            <h1 className="stub__title">Проверка авторизации…</h1>
            <p className="stub__text" role="status" aria-live="polite">
              Проверяем вашу сессию. Если вход выполнен, приватный раздел
              откроется автоматически.
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    )
  }

  return <>{children}</>
}