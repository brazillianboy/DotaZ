import { describe, expect, it } from 'vitest'

import { ANALYSIS_RULE_IDS, analyzePlayer } from '../lib/analysisRules'
import { normalizeMatch } from '../lib/normalizeMatch'
import type { AnalysisObservation } from '../types/analysis'
import {
  OBSERVATION_TEMPLATES,
  isKnownRule,
  localizeLimitation,
  localizeObservation,
  localizePeriod,
  localizeRecommendationsNote,
} from './analysisText'
import { translations } from './translations'

/**
 * Тесты локализации аналитических текстов (Task 13).
 *
 * Проверяется, что перевод опирается на сохранённые факты (`rule_id` + `evidence`),
 * не изменяет значения и корректно отказывается от перевода неизвестных правил.
 */

const RAW_WITH_LANING = {
  player_slot: 0,
  hero_id: 6,
  kills: 16,
  deaths: 3,
  assists: 15,
  lh_t: [0, 3, 7, 10, 11, 17, 23, 28, 33, 40, 47],
  gold_t: [0, 287, 779, 1029, 1540, 1906, 2379, 2684, 3037, 3438, 3864],
  xp_t: [0, 118, 408, 765, 1068, 1306, 1792, 2074, 2380, 2661, 2907],
  kills_log: [{ time: 102, key: 'npc_dota_hero_dark_seer' }],
  deaths_log: [{ time: 186, key: 'npc_dota_neutral' }],
  purchase_log: [{ time: 120, key: 'boots' }],
  lane_efficiency_pct: 78,
}

function observationByRule(ruleId: string): AnalysisObservation {
  const match = normalizeMatch({ players: [RAW_WITH_LANING] })
  const analysis = analyzePlayer(match, match.players[0])
  const found = analysis.observations.find((item) => item.rule_id === ruleId)
  if (found === undefined) {
    throw new Error(`Наблюдение ${ruleId} не сформировано`)
  }
  return found
}

describe('Шаблоны наблюдений известных правил', () => {
  it('содержат шаблоны для всех семи правил версии 1.0.0', () => {
    const ruleIds = Object.values(ANALYSIS_RULE_IDS)
    expect(ruleIds).toHaveLength(7)
    for (const ruleId of ruleIds) {
      expect(isKnownRule(ruleId), ruleId).toBe(true)
      expect(OBSERVATION_TEMPLATES[ruleId].ru.length).toBeGreaterThan(0)
      expect(OBSERVATION_TEMPLATES[ruleId].en.length).toBeGreaterThan(0)
    }
    expect(Object.keys(OBSERVATION_TEMPLATES)).toHaveLength(7)
  })

  it('не знает правил вне утверждённого набора', () => {
    expect(isKnownRule('laning.unknown_rule')).toBe(false)
  })

  it('русские шаблоны совпадают с текстом, который формирует движок правил', () => {
    for (const ruleId of Object.values(ANALYSIS_RULE_IDS)) {
      const observation = observationByRule(ruleId)
      const localized = localizeObservation(observation, 'ru')
      expect(localized.text, ruleId).toBe(observation.text)
      expect(localized.localized, ruleId).toBe(true)
    }
  })
})

