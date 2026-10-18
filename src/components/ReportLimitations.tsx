import type { AnalysisLimitation } from '../types/analysis'

interface ReportLimitationsProps {
  limitations: AnalysisLimitation[]
}

/**
 * Ограничения анализа (Task 9): показываются только те ограничения,
 * которые относятся к фактически отсутствующим данным и методике.
 */
export default function ReportLimitations({ limitations }: ReportLimitationsProps) {
  return (
    <section className="analysis-panel panel" aria-labelledby="limitations-title">
      <h2 className="match-section__title" id="limitations-title">
        Ограничения анализа
      </h2>

      {limitations.length === 0 ? (
        <p className="stub__text">Ограничений не зафиксировано.</p>
      ) : (
        <ul className="limitations">
          {limitations.map((limitation) => (
            <li key={limitation.code}>{limitation.text}</li>
          ))}
        </ul>
      )}
    </section>
  )
}