import { useI18n } from '../i18n/I18nContext'
import { statText } from '../i18n/viewLabels'
import {
  BENCHMARK_METRICS,
  compareLaningWithBenchmark,
  type BenchmarkMetricKey,
  type BenchmarkSnapshot,
  type LaningBenchmarkResult,
  type MetricComparison,
} from '../lib/benchmarks'
import { heroName } from '../lib/heroes'
import { LANING_INTERVAL_LABEL } from '../lib/laning'
import type { NormalizedPlayer } from '../types/match'

interface LaningBenchmarksProps {
  player: NormalizedPlayer | null
  /** Числовой id патча матча (`patch` OpenDota) — сравниваются только одинаковые патчи. */
  patch: number | null
  /** Проверенный снапшот нормативов; `null` — данных нет или файл невалиден. */
  snapshot: BenchmarkSnapshot | null
}

/**
 * Сравнение первых 15 минут с нормативами того же героя и класса линии (Task 16).
 *
 * Принципы:
 *  - сравниваются только значения 15-й минуты (`lh_t[15]`, `gold_t[15]`, `xp_t[15]`);
 *  - норматив берётся исключительно за тот же патч и ту же линию (`lane_role`);
 *  - отсутствие нормы, малая выборка, неизвестная роль или отсутствие таймлайна
 *    показываются как понятное состояние, а не как «плохая игра»;
 *  - никаких оценок «хорошо/плохо»: только факт, медиана, квартили и разница.
 *
 * Источник нормативов: OpenDota Explorer (см. `scripts/build-benchmarks.mjs`).
 */