describe('Локализация наблюдений', () => {
  it('сохраняет русский текст сохранённого наблюдения без изменений', () => {
    const observation = observationByRule(ANALYSIS_RULE_IDS.lastHitsAt10)
    expect(localizeObservation(observation, 'ru').text).toBe('Добивания к 10:00 (lh_t[10]) — 47.')
  })

  it('переводит известное правило на английский, сохраняя значения', () => {
    const observation = observationByRule(ANALYSIS_RULE_IDS.lastHitsAt10)
    const localized = localizeObservation(observation, 'en')
    expect(localized.localized).toBe(true)
    expect(localized.text).toBe('Last hits at 10:00 (lh_t[10]) — 47.')
    expect(localized.text).toContain('lh_t[10]')
  })

  it('переводит K/D/A, используя значения из подтверждений', () => {
    const observation = observationByRule(ANALYSIS_RULE_IDS.matchKda)
    const localized = localizeObservation(observation, 'en')
    expect(localized.localized).toBe(true)
    expect(localized.text).toContain('16')
    expect(localized.text).toContain('kills')
  })

  it('переводит все семь правил и не теряет числовые подтверждения', () => {
    for (const ruleId of Object.values(ANALYSIS_RULE_IDS)) {
      const observation = observationByRule(ruleId)
      const localized = localizeObservation(observation, 'en')
      expect(localized.localized, ruleId).toBe(true)
      for (const item of observation.evidence) {
        expect(localized.text, `${ruleId}:${item.field}`).toContain(String(item.value))
      }
    }
  })

  it('сохраняет значения evidence и не мутирует наблюдение', () => {
    const observation = observationByRule(ANALYSIS_RULE_IDS.goldAt10)
    const before = JSON.stringify(observation)
    localizeObservation(observation, 'en')
    localizeObservation(observation, 'ru')
    expect(JSON.stringify(observation)).toBe(before)
  })

  it('для неизвестного правила показывает сохранённый текст и помечает перевод недоступным', () => {
    const observation: AnalysisObservation = {
      rule_id: 'laning.legacy_rule',
      player_slot: 0,
      metric: 'legacy_metric',
      period: '00:00–10:00',
      source: 'OpenDota',
      rule_version: '0.9.0',
      text: 'Сохранённый текст исторического правила.',
      evidence: [{ field: 'legacy_field', value: 5, period: '00:00–10:00', source: 'OpenDota' }],
      limitations: [],
    }
    const localized = localizeObservation(observation, 'en')
    expect(localized.localized).toBe(false)
    expect(localized.text).toBe('Сохранённый текст исторического правила.')
  })

  it('не выдумывает перевод, если подтверждений недостаточно', () => {
    const observation: AnalysisObservation = {
      rule_id: ANALYSIS_RULE_IDS.matchKda,
      player_slot: 0,
      metric: 'kda',
      period: 'весь матч',
      source: 'OpenDota',
      rule_version: '1.0.0',
      text: 'Итог матча: убийства — 16, смерти — 3, ассисты — 15.',
      evidence: [],
      limitations: [],
    }
    const localized = localizeObservation(observation, 'en')
    expect(localized.localized).toBe(false)
    expect(localized.text).toBe(observation.text)
  })
})

describe('Локализация периодов, ограничений и рекомендаций', () => {
  it('переводит известные периоды и сохраняет неизвестные', () => {
    expect(localizePeriod('весь матч', 'en')).toBe('whole match')
    expect(localizePeriod('весь матч', 'ru')).toBe('весь матч')
    expect(localizePeriod('00:00–10:00', 'en')).toBe('00:00–10:00')
    expect(localizePeriod('00:00–25:00', 'en')).toBe('00:00–25:00')
  })

  it('переводит известные коды ограничений', () => {
    const limitation = {
      code: 'laning.events.missing',
      text: 'Журналы событий первых десяти минут (kills_log, deaths_log) отсутствуют или недостоверны.',
    }
    expect(localizeLimitation(limitation, 'ru').text).toBe(limitation.text)
    const en = localizeLimitation(limitation, 'en')
    expect(en.localized).toBe(true)
    expect(en.text).toBe(translations.en['limitation.laning.events.missing'])
    expect(en.text).toContain('kills_log')
  })

  it('сохраняет исходный текст неизвестного ограничения', () => {
    const limitation = { code: 'legacy.limit', text: 'Историческое ограничение.' }
    const en = localizeLimitation(limitation, 'en')
    expect(en.localized).toBe(false)
    expect(en.text).toBe('Историческое ограничение.')
  })

  it('локализует пояснение о недоступности рекомендаций', () => {
    const note = 'Объективные рекомендации недоступны: нормы героя и роли не подтверждены.'
    expect(localizeRecommendationsNote(note, 'ru')).toBe(note)
    expect(localizeRecommendationsNote(note, 'en')).toBe(
      translations.en['analysis.recommendationsUnavailable'],
    )
    expect(localizeRecommendationsNote(null, 'ru')).toBe(
      translations.ru['analysis.recommendationsUnavailable'],
    )
  })

  it('использует английские тексты ограничений из словаря (паритет ключей)', () => {
    for (const code of [
      'player.not_in_match',
      'match.kda.partial',
      'match.kda.missing',
      'laning.last_hits_at_10.missing',
      'laning.gold_at_10.missing',
      'laning.xp_at_10.missing',
      'laning.events.missing',
      'laning.purchases.missing',
      'laning.efficiency_pct.missing',
      'benchmarks.hero_role_missing',
    ]) {
      const en = localizeLimitation({ code, text: 'ru' }, 'en')
      expect(en.localized, code).toBe(true)
      expect(en.text, code).not.toBe('ru')
    }
  })
})