import type { MatchParseOutcome } from '../lib/matchParseFlow'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'

interface MatchParseNoticeProps {
  /** Итог автоматической обработки реплея; `null` — обработка не запускалась. */
  outcome: MatchParseOutcome | null
}

interface ParsePresentation {
  badge: TranslationKey
  badgeClass: string
  message: TranslationKey
}

/**
 * Честный статус автоматической обработки реплея (Task 14).
 *
 * Показывается только когда обработка действительно выполнялась. Ни один статус не
 * утверждает успех без подтверждения: «Анализ готов» выводится лишь после того, как
 * повторная загрузка матча действительно подтвердила наличие подробных данных.
 */
function describeOutcome(outcome: MatchParseOutcome): ParsePresentation | null {
  switch (outcome.kind) {
    case 'not-needed':
      return null
    case 'aborted':
      return null
    case 'parsed':
      return {
        badge: 'parse.badge.ready',
        badgeClass: 'badge badge--ok',
        message: 'parse.ready',
      }
    case 'replay-unavailable':
      return {
        badge: 'parse.badge.unavailable',
        badgeClass: 'badge badge--warn',
        message: 'parse.replayUnavailable',
      }
    case 'pending':
      return {
        badge: 'parse.badge.pending',
        badgeClass: 'badge badge--warn',
        message: 'parse.pending',
      }
    case 'failed':
      return {
        badge: 'parse.badge.failed',
        badgeClass: 'badge badge--warn',
        message:
          outcome.reason === 'rate-limited'
            ? 'parse.rateLimited'
            : outcome.reason === 'network'
              ? 'parse.networkFailed'
              : outcome.reason === 'incomplete'
                ? 'parse.incomplete'
                : 'parse.failed',
      }
  }
}

export default function MatchParseNotice({ outcome }: MatchParseNoticeProps) {
  const { t } = useI18n()
  const presentation = outcome === null ? null : describeOutcome(outcome)
  if (presentation === null) {
    return null
  }

  return (
    <section className="parse-notice panel" aria-labelledby="parse-notice-title">
      <h2 className="match-section__title" id="parse-notice-title">
        {t('parse.title')}
      </h2>
      <p className={presentation.badgeClass} role="status" aria-live="polite">
        {t(presentation.badge)}
      </p>
      <p className="stub__text">{t(presentation.message)}</p>
      <p className="stub__hint">{t('parse.hint')}</p>
    </section>
  )
}
