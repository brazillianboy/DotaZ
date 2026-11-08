import { describe, expect, it } from 'vitest'

import { ITEM_TIMING_MIN_CLASSIFY_SAMPLE } from './itemTimings'
import {
  TIMING_SCALE_MIN_PADDING_SECONDS,
  TIMING_SCALE_PADDING_RATIO,
  buildTimingScale,
} from './timingScale'

/**
 * Тесты геометрии шкалы тайминга (Task 18): чистые вычисления без React.
 * Значения синтетические; проверяется арифметика, а не статистика OpenDota.
 */

const STATS = { n: 200, p25: 600, p50: 750, p75: 900 }

function percentOf(value: number, domainMin: number, domainMax: number): number {
  return Math.round(((value - domainMin) / (domainMax - domainMin)) * 10000) / 100
}

describe('buildTimingScale — порог выборки', () => {
  it('не строит шкалу при n = 29, 30 и 99', () => {
    expect(buildTimingScale({ actualSeconds: 700, stats: { ...STATS, n: 29 } })).toBeNull()
    expect(buildTimingScale({ actualSeconds: 700, stats: { ...STATS, n: 30 } })).toBeNull()
    expect(buildTimingScale({ actualSeconds: 700, stats: { ...STATS, n: 99 } })).toBeNull()
  })

  it('строит шкалу при n = 100 и 101', () => {
    expect(buildTimingScale({ actualSeconds: 700, stats: { ...STATS, n: 100 } })).not.toBeNull()
    expect(buildTimingScale({ actualSeconds: 700, stats: { ...STATS, n: 101 } })).not.toBeNull()
  })

  it('по умолчанию используется порог классификации', () => {
    expect(buildTimingScale({ actualSeconds: 700, stats: { ...STATS, n: 99 } })).toBeNull()
    expect(ITEM_TIMING_MIN_CLASSIFY_SAMPLE).toBe(100)
  })

  it('пользовательский порог соблюдается', () => {
    expect(
      buildTimingScale({ actualSeconds: 700, stats: { ...STATS, n: 50 } }, { minSample: 50 }),
    ).not.toBeNull()
    expect(
      buildTimingScale({ actualSeconds: 700, stats: { ...STATS, n: 50 } }, { minSample: 51 }),
    ).toBeNull()
  })
})

describe('buildTimingScale — область и позиции', () => {
  it('область содержит все значения с пропорциональным запасом', () => {
    const scale = buildTimingScale({ actualSeconds: 700, stats: STATS })
    expect(scale).not.toBeNull()
    if (scale === null) {
      return
    }
    const min = 600
    const max = 900
    const padding = (max - min) * TIMING_SCALE_PADDING_RATIO
    expect(scale.domainMinSeconds).toBeCloseTo(min - padding, 1)
    expect(scale.domainMaxSeconds).toBeCloseTo(max + padding, 1)
    expect(scale.domainMinSeconds).toBeLessThan(min)
    expect(scale.domainMaxSeconds).toBeGreaterThan(max)
  })

  it('позиция медианы соответствует p50', () => {
    const scale = buildTimingScale({ actualSeconds: 700, stats: STATS })
    if (scale === null) {
      throw new Error('шкала не построена')
    }
    expect(scale.medianSeconds).toBe(STATS.p50)
    expect(scale.medianPercent).toBeCloseTo(
      percentOf(STATS.p50, scale.domainMinSeconds, scale.domainMaxSeconds),
      1,
    )
  })

  it('закрашенная зона соответствует p25–p75', () => {
    const scale = buildTimingScale({ actualSeconds: 700, stats: STATS })
    if (scale === null) {
      throw new Error('шкала не построена')
    }
    expect(scale.p25Percent).toBeCloseTo(
      percentOf(scale.p25Seconds, scale.domainMinSeconds, scale.domainMaxSeconds),
      1,
    )
    expect(scale.p75Percent).toBeCloseTo(
      percentOf(scale.p75Seconds, scale.domainMinSeconds, scale.domainMaxSeconds),
      1,
    )
    expect(scale.rangeStartPercent).toBe(scale.p25Percent)
    expect(scale.rangeWidthPercent).toBeCloseTo(
      scale.p75Percent - scale.p25Percent,
      1,
    )
    expect(scale.rangeWidthPercent).toBeGreaterThan(0)
  })

  it('позиция покупки вычисляется линейно и лежит между p25 и p75', () => {
    const scale = buildTimingScale({ actualSeconds: 700, stats: STATS })
    if (scale === null) {
      throw new Error('шкала не построена')
    }
    expect(scale.actualPercent).toBeCloseTo(
      percentOf(700, scale.domainMinSeconds, scale.domainMaxSeconds),
      1,
    )
    expect(scale.actualPercent).toBeGreaterThan(scale.p25Percent)
    expect(scale.actualPercent).toBeLessThan(scale.p75Percent)
    expect(scale.actualPosition).toBe('in-range')
  })

  it('ранняя покупка стоит левее зоны p25–p75', () => {
    const scale = buildTimingScale({ actualSeconds: 450, stats: STATS })
    if (scale === null) {
      throw new Error('шкала не построена')
    }
    expect(scale.actualPosition).toBe('before-range')
    expect(scale.actualPercent).toBeLessThan(scale.p25Percent)
    expect(scale.actualPercent).toBeGreaterThanOrEqual(0)
  })

  it('поздняя покупка стоит правее зоны p25–p75', () => {
    const scale = buildTimingScale({ actualSeconds: 1400, stats: STATS })
    if (scale === null) {
      throw new Error('шкала не построена')
    }
    expect(scale.actualPosition).toBe('after-range')
    expect(scale.actualPercent).toBeGreaterThan(scale.p75Percent)
    expect(scale.actualPercent).toBeLessThanOrEqual(100)
  })
})

