import type { AnalysisLimitation } from '../types/analysis'
import { useI18n } from '../i18n/I18nContext'
import { localizeLimitation } from '../i18n/analysisText'

interface ReportLimitationsProps {
  limitations: AnalysisLimitation[]
}

/**
 * Ограничения анализа (Task 9, локализация — Task 13): показываются только те
 * ограничения, которые относятся к фактически отсутствующим данным и методике.
 * Известные коды локализуются; неизвестный код сохраняет исходный текст.
 */
export default function ReportLimitations({ limitations }: ReportLimitationsProps) {
  const { t, locale } = useI18n()

  return (
    <section className="analysis-panel panel" aria-labelledby="limitations-title">
      <h2 className="match-section__title" id="limitations-title">
        {t('analysis.limitationsTitle')}
      </h2>

      {limitations.length === 0 ? (
        <p className="stub__text">{t('analysis.noLimitations')}</p>
      ) : (
        <ul className="limitations">
          {limitations.map((limitation) => (
            <li key={limitation.code}>{localizeLimitation(limitation, locale).text}</li>
          ))}
        </ul>
      )}
    </section>
  )
}