export default function LaningBenchmarks({ player, patch, snapshot }: LaningBenchmarksProps) {
  const { t, locale } = useI18n()

  const roleLabel = (role: number | null): string | null => {
    if (role === 1) return t('bench.role.safe')
    if (role === 2) return t('bench.role.mid')
    if (role === 3) return t('bench.role.off')
    if (role === 4) return t('bench.role.jungle')
    return null
  }

  const numberFormat = (value: number, signedValue: boolean): string => {
    const text = Math.abs(value).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      maximumFractionDigits: 1,
    })
    if (!signedValue) return text
    if (value > 0) return `+${text}`
    if (value < 0) return `−${text}`
    return text
  }

  const result: LaningBenchmarkResult | null =
    snapshot === null || player === null
      ? null
      : compareLaningWithBenchmark(
          snapshot,
          {
            heroId: player.hero_id,
            laneRole: player.lane_role,
            patchId: patch,
            intervalMinutes: player.laning.interval.minutes,
          },
          { lastHits: player.laning.lastHits, gold: player.laning.gold, xp: player.laning.xp },
        )

  const metricLabel = (key: BenchmarkMetricKey): string => {
    if (key === 'lastHits') return t('bench.metric.lastHits')
    if (key === 'gold') return t('bench.metric.gold')
    return t('bench.metric.xp')
  }

  const statusText = (result: LaningBenchmarkResult): string => {
    if (result.status === 'missing-role') return t('bench.status.missingRole')
    if (result.status === 'missing-patch') return t('bench.status.missingPatch')
    if (result.status === 'patch-mismatch') {
      return t('bench.status.patchMismatch', { patch: result.benchmarkPatch })
    }
    if (result.status === 'interval-mismatch') {
      return t('bench.status.intervalMismatch', {
        actual: player?.laning.interval.label ?? '',
        expected: String(result.benchmarkInterval),
      })
    }
    return t('bench.status.noBenchmark')
  }

  const metricCell = (
    comparison: MetricComparison,
    column: 'actual' | 'median' | 'range' | 'diff' | 'sample',
  ): string => {
    if (column === 'sample') {
      return comparison.sampleSize === 0 ? t('common.noData') : String(comparison.sampleSize)
    }
    if (column === 'actual') return statText(t, comparison.actual)
    if (comparison.status === 'no-sample') return t('bench.status.noSample')
    if (comparison.status === 'insufficient') return t('bench.status.insufficient')
    if (comparison.status === 'missing-actual') return t('bench.status.missingActual')
    if (column === 'median') return statText(t, comparison.median)
    if (column === 'range') {
      return comparison.status === 'full'
        ? `${statText(t, comparison.p25)} – ${statText(t, comparison.p75)}`
        : t('bench.status.medianOnly')
    }
    return comparison.difference === null
      ? t('common.noData')
      : numberFormat(comparison.difference, true)
  }

  const subject =
    player === null
      ? null
      : `${heroName(player.hero_id) ?? t('common.noData')} · ${
          roleLabel(player.lane_role) ?? t('bench.role.unknown')
        }`

  /**
   * Подпись интервала в заголовке — это интервал САМИХ нормативов, а не глобальная
   * подпись периода из словаря (`period.laning` остаётся исторической меткой
   * 00:00–10:00 для локализации старых наблюдений и здесь не используется).
   */
  const intervalLabel = snapshot === null ? LANING_INTERVAL_LABEL : snapshot.interval.label

  return (
    <section className="lane-report panel" aria-labelledby="benchmarks-title">
      <h2 className="match-section__title" id="benchmarks-title">
        {t('bench.title', { interval: intervalLabel })}
      </h2>

      {subject !== null && <p className="lane-report__subject">{subject}</p>}

      {snapshot === null || result === null ? (
        <p className="stub__hint">{t('bench.unavailable')}</p>
      ) : result.status !== 'ready' || result.metrics === null ? (
        <p className="auth-alert auth-alert--error" role="status">
          {statusText(result)}
        </p>
      ) : (
        <>
          {/*
           * Таблица нормативов обёрнута в `.table-scroll` — тот же контейнер
           * горизонтальной прокрутки, что используют `team-table` и `buildings-table`.
           * Без обёртки шесть колонок с `white-space: nowrap` задают таблице
           * минимальную ширину около 483 px, и документ переполнялся по горизонтали
           * на узких экранах (~390 px). Колонки, значения, шрифт и расчёты Task 16
           * не менялись: прокручивается только сама таблица внутри панели.
           */}
          <div className="table-scroll">
            <table className="bench-table">
              <thead>
                <tr>
                  <th scope="col">{t('bench.column.metric')}</th>
                  <th scope="col">{t('bench.column.actual')}</th>
                  <th scope="col">{t('bench.column.median')}</th>
                  <th scope="col">{t('bench.column.range')}</th>
                  <th scope="col">{t('bench.column.diff')}</th>
                  <th scope="col">{t('bench.column.sample')}</th>
                </tr>
              </thead>
              <tbody>
                {BENCHMARK_METRICS.map((key) => {
                  const comparison = result.metrics?.[key]
                  if (comparison === undefined) return null
                  return (
                    <tr key={key} data-metric={key} data-status={comparison.status}>
                      <th scope="row">{metricLabel(key)}</th>
                      <td>{metricCell(comparison, 'actual')}</td>
                      <td>{metricCell(comparison, 'median')}</td>
                      <td>{metricCell(comparison, 'range')}</td>
                      <td>{metricCell(comparison, 'diff')}</td>
                      <td>{metricCell(comparison, 'sample')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="stub__hint">
            {t('bench.meta', {
              patch: result.benchmarkPatch,
              source: snapshot.source.name,
              generated: formatDate(snapshot.generated_at, locale),
            })}
          </p>
          <p className="stub__hint">{t('bench.limitations')}</p>
          <details className="technical-details">
            <summary>{t('common.technicalDetails')}</summary>
            <p className="stub__hint">{snapshot.source.attribution}</p>
            <p className="stub__hint">
              {t('bench.methodVersion', {
                version: snapshot.method_version,
                full: String(snapshot.thresholds.full),
                medianOnly: String(snapshot.thresholds.medianOnly),
              })}
            </p>
          </details>
        </>
      )}
    </section>
  )
}

/** Дата генерации снапшота в локали интерфейса; некорректная дата показывается как есть. */
function formatDate(iso: string, locale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
