import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'

import ProfileActivity from '../components/ProfileActivity'
import ProfileLaneRoles from '../components/ProfileLaneRoles'
import ProfileOverview from '../components/ProfileOverview'
import ProfileRecentMatches from '../components/ProfileRecentMatches'
import ProfileSavedAnalyses from '../components/ProfileSavedAnalyses'
import ProfileTopHeroes from '../components/ProfileTopHeroes'
import { I18nProvider } from '../i18n/I18nContext'
import type { Locale } from '../i18n/translations'
import type { HistoryReportItem } from '../lib/historyReports'
import type { MatchFeedResult } from '../lib/opendotaPlayer'
import type { PlayerRecord, RecentMatch } from '../lib/playerStats'

const CYRILLIC = /[А-Яа-яЁё]/

function render(ui: ReactNode, locale: Locale = 'ru'): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <I18nProvider initialLocale={locale}>{ui}</I18nProvider>
    </MemoryRouter>,
  )
}

const RECORD: PlayerRecord = { wins: 3, losses: 1, total: 4, winRatePercent: 75 }

const MATCH: RecentMatch = {
  matchId: '9095565720',
  heroId: 97,
  outcome: 'win',
  kills: 10,
  deaths: 2,
  assists: 14,
  durationSeconds: 1922,
  startTime: '2026-11-18T00:00:00.000Z',
  laneRole: 2,
}

describe('ProfileOverview: итог аккаунта', () => {
  it('показывает матчи, победы и винрейт из ответа wl', () => {
    const html = render(
      <ProfileOverview record={RECORD} recordError={null} latestMatch={MATCH} recentError={null} onRetry={() => {}} />,
    )
    expect(html).toContain('Матчи')
    expect(html).toContain('Победы')
    expect(html).toContain('75 %')
    expect(html).toContain('Magnus')
    expect(html).toContain('Победа')
  })

  it('отсутствующий итог показывается как недоступный, а не как ноль', () => {
    const html = render(
      <ProfileOverview record={null} recordError={null} latestMatch={null} recentError={null} onRetry={() => {}} />,
    )
    expect(html).toContain('Недоступно')
    expect(html).not.toContain('>0<')
  })

  it('нулевой итог снабжается честной пометкой', () => {
    const html = render(
      <ProfileOverview
        record={{ wins: 0, losses: 0, total: 0, winRatePercent: null }}
        recordError={null}
        latestMatch={null}
        recentError={null}
        onRetry={() => {}}
      />,
    )
    expect(html).toContain('не содержит подтверждённых матчей')
  })
})

describe('ProfileRecentMatches: последние матчи', () => {
  it('рендерит матч: K/D/A, длительность, дату и результат', () => {
    const html = render(
      <ProfileRecentMatches matches={[MATCH]} skipped={0} error={null} onRetry={() => {}} />,
    )
    expect(html).toContain('9095565720')
    expect(html).toContain('10 / 2 / 14')
    expect(html).toContain('32:02')
    expect(html).toContain('Победа')
    expect(html).toContain('/matches/9095565720')
    expect(html).toContain('Открыть матч')
  })

  it('сообщает о пропущенных записях', () => {
    const html = render(
      <ProfileRecentMatches matches={[MATCH]} skipped={3} error={null} onRetry={() => {}} />,
    )
    expect(html).toContain('пропущена')
  })
})

describe('ProfileTopHeroes: герои', () => {
  it('показывает топ и английское имя героя', () => {
    const heroes = [
      { heroId: 97, games: 10, wins: 4, winRatePercent: 40 },
      { heroId: 1, games: 6, wins: 3, winRatePercent: 50 },
    ]
    const html = render(<ProfileTopHeroes heroes={heroes} error={null} onRetry={() => {}} />)
    expect(html).toContain('Magnus')
    expect(html).toContain('Anti-Mage')
    expect(html).toContain('Матчи: 10')
  })

  it('при пустых данных честно сообщает об отсутствии', () => {
    const html = render(<ProfileTopHeroes heroes={[]} error={null} onRetry={() => {}} />)
    expect(html).toContain('Нет данных о героях')
  })
})

