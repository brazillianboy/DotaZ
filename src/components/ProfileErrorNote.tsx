import type { OpenDotaError, OpenDotaErrorKind } from '../lib/opendota'
import type { TranslationKey } from '../i18n/translations'
import { useI18n } from '../i18n/I18nContext'

/**
 * Пояснение недоступной секции профиля (Task 20B).
 *
 * Коды OpenDota (`OpenDotaErrorKind`) переводятся в локализованные причины, чтобы
 * английский интерфейс не показывал русские сообщения клиента Task 5.
 * Технические подробности и статусы в интерфейс не попадают.
 */

export const PLAYER_ERROR_REASON_KEYS: Record<OpenDotaErrorKind, TranslationKey> = {
  not_found: 'profile.reason.notFound',
  forbidden: 'profile.reason.forbidden',
  rate_limited: 'profile.reason.rateLimited',
  server_error: 'profile.reason.serverError',
  unexpected_status: 'profile.reason.unexpected',
  network: 'profile.reason.network',
  timeout: 'profile.reason.timeout',
  invalid_response: 'profile.reason.invalid',
  aborted: 'profile.reason.aborted',
}

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

/** Текст причины недоступности по коду ошибки. */
export function playerErrorReason(t: Translate, error: OpenDotaError): string {
  return t(PLAYER_ERROR_REASON_KEYS[error.kind])
}

interface ProfileErrorNoteProps {
  error: OpenDotaError
  /** Обработчик повтора; отсутствует в секциях без собственного запроса. */
  onRetry?: () => void
}

export default function ProfileErrorNote({ error, onRetry }: ProfileErrorNoteProps) {
  const { t } = useI18n()
  return (
    <div className="profile-error" role="note">
      <p className="profile-error__text">
        {t('profile.sectionUnavailable', { reason: playerErrorReason(t, error) })}
        {' '}
        {t('profile.noZeroNote')}
      </p>
      {onRetry !== undefined && (
        <button type="button" className="btn btn--ghost profile-error__retry" onClick={onRetry}>
          {t('profile.retry')}
        </button>
      )}
    </div>
  )
}
