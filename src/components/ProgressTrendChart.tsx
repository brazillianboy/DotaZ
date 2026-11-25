import type { TrendPoint } from '../lib/progress'

interface ProgressTrendChartProps {
  points: TrendPoint[]
  /** Форматирование unix-секунд в строку даты. */
  formatDate: (unix: number | null) => string
  /** Форматирование значения в строку. */
  formatValue: (value: number) => string
}

/**
 * Дискретная диаграмма показателя (Task 20): столбики только для фактических
 * замеров, без соединительных линий. Линии между отдельными матчами не рисуются,
 * чтобы не создавать впечатление непрерывного мониторинга между событиями.
 * Диаграмма полностью семантична: каждая колонка имеет aria-label с датой и значением.
 */
export default function ProgressTrendChart({
  points,
  formatDate,
  formatValue,
}: ProgressTrendChartProps) {
  if (points.length === 0) {
    return null
  }

  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min
  const showDates = points.length <= 20

  return (
    <div className="progress-chart" role="img" aria-label="Progress chart">
      <div className="progress-chart__plot">
        {points.map((point) => {
          const ratio = spread === 0 ? 0.6 : (point.value - min) / spread
          const heightPct = Math.round(8 + ratio * 92)
          const label = `${formatDate(point.date)}: ${formatValue(point.value)}`
          return (
            <div
              className="progress-chart__col"
              key={point.matchId}
              aria-label={label}
              role="img"
              title={label}
            >
              <span className="progress-chart__value">{formatValue(point.value)}</span>
              <span className="progress-chart__bar" style={{ height: `${heightPct}%` }} />
              {showDates && <span className="progress-chart__date">{formatDate(point.date)}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}