import { useI18n } from '../i18n/I18nContext'
import { heroName } from '../lib/heroes'
import type { BenchmarkSnapshot } from '../lib/benchmarks'
import { buildPlayerInsights, type PlayerInsight } from '../lib/insights'
import type { NormalizedPlayer } from '../types/match'

interface PlayerInsightsProps {
  player: NormalizedPlayer | null
  /** Числовой id патча матча (для сравнения строго в пределах патча). */
  patch: number | null
  /** Нормативы Task 16; `null` — статистические сравнения недоступны. */
  snapshot: BenchmarkSnapshot | null
}

/**
 * Секция «Анализ ошибок и рекомендации» (Task 17).
 *
 * Показывает только поддерживаемые находки по выбранному игроку: статистические
 * отклонения от нормативов Task 16 и подтверждённые события первых 15 минут.
 * Отклонение от медианы не называется ошибкой; причины событий не выдумываются.
 */
export default function PlayerInsights({ player, patch, snapshot }: PlayerInsightsProps) {
  const { t } = useI18n()

  const roleLabel = (role: number | null): string | null => {
    if (role === 1) return t('bench.role.safe')
    if (role === 2) return t('bench.role.mid')
    if (role === 3) return t('bench.role.off')
    if (role === 4) return t('bench.role.jungle')
    return null
  }

  const insights = buildPlayerInsights({ player, patchId: patch, benchmark: snapshot })

  const renderFinding = (finding: PlayerInsight) => {
    const small = finding.params.small === 1
    const params = {
      ...finding.params,
      sample: small
        ? t('insights.smallSample')
        : t('insights.sample', { sample: finding.params.sample ?? '' }),
    }
    const source =
      finding.evidenceType === 'benchmark-deviation'
        ? t('insights.source.benchmark', { patch: finding.evidence.benchmarkPatch ?? '' })
        : t('insights.source.event')

    return (
      <li
        className="insight"
        data-severity={finding.severity}
        data-category={finding.category}
        key={finding.id}
      >
        <div className="insight__head">
          <span className={finding.severity === 'warning' ? 'badge badge--warn' : 'badge'}>
            {finding.severity === 'warning'
              ? t('insights.severity.warning')
              : t('insights.severity.info')}
          </span>
          <h3 className="insight__title">{t(finding.titleKey, params)}</h3>
        </div>
        <p className="insight__text">{t(finding.descriptionKey, params)}</p>
        <p className="stub__hint">{source}</p>
        <p className="insight__recommendation">
          <strong>{t('insights.recommendationLabel')}:</strong>{' '}
          {t(finding.recommendationKey, params)}
        </p>
      </li>
    )
  }

  const subject =
    player === null
      ? null
      : `${heroName(player.hero_id) ?? t('common.noData')} · ${
          roleLabel(player.lane_role) ?? t('bench.role.unknown')
        }`

  return (
    <section className="lane-report panel" aria-labelledby="insights-title">
      <h2 className="match-section__title" id="insights-title">
        {t('insights.title')}
      </h2>

      {subject !== null && <p className="lane-report__subject">{subject}</p>}

      {insights.status === 'no-data' ? (
        <p className="auth-alert auth-alert--error" role="status">
          {t('insights.unavailable')}
        </p>
      ) : (
        <>
          <p className="stub__hint">{t('insights.lead')}</p>

          {!insights.benchmarkUsed && (
            <p className="stub__hint" role="status">
              {t('insights.noBenchmark')}
            </p>
          )}

          {insights.findings.length === 0 ? (
            <p className="stub__hint">{t('insights.empty')}</p>
          ) : (
            <ul className="insights-list">{insights.findings.map(renderFinding)}</ul>
          )}

          {insights.hiddenCount > 0 && (
            <p className="stub__hint">{t('insights.hidden', { count: insights.hiddenCount })}</p>
          )}

          <details className="technical-details">
            <summary>{t('common.technicalDetails')}</summary>
            <p className="stub__hint">
              {t('insights.method', {
                version: insights.rulesVersion,
                benchmark: insights.benchmarkPatch ?? t('common.noData'),
              })}
            </p>
          </details>
        </>
      )}
    </section>
  )
}
