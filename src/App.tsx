import { Route, Routes } from 'react-router-dom'

import AppLayout from './components/AppLayout'
import HistoryPage from './pages/HistoryPage'
import HeroesPage from './pages/HeroesPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import MatchPage from './pages/MatchPage'
import NotFoundPage from './pages/NotFoundPage'
import RegisterPage from './pages/RegisterPage'

/**
 * Маршрутизация приложения (Task 2).
 * Поддерживаемые маршруты: `/`, `/login`, `/register`, `/heroes`,
 * `/matches/:matchId`, `/history`. Неизвестные адреса — страница 404.
 * Логика анализа, авторизации и данных (Tasks 3–5) здесь намеренно отсутствует.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="heroes" element={<HeroesPage />} />
        <Route path="matches/:matchId" element={<MatchPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}