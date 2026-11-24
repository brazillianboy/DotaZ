import type { LaneRole } from './benchmarks'

/**
 * Расчёты личного профиля игрока (Task 20B).
 *
 * Модуль чистый: без сети, React, Supabase и глобального состояния. Входные
 * значения уже проверены парсером ответа OpenDota (`opendotaPlayer.ts`), поэтому
 * здесь нет «догадок»: любое отсутствующее значение остаётся `null` и никогда не
 * подменяется нулём. Легитимный ноль (например, «0 матчей за неделю») сохраняется.
 *
 * Все определения ниже — часть методики, а не оформление:
 *  - винрейт = победы / (победы + поражения), округление до 0,1 п.п.;
 *  - окно активности — ровно 90 суток назад от момента расчёта (UTC);
 *  - линия берётся из агрегата OpenDota `lane_role` 1–4 и не выводится из героя.
 */

/** Окно выборки истории для тепловой карты (~10 лет назад, фильтр `date=…` OpenDota). */
export const HEATMAP_HISTORY_WINDOW_DAYS = 3650

/** Минимальное число матчей с определённой линией, при котором распределение показывается. */
export const MIN_LANE_SAMPLE = 20

/** Размер страницы истории матчей OpenDota (`/players/{id}/matches`). */
export const MATCHES_PAGE_LIMIT = 100

/** Верхняя граница пагинации: не больше этого числа страниц за один вызов. */
export const MATCHES_MAX_PAGES = 30

/** Верхняя граница числа полученных записей: защита от бесконечной выгрузки. */
export const MATCHES_MAX_RECORDS = 3000

const SECONDS_IN_DAY = 86_400

/** Итог по всему аккаунту из `GET /players/{id}/wl`. */
export interface PlayerRecord {
  wins: number
  losses: number
  /** `wins + losses` — сумма, которую подтверждает OpenDota. */
  total: number
  /** Винрейт в процентах либо `null`, если подтверждённых матчей нет. */
  winRatePercent: number | null
}

/** Результат матча для конкретного слота участника. */
export type MatchOutcome = 'win' | 'loss' | 'unknown'

/** Строка последних матчей. */
export interface RecentMatch {
  /** ID матча — точная строка (как в остальном приложении). */
  matchId: string
  heroId: number
  outcome: MatchOutcome
  kills: number | null
  deaths: number | null
  assists: number | null
  /** Длительность в секундах либо `null`, если значение некорректно. */
  durationSeconds: number | null
  /** Время начала в ISO-8601 (UTC) либо `null`. */
  startTime: string | null
  /** Класс линии из того же ответа OpenDota; `null`, если не определён. */
  laneRole: LaneRole | null
}

/** Статистика героя за всё время из `GET /players/{id}/heroes`. */
export interface PlayerHeroStat {
  heroId: number
  games: number
  wins: number
  winRatePercent: number | null
}

/** Строка распределения по линиям (только роли 1–4). */
export interface LaneDistributionRow {
  laneRole: LaneRole
  games: number
  wins: number
  winRatePercent: number | null
  /** Доля от всей обследованной популяции (`examined`), в процентах (0,1 п.п.). */
  sharePercent: number
}

/** Отдельный бакет «линия не определена» (`lane_role = 0`) для полной картины. */
export interface UndeterminedLaneBucket {
  games: number
  /** Доля от всей обследованной популяции (`examined`), в процентах (0,1 п.п.). */
  sharePercent: number
}

/** Распределение по линиям с честным указанием покрытия полной истории. */
export interface LaneDistribution {
  rows: LaneDistributionRow[]
  /** Матчи, у которых линия определена (сумма ролей 1–4). */
  knownGames: number
  /** Матчи без определённой линии (`lane_role = 0`) либо `null`, если бакета нет. */
  undeterminedGames: number | null
  /** Доля «неопределённой линии» от `examined`, 0,1 п.п.; `null`, если бакета нет. */
  undeterminedPercent: number | null
  /** Матчи, обследованные агрегатом OpenDota (сумма всех бакетов `lane_role`). */
  examined: number
  /** Всего матчей, зафиксированных OpenDota (`/wl` win+lose); `null`, если неизвестно. */
  total: number | null
  /** true — выборки достаточно для вывода о предпочитаемой линии. */
  sufficient: boolean
}

/** Одна ячейка тепловой карты активности. */
export interface ActivityHeatCell {
  /** UTC-дата в формате `YYYY-MM-DD` (технический ключ, не переводится). */
  dateKey: string
  /** Начало этой UTC-даты в unix-секундах. */
  startSeconds: number
  /** Количество матчей за эту дату (в UTC). */
  matches: number
  /**
   * true — день входит в покрытие выборки: тогда 0 — подтверждённое отсутствие
   * матчей. false — дня нет в выборке (данные недоступны), это не ноль.
   */
  available: boolean
}

/** Колонка недели: 7 строк (понедельник первым); `null` — выравнивающая пустая ячейка. */
export type ActivityHeatWeek = (ActivityHeatCell | null)[]

