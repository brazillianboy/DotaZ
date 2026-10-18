import type { AnalysisRecommendation } from '../types/analysis'

interface RecommendationsListProps {
  recommendations: AnalysisRecommendation[]
  /** Пояснение, почему рекомендации недоступны (показывается при пустом списке). */
  note: string | null
}

/**
 * Список рекомендаций (Task 9).
 *
 * В версии правил 1.0.0 рекомендации не формируются: в документации проекта нет
 * подтверждённых норм героя и роли, поэтому объективных условий для советов нет.
 * Пустой список — ожидаемое состояние, а не ошибка реализации.
 */
export default function RecommendationsList({ recommendations, note }: RecommendationsListProps) {
  return (
    <section className="analysis-panel panel" aria-labelledby="recommendations-title">
      <h2 className="match-section__title" id="recommendations-title">
        Рекомендации
      </h2>

      {recommendations.length === 0 ? (
        <p className="stub__text" role="status">
          {note}
        </p>
      ) : (
        <ul className="observations">
          {recommendations.map((recommendation) => (
            <li className="observation" key={recommendation.rule_id}>
              <p className="observation__text">{recommendation.text}</p>
              <p className="observation__meta">
                <span>Источник: OpenDota</span>
                <span>Правило: {recommendation.rule_id}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}