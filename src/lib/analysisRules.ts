import type {
  AnalysisEvidence,
  AnalysisLimitation,
  AnalysisObservation,
  PlayerAnalysis,
} from '../types/analysis'
import type { NormalizedMatch, NormalizedPlayer } from '../types/match'
import { LANING_INTERVAL_LABEL } from './laning'

/**
 * Детерминированный движок наблюдений и рекомендаций (Task 9; интервал 15 минут).
 *
 * Принципы:
 *  - только подтверждённые факты из нормализованных данных (Tasks 6–8);
 *  - каждое наблюдение содержит правило, версию, участника, период, источник,
 *    текст и точные подтверждения (поле + значение);
 *  - отсутствующие данные не превращаются в нули и не порождают выводов;
 *  - оценки качества игры и рекомендации без подтверждённой нормы героя/роли
 *    не формируются;
 *  - функция чистая и детерминированная: без сети, БД, состояния и текущего времени.
 */

/**
 * Версия правил анализа. Изменение поведения правил требует новой версии:
 * версия `1.1.0` переводит раннюю стадию с интервала 00:00–10:00 на 00:00–15:00,
 * поэтому наблюдения версии `1.0.0` в сохранённых отчётах не пересчитываются.
 */
export const ANALYSIS_RULES_VERSION = '1.1.0'

/** Периоды, к которым относятся показатели. */
export const PERIOD_MATCH = 'весь матч'
export const PERIOD_LANING = LANING_INTERVAL_LABEL

/** Стабильные идентификаторы правил (не переименовывать без смены версии). */
export const ANALYSIS_RULE_IDS = {
  matchKda: 'match.kda',
  lastHitsAt15: 'laning.last_hits_at_15',
  laningKillsDeaths: 'laning.kills_deaths_first_15',
  goldAt15: 'laning.gold_at_15',
  xpAt15: 'laning.xp_at_15',
  purchasesFirst15: 'laning.purchases_first_15',
  laneEfficiencyPct: 'laning.efficiency_pct',
} as const

/** Сообщение, когда подтверждённых наблюдений нет вовсе. */
export const INSUFFICIENT_DATA_MESSAGE = 'Недостаточно данных для достоверной оценки.'

/** Честное пояснение, почему объективные рекомендации недоступны в v1. */
export const RECOMMENDATIONS_UNAVAILABLE_NOTE =
  'Объективные рекомендации недоступны: в документации проекта не подтверждены нормы героя и роли, ' +
  'поэтому сравнение показателей с эталоном и советы по игре не формируются. ' +
  'Наблюдения выше описывают только факты из ответа OpenDota.'

const SOURCE = 'OpenDota' as const

/** Создание подтверждения с указанием периода и источника. */
function makeEvidence(
  field: string,
  value: number | string | boolean,
  period: string,
): AnalysisEvidence {
  return { field, value, period, source: SOURCE }
}

/** Создание наблюдения с обязательными метаданными правила. */
function makeObservation(
  ruleId: string,
  playerSlot: number,
  metric: string,
  period: string,
  text: string,
  evidence: AnalysisEvidence[],
): AnalysisObservation {
  return {
    rule_id: ruleId,
    rule_version: ANALYSIS_RULES_VERSION,
    player_slot: playerSlot,
    metric,
    period,
    source: SOURCE,
    text,
    evidence,
    limitations: [],
  }
}

/**
 * Анализ одного участника матча.
 * Возвращает наблюдения, рекомендации (в v1 — пустые) и ограничения анализа.
 */
