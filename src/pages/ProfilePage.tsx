import { useState } from 'react'

import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n/I18nContext'
import { steamErrorKey } from '../lib/steamClient'

/**
 * Минимальный защищённый профиль (Task 20A → Task 20B).
 *
 * Здесь нет статистики игры: полный профиль Dota 2 — задача 20B. Страница
 * показывает **проверенную** Steam-личность текущего пользователя, позволяет
 * привязать Steam к существующему аккаунту и честно сообщает, что остальное
 * ещё не реализовано.
 */
export default function ProfilePage() {
  const { steamIdentity, isSteamConfigured, startSteamLink } = useAuth()
  const { t } = useI18n()
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  async function handleLink() {
    if (linking) {
      return
    }
    setLinking(true)
    setLinkError(null)
    const result = await startSteamLink('/profile')
    if (!result.ok) {
      setLinkError(result.steamErrorCode ?? 'link_failed')
      setLinking(false)
    }
  }

  return (
    <section className="stub">
      <div className="container">
        <div className="stub__panel panel">
          <h1 className="stub__title">{t('profile.title')}</h1>

          {steamIdentity === null ? (
            <>
              <p className="stub__text">{t('profile.noSteam')}</p>
              <p className="auth-hint">{t('profile.notLinkedHint')}</p>

              {isSteamConfigured ? (
                <div className="auth-steam">
                  <button
                    type="button"
                    className="btn btn--steam auth-steam__button"
                    onClick={handleLink}
                    disabled={linking}
                  >
                    {linking ? t('auth.steam.signingIn') : t('auth.steam.link')}
                  </button>
                  <p className="auth-hint">{t('auth.steam.linkHint')}</p>
                  {linkError !== null && (
                    <p className="auth-alert auth-alert--error" role="alert">
                      {t(steamErrorKey(linkError))}
                    </p>
                  )}
                </div>
              ) : (
                <p className="auth-hint" role="status">
                  {t('auth.steam.error.notConfigured')}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="steam-identity">
                {steamIdentity.avatarUrl === null ? (
                  <span className="steam-identity__avatar steam-identity__avatar--empty" aria-hidden="true">
                    {t('auth.steam.unknownName').slice(0, 1)}
                  </span>
                ) : (
                  <img
                    className="steam-identity__avatar"
                    src={steamIdentity.avatarUrl}
                    alt={t('auth.steam.avatarAlt')}
                    width={96}
                    height={96}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                )}
                <div className="steam-identity__body">
                  <p className="steam-identity__name">
                    {steamIdentity.personaName ?? t('auth.steam.unknownName')}
                  </p>
                  <p className="steam-identity__id">
                    {t('profile.steamId')}: <code>{steamIdentity.steamId64}</code>
                  </p>
                  {steamIdentity.profileUrl !== null && (
                    <a
                      className="steam-identity__link"
                      href={steamIdentity.profileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {t('profile.openSteam')}
                    </a>
                  )}
                </div>
              </div>

              <h2 className="stub__subtitle">{t('profile.placeholderTitle')}</h2>
              <p className="stub__text">{t('profile.placeholderText')}</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
