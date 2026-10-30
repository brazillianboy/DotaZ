import { ANALYSIS_RULE_IDS } from '../lib/analysisRules'
import type { AnalysisEvidence, AnalysisLimitation, AnalysisObservation } from '../types/analysis'
import { interpolate, translations, type Locale, type TranslationKey } from './translations'

/**
 * Локализация аналитических текстов (Task 13).
 *
 * Источник истины — сохранённые факты: `rule_id`, `evidence` (поле + значение),
 * `metric`, `period`, `rule_version`. Тексты наблюдений формируются заново только
 * для **известных** правил: значения берутся из подтверждений, ничего не
 * пересчитывается, JSONB-снимки не изменяются.
 *
 * Для неизвестных правил и версий показывается сохранённый текст с признаком
 * `localized: false` — интерфейс честно сообщает, что перевод недоступен.
 */

export interface LocalizedText {
  text: string
  /** true — текст локализован из rule_id; false — показан сохранённый текст. */
  localized: boolean
}

const MATCH_PERIODS = new Set(['весь матч', 'whole match'])
const LANING_PERIOD = '00:00–10:00'

/** Локализация периода наблюдения; неизвестные периоды остаются как есть. */
export function localizePeriod(period: string, locale: Locale): string {
  if (MATCH_PERIODS.has(period)) {
    return translations[locale]['period.match']
  }
  if (period === LANING_PERIOD) {
    return translations[locale]['period.laning']
  }
  return period
}

/** Значение подтверждения по имени поля (evidence). */
export function findEvidenceValue(
  evidence: AnalysisEvidence[],
  field: string,
): string | number | boolean | null {
  const found = evidence.find((item) => item.field === field)
  return found === undefined ? null : found.value
}

/** Шаблоны наблюдений известных правил (текущая версия 1.1.0 — интервал 15 минут). */
export const OBSERVATION_TEMPLATES: Record<string, { ru: string; en: string }> = {
  [ANALYSIS_RULE_IDS.matchKda]: {
    ru: 'Итог матча: убийства — {kills}, смерти — {deaths}, ассисты — {assists}.',
    en: 'Match result: kills — {kills}, deaths — {deaths}, assists — {assists}.',
  },
  [ANALYSIS_RULE_IDS.lastHitsAt15]: {
    ru: 'Добивания к 15:00 (lh_t[15]) — {value}.',
    en: 'Last hits at 15:00 (lh_t[15]) — {value}.',
  },
  [ANALYSIS_RULE_IDS.laningKillsDeaths]: {
    ru: 'Первые пятнадцать минут: убийства — {kills}, смерти — {deaths}.',
    en: 'First fifteen minutes: kills — {kills}, deaths — {deaths}.',
  },
  [ANALYSIS_RULE_IDS.goldAt15]: {
    ru: 'Накопленное золото к 15:00 (gold_t[15]) — {value}.',
    en: 'Accumulated gold at 15:00 (gold_t[15]) — {value}.',
  },
  [ANALYSIS_RULE_IDS.xpAt15]: {
    ru: 'Накопленный опыт к 15:00 (xp_t[15]) — {value}.',
    en: 'Accumulated experience at 15:00 (xp_t[15]) — {value}.',
  },
  [ANALYSIS_RULE_IDS.purchasesFirst15]: {
    ru: 'Покупки в интервале 00:00–15:00: {count}.',
    en: 'Purchases in the 00:00–15:00 interval: {count}.',
  },
  [ANALYSIS_RULE_IDS.laneEfficiencyPct]: {
    ru: 'Эффективность линии по данным OpenDota (lane_efficiency_pct) — {value} % (значение провайдера, не пересчитано DotaZ).',
    en: 'Lane efficiency reported by OpenDota (lane_efficiency_pct) — {value} % (provider value, not recalculated by DotaZ).',
  },

  // --- Правила версии 1.0.0 (интервал 00:00–10:00) ---
  // Сохранены для английского перевода ранее сохранённых отчётов: их наблюдения
  // не пересчитываются, а подписи остаются 10-минутными.
  'laning.last_hits_at_10': {
    ru: 'Добивания к 10:00 (lh_t[10]) — {value}.',
    en: 'Last hits at 10:00 (lh_t[10]) — {value}.',
  },
  'laning.kills_deaths_first_10': {
    ru: 'Первые десять минут: убийства — {kills}, смерти — {deaths}.',
    en: 'First ten minutes: kills — {kills}, deaths — {deaths}.',
  },
  'laning.gold_at_10': {
    ru: 'Накопленное золото к 10:00 (gold_t[10]) — {value}.',
    en: 'Accumulated gold at 10:00 (gold_t[10]) — {value}.',
  },
  'laning.xp_at_10': {
    ru: 'Накопленный опыт к 10:00 (xp_t[10]) — {value}.',
    en: 'Accumulated experience at 10:00 (xp_t[10]) — {value}.',
  },
  'laning.purchases_first_10': {
    ru: 'Покупки в интервале 00:00–10:00: {count}.',
    en: 'Purchases in the 00:00–10:00 interval: {count}.',
  },
}