export function analyzePlayer(match: NormalizedMatch, player: NormalizedPlayer): PlayerAnalysis {
  const playerSlot = player.player_slot

  // Участник должен присутствовать в данных матча: иначе анализ не выполняется.
  const belongsToMatch = match.players.some(
    (candidate) => candidate.player_slot === playerSlot,
  )
  if (!belongsToMatch) {
    return {
      rule_version: ANALYSIS_RULES_VERSION,
      player_slot: playerSlot,
      observations: [],
      recommendations: [],
      limitations: [
        {
          code: 'player.not_in_match',
          text: 'Выбранный участник не найден в данных матча — анализ не выполнен.',
        },
      ],
      hasObservations: false,
      recommendationsNote: RECOMMENDATIONS_UNAVAILABLE_NOTE,
    }
  }

  const observations: AnalysisObservation[] = []
  const limitations: AnalysisLimitation[] = []

  // --- Правило A: K/D/A за весь матч ---
  const { kills, deaths, assists } = player
  if (kills !== null && deaths !== null && assists !== null) {
    observations.push(
      makeObservation(
        ANALYSIS_RULE_IDS.matchKda,
        playerSlot,
        'kda',
        PERIOD_MATCH,
        `Итог матча: убийства — ${kills}, смерти — ${deaths}, ассисты — ${assists}.`,
        [
          makeEvidence('kills', kills, PERIOD_MATCH),
          makeEvidence('deaths', deaths, PERIOD_MATCH),
          makeEvidence('assists', assists, PERIOD_MATCH),
        ],
      ),
    )
  } else if (kills !== null || deaths !== null || assists !== null) {
    limitations.push({
      code: 'match.kda.partial',
      text: 'Показатели K/D/A неполные — наблюдение по итогу матча не сформировано.',
    })
  } else {
    limitations.push({
      code: 'match.kda.missing',
      text: 'Итоговые показатели K/D/A отсутствуют в ответе OpenDota.',
    })
  }

  // --- Правило B: добивания к 15:00 ---
  const { lastHits } = player.laning
  if (lastHits !== null) {
    observations.push(
      makeObservation(
        ANALYSIS_RULE_IDS.lastHitsAt15,
        playerSlot,
        'last_hits_at_15',
        PERIOD_LANING,
        `Добивания к 15:00 (lh_t[15]) — ${lastHits}.`,
        [makeEvidence('lh_t[15]', lastHits, PERIOD_LANING)],
      ),
    )
  } else {
    limitations.push({
      code: 'laning.last_hits_at_15.missing',
      text: 'Нет данных о добиваниях к 15-й минуте: поминутный ряд lh_t отсутствует или короче 16 элементов.',
    })
  }

  // --- Правило C: убийства и смерти в интервале 00:00–15:00 ---
  const { killsFirst, deathsFirst } = player.laning
  if (killsFirst !== null && deathsFirst !== null) {
    observations.push(
      makeObservation(
        ANALYSIS_RULE_IDS.laningKillsDeaths,
        playerSlot,
        'kills_deaths_first_15',
        PERIOD_LANING,
        `Первые пятнадцать минут: убийства — ${killsFirst}, смерти — ${deathsFirst}.`,
        [
          makeEvidence('kills_log (00:00–15:00)', killsFirst, PERIOD_LANING),
          makeEvidence('deaths_log (00:00–15:00)', deathsFirst, PERIOD_LANING),
        ],
      ),
    )
  } else if (killsFirst !== null || deathsFirst !== null) {
    limitations.push({
      code: 'laning.events.partial',
      text: 'Журналы убийств и смертей первых пятнадцати минут доступны не полностью — наблюдение не сформировано.',
    })
  } else {
    limitations.push({
      code: 'laning.events.first_15.missing',
      text: 'Журналы событий первых пятнадцати минут (kills_log, deaths_log) отсутствуют или недостоверны.',
    })
  }

  // --- Правило D1: накопленное золото к 15:00 ---
  const { gold, xp, purchasesFirst, laneEfficiencyPct } = player.laning
  if (gold !== null) {
    observations.push(
      makeObservation(
        ANALYSIS_RULE_IDS.goldAt15,
        playerSlot,
        'gold_at_15',
        PERIOD_LANING,
        `Накопленное золото к 15:00 (gold_t[15]) — ${gold}.`,
        [makeEvidence('gold_t[15]', gold, PERIOD_LANING)],
      ),
    )
  } else {
    limitations.push({
      code: 'laning.gold_at_15.missing',
      text: 'Нет данных о золоте к 15-й минуте: поминутный ряд gold_t отсутствует или короче 16 элементов.',
    })
  }

  // --- Правило D2: накопленный опыт к 15:00 ---
  if (xp !== null) {
    observations.push(
      makeObservation(
        ANALYSIS_RULE_IDS.xpAt15,
        playerSlot,
        'xp_at_15',
        PERIOD_LANING,
        `Накопленный опыт к 15:00 (xp_t[15]) — ${xp}.`,
        [makeEvidence('xp_t[15]', xp, PERIOD_LANING)],
      ),
    )
  } else {
    limitations.push({
      code: 'laning.xp_at_15.missing',
      text: 'Нет данных об опыте к 15-й минуте: поминутный ряд xp_t отсутствует или короче 16 элементов.',
    })
  }

  // --- Правило E: покупки в интервале 00:00–15:00 ---
  if (purchasesFirst !== null) {
    observations.push(
      makeObservation(
        ANALYSIS_RULE_IDS.purchasesFirst15,
        playerSlot,
        'purchases_first_15',
        PERIOD_LANING,
        purchasesFirst.length === 0
          ? 'Покупки в интервале 00:00–15:00: 0 (журнал получен, покупок нет).'
          : `Покупки в интервале 00:00–15:00: ${purchasesFirst.length}.`,
        [makeEvidence('purchase_log (00:00–15:00)', purchasesFirst.length, PERIOD_LANING)],
      ),
    )
  } else {
    limitations.push({
      code: 'laning.purchases_first_15.missing',
      text: 'Журнал покупок недоступен — количество покупок первых пятнадцати минут не определено.',
    })
  }

  // --- Правило F: показатель эффективности линии OpenDota ---
  if (laneEfficiencyPct !== null) {
    observations.push(
      makeObservation(
        ANALYSIS_RULE_IDS.laneEfficiencyPct,
        playerSlot,
        'lane_efficiency_pct',
        PERIOD_LANING,
        `Эффективность линии по данным OpenDota (lane_efficiency_pct) — ${laneEfficiencyPct} % (значение провайдера, не пересчитано DotaZ).`,
        [makeEvidence('lane_efficiency_pct', laneEfficiencyPct, PERIOD_LANING)],
      ),
    )
  } else {
    limitations.push({
      code: 'laning.efficiency_pct.missing',
      text: 'Показатель эффективности линии (lane_efficiency_pct) отсутствует в ответе OpenDota.',
    })
  }

  // --- Принципиальное ограничение версии 1.0.0 ---
  limitations.push({
    code: 'benchmarks.hero_role_missing',
    text: 'Нормы героя и роли не подтверждены: сравнение с другими игроками, оценка качества линии и рекомендации не выполняются.',
  })

  return {
    rule_version: ANALYSIS_RULES_VERSION,
    player_slot: playerSlot,
    observations,
    recommendations: [],
    limitations,
    hasObservations: observations.length > 0,
    recommendationsNote: RECOMMENDATIONS_UNAVAILABLE_NOTE,
  }
}