import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { I18nProvider } from './i18n/I18nContext'
import './styles/global.css'
import './styles/layout.css'
import './styles/home.css'
import './styles/pages.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
)