/** Известно ли правило (поддерживается ли локализация наблюдения). */
export function isKnownRule(ruleId: string): boolean {
  return Object.prototype.hasOwnProperty.call(OBSERVATION_TEMPLATES, ruleId)
}

/** Параметры шаблона наблюдения из подтверждений; `null`, если данных не хватает. */
function observationParams(
  observation: AnalysisObservation,
): Record<string, string | number> | null {
  const evidence = observation.evidence
  const value = evidence.length > 0 ? evidence[0].value : null

  switch (observation.rule_id) {
    case ANALYSIS_RULE_IDS.matchKda: {
      const kills = findEvidenceValue(evidence, 'kills')
      const deaths = findEvidenceValue(evidence, 'deaths')
      const assists = findEvidenceValue(evidence, 'assists')
      if (kills === null || deaths === null || assists === null) {
        return null
      }
      return { kills: String(kills), deaths: String(deaths), assists: String(assists) }
    }
    case ANALYSIS_RULE_IDS.laningKillsDeaths: {
      const kills = findEvidenceValue(evidence, 'kills_log (00:00–15:00)')
      const deaths = findEvidenceValue(evidence, 'deaths_log (00:00–15:00)')
      if (kills === null || deaths === null) {
        return null
      }
      return { kills: String(kills), deaths: String(deaths) }
    }
    case 'laning.kills_deaths_first_10': {
      const kills = findEvidenceValue(evidence, 'kills_log (00:00–10:00)')
      const deaths = findEvidenceValue(evidence, 'deaths_log (00:00–10:00)')
      if (kills === null || deaths === null) {
        return null
      }
      return { kills: String(kills), deaths: String(deaths) }
    }
    case ANALYSIS_RULE_IDS.purchasesFirst15:
    case 'laning.purchases_first_10':
      return value === null ? null : { count: String(value) }
    default:
      return value === null ? null : { value: String(value) }
  }
}

/**
 * Локализация наблюдения.
 *
 * Для русского языка возвращается сохранённый текст (он и есть русский): так
 * исторические снимки отображаются без изменений. Для английского — текст
 * собирается по `rule_id` и подтверждениям; при неизвестном правиле или
 * недостатке подтверждений показывается сохранённый текст с `localized: false`.
 */
export function localizeObservation(
  observation: AnalysisObservation,
  locale: Locale,
): LocalizedText {
  if (locale === 'ru') {
    return { text: observation.text, localized: true }
  }
  const template = OBSERVATION_TEMPLATES[observation.rule_id]
  if (template === undefined) {
    return { text: observation.text, localized: false }
  }
  const params = observationParams(observation)
  if (params === null) {
    return { text: observation.text, localized: false }
  }
  return { text: interpolate(template.en, params), localized: true }
}

/**
 * Локализация ограничения по стабильному коду.
 * Неизвестный код сохраняет исходный текст (перевод не выдумывается).
 */
export function localizeLimitation(limitation: AnalysisLimitation, locale: Locale): LocalizedText {
  if (locale === 'ru') {
    return { text: limitation.text, localized: true }
  }
  const key = `limitation.${limitation.code}` as TranslationKey
  const translated = translations.en[key]
  if (typeof translated !== 'string') {
    return { text: limitation.text, localized: false }
  }
  return { text: translated, localized: true }
}

/**
 * Пояснение о недоступности рекомендаций.
 * Для английского языка используется утверждённое пояснение из словаря;
 * сохранённый текст не перезаписывается.
 */
export function localizeRecommendationsNote(note: string | null, locale: Locale): string | null {
  if (locale === 'en') {
    return translations.en['analysis.recommendationsUnavailable']
  }
  return note ?? translations.ru['analysis.recommendationsUnavailable']
}