import { ANALYSIS_RULES_VERSION, analyzePlayer } from './analysisRules'
import type {
  AnalysisEvidence,
  AnalysisLimitation,
  AnalysisObservation,
  AnalysisRecommendation,
  PlayerAnalysis,
} from '../types/analysis'
import type { LaningPurchase, LaningStageData, NormalizedMatch, NormalizedPlayer } from '../types/match'

/**
 * Личные отчёты о матчах (Task 11): типы, правила сборки снимков, валидация
 * сохранённых JSONB и сервис доступа к `public.match_reports`.
 *
 * Принципы:
 *  - ID матча хранится точной строкой (без числовых преобразований);
 *  - сохраняется весь матч (все участники) и анализ каждого участника;
 *  - отсутствующие значения остаются `null` и никогда не подменяются нулём;
 *  - сохранённый снимок — источник истины: он не пересчитывается новым кодом;
 *  - некорректный снимок не принимается молча, а честно отклоняется.
 *
 * Модуль не содержит React и не обращается к сети: работа с Supabase вынесена в
 * адаптер (`matchReportsSupabase.ts`), оркестрация — в `matchReportFlow.ts`.
 */

/** Версия формата снимка отчёта (меняется при несовместимом изменении структуры). */
export const MATCH_REPORT_SNAPSHOT_VERSION = 1

/** Атрибуция источника данных отчёта. */
export const MATCH_REPORT_SOURCE = 'OpenDota' as const

export type MatchReportSource = typeof MATCH_REPORT_SOURCE

/** Допустимые статусы отчёта (совпадают с CHECK-ограничением таблицы). */
export type MatchReportStatus = 'pending' | 'ready' | 'partial' | 'error'

/** Статусы, при которых сохранённый отчёт считается готовым к показу. */
export const USABLE_REPORT_STATUSES: readonly MatchReportStatus[] = ['ready', 'partial']

/** Статус, записываемый новой строкой отчёта (см. `determineReportStatus`). */
export type NewReportStatus = Extract<MatchReportStatus, 'ready' | 'partial'>

/** Снимок нормализованного матча (содержимое `match_payload`). */
export interface StoredMatchSnapshot {
  snapshot_version: number
  match: NormalizedMatch
  /** Ограничения данных, обнаруженные при сборке снимка (честно, без догадок). */
  limitations: AnalysisLimitation[]
}

/** Анализ одного участника в составе снимка анализа. */
export interface StoredPlayerAnalysis {
  player_slot: number
  analysis: PlayerAnalysis
}

/** Снимок анализа всех участников (содержимое `analysis_payload`). */
export interface StoredAnalysisSnapshot {
  snapshot_version: number
  rules_version: string
  players: StoredPlayerAnalysis[]
}

/** Данные для вставки строки в `public.match_reports`. */
export interface MatchReportInsert {
  user_id: string
  /** Проверенный ID матча из маршрута — точная строка. */
  match_id: string
  status: NewReportStatus
  match_payload: StoredMatchSnapshot
  analysis_payload: StoredAnalysisSnapshot
  rules_version: string
  source: MatchReportSource
  /** Фактическое время успешного получения данных OpenDota (ISO 8601) или `null`. */
  fetched_at: string | null
}

/** Отчёт, подготовленный для отображения (сохранённый или только что сформированный). */
export interface MatchReportView {
  /** `null` — отчёт не сохранён в базе (гость, ошибка записи, незавершённая запись). */
  id: string | null
  /** Владелец отчёта; `null`, если отчёт ещё не сохранён. */
  userId: string | null
  matchId: string
  status: MatchReportStatus
  rulesVersion: string
  source: MatchReportSource
  fetchedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  match: NormalizedMatch
  analyses: StoredPlayerAnalysis[]
  limitations: AnalysisLimitation[]
}

/** Глубокая копия стадии линии: снимок не должен разделять ссылки с исходными данными. */
function cloneLaning(laning: LaningStageData): LaningStageData {
  const purchases: LaningPurchase[] | null =
    laning.purchasesFirst10 === null
      ? null
      : laning.purchasesFirst10.map((purchase) => ({ time: purchase.time, key: purchase.key }))
  return { ...laning, purchasesFirst10: purchases }
}

/** Глубокая копия участника: сохраняются все поля, включая `null`. */
function clonePlayer(player: NormalizedPlayer): NormalizedPlayer {
  return { ...player, laning: cloneLaning(player.laning) }
}

/**
 * Сборка снимка матча: сохраняются все участники и их статистика целиком.
 * `requestedId` — проверенный ID из маршрута; расхождение фиксируется ограничением.
 */
