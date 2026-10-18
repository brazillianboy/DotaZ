import { useMemo } from 'react'

import { analyzePlayer } from '../lib/analysisRules'
import type { NormalizedMatch, NormalizedPlayer } from '../types/match'
import EvidenceList from './EvidenceList'
import RecommendationsList from './RecommendationsList'
import ReportLimitations from './ReportLimitations'

interface AnalysisReportProps {
  match: NormalizedMatch
  player: NormalizedPlayer | null
}

/**
 * Секция анализа выбранного участника (Task 9).
 *
 * Расчёт выполняется локально из уже загруженных нормализованных данных:
 * при смене игрока дополнительные запросы к OpenDota не выполняются.
 */
export default function AnalysisReport({ match, player }: AnalysisReportProps) {
  const analysis = useMemo(
    () => (player === null ? null : analyzePlayer(match, player)),
    [match, player],
  )

  if (analysis === null) {
    return (
      <section className="analysis-panel panel" aria-labelledby="analysis-title">
        <h2 className="match-section__title" id="analysis-title">
          Наблюдения
        </h2>
        <p className="stub__text">Выберите участника, чтобы увидеть наблюдения по данным матча.</p>
      </section>
    )
  }

  return (
    <div className="analysis">
      <p className="analysis__version">Версия правил анализа: {analysis.rule_version}</p>
      <EvidenceList observations={analysis.observations} />
      <RecommendationsList
        recommendations={analysis.recommendations}
        note={analysis.recommendationsNote}
      />
      <ReportLimitations limitations={analysis.limitations} />
    </div>
  )
}