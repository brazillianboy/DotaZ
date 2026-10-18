import { Route, Routes } from 'react-router-dom'

import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import AuthConfirmPage from './pages/AuthConfirmPage'
import HistoryPage from './pages/HistoryPage'
import HeroesPage from './pages/HeroesPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import MatchPage from './pages/MatchPage'
import NotFoundPage from './pages/NotFoundPage'
import RegisterPage from './pages/RegisterPage'

/**
 * Маршрутизация приложения (Tasks 2–4).
 * Публичные маршруты: `/`, `/login`, `/register`, `/auth/confirm`, `/heroes`,
 * `/matches/:matchId`. Приватный маршрут: `/history` — только после
 * подтверждения сессии (Task 4). Неизвестные адреса — страница 404.
 * Логика анализа и данных (Tasks 5+) здесь намеренно отсутствует.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="auth/confirm" element={<AuthConfirmPage />} />
        <Route path="heroes" element={<HeroesPage />} />
        <Route path="matches/:matchId" element={<MatchPage />} />
        <Route
          path="history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}