export function buildMatchSnapshot(match: NormalizedMatch, requestedId: string): StoredMatchSnapshot {
  const limitations: AnalysisLimitation[] = []

  if (match.match_id === null) {
    limitations.push({
      code: 'match.id.missing',
      text: 'Ответ OpenDota не содержит ID матча: соответствие данных подтверждено только по адресу запроса.',
    })
  } else if (match.match_id !== requestedId) {
    limitations.push({
      code: 'match.id.mismatch',
      text: `ID матча в ответе OpenDota (${match.match_id}) не совпадает с запрошенным (${requestedId}).`,
    })
  }

  if (match.duration === null) {
    limitations.push({
      code: 'match.duration.missing',
      text: 'Длительность матча отсутствует или некорректна в ответе OpenDota.',
    })
  }
  if (match.radiant_win === null) {
    limitations.push({
      code: 'match.winner.missing',
      text: 'Победитель матча не указан в ответе OpenDota.',
    })
  }

  if (match.players.length === 0) {
    limitations.push({
      code: 'players.empty',
      text: 'В ответе OpenDota нет ни одного участника с корректным player_slot.',
    })
  } else if (match.players.length < 10) {
    limitations.push({
      code: 'players.incomplete',
      text: `Получены данные только о ${match.players.length} участниках из 10 — часть данных матча недоступна.`,
    })
  }

  return {
    snapshot_version: MATCH_REPORT_SNAPSHOT_VERSION,
    match: {
      match_id: match.match_id,
      duration: match.duration,
      radiant_win: match.radiant_win,
      players: match.players.map(clonePlayer),
    },
    limitations,
  }
}

/**
 * Сборка снимка анализа: для каждого участника выполняется существующий движок
 * правил (Task 9). Новых оценок и сущностей не создаётся.
 */
export function buildAnalysisSnapshot(match: NormalizedMatch): StoredAnalysisSnapshot {
  return {
    snapshot_version: MATCH_REPORT_SNAPSHOT_VERSION,
    rules_version: ANALYSIS_RULES_VERSION,
    players: match.players.map((player) => ({
      player_slot: player.player_slot,
      analysis: analyzePlayer(match, player),
    })),
  }
}

/**
 * Статус нового отчёта.
 *
 * `ready` — только при подтверждённой полноте: ID матча совпадает с запрошенным,
 * известны длительность и победитель, есть хотя бы один участник. Успешный HTTP-ответ
 * сам по себе полноту не подтверждает. Во всех остальных случаях — `partial`.
 */
export function determineReportStatus(
  snapshot: StoredMatchSnapshot,
  requestedId: string,
): NewReportStatus {
  const complete =
    snapshot.match.match_id === requestedId &&
    snapshot.match.duration !== null &&
    snapshot.match.radiant_win !== null &&
    snapshot.match.players.length > 0
  return complete ? 'ready' : 'partial'
}

/**
 * Полная сборка данных для сохранения нового личного отчёта.
 * `fetchedAt` — фактическое время успешного ответа OpenDota (ISO 8601) или `null`,
 * если время не зафиксировано (подставлять текущее время вместо истории нельзя).
 */
export function buildReportInsert(params: {
  userId: string
  requestedId: string
  match: NormalizedMatch
  fetchedAt: string | null
}): MatchReportInsert {
  const snapshot = buildMatchSnapshot(params.match, params.requestedId)
  return {
    user_id: params.userId,
    match_id: params.requestedId,
    status: determineReportStatus(snapshot, params.requestedId),
    match_payload: snapshot,
    analysis_payload: buildAnalysisSnapshot(params.match),
    rules_version: ANALYSIS_RULES_VERSION,
    source: MATCH_REPORT_SOURCE,
    fetched_at: params.fetchedAt,
  }
}

/**
 * Отображение «свежего» (ещё не сохранённого) отчёта: используется, когда запись
 * в базу не выполнялась или не удалась. `id` и временные метки остаются `null`,
 * поэтому такой отчёт нельзя принять за сохранённый.
 */
export function buildPendingView(params: {
  userId: string | null
  requestedId: string
  match: NormalizedMatch
  fetchedAt: string | null
}): MatchReportView {
  const snapshot = buildMatchSnapshot(params.match, params.requestedId)
  return {
    id: null,
    userId: params.userId,
    matchId: params.requestedId,
    status: determineReportStatus(snapshot, params.requestedId),
    rulesVersion: ANALYSIS_RULES_VERSION,
    source: MATCH_REPORT_SOURCE,
    fetchedAt: params.fetchedAt,
    createdAt: null,
    updatedAt: null,
    match: snapshot.match,
    analyses: buildAnalysisSnapshot(params.match).players,
    limitations: snapshot.limitations,
  }
}

