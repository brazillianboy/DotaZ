import type { AnalysisRecommendation } from '../types/analysis'
import { useI18n } from '../i18n/I18nContext'
import { localizeRecommendationsNote } from '../i18n/analysisText'

interface RecommendationsListProps {
  recommendations: AnalysisRecommendation[]
  /** Пояснение, почему рекомендации недоступны (показывается при пустом списке). */
  note: string | null
}

/**
 * Список рекомендаций (Task 9, локализация — Task 13).
 *
 * В версии правил 1.0.0 рекомендации не формируются: в документации проекта нет
 * подтверждённых норм героя и роли, поэтому объективных условий для советов нет.
 * Пустой список — ожидаемое состояние, а не ошибка реализации; пояснение
 * локализуется, сохранённые данные при этом не изменяются.
 */
export default function RecommendationsList({ recommendations, note }: RecommendationsListProps) {
  const { t, locale } = useI18n()
  const localizedNote = localizeRecommendationsNote(note, locale)

  return (
    <section className="analysis-panel panel" aria-labelledby="recommendations-title">
      <h2 className="match-section__title" id="recommendations-title">
        {t('analysis.recommendationsTitle')}
      </h2>

      {recommendations.length === 0 ? (
        <p className="stub__text" role="status">
          {localizedNote}
        </p>
      ) : (
        <ul className="observations">
          {recommendations.map((recommendation) => (
            <li className="observation" key={recommendation.rule_id}>
              <p className="observation__text">{recommendation.text}</p>
              <p className="observation__meta">
                <span>{t('common.sourceLabel', { source: 'OpenDota' })}</span>
                <span>{t('analysis.ruleLabel', { ruleId: recommendation.rule_id })}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}