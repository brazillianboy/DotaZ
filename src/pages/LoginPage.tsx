import { Link } from 'react-router-dom'

import PlaceholderPanel from '../components/PlaceholderPanel'

export default function LoginPage() {
  return (
    <PlaceholderPanel
      title="Вход в аккаунт"
      description="Авторизация ещё не реализована. Форма входа и подключение Supabase Auth появятся в следующих версиях (Task 3). Сейчас страница показывает будущее место входа."
    >
      <p className="stub__hint">
        Нет аккаунта? Заготовка страницы регистрации —{' '}
        <Link to="/register">на странице «Регистрация»</Link>.
      </p>
    </PlaceholderPanel>
  )
}