/** Анализ конкретного участника из снимка отчёта (без пересчёта правил). */
export function findStoredPlayerAnalysis(
  view: MatchReportView,
  playerSlot: number | null,
): PlayerAnalysis | null {
  if (playerSlot === null) {
    return null
  }
  const stored = view.analyses.find((item) => item.player_slot === playerSlot)
  return stored === undefined ? null : stored.analysis
}

/**
 * Фактическое уведомление о расхождении версий правил.
 * Возвращает `null`, если версии совпадают: старый отчёт не пересчитывается и не
 * обновляется автоматически, но пользователь должен знать о различии.
 */
export function rulesVersionNotice(storedVersion: string, currentVersion: string): string | null {
  if (storedVersion === currentVersion) {
    return null
  }
  return (
    `Отчёт сохранён с версией правил анализа ${storedVersion}; текущая версия правил — ` +
    `${currentVersion}. Показаны сохранённые наблюдения без пересчёта.`
  )
}

/* -------------------------------------------------------------------------- */
/* Валидация сохранённых JSONB-снимков                                         */
/* -------------------------------------------------------------------------- */

type Parse<T> = { ok: true; value: T } | { ok: false }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseNonEmptyString(value: unknown): Parse<string> {
  return typeof value === 'string' && value.length > 0 ? { ok: true, value } : { ok: false }
}

function parseString(value: unknown): Parse<string> {
  return typeof value === 'string' ? { ok: true, value } : { ok: false }
}

function parseNullableString(value: unknown): Parse<string | null> {
  if (value === null || value === undefined) {
    return { ok: true, value: null }
  }
  return typeof value === 'string' ? { ok: true, value } : { ok: false }
}

function parseNullableNumber(value: unknown): Parse<number | null> {
  if (value === null) {
    return { ok: true, value: null }
  }
  return typeof value === 'number' && Number.isFinite(value) ? { ok: true, value } : { ok: false }
}

function parseNullableInteger(value: unknown): Parse<number | null> {
  const parsed = parseNullableNumber(value)
  if (!parsed.ok) {
    return { ok: false }
  }
  if (parsed.value === null) {
    return { ok: true, value: null }
  }
  return Number.isInteger(parsed.value) ? { ok: true, value: parsed.value } : { ok: false }
}

function parseArray(value: unknown): Parse<unknown[]> {
  return Array.isArray(value) ? { ok: true, value } : { ok: false }
}

/** Строковый массив (используется для `limitations` внутри наблюдений). */
function parseStringArray(value: unknown): Parse<string[]> {
  const parsed = parseArray(value)
  if (!parsed.ok) {
    return { ok: false }
  }
  const result: string[] = []
  for (const item of parsed.value) {
    if (typeof item !== 'string') {
      return { ok: false }
    }
    result.push(item)
  }
  return { ok: true, value: result }
}

/** Подтверждение наблюдения: поле, значение, период, источник. */
function parseEvidence(value: unknown): Parse<AnalysisEvidence> {
  if (!isRecord(value)) {
    return { ok: false }
  }
  const field = parseNonEmptyString(value.field)
  const period = parseNonEmptyString(value.period)
  const source = parseString(value.source)
  const rawValue = value.value
  const valueOk =
    typeof rawValue === 'string' ||
    typeof rawValue === 'boolean' ||
    (typeof rawValue === 'number' && Number.isFinite(rawValue))
  if (!field.ok || !period.ok || !source.ok || !valueOk) {
    return { ok: false }
  }
  return {
    ok: true,
    value: {
      field: field.value,
      value: rawValue as AnalysisEvidence['value'],
      period: period.value,
      source: source.value as AnalysisEvidence['source'],
    },
  }
}

function parseEvidenceList(value: unknown): Parse<AnalysisEvidence[]> {
  const parsed = parseArray(value)
  if (!parsed.ok) {
    return { ok: false }
  }
  const result: AnalysisEvidence[] = []
  for (const item of parsed.value) {
    const evidence = parseEvidence(item)
    if (!evidence.ok) {
      return { ok: false }
    }
    result.push(evidence.value)
  }
  return { ok: true, value: result }
}

/** Ограничение анализа: машинный код и понятное описание. */
function parseLimitation(value: unknown): Parse<AnalysisLimitation> {
  if (!isRecord(value)) {
    return { ok: false }
  }
  const code = parseNonEmptyString(value.code)
  const text = parseString(value.text)
  if (!code.ok || !text.ok) {
    return { ok: false }
  }
  return { ok: true, value: { code: code.value, text: text.value } }
}

