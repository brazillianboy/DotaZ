/**
 * Типы результатов анализа матча (Task 9).
 *
 * Наблюдения описывают только факты из нормализованных данных (Task 6–8) и
 * сопровождаются точным подтверждением: поле, значение, период, источник.
 * Оценки качества игры и рекомендации без подтверждённой нормы не формируются.
 * Все структуры JSON-сериализуемы и не содержат React-элементов.
 */

/** Источник данных анализа. */
export type AnalysisSource = 'OpenDota'

/** Подтверждение: конкретное поле, его значение, период и источник. */
export interface AnalysisEvidence {
  /** Имя поля источника (например, `lh_t[10]`, `kills`, `purchase_log`). */
  field: string
  /** Фактическое значение из нормализованных данных. */
  value: number | string | boolean
  /** Период, к которому относится значение. */
  period: string
  source: AnalysisSource
}

/** Наблюдение — воспроизводимый факт, а не оценка игры. */
export interface AnalysisObservation {
  rule_id: string
  rule_version: string
  player_slot: number
  /** Короткое имя показателя (машинное). */
  metric: string
  period: string
  source: AnalysisSource
  /** Текст наблюдения на русском. */
  text: string
  evidence: AnalysisEvidence[]
  limitations: string[]
}

/**
 * Рекомендация. Формируется только при документированном объективном условии
 * и достаточных подтверждённых данных; в версии 1.0.0 таких правил нет.
 */
export interface AnalysisRecommendation {
  rule_id: string
  rule_version: string
  player_slot: number
  text: string
  evidence: AnalysisEvidence[]
  limitations: string[]
}

/** Ограничение анализа: машинный код и понятное описание. */
export interface AnalysisLimitation {
  code: string
  text: string
}

/** Результат анализа одного участника. */
export interface PlayerAnalysis {
  rule_version: string
  player_slot: number
  observations: AnalysisObservation[]
  recommendations: AnalysisRecommendation[]
  limitations: AnalysisLimitation[]
  /** true, если есть хотя бы одно подтверждённое наблюдение. */
  hasObservations: boolean
  /** Почему рекомендации недоступны (null, если они есть). */
  recommendationsNote: string | null
}