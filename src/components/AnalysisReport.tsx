import { useMemo } from 'react'

import { analyzePlayer } from '../lib/analysisRules'
import type { PlayerAnalysis } from '../types/analysis'
import type { NormalizedMatch, NormalizedPlayer } from '../types/match'
import { useI18n } from '../i18n/I18nContext'
import EvidenceList from './EvidenceList'
import RecommendationsList from './RecommendationsList'
import ReportLimitations from './ReportLimitations'

interface AnalysisReportProps {
  match: NormalizedMatch
  player: NormalizedPlayer | null
  /**
   * Готовый анализ (Task 11): например, наблюдения из сохранённого отчёта.
   * Если не передан, анализ рассчитывается локально существующим движком правил (Task 9),
   * а сохранённые наблюдения никогда не пересчитываются заново.
   */
  analysis?: PlayerAnalysis | null
}

/**
 * Секция анализа выбранного участника (Task 9, локализация — Task 13).
 *
 * Расчёт выполняется локально из уже загруженных нормализованных данных:
 * при смене игрока дополнительные запросы к OpenDota не выполняются.
 * Переключение языка не пересчитывает наблюдения — меняется только представление.
 */
export default function AnalysisReport({ match, player, analysis }: AnalysisReportProps) {
  const { t } = useI18n()
  const resolved = useMemo(
    () =>
      analysis !== undefined ? analysis : player === null ? null : analyzePlayer(match, player),
    [analysis, match, player],
  )

  if (resolved === null) {
    return (
      <section className="analysis-panel panel" aria-labelledby="analysis-title">
        <h2 className="match-section__title" id="analysis-title">
          {t('analysis.observationsTitle')}
        </h2>
        <p className="stub__text">{t('analysis.selectPlayer')}</p>
      </section>
    )
  }

  return (
    <div className="analysis">
      <p className="analysis__version">
        {t('analysis.rulesVersion', { version: resolved.rule_version })}
      </p>
      <EvidenceList observations={resolved.observations} />
      <RecommendationsList
        recommendations={resolved.recommendations}
        note={resolved.recommendationsNote}
      />
      <ReportLimitations limitations={resolved.limitations} />
    </div>
  )
}