function parseLimitationList(value: unknown): Parse<AnalysisLimitation[]> {
  const parsed = parseArray(value)
  if (!parsed.ok) {
    return { ok: false }
  }
  const result: AnalysisLimitation[] = []
  for (const item of parsed.value) {
    const limitation = parseLimitation(item)
    if (!limitation.ok) {
      return { ok: false }
    }
    result.push(limitation.value)
  }
  return { ok: true, value: result }
}

function parseObservation(value: unknown): Parse<AnalysisObservation> {
  if (!isRecord(value)) {
    return { ok: false }
  }
  const ruleId = parseNonEmptyString(value.rule_id)
  const ruleVersion = parseNonEmptyString(value.rule_version)
  const playerSlot = parseNullableInteger(value.player_slot)
  const metric = parseNonEmptyString(value.metric)
  const period = parseNonEmptyString(value.period)
  const source = parseString(value.source)
  const text = parseString(value.text)
  const evidence = parseEvidenceList(value.evidence)
  const limitations = parseStringArray(value.limitations)
  if (
    !ruleId.ok ||
    !ruleVersion.ok ||
    !playerSlot.ok ||
    playerSlot.value === null ||
    !metric.ok ||
    !period.ok ||
    !source.ok ||
    !text.ok ||
    !evidence.ok ||
    !limitations.ok
  ) {
    return { ok: false }
  }
  return {
    ok: true,
    value: {
      rule_id: ruleId.value,
      rule_version: ruleVersion.value,
      player_slot: playerSlot.value,
      metric: metric.value,
      period: period.value,
      source: source.value as AnalysisObservation['source'],
      text: text.value,
      evidence: evidence.value,
      limitations: limitations.value,
    },
  }
}

function parseRecommendation(value: unknown): Parse<AnalysisRecommendation> {
  if (!isRecord(value)) {
    return { ok: false }
  }
  const ruleId = parseNonEmptyString(value.rule_id)
  const ruleVersion = parseNonEmptyString(value.rule_version)
  const playerSlot = parseNullableInteger(value.player_slot)
  const text = parseString(value.text)
  const evidence = parseEvidenceList(value.evidence)
  const limitations = parseStringArray(value.limitations)
  if (
    !ruleId.ok ||
    !ruleVersion.ok ||
    !playerSlot.ok ||
    playerSlot.value === null ||
    !text.ok ||
    !evidence.ok ||
    !limitations.ok
  ) {
    return { ok: false }
  }
  return {
    ok: true,
    value: {
      rule_id: ruleId.value,
      rule_version: ruleVersion.value,
      player_slot: playerSlot.value,
      text: text.value,
      evidence: evidence.value,
      limitations: limitations.value,
    },
  }
}

function parsePlayerAnalysis(value: unknown): Parse<PlayerAnalysis> {
  if (!isRecord(value)) {
    return { ok: false }
  }
  const ruleVersion = parseNonEmptyString(value.rule_version)
  const playerSlot = parseNullableInteger(value.player_slot)
  const observations = parseArray(value.observations)
  const recommendations = parseArray(value.recommendations)
  const limitations = parseLimitationList(value.limitations)
  if (
    !ruleVersion.ok ||
    !playerSlot.ok ||
    playerSlot.value === null ||
    !observations.ok ||
    !recommendations.ok ||
    !limitations.ok
  ) {
    return { ok: false }
  }

  const parsedObservations: AnalysisObservation[] = []
  for (const item of observations.value) {
    const parsed = parseObservation(item)
    if (!parsed.ok) {
      return { ok: false }
    }
    parsedObservations.push(parsed.value)
  }

  const parsedRecommendations: AnalysisRecommendation[] = []
  for (const item of recommendations.value) {
    const parsed = parseRecommendation(item)
    if (!parsed.ok) {
      return { ok: false }
    }
    parsedRecommendations.push(parsed.value)
  }

  return {
    ok: true,
    value: {
      rule_version: ruleVersion.value,
      player_slot: playerSlot.value,
      observations: parsedObservations,
      recommendations: parsedRecommendations,
      limitations: limitations.value,
      // Производные поля восстанавливаются из данных, а не берутся на веру.
      hasObservations: parsedObservations.length > 0,
      recommendationsNote:
        typeof value.recommendationsNote === 'string' ? value.recommendationsNote : null,
    },
  }
}

function parseTeam(value: unknown): Parse<NormalizedPlayer['team']> {
  if (value === null || value === 'radiant' || value === 'dire') {
    return { ok: true, value: value as NormalizedPlayer['team'] }
  }
  return { ok: false }
}

