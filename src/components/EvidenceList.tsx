import type { AnalysisObservation } from '../types/analysis'
import { useI18n } from '../i18n/I18nContext'
import { localizeObservation, localizePeriod } from '../i18n/analysisText'

interface EvidenceListProps {
  observations: AnalysisObservation[]
}

/**
 * Список фактологических наблюдений (Task 9, локализация — Task 13).
 *
 * Текст наблюдения строится по `rule_id` и сохранённым подтверждениям, поэтому
 * переключение языка не изменяет факты: значения evidence, период и источник
 * остаются прежними. Для неизвестных правил показывается сохранённый текст с
 * честной пометкой о недоступности перевода.
 */
export default function EvidenceList({ observations }: EvidenceListProps) {
  const { t, locale } = useI18n()

  return (
    <section className="analysis-panel panel" aria-labelledby="observations-title">
      <h2 className="match-section__title" id="observations-title">
        {t('analysis.observationsTitle')}
      </h2>

      {observations.length === 0 ? (
        <p className="stub__text" role="status">
          {t('analysis.insufficientData')}
        </p>
      ) : (
        <ul className="observations">
          {observations.map((observation) => {
            const localized = localizeObservation(observation, locale)
            return (
              <li className="observation" key={observation.rule_id}>
                <p className="observation__text">{localized.text}</p>
                {!localized.localized && (
                  <p className="stub__hint">
                    {t('analysis.translationUnavailable', {
                      ruleId: observation.rule_id,
                      ruleVersion: observation.rule_version,
                    })}
                  </p>
                )}
                <p className="observation__meta">
                  <span className="badge badge--warn">{t('analysis.notAnAssessment')}</span>
                  <span>{t('common.sourceLabel', { source: observation.source })}</span>
                  <span>
                    {t('common.periodLabel', { period: localizePeriod(observation.period, locale) })}
                  </span>
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
            )
          })}
        </ul>
      )}
    </section>
  )
}