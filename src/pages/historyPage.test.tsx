import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'

import { AuthContext, type AuthContextValue } from '../contexts/AuthContext'
import HistoryPage from './HistoryPage'

// Исходники читаются как строки (Vite ?raw) — для статических проверок безопасности.
import historyPageSource from './HistoryPage.tsx?raw'
import historyListSource from '../components/HistoryList.tsx?raw'
import historyFlowSource from '../lib/historyFlow.ts?raw'
import historyReportsSource from '../lib/historyReports.ts?raw'
import historySupabaseSource from '../lib/matchReportsSupabase.ts?raw'

/**
 * Проверки страницы личной истории (Task 12).
 *
 * SSR-рендеринг выполняется через `react-dom/server` (эффекты не запускаются), поэтому
 * здесь проверяется начальное состояние страницы, а состояния загрузки/списка/ошибки
 * покрыты тестами `historyFlow` и `HistoryList`. Статические проверки исходников
 * подтверждают ограничения безопасности (только чтение, только свой аккаунт).
 */

function renderPage(auth: Partial<AuthContextValue>) {
  const value: AuthContextValue = {
    user: null,
    session: null,
    loading: true,
    isConfigured: true,
    signUp: async () => ({ ok: false, error: null, needsEmailConfirmation: false }),
    signIn: async () => ({ ok: false, error: null, needsEmailConfirmation: false }),
    signOut: async () => ({ ok: false, error: null, needsEmailConfirmation: false }),
    ...auth,
  }
  return renderToStaticMarkup(
    <StaticRouter location="/history">
      <AuthContext.Provider value={value}>
        <HistoryPage />
      </AuthContext.Provider>
    </StaticRouter>,
  )
}

describe('HistoryPage — начальное состояние', () => {
  it('показывает заголовок страницы и статус загрузки, пока сессия не подтверждена', () => {
    const html = renderPage({ loading: true })
    expect(html).toContain('История анализов')
    expect(html).toContain('Личные данные')
    expect(html).toContain('Загружаем историю анализов…')
    expect(html).toContain('aria-busy="true"')
  })

  it('не показывает приватные данные и чужие отчёты до загрузки', () => {
    const html = renderPage({ loading: true })
    expect(html).not.toContain('history-card')
    expect(html).not.toContain('9007760151')
  })

  it('объясняет, что отчёты доступны только владельцу аккаунта', () => {
    const html = renderPage({ loading: false, user: null })
    expect(html).toContain('только вашему аккаунту')
  })
})

describe('Task 12: ограничения безопасности по исходникам', () => {
  const sources = {
    'HistoryPage.tsx': historyPageSource,
    'HistoryList.tsx': historyListSource,
    'historyFlow.ts': historyFlowSource,
    'historyReports.ts': historyReportsSource,
    'matchReportsSupabase.ts': historySupabaseSource,
  }

  it('не использует service-role и служебные ключи', () => {
    for (const [name, source] of Object.entries(sources)) {
      expect(source, name).not.toMatch(/SERVICE_ROLE|sb_secret_|auth\.admin/)
    }
  })

  it('страница истории не обращается к OpenDota и не пишет отчёты', () => {
    expect(historyPageSource).not.toContain("from '../lib/opendota'")
    expect(historyPageSource).not.toContain('fetchMatchById')
    expect(historyPageSource).not.toContain('savePersonalMatchReport')
    expect(historyPageSource).not.toContain('insertPersonalReport')
    expect(historyListSource).not.toContain('opendota')
  })

  it('запрос списка ограничен текущим пользователем и сортируется в базе', () => {
    expect(historySupabaseSource).toContain('.eq(\'user_id\', userId)')
    expect(historySupabaseSource).toContain('.order(\'created_at\', { ascending: false })')
    expect(historySupabaseSource).toContain('.order(\'id\', { ascending: false })')
    expect(historySupabaseSource).toContain('.range(offset, offset + limit - 1)')
    expect(historySupabaseSource).toContain('radiant_win:match_payload->match->>radiant_win')
  })

  it('история не тянет тяжёлые payload и не меняет данные', () => {
    expect(historySupabaseSource).toContain('HISTORY_REPORT_COLUMNS')
    expect(historySupabaseSource).not.toMatch(/HISTORY_REPORT_COLUMNS\s*=[\s\S]{0,200}analysis_payload/)
    expect(historyReportsSource).not.toContain('.update(')
    expect(historyReportsSource).not.toContain('.delete(')
    expect(historyFlowSource).not.toContain('.insert(')
  })
})