function parsePurchase(value: unknown): Parse<LaningPurchase> {
  if (!isRecord(value)) {
    return { ok: false }
  }
  const time = parseNullableNumber(value.time)
  const key = parseNonEmptyString(value.key)
  if (!time.ok || time.value === null || !key.ok) {
    return { ok: false }
  }
  return { ok: true, value: { time: time.value, key: key.value } }
}

function parsePurchases(value: unknown): Parse<LaningPurchase[] | null> {
  if (value === null) {
    return { ok: true, value: null }
  }
  const parsed = parseArray(value)
  if (!parsed.ok) {
    return { ok: false }
  }
  const result: LaningPurchase[] = []
  for (const item of parsed.value) {
    const purchase = parsePurchase(item)
    if (!purchase.ok) {
      return { ok: false }
    }
    result.push(purchase.value)
  }
  return { ok: true, value: result }
}

/** Стадия линии: сохраняются как числа, так и `null` (без подстановки нулей). */
function parseLaningStageData(value: unknown): Parse<LaningStageData> {
  if (!isRecord(value)) {
    return { ok: false }
  }
  const lastHitsAt10 = parseNullableNumber(value.lastHitsAt10)
  const goldAt10 = parseNullableNumber(value.goldAt10)
  const xpAt10 = parseNullableNumber(value.xpAt10)
  const killsFirst10 = parseNullableNumber(value.killsFirst10)
  const deathsFirst10 = parseNullableNumber(value.deathsFirst10)
  const purchasesFirst10 = parsePurchases(value.purchasesFirst10)
  const laneEfficiencyPct = parseNullableNumber(value.laneEfficiencyPct)
  if (
    !lastHitsAt10.ok ||
    !goldAt10.ok ||
    !xpAt10.ok ||
    !killsFirst10.ok ||
    !deathsFirst10.ok ||
    !purchasesFirst10.ok ||
    !laneEfficiencyPct.ok
  ) {
    return { ok: false }
  }
  return {
    ok: true,
    value: {
      lastHitsAt10: lastHitsAt10.value,
      goldAt10: goldAt10.value,
      xpAt10: xpAt10.value,
      killsFirst10: killsFirst10.value,
      deathsFirst10: deathsFirst10.value,
      purchasesFirst10: purchasesFirst10.value,
      laneEfficiencyPct: laneEfficiencyPct.value,
    },
  }
}

function parseNormalizedPlayer(value: unknown): Parse<NormalizedPlayer> {
  if (!isRecord(value)) {
    return { ok: false }
  }
  const playerSlot = parseNullableInteger(value.player_slot)
  const team = parseTeam(value.team)
  const heroId = parseNullableInteger(value.hero_id)
  const kills = parseNullableInteger(value.kills)
  const deaths = parseNullableInteger(value.deaths)
  const assists = parseNullableInteger(value.assists)
  const goldPerMin = parseNullableInteger(value.gold_per_min)
  const xpPerMin = parseNullableInteger(value.xp_per_min)
  const lastHits = parseNullableInteger(value.last_hits)
  const laning = parseLaningStageData(value.laning)
  if (
    !playerSlot.ok ||
    playerSlot.value === null ||
    !team.ok ||
    !heroId.ok ||
    !kills.ok ||
    !deaths.ok ||
    !assists.ok ||
    !goldPerMin.ok ||
    !xpPerMin.ok ||
    !lastHits.ok ||
    !laning.ok
  ) {
    return { ok: false }
  }
  return {
    ok: true,
    value: {
      player_slot: playerSlot.value,
      team: team.value,
      hero_id: heroId.value,
      kills: kills.value,
      deaths: deaths.value,
      assists: assists.value,
      gold_per_min: goldPerMin.value,
      xp_per_min: xpPerMin.value,
      last_hits: lastHits.value,
      laning: laning.value,
    },
  }
}

/** Нормализованный матч: ID — строка из цифр либо `null`. */
function parseNormalizedMatch(value: unknown): Parse<NormalizedMatch> {
  if (!isRecord(value)) {
    return { ok: false }
  }
  const matchId = parseNullableString(value.match_id)
  const duration = parseNullableInteger(value.duration)
  const players = parseArray(value.players)
  if (!matchId.ok || !duration.ok || !players.ok) {
    return { ok: false }
  }
  if (matchId.value !== null && !/^\d+$/.test(matchId.value)) {
    return { ok: false }
  }
  if (duration.value !== null && duration.value < 0) {
    return { ok: false }
  }
  const radiantWin = value.radiant_win
  if (radiantWin !== null && typeof radiantWin !== 'boolean') {
    return { ok: false }
  }
  const parsedPlayers: NormalizedPlayer[] = []
  for (const item of players.value) {
    const player = parseNormalizedPlayer(item)
    if (!player.ok) {
      return { ok: false }
    }
    parsedPlayers.push(player.value)
  }
  return {
    ok: true,
    value: {
      match_id: matchId.value,
      duration: duration.value,
      radiant_win: radiantWin as boolean | null,
      players: parsedPlayers,
    },
  }
}