/** Подпись месяца над сеткой. */
export interface ActivityHeatMonthStart {
  /** Ключ месяца `YYYY-MM` (для локализованной подписи). */
  monthKey: string
  /** Индекс колонки недели, с которой начинается месяц. */
  weekIndex: number
}

/** Тепловая карта активности за календарный год (GitHub-стиль). */
export interface ActivityHeatmap {
  year: number
  /** Колонки недель, понедельник первым. */
  weeks: ActivityHeatWeek[]
  /** Начала месяцев для подписей сверху. */
  monthStarts: ActivityHeatMonthStart[]
  /** Матчей в выбранном году. */
  totalMatches: number
  /** ISO-начало покрытия выборки; дни раньше — «нет данных». */
  coverageStart: string | null
  /** true — история оборвана по лимиту: дни старше `coverageStart` недоступны, а не «0». */
  truncated: boolean
}

/** Максимум матчей, который возвращает OpenDota в `/recentMatches`. */
export const RECENT_MATCHES_SAMPLE_LIMIT = 20

/**
 * Винрейт в процентах с округлением до 0,1 п.п.
 *
 * Возвращает `null`, если значения некорректны или подтверждённых матчей нет:
 * «0 из 0» — это отсутствие данных, а не 0 %.
 */
export function computeWinRate(wins: number | null, losses: number | null): number | null {
  if (wins === null || losses === null) {
    return null
  }
  if (!Number.isInteger(wins) || !Number.isInteger(losses) || wins < 0 || losses < 0) {
    return null
  }
  const total = wins + losses
  if (total <= 0) {
    return null
  }
  return Math.round((wins / total) * 1000) / 10
}

/**
 * Итог матча по подтверждённым полям OpenDota.
 *
 * `player_slot` 0–4 — Radiant, 128–132 — Dire. Результат выводится только из
 * пары `radiant_win` + `player_slot`; если хотя бы одного поля нет, результат
 * неизвестен (никаких выводов из статистики игрока).
 */
export function matchOutcome(radiantWin: unknown, playerSlot: unknown): MatchOutcome {
  if (typeof radiantWin !== 'boolean') {
    return 'unknown'
  }
  if (
    typeof playerSlot !== 'number' ||
    !Number.isInteger(playerSlot) ||
    playerSlot < 0 ||
    playerSlot > 255
  ) {
    return 'unknown'
  }
  const isRadiant = playerSlot < 128
  return radiantWin === isRadiant ? 'win' : 'loss'
}

/**
 * Сортировка героев по фактическому количеству матчей.
 * Дополнительные ключи (победы, `hero_id`) делают порядок детерминированным.
 */
export function sortHeroStats(stats: readonly PlayerHeroStat[]): PlayerHeroStat[] {
  return [...stats].sort((a, b) => {
    if (b.games !== a.games) {
      return b.games - a.games
    }
    if (b.wins !== a.wins) {
      return b.wins - a.wins
    }
    return a.heroId - b.heroId
  })
}

/** Срез самых играемых героев с сохранением фактического порядка. */
export function topHeroStats(stats: readonly PlayerHeroStat[], limit: number): PlayerHeroStat[] {
  if (!Number.isInteger(limit) || limit <= 0) {
    return []
  }
  return sortHeroStats(stats).slice(0, limit)
}

/**
 * Распределение по линиям из агрегата `GET /players/{id}/counts` → `lane_role`.
 *
 * Агрегат покрывает **всю** историю матчей, зафиксированных OpenDota. Принимаются
 * роли 1–4 (`LaneRole`) плюс отдельный бакет `0` («линия не определена»: это
 * матчи, по которым у OpenDota нет данных о линии — обычно неразобранные
 * повторы/ранние матчи, а не «лес/роуминг»). Доли считаются от **обследованной**
 * популяции (`examined` = сумма всех бакетов), чтобы неопределённая линия была
 * видна как часть полной истории, а не скрыта за счёткой только известных линий.
 *
 * Если матчей с определённой линией меньше `MIN_LANE_SAMPLE`, распределение
 * помечается недостаточным для вывода о предпочитаемой линии.
 */
export function buildLaneDistribution(
  counts: ReadonlyMap<number, { games: number; wins: number }> | null,
  total: number | null,
): LaneDistribution | null {
  if (counts === null) {
    return null
  }
  const rows: LaneDistributionRow[] = []
  for (const laneRole of [1, 2, 3, 4] as const) {
    const entry = counts.get(laneRole)
    if (entry === undefined || entry.games <= 0) {
      continue
    }
    rows.push({
      laneRole,
      games: entry.games,
      wins: entry.wins,
      winRatePercent: computeWinRate(entry.wins, entry.games - entry.wins),
      sharePercent: 0,
    })
  }
  const knownGames = rows.reduce((sum, row) => sum + row.games, 0)
  const undeterminedEntry = counts.get(0)
  const undeterminedGames =
    undeterminedEntry !== undefined && undeterminedEntry.games > 0 ? undeterminedEntry.games : 0
  const examined = knownGames + undeterminedGames

  const withShares = rows.map((row) => ({
    ...row,
    sharePercent: examined > 0 ? Math.round((row.games / examined) * 1000) / 10 : 0,
  }))
  const undeterminedPercent =
    examined > 0 ? Math.round((undeterminedGames / examined) * 1000) / 10 : 0

  return {
    rows: withShares,
    knownGames,
    undeterminedGames: undeterminedEntry === undefined ? null : undeterminedGames,
    undeterminedPercent: undeterminedEntry === undefined ? null : undeterminedPercent,
    examined,
    total,
    sufficient: knownGames >= MIN_LANE_SAMPLE,
  }
}

