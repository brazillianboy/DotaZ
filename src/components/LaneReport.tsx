import { hasLaningFacts } from '../lib/laning'
import {
  NO_DATA_LABEL,
  formatEventTime,
  formatLaneEfficiencyPct,
  formatStat,
  playerLabel,
} from '../lib/matchView'
import type { NormalizedPlayer } from '../types/match'

interface LaneReportProps {
  player: NormalizedPlayer | null
}

/**
 * Отчёт о стадии линии 00:00–10:00 (Task 8).
 *
 * Показывает только фактические значения из ответа OpenDota: поминутные показатели
 * (`lh_t[10]`, `gold_t[10]`, `xp_t[10]`), события первых десяти минут и процент
 * эффективности линии провайдера. Оценки качества линии, нормативы героя/роли и
 * рекомендации не выполняются (Task 9+).
 */
export default function LaneReport({ player }: LaneReportProps) {
  if (player === null) {
    return (
      <section className="lane-report panel" aria-labelledby="lane-report-title">
        <h2 className="match-section__title" id="lane-report-title">
          Стадия линии — 00:00–10:00
        </h2>
        <p className="stub__text">Выберите участника, чтобы увидеть данные стадии линии.</p>
      </section>
    )
  }

  const laning = player.laning

  return (
    <section className="lane-report panel" aria-labelledby="lane-report-title">
      <h2 className="match-section__title" id="lane-report-title">
        Стадия линии — 00:00–10:00
      </h2>
      <p className="lane-report__subject">{playerLabel(player)}</p>

      {!hasLaningFacts(laning) ? (
        <p className="auth-alert auth-alert--error" role="status">
          Детальные данные стадии линии для этого матча недоступны: OpenDota не вернула
          поминутные ряды и журналы событий (реплей не обработан). Отсутствующие значения
          не подменяются нулями.
        </p>
      ) : (
        <>
          <dl className="match-facts match-facts--grid">
            <div className="match-facts__item">
              <dt>Добивания к 10:00</dt>
              <dd>{formatStat(laning.lastHitsAt10)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>Золото к 10:00</dt>
              <dd>{formatStat(laning.goldAt10)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>Опыт к 10:00</dt>
              <dd>{formatStat(laning.xpAt10)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>Убийства 00:00–10:00</dt>
              <dd>{formatStat(laning.killsFirst10)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>Смерти 00:00–10:00</dt>
              <dd>{formatStat(laning.deathsFirst10)}</dd>
            </div>
            <div className="match-facts__item">
              <dt>Эффективность линии (OpenDota)</dt>
              <dd>{formatLaneEfficiencyPct(laning.laneEfficiencyPct)}</dd>
            </div>
          </dl>

          <div className="lane-purchases">
            <h3 className="lane-purchases__title">
              Покупки 00:00–10:00:{' '}
              {laning.purchasesFirst10 === null
                ? NO_DATA_LABEL
                : laning.purchasesFirst10.length}
            </h3>
            {laning.purchasesFirst10 === null && (
              <p className="stub__hint">Журнал покупок недоступен в ответе OpenDota.</p>
            )}
            {laning.purchasesFirst10 !== null && laning.purchasesFirst10.length === 0 && (
              <p className="stub__hint">
                В интервале 00:00–10:00 покупок нет (журнал получен).
              </p>
            )}
            {laning.purchasesFirst10 !== null && laning.purchasesFirst10.length > 0 && (
              <ul className="lane-purchases__list">
                {laning.purchasesFirst10.map((purchase, index) => (
                  <li
                    className="lane-purchase"
                    key={`${purchase.key}-${purchase.time}-${index}`}
                  >
                    <span className="lane-purchase__key">{purchase.key}</span>
                    <span className="lane-purchase__time">{formatEventTime(purchase.time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <p className="stub__hint">
        Источник: OpenDota. Период: 00:00–10:00. Поминутные показатели берутся из массивов
        OpenDota (индекс 10 соответствует 10:00) и не подменяются статистикой за весь матч;
        события фильтруются по времени в секундах. «Нет данных» означает отсутствие поля
        в ответе. Оценки качества линии не выполняются: подтверждённые нормы героя и роли
        появятся в следующих задачах.
      </p>
    </section>
  )
}