function parseStoredMatchSnapshot(value: unknown): Parse<StoredMatchSnapshot> {
  if (!isRecord(value) || value.snapshot_version !== MATCH_REPORT_SNAPSHOT_VERSION) {
    return { ok: false }
  }
  const match = parseNormalizedMatch(value.match)
  const limitations = parseLimitationList(value.limitations)
  if (!match.ok || !limitations.ok) {
    return { ok: false }
  }
  return {
    ok: true,
    value: {
      snapshot_version: MATCH_REPORT_SNAPSHOT_VERSION,
      match: match.value,
      limitations: limitations.value,
    },
  }
}

function parseStoredAnalysisSnapshot(value: unknown): Parse<StoredAnalysisSnapshot> {
  if (!isRecord(value) || value.snapshot_version !== MATCH_REPORT_SNAPSHOT_VERSION) {
    return { ok: false }
  }
  const rulesVersion = parseNonEmptyString(value.rules_version)
  const players = parseArray(value.players)
  if (!rulesVersion.ok || !players.ok) {
    return { ok: false }
  }
  const parsedPlayers: StoredPlayerAnalysis[] = []
  for (const item of players.value) {
    if (!isRecord(item)) {
      return { ok: false }
    }
    const playerSlot = parseNullableInteger(item.player_slot)
    const analysis = parsePlayerAnalysis(item.analysis)
    if (!playerSlot.ok || playerSlot.value === null || !analysis.ok) {
      return { ok: false }
    }
    parsedPlayers.push({ player_slot: playerSlot.value, analysis: analysis.value })
  }
  return {
    ok: true,
    value: {
      snapshot_version: MATCH_REPORT_SNAPSHOT_VERSION,
      rules_version: rulesVersion.value,
      players: parsedPlayers,
    },
  }
}

/** Причины отклонения сохранённой строки отчёта. */
export type StoredReportParseFailure = 'invalid_row' | 'invalid_payload'

export type StoredReportParseResult =
  | { ok: true; view: MatchReportView }
  | { ok: false; reason: StoredReportParseFailure; message: string }

/** Сообщение для строки с неожиданной структурой (не трогаем и не перезаписываем). */
export const INVALID_REPORT_ROW_MESSAGE =
  'Сохранённая запись отчёта имеет неожиданный формат: показать её нельзя, запись не изменяется.'

/** Сообщение для повреждённого или устаревшего формата снимка. */
export const INVALID_REPORT_PAYLOAD_MESSAGE =
  'Сохранённый снимок отчёта повреждён или имеет неизвестную версию формата: ' +
  'запись не перезаписывается, требуется решение владельца.'

/** Отображение версии правил, когда запись отчёта ещё не содержит снимка анализа. */
export const UNKNOWN_RULES_VERSION = 'не указана'

/** Ограничения незавершённой записи (payload ещё не записан). */
const MISSING_MATCH_PAYLOAD_LIMITATION: AnalysisLimitation = {
  code: 'report.match_payload.missing',
  text: 'Снимок данных матча отсутствует: запись отчёта не завершена (payload не записан).',
}

const MISSING_ANALYSIS_PAYLOAD_LIMITATION: AnalysisLimitation = {
  code: 'report.analysis_payload.missing',
  text: 'Снимок анализа отсутствует: запись отчёта не завершена (payload не записан).',
}

/**
 * Строгая проверка строки `public.match_reports` перед отображением.
 *
 * Некорректные снимки не принимаются молча и никогда не перезаписываются.
 * Незавершённые записи (`pending`/`error`) по схеме могут иметь `NULL`-payload:
 * такие строки распознаются как незавершённые, а не как повреждённые.
 */
