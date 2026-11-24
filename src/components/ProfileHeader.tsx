import { useState } from 'react'

import type { SteamIdentityView } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'

interface ProfileHeaderProps {
  /** Проверенная Steam-личность текущего пользователя (из Supabase под RLS). */
  steamIdentity: SteamIdentityView
  /** Dota 2 account ID, вычисленный из SteamID64; `null`, если преобразование невозможно. */
  accountId: number | null
}

/**
 * Заголовок личного профиля (Task 20B).
 *
 * Показывает только проверенную личность: ник — как есть (без нормализации и
 * перевода), аватар — из сохранённого профиля Steam, SteamID64 — технический
 * идентификатор. Отдельно выводится вычисленный Dota 2 account ID, чтобы связь
 * трёх идентификаторов (Supabase UUID / SteamID64 / account_id) была явной.
 *
 * Никаких полей ввода идентификаторов здесь нет: SteamID64 нельзя подменить из
 * интерфейса, он приходит из привязки, созданной серверной проверкой OpenID.
 */
export default function ProfileHeader({ steamIdentity, accountId }: ProfileHeaderProps) {
  const { t } = useI18n()
  const [avatarFailed, setAvatarFailed] = useState(false)
  const avatarUrl = steamIdentity.avatarUrl
  const showAvatar = avatarUrl !== null && !avatarFailed

  return (
    <header className="profile-header panel">
      <div className="profile-header__avatar-wrap">
        {showAvatar && avatarUrl !== null ? (
          <img
            className="profile-header__avatar"
            src={avatarUrl}
            alt={t('auth.steam.avatarAlt')}
            width={112}
            height={112}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <span className="profile-header__avatar profile-header__avatar--empty" aria-hidden="true">
            {(steamIdentity.personaName ?? t('auth.steam.unknownName')).slice(0, 1)}
          </span>
        )}
      </div>

      <div className="profile-header__body">
        <span className="badge badge--ok profile-header__badge">{t('profile.verified')}</span>
        <h1 className="profile-header__name">
          {steamIdentity.personaName ?? t('auth.steam.unknownName')}
        </h1>
        <p className="profile-header__hint">{t('profile.verifiedHint')}</p>

        <dl className="profile-header__ids">
          <div className="profile-header__id">
            <dt>{t('profile.steamId')}</dt>
            <dd>
              <code>{steamIdentity.steamId64}</code>
            </dd>
          </div>
          <div className="profile-header__id">
            <dt>{t('profile.accountId')}</dt>
            <dd>
              {accountId === null ? (
                <span className="profile-header__id-missing">{t('profile.accountIdMissing')}</span>
              ) : (
                <code>{accountId}</code>
              )}
            </dd>
          </div>
        </dl>

        <p className="profile-header__note">{t('profile.accountIdHint')}</p>

        {steamIdentity.profileUrl !== null && (
          <a
            className="profile-header__link"
            href={steamIdentity.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('profile.openSteam')}
          </a>
        )}
      </div>
    </header>
  )
}