describe('buildTimingScale — крайние случаи', () => {
  it('все значения равны: область расширяется, позиции в середине', () => {
    const equal = { n: 120, p25: 300, p50: 300, p75: 300 }
    const scale = buildTimingScale({ actualSeconds: 300, stats: equal })
    if (scale === null) {
      throw new Error('шкала не построена')
    }
    expect(scale.domainMaxSeconds - scale.domainMinSeconds).toBe(
      TIMING_SCALE_MIN_PADDING_SECONDS * 2,
    )
    expect(scale.actualPercent).toBe(50)
    expect(scale.medianPercent).toBe(50)
    expect(scale.rangeWidthPercent).toBe(0)
    expect(scale.actualPosition).toBe('in-range')
  })

  it('очень узкий диапазон квартилей остаётся видимым', () => {
    const narrow = { n: 150, p25: 300, p50: 300.5, p75: 301 }
    const scale = buildTimingScale({ actualSeconds: 350, stats: narrow })
    if (scale === null) {
      throw new Error('шкала не построена')
    }
    expect(scale.rangeWidthPercent).toBeGreaterThan(0)
    expect(scale.p25Percent).toBeLessThan(scale.p75Percent)
    expect(scale.domainMaxSeconds).toBeGreaterThan(350)
  })

  it('отрицательное время предматчевой закупки', () => {
    const preGame = { n: 582, p25: -89, p50: -88, p75: 174 }
    const scale = buildTimingScale({ actualSeconds: -89, stats: preGame })
    if (scale === null) {
      throw new Error('шкала не построена')
    }
    expect(scale.domainMinSeconds).toBeLessThan(-89)
    expect(scale.actualPercent).toBeGreaterThanOrEqual(0)
    expect(scale.actualPercent).toBeLessThan(scale.p75Percent)
    expect(scale.actualPosition).toBe('in-range')
  })

  it('очень ранняя и очень поздняя покупки не выходят за границы шкалы', () => {
    const veryEarly = buildTimingScale({ actualSeconds: -120, stats: STATS })
    const veryLate = buildTimingScale({ actualSeconds: 5400, stats: STATS })
    for (const scale of [veryEarly, veryLate]) {
      if (scale === null) {
        throw new Error('шкала не построена')
      }
      for (const percent of [
        scale.actualPercent,
        scale.medianPercent,
        scale.p25Percent,
        scale.p75Percent,
      ]) {
        expect(percent).toBeGreaterThanOrEqual(0)
        expect(percent).toBeLessThanOrEqual(100)
      }
    }
    expect(veryEarly?.actualPosition).toBe('before-range')
    expect(veryLate?.actualPosition).toBe('after-range')
  })

  it('дробные перцентили сохраняются без искажения', () => {
    const fractional = { n: 686, p25: 319.3, p50: 389.5, p75: 485 }
    const scale = buildTimingScale({ actualSeconds: 389.5, stats: fractional })
    if (scale === null) {
      throw new Error('шкала не построена')
    }
    expect(scale.p25Seconds).toBe(319.3)
    expect(scale.medianSeconds).toBe(389.5)
    expect(scale.actualPosition).toBe('in-range')
    expect(scale.actualPercent).toBe(scale.medianPercent)
  })

  it('некорректные значения не превращаются в шкалу', () => {
    expect(buildTimingScale({ actualSeconds: 700, stats: { n: 200, p25: null, p50: 750, p75: 900 } })).toBeNull()
    expect(buildTimingScale({ actualSeconds: 700, stats: { n: 200, p25: 800, p50: 750, p75: 900 } })).toBeNull()
    expect(buildTimingScale({ actualSeconds: 700, stats: { n: 200, p25: 600, p50: 750, p75: Number.NaN } })).toBeNull()
    expect(buildTimingScale({ actualSeconds: Number.NaN, stats: STATS })).toBeNull()
    expect(buildTimingScale({ actualSeconds: 700, stats: { ...STATS, n: Number.NaN } })).toBeNull()
    expect(buildTimingScale({ actualSeconds: 700, stats: { ...STATS, n: 150.5 } })).toBeNull()
    expect(
      buildTimingScale({ actualSeconds: 700, stats: STATS }, { minSample: 0 }),
    ).toBeNull()
  })

  it('порядок маркеров не нарушается: p25 ≤ медиана ≤ p75', () => {
    const scale = buildTimingScale({ actualSeconds: 700, stats: STATS })
    if (scale === null) {
      throw new Error('шкала не построена')
    }
    expect(scale.p25Percent).toBeLessThanOrEqual(scale.medianPercent)
    expect(scale.medianPercent).toBeLessThanOrEqual(scale.p75Percent)
  })
})