/** UTC-дата (`YYYY-MM-DD`) для unix-секунд. Технический ключ календаря. */
export function utcDateKey(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

/** Сдвиг даты `YYYY-MM-DD` в сетке с понедельника (0–6). */
export function mondayShift(dateKey: string): number {
  return (new Date(`${dateKey}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** Календарные годы, по которым есть данные (для селектора), по убыванию. */
export function heatmapYears(
  matches: readonly { startTime: string | null }[],
  now: Date,
): number[] {
  const years = new Set<number>([now.getUTCFullYear()])
  for (const match of matches) {
    if (match.startTime === null) {
      continue
    }
    const seconds = Math.floor(new Date(match.startTime).getTime() / 1000)
    if (Number.isFinite(seconds)) {
      years.add(new Date(seconds * 1000).getUTCFullYear())
    }
  }
  return [...years].filter((year) => Number.isInteger(year)).sort((a, b) => b - a)
}

/**
 * Тепловая карта активности за календарный год (GitHub-стиль, Task 20B.5).
 *
 * Методика:
 *  - недели идут столбцами, 7 строк — от понедельника к воскресенью;
 *  - матчи раскладываются по `utcDateKey(start_time)` (UTC), дубликаты `matchId`
 *    не учитываются дважды;
 *  - день «подтверждённый ноль» — только если он входит в покрытие выборки
 *    (`startSeconds >= coverageStartSeconds`); дни старше покрытия помечаются
 *    `available: false` и трактуются как «нет данных», а не как ноль.
 */
export function buildActivityHeatmap(
  matches: readonly { matchId: string | null; startTime: string | null }[],
  options: {
    year: number
    now: Date
    /** true — пагинация источника была оборвана, не исчерпав историю. */
    truncated: boolean
    /** Начало покрытия выборки в unix-секундах (0 — покрытие полное). */
    coverageStartSeconds: number
  },
): ActivityHeatmap {
  const year = options.year
  const nowSeconds = Math.floor(options.now.getTime() / 1000)
  const yearStart = Math.floor(Date.UTC(year, 0, 1) / 1000)
  const yearEnd = Math.min(Math.floor(Date.UTC(year + 1, 0, 1) / 1000), nowSeconds)

  // Подсчёт матчей по дням с дедупликацией matchId.
  const counts = new Map<string, number>()
  const seen = new Set<string>()
  for (const match of matches) {
    if (match.startTime === null) {
      continue
    }
    const seconds = Math.floor(new Date(match.startTime).getTime() / 1000)
    if (!Number.isFinite(seconds) || seconds < yearStart || seconds > yearEnd) {
      continue
    }
    const dedupKey = match.matchId === null ? `t:${seconds}` : `m:${match.matchId}`
    if (seen.has(dedupKey)) {
      continue
    }
    seen.add(dedupKey)
    const dateKey = utcDateKey(seconds)
    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1)
  }
  const totalMatches = [...counts.values()].reduce((sum, value) => sum + value, 0)

  const coverageStartSeconds = options.coverageStartSeconds
  const weeks: ActivityHeatWeek[] = []
  const monthStarts: ActivityHeatMonthStart[] = []
  const firstOffset = mondayShift(utcDateKey(yearStart))
  let current: (ActivityHeatCell | null)[] = Array.from({ length: firstOffset }, () => null)
  let weekIndex = 0
  let lastMonth = ''

  for (let seconds = yearStart; seconds < yearEnd; seconds += SECONDS_IN_DAY) {
    const dateKey = utcDateKey(seconds)
    const cell: ActivityHeatCell = {
      dateKey,
      startSeconds: seconds,
      matches: counts.get(dateKey) ?? 0,
      available: seconds >= coverageStartSeconds,
    }
    const monthKey = dateKey.slice(0, 7)
    if (monthKey !== lastMonth) {
      monthStarts.push({ monthKey, weekIndex })
      lastMonth = monthKey
    }
    current.push(cell)
    if (current.length === 7) {
      weeks.push(current)
      current = []
      weekIndex += 1
    }
  }
  if (current.length > 0) {
    while (current.length < 7) {
      current.push(null)
    }
    weeks.push(current)
  }

  return {
    year,
    weeks,
    monthStarts,
    totalMatches,
    coverageStart: coverageStartSeconds > 0 ? new Date(coverageStartSeconds * 1000).toISOString() : null,
    truncated: options.truncated,
  }
}
