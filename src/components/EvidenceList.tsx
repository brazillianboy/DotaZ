import { INSUFFICIENT_DATA_MESSAGE } from '../lib/analysisRules'
import type { AnalysisObservation } from '../types/analysis'

interface EvidenceListProps {
  observations: AnalysisObservation[]
}

/**
 * Список фактологических наблюдений (Task 9).
 * Каждое наблюдение помечено как «Наблюдение, не оценка» и сопровождается
 * источником, периодом и точными подтверждениями (поле + значение).
 */
export default function EvidenceList({ observations }: EvidenceListProps) {
  return (
    <section className="analysis-panel panel" aria-labelledby="observations-title">
      <h2 className="match-section__title" id="observations-title">
        Наблюдения
      </h2>

      {observations.length === 0 ? (
        <p className="stub__text" role="status">
          {INSUFFICIENT_DATA_MESSAGE}
        </p>
      ) : (
        <ul className="observations">
          {observations.map((observation) => (
            <li className="observation" key={observation.rule_id}>
              <p className="observation__text">{observation.text}</p>
              <p className="observation__meta">
                <span className="badge badge--warn">Наблюдение, не оценка</span>
                <span>Источник: {observation.source}</span>
                <span>Период: {observation.period}</span>
              </p>
              <ul className="observation__evidence">
                {observation.evidence.map((item) => (
                  <li key={`${item.field}-${item.period}`}>
                    <span className="observation__field">{item.field}</span>
                    <span className="observation__value">{String(item.value)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}