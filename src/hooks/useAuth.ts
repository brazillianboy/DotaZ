import { useContext } from 'react'

import { AuthContext, type AuthContextValue } from '../contexts/AuthContext'

/**
 * Доступ к состоянию аутентификации из любого компонента приложения.
 * Использовать только внутри AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) {
    throw new Error('useAuth должен использоваться внутри <AuthProvider>')
  }
  return value
}