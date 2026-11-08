import { useI18n } from '../i18n/I18nContext'
import { heroName } from '../lib/heroes'
import { purchaseClockText } from '../lib/items'
import { buildItemTimeline, type TimelineEntry } from '../lib/itemTimeline'
import {
  DEFAULT_ITEM_TIMING_THRESHOLDS,
  compareItemTimings,
  effectiveClassifyThreshold,
  effectivePercentileThreshold,
  type ItemTimingClass,
  type ItemTimingComparison,
  type ItemTimingSnapshot,
} from '../lib/itemTimings'
import { buildTimingScale, type TimingScaleActualPosition } from '../lib/timingScale'
import type { NormalizedPlayer } from '../types/match'

interface ItemTimingsProps {
  player: NormalizedPlayer | null
  /** Числовой id патча матча: сравнение строго в пределах патча. */
  patch: number | null
  /** Нормативы таймингов Task 18; `null` — сравнение недоступно. */
  snapshot: ItemTimingSnapshot | null
}

/** Время в секундах как `м:сс`; отрицательное (закупка до 0:00) — со знаком минус. */
function clock(seconds: number): string {
  return seconds < 0 ? `−${purchaseClockText(Math.abs(seconds))}` : purchaseClockText(seconds)
}

function signed(seconds: number | null): string {
  if (seconds === null) return '—'
  const text = clock(Math.abs(seconds))
  if (seconds > 0) return `+${text}`
  if (seconds < 0) return `−${text}`
  return text
}

/** Классы, которые разрешено показывать только при достаточной выборке. */
function isClassified(value: ItemTimingClass): boolean {
  return value === 'early' || value === 'typical' || value === 'late'
}

/**
 * Анализ покупки предметов (Task 18).
 *
 * Каждая покупка — отдельный контейнер: слева предмет и фактическое время,
 * справа — медиана, диапазон p25–p75, отличие от медианы, размер выборки и класс;
 * под ними, внутри того же контейнера, компактная шкала тайминга. Классификация и
 * шкала выводятся только при выборке не меньше порога (100 наблюдений). Медиана
 * не является «оптимальным» временем, поздняя покупка не объявляется ошибкой.
 */