export function parseStoredMatchReport(row: unknown): StoredReportParseResult {
  if (!isRecord(row)) {
    return { ok: false, reason: 'invalid_row', message: INVALID_REPORT_ROW_MESSAGE }
  }

  const id = parseNonEmptyString(row.id)
  const userId = parseNonEmptyString(row.user_id)
  const matchId = parseNonEmptyString(row.match_id)
  const rulesVersion = parseNullableString(row.rules_version)
  const fetchedAt = parseNullableString(row.fetched_at)
  const createdAt = parseNullableString(row.created_at)
  const updatedAt = parseNullableString(row.updated_at)
  const status = row.status
  const source = row.source

  if (
    !id.ok ||
    !userId.ok ||
    !matchId.ok ||
    !rulesVersion.ok ||
    !fetchedAt.ok ||
    !createdAt.ok ||
    !updatedAt.ok ||
    typeof status !== 'string' ||
    !(USABLE_REPORT_STATUSES as readonly string[]).concat(['pending', 'error']).includes(status) ||
    source !== MATCH_REPORT_SOURCE
  ) {
    return { ok: false, reason: 'invalid_row', message: INVALID_REPORT_ROW_MESSAGE }
  }

  if (!/^\d+$/.test(matchId.value)) {
    return { ok: false, reason: 'invalid_row', message: INVALID_REPORT_ROW_MESSAGE }
  }

  const incomplete = status === 'pending' || status === 'error'
  const rawMatchPayload = row.match_payload
  const rawAnalysisPayload = row.analysis_payload

  const matchSnapshot =
    rawMatchPayload === null || rawMatchPayload === undefined
      ? null
      : parseStoredMatchSnapshot(rawMatchPayload)
  const analysisSnapshot =
    rawAnalysisPayload === null || rawAnalysisPayload === undefined
      ? null
      : parseStoredAnalysisSnapshot(rawAnalysisPayload)

  if (matchSnapshot !== null && !matchSnapshot.ok) {
    return { ok: false, reason: 'invalid_payload', message: INVALID_REPORT_PAYLOAD_MESSAGE }
  }
  if (analysisSnapshot !== null && !analysisSnapshot.ok) {
    return { ok: false, reason: 'invalid_payload', message: INVALID_REPORT_PAYLOAD_MESSAGE }
  }
  // Готовый отчёт обязан иметь оба снимка: отсутствие любого из них — повреждение.
  if (!incomplete && (matchSnapshot === null || analysisSnapshot === null)) {
    return { ok: false, reason: 'invalid_payload', message: INVALID_REPORT_PAYLOAD_MESSAGE }
  }

  const analysisRulesVersion = analysisSnapshot === null ? null : analysisSnapshot.value.rules_version
  if (
    rulesVersion.value !== null &&
    analysisRulesVersion !== null &&
    rulesVersion.value !== analysisRulesVersion
  ) {
    return { ok: false, reason: 'invalid_payload', message: INVALID_REPORT_PAYLOAD_MESSAGE }
  }

  const limitations: AnalysisLimitation[] = matchSnapshot === null ? [] : [...matchSnapshot.value.limitations]
  if (matchSnapshot === null) {
    limitations.push(MISSING_MATCH_PAYLOAD_LIMITATION)
  }
  if (analysisSnapshot === null) {
    limitations.push(MISSING_ANALYSIS_PAYLOAD_LIMITATION)
  }

  return {
    ok: true,
    view: {
      id: id.value,
      userId: userId.value,
      matchId: matchId.value,
      status: status as MatchReportStatus,
      rulesVersion: rulesVersion.value ?? analysisRulesVersion ?? UNKNOWN_RULES_VERSION,
      source: MATCH_REPORT_SOURCE,
      fetchedAt: fetchedAt.value,
      createdAt: createdAt.value,
      updatedAt: updatedAt.value,
      match:
        matchSnapshot === null
          ? { match_id: matchId.value, duration: null, radiant_win: null, players: [] }
          : matchSnapshot.value.match,
      analyses: analysisSnapshot === null ? [] : analysisSnapshot.value.players,
      limitations,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Ошибки базы данных                                                          */
/* -------------------------------------------------------------------------- */

export type ReportDbErrorKind =
  | 'conflict'
  | 'permission'
  | 'session'
  | 'network'
  | 'invalid_payload'
  | 'unknown'

export interface ReportDbError {
  kind: ReportDbErrorKind
  /** Код PostgREST/PostgreSQL, если он есть (не является секретом). */
  code: string | null
  /** Понятное русское сообщение без технических деталей и секретов. */
  message: string
}

export const REPORT_CONFLICT_MESSAGE =
  'Отчёт для этого матча уже сохранён: используется существующая запись, новая не создаётся.'
export const REPORT_PERMISSION_MESSAGE =
  'База данных отклонила операцию: нет прав на доступ к личным отчётам (ограничения RLS).'
export const REPORT_SESSION_MESSAGE =
  'Сессия истекла или отсутствует: войдите в аккаунт и повторите действие.'
export const REPORT_NETWORK_MESSAGE =
  'Не удалось связаться с базой данных Supabase. Проверьте подключение и повторите попытку.'
export const REPORT_UNKNOWN_DB_MESSAGE =
  'Не удалось выполнить операцию с базой данных. Повторите попытку позже.'

/**
 * Классификация ошибки Supabase/PostgREST. Разные виды сбоев различаются явно:
 * ошибка прав не превращается в «отчёт не найден», а конфликт уникальности —
 * в обычную ошибку.
 */
export function classifyReportDbError(error: unknown): ReportDbError {
  if (error instanceof TypeError) {
    return { kind: 'network', code: null, message: REPORT_NETWORK_MESSAGE }
  }
  if (typeof error === 'string') {
    return /failed to fetch|network/i.test(error)
      ? { kind: 'network', code: null, message: REPORT_NETWORK_MESSAGE }
      : { kind: 'unknown', code: null, message: REPORT_UNKNOWN_DB_MESSAGE }
  }
  if (isRecord(error)) {
    const code = typeof error.code === 'string' ? error.code : null
    const status = typeof error.status === 'number' ? error.status : null
    const rawMessage = typeof error.message === 'string' ? error.message : ''
    if (code === '23505') {
      return { kind: 'conflict', code, message: REPORT_CONFLICT_MESSAGE }
    }
    if (code === '42501' || status === 403) {
      return { kind: 'permission', code, message: REPORT_PERMISSION_MESSAGE }
    }
    if (code === 'PGRST301' || status === 401) {
      return { kind: 'session', code, message: REPORT_SESSION_MESSAGE }
    }
    if (/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(rawMessage)) {
      return { kind: 'network', code, message: REPORT_NETWORK_MESSAGE }
    }
    return { kind: 'unknown', code, message: REPORT_UNKNOWN_DB_MESSAGE }
  }
  return { kind: 'unknown', code: null, message: REPORT_UNKNOWN_DB_MESSAGE }
}

/* -------------------------------------------------------------------------- */
/* Сервис личных отчётов                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Минимальный клиент доступа к `public.match_reports`.
 * Реализуется адаптером Supabase (`matchReportsSupabase.ts`); в тестах подменяется.
 * Все запросы обязательно ограничены текущим пользователем.
 */
export interface MatchReportsClient {
  /** Чтение собственной строки по паре `(user_id, match_id)`; иначе `null`. */
  selectPersonalReport(params: {
    userId: string
    matchId: string
  }): Promise<{ data: unknown; error: ReportDbError | null }>
  /** Вставка новой строки; нарушение уникальности возвращается как `kind: 'conflict'`. */
  insertPersonalReport(
    payload: MatchReportInsert,
  ): Promise<{ data: unknown; error: ReportDbError | null }>
}

export type ReportFetchResult =
  | { ok: true; report: MatchReportView | null }
  | { ok: false; error: ReportDbError }

export type ReportSaveResult =
  | { ok: true; report: MatchReportView; created: boolean }
  | { ok: false; error: ReportDbError }

export interface MatchReportsService {
  getPersonalMatchReport(params: { userId: string; matchId: string }): Promise<ReportFetchResult>
  savePersonalMatchReport(payload: MatchReportInsert): Promise<ReportSaveResult>
}

function ownershipError(): ReportDbError {
  return {
    kind: 'permission',
    code: null,
    message: 'Полученная запись принадлежит другому пользователю — операция отменена.',
  }
}

/**
 * Сервис личных отчётов: чтение и вставка с обязательной проверкой владельца.
 * Перезапись существующих снимков не выполняется ни в каком сценарии.
 */
export function createMatchReportsService(client: MatchReportsClient): MatchReportsService {
  return {
    async getPersonalMatchReport({ userId, matchId }): Promise<ReportFetchResult> {
      const { data, error } = await client.selectPersonalReport({ userId, matchId })
      if (error) {
        return { ok: false, error }
      }
      if (data === null || data === undefined) {
        return { ok: true, report: null }
      }
      const parsed = parseStoredMatchReport(data)
      if (!parsed.ok) {
        return { ok: false, error: { kind: 'invalid_payload', code: null, message: parsed.message } }
      }
      if (parsed.view.userId !== userId) {
        return { ok: false, error: ownershipError() }
      }
      return { ok: true, report: parsed.view }
    },

    async savePersonalMatchReport(payload): Promise<ReportSaveResult> {
      const { data, error } = await client.insertPersonalReport(payload)
      if (error) {
        return { ok: false, error }
      }
      const parsed = parseStoredMatchReport(data)
      if (!parsed.ok) {
        return { ok: false, error: { kind: 'invalid_payload', code: null, message: parsed.message } }
      }
      if (parsed.view.userId !== payload.user_id) {
        return { ok: false, error: ownershipError() }
      }
      return { ok: true, report: parsed.view, created: true }
    },
  }
}