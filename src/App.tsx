import { Route, Routes } from 'react-router-dom'

import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import AuthConfirmPage from './pages/AuthConfirmPage'
import HistoryPage from './pages/HistoryPage'
import HeroPage from './pages/HeroPage'
import HeroesPage from './pages/HeroesPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import MatchPage from './pages/MatchPage'
import NotFoundPage from './pages/NotFoundPage'
import ProfilePage from './pages/ProfilePage'
import ProgressPage from './pages/ProgressPage'
import RegisterPage from './pages/RegisterPage'
import SteamCallbackPage from './pages/SteamCallbackPage'

/**
 * Маршрутизация приложения (Tasks 2–4, расширение Task 20A).
 * Публичные маршруты: `/`, `/login`, `/register`, `/auth/confirm`, `/heroes`,
 * `/matches/:matchId`, `/auth/steam/callback`. Приватные маршруты: `/history` и
 * `/profile` — только после подтверждения сессии (Task 4, Task 20A).
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="auth/confirm" element={<AuthConfirmPage />} />
        <Route path="auth/steam/callback" element={<SteamCallbackPage />} />
        <Route path="heroes" element={<HeroesPage />} />
        <Route path="heroes/:heroId" element={<HeroPage />} />
        <Route path="matches/:matchId" element={<MatchPage />} />
        <Route
          path="history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="progress"
          element={
            <ProtectedRoute>
              <ProgressPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}