export default function ItemTimings({ player, patch, snapshot }: ItemTimingsProps) {
  const { t } = useI18n()

  const roleLabel = (role: number | null): string | null => {
    if (role === 1) return t('bench.role.safe')
    if (role === 2) return t('bench.role.mid')
    if (role === 3) return t('bench.role.off')
    if (role === 4) return t('bench.role.jungle')
    return null
  }

  const timeline = buildItemTimeline(player?.purchaseLog ?? null)

  const classifyMin = effectiveClassifyThreshold(
    snapshot?.thresholds ?? DEFAULT_ITEM_TIMING_THRESHOLDS,
  )

  const comparisons: Map<string, ItemTimingComparison> =
    snapshot !== null && player !== null
      ? compareItemTimings(timeline.entries, snapshot, {
          heroId: player.hero_id,
          laneRole: player.lane_role,
          patchId: patch,
        })
      : new Map()

  const classLabel = (value: ItemTimingClass): string => {
    if (value === 'early') return t('itemTimings.class.early')
    if (value === 'late') return t('itemTimings.class.late')
    if (value === 'typical') return t('itemTimings.class.typical')
    if (value === 'insufficient') return t('itemTimings.class.insufficient')
    return t('itemTimings.class.noSample')
  }

  const positionLabel = (position: TimingScaleActualPosition): string => {
    if (position === 'before-range') return t('itemTimings.scale.position.before')
    if (position === 'after-range') return t('itemTimings.scale.position.after')
    return t('itemTimings.scale.position.in')
  }

  /** Пояснение под строкой: почему сравнение недоступно (если недоступно). */
  const rowNote = (entry: TimelineEntry, comparison?: ItemTimingComparison): string | null => {
    if (snapshot === null) {
      return null
    }
    if (entry.occurrence > 1) {
      return entry.comparable ? t('itemTimings.repeatNoCompare') : null
    }
    if (!entry.comparable) {
      return null
    }
    if (comparison === undefined) {
      return t('itemTimings.rowNoBenchmark')
    }
    if (!isClassified(comparison.timingClass)) {
      return t('itemTimings.insufficientSample', {
        count: comparison.sampleSize,
        min: classifyMin,
      })
    }
    return null
  }

  const renderEntry = (entry: TimelineEntry) => {
    const comparison = comparisons.get(entry.key)
    // Норматив описывает первую подтверждённую покупку: повторные покупки не
    // переиспользуют его и не получают ни статистику, ни шкалу.
    const canCompare = entry.occurrence === 1 && entry.comparable
    const classified =
      canCompare && comparison !== undefined && isClassified(comparison.timingClass)
    const scale =
      comparison !== undefined && classified
        ? buildTimingScale(
            {
              actualSeconds: entry.timeSeconds,
              stats: {
                n: comparison.sampleSize,
                p25: comparison.p25,
                p50: comparison.median,
                p75: comparison.p75,
              },
            },
            { minSample: classifyMin },
          )
        : null
    const note = rowNote(entry, comparison)

    return (
      <li
        className="item-timeline__item"
        data-item-key={entry.key}
        data-timing-class={comparison?.timingClass ?? 'none'}
        key={`${entry.key}-${entry.occurrence}-${entry.timeSeconds}`}
      >
        <div className="item-timeline__main">
          <div className="item-timeline__identity">
            <img
              className="item-timeline__icon"
              src={entry.iconUrl}
              alt=""
              width={24}
              height={24}
              loading="lazy"
            />
            <span className="item-timeline__name">{entry.name}</span>
            {entry.occurrence > 1 && (
              <span className="badge">{t('itemTimings.repeat', { count: entry.occurrence })}</span>
            )}
            {entry.category === 'unclassified' && (
              <span className="badge">{t('itemTimings.unknown')}</span>
            )}
            <span className="item-timeline__actual">
              {t('itemTimings.purchased', { time: clock(entry.timeSeconds) })}
            </span>
          </div>

          {comparison !== undefined && classified && (
            <dl className="item-timeline__stats">
              <div className="item-timeline__stat">
                <dt>{t('itemTimings.col.median')}</dt>
                <dd>{comparison.median === null ? '—' : clock(comparison.median)}</dd>
              </div>
              <div className="item-timeline__stat">
                <dt>{t('itemTimings.col.range')}</dt>
                <dd>
                  {comparison.p25 === null || comparison.p75 === null
                    ? '—'
                    : `${clock(comparison.p25)}–${clock(comparison.p75)}`}
                </dd>
              </div>
              <div className="item-timeline__stat">
                <dt>{t('itemTimings.col.difference')}</dt>
                <dd>{signed(comparison.differenceSeconds)}</dd>
              </div>
              <div className="item-timeline__stat">
                <dt>{t('itemTimings.col.sample')}</dt>
                <dd>{comparison.sampleSize}</dd>
              </div>
              <div className="item-timeline__stat item-timeline__stat--class">
                <dt>{t('itemTimings.col.timing')}</dt>
                <dd data-timing-class={comparison.timingClass}>
                  {classLabel(comparison.timingClass)}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {scale !== null && comparison !== undefined && (
          <div
            className="item-timing-scale"
            role="img"
            aria-label={t('itemTimings.scale.aria', {
              actual: clock(entry.timeSeconds),
              median: clock(scale.medianSeconds),
              p25: clock(scale.p25Seconds),
              p75: clock(scale.p75Seconds),
              count: scale.sampleSize,
              position: positionLabel(scale.actualPosition),
            })}
          >
            <div className="item-timing-scale__track">
              <span
                className="item-timing-scale__range"
                style={{
                  left: `${scale.rangeStartPercent}%`,
                  width: `${scale.rangeWidthPercent}%`,
                }}
              />
              <span
                className="item-timing-scale__median"
                style={{ left: `${scale.medianPercent}%` }}
              />
              <span
                className="item-timing-scale__actual"
                data-position={scale.actualPosition}
                style={{ left: `${scale.actualPercent}%` }}
              >
                <span className="item-timing-scale__actual-label">
                  {clock(entry.timeSeconds)}
                </span>
              </span>
            </div>
            <div className="item-timing-scale__axis" aria-hidden="true">
              <span>{clock(scale.domainMinSeconds)}</span>
              <span className="item-timing-scale__legend">{t('itemTimings.scale.legend')}</span>
              <span>{clock(scale.domainMaxSeconds)}</span>
            </div>
          </div>
        )}

        {note !== null && <p className="item-timeline__note">{note}</p>}
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
    <section className="lane-report panel" aria-labelledby="item-timings-title">
      <h2 className="match-section__title" id="item-timings-title">
        {t('itemTimings.title')}
      </h2>

      {subject !== null && <p className="lane-report__subject">{subject}</p>}
      <p className="stub__hint">{t('itemTimings.lead')}</p>

      {timeline.status === 'no-log' ? (
        <p className="auth-alert auth-alert--error" role="status">
          {t('itemTimings.noLog')}
        </p>
      ) : timeline.status === 'empty' ? (
        <p className="stub__hint">{t('itemTimings.empty')}</p>
      ) : (
        <>
          <ul className="item-timeline">{timeline.entries.map(renderEntry)}</ul>

          {snapshot === null ? (
            <p className="stub__hint" role="status">
              {t('itemTimings.noBenchmarks')}
            </p>
          ) : (
            <>
              <p className="stub__hint">{t('itemTimings.medianNote')}</p>
              <p className="stub__hint">{t('itemTimings.thresholdNote', { min: classifyMin })}</p>
            </>
          )}

          {timeline.hiddenConsumables > 0 && (
            <p className="stub__hint">
              {t('itemTimings.hiddenConsumables', { count: timeline.hiddenConsumables })}
            </p>
          )}
          {timeline.hiddenRecipes > 0 && (
            <p className="stub__hint">
              {t('itemTimings.hiddenRecipes', { count: timeline.hiddenRecipes })}
            </p>
          )}
          {timeline.repeatedItems > 0 && (
            <p className="stub__hint">
              {t('itemTimings.repeated', { count: timeline.repeatedItems })}
            </p>
          )}
          {timeline.hiddenByLimit > 0 && (
            <p className="stub__hint">
              {t('itemTimings.hiddenByLimit', { count: timeline.hiddenByLimit })}
            </p>
          )}
          {timeline.droppedInvalid > 0 && (
            <p className="stub__hint">
              {t('itemTimings.droppedInvalid', { count: timeline.droppedInvalid })}
            </p>
          )}

          <details className="technical-details">
            <summary>{t('common.technicalDetails')}</summary>
            <p className="stub__hint">{t('itemTimings.source')}</p>
            {snapshot !== null && (
              <>
                <p className="stub__hint">
                  {t('itemTimings.method', {
                    version: snapshot.method_version,
                    patch: snapshot.patch,
                  })}
                </p>
                <p className="stub__hint">
                  {t('itemTimings.thresholds', {
                    store: snapshot.thresholds.store,
                    full: effectivePercentileThreshold(snapshot.thresholds),
                    classify: classifyMin,
                  })}
                </p>
              </>
            )}
          </details>
        </>
      )}
    </section>
  )
}

