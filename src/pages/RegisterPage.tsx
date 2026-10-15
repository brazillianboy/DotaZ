import { Link } from 'react-router-dom'

import PlaceholderPanel from '../components/PlaceholderPanel'

export default function RegisterPage() {
  return (
    <PlaceholderPanel
      title="Регистрация"
      description="Регистрация аккаунтов пока не работает: форма и Supabase Auth появятся в следующих версиях (Task 3). Никакие данные сейчас не собираются."
    >
      <p className="stub__hint">
        Уже есть аккаунт? Заготовка входа — <Link to="/login">на странице «Вход»</Link>.
      </p>
    </PlaceholderPanel>
  )
}