describe('ProfileActivity: тепловая карта', () => {
  const history: MatchFeedResult = {
    items: [
      { matchId: '1', startTime: '2026-11-18T10:00:00.000Z' },
      { matchId: '2', startTime: '2026-11-18T08:00:00.000Z' },
    ],
    truncated: false,
    oldestMatchTime: '2026-01-02T00:00:00.000Z',
  }

  it('показывает заголовок, дни недели, легенду и селектор года', () => {
    const html = render(
      <ProfileActivity
        history={history}
        error={null}
        fetchedAt="2026-11-18T12:00:00.000Z"
        onRetry={() => {}}
      />,
    )
    expect(html).toContain('Календарь активности')
    expect(html).toContain('Пн')
    expect(html).toContain('Меньше')
    expect(html).toContain('Больше')
    expect(html).toContain('Год')
  })

  it('при оборванной истории сообщает о неполноте покрытия', () => {
    const html = render(
      <ProfileActivity
        history={{ ...history, truncated: true, oldestMatchTime: '2026-11-10T00:00:00.000Z' }}
        error={null}
        fetchedAt="2026-11-18T12:00:00.000Z"
        onRetry={() => {}}
      />,
    )
    expect(html).toContain('История оборвана')
  })
})

describe('ProfileLaneRoles: линии (полная история)', () => {
  it('при недостаточной выборке не выдумывает распределение', () => {
    const html = render(
      <ProfileLaneRoles
        lanes={{
          rows: [],
          knownGames: 0,
          undeterminedGames: null,
          undeterminedPercent: null,
          examined: 0,
          total: null,
          sufficient: false,
        }}
        error={null}
        onRetry={() => {}}
      />,
    )
    expect(html).toContain('Недостаточно данных')
  })

  it('показывает четыре сводных числа и неопределённую линию', () => {
    const html = render(
      <ProfileLaneRoles
        lanes={{
          rows: [{ laneRole: 2, games: 40, wins: 20, winRatePercent: 50, sharePercent: 16 }],
          knownGames: 40,
          undeterminedGames: 210,
          undeterminedPercent: 84,
          examined: 250,
          total: 250,
          sufficient: true,
        }}
        error={null}
        onRetry={() => {}}
      />,
    )
    expect(html).toContain('Центральная линия')
    expect(html).toContain('50 %')
    expect(html).toContain('Всего матчей')
    expect(html).toContain('Учтено в распределении')
    expect(html).toContain('Неопределённая линия')
  })
})

describe('ProfileSavedAnalyses: анализы', () => {
  const item: HistoryReportItem = {
    id: 'row-1',
    userId: 'user-1',
    matchId: '9007760151',
    status: 'ready',
    source: 'opendota',
    rulesVersion: '1.0.0',
    createdAt: '2026-11-18T00:00:00.000Z',
    fetchedAt: null,
    radiantWin: true,
  }

  it('различает пустую историю и ошибку', () => {
    expect(render(<ProfileSavedAnalyses state={{ status: 'empty' }} onRetry={() => {}} />)).toContain(
      'Сохранённых анализов пока нет',
    )
    expect(
      render(<ProfileSavedAnalyses state={{ status: 'error', message: 'x' }} onRetry={() => {}} />),
    ).toContain('Повторить')
  })

  it('показывает сохранённый отчёт и ссылку на открытие', () => {
    const html = render(
      <ProfileSavedAnalyses state={{ status: 'list', items: [item], skipped: 0 }} onRetry={() => {}} />,
    )
    expect(html).toContain('9007760151')
    expect(html).toContain('/matches/9007760151')
  })
})

describe('Локализация профиля (RU/EN)', () => {
  it('английский интерфейс не содержит кириллицы', () => {
    const html = render(
      <ProfileOverview
        record={RECORD}
        recordError={null}
        latestMatch={MATCH}
        recentError={null}
        onRetry={() => {}}
      />,
      'en',
    )
    expect(html).toContain('Win rate')
    expect(html).toContain('Magnus')
    expect(html).not.toMatch(CYRILLIC)
  })
})