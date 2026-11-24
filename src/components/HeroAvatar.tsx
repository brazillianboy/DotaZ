import { useState } from 'react'

import { useI18n } from '../i18n/I18nContext'
import { heroImageUrl, heroInfo } from '../lib/heroes'

interface HeroAvatarProps {
  heroId: number
  /** Класс изображения (размер задаётся в CSS конкретного раздела). */
  className?: string
  /** Показывать ли имя героя рядом с портретом. */
  withName?: boolean
}

/**
 * Портрет героя с нейтральной заглушкой (Task 20B).
 *
 * Источник имени и картинки — существующий справочник `heroCatalog`/`heroes`:
 * второго набора данных о героях не создаётся. Имя героя всегда английское и не
 * переводится; неизвестный `hero_id` не подменяется чужим изображением.
 */
export default function HeroAvatar({ heroId, className, withName = false }: HeroAvatarProps) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  const info = heroInfo(heroId)
  const url = heroImageUrl(heroId)
  const name = info?.name ?? t('profile.heroUnknown', { id: heroId })

  return (
    <span className={`hero-avatar${className === undefined ? '' : ` ${className}`}`}>
      {url === null || failed ? (
        <span className="hero-avatar__fallback" aria-hidden="true">
          {info === null ? '?' : info.name.slice(0, 2)}
        </span>
      ) : (
        <img
          className="hero-avatar__image"
          src={url}
          alt={name}
          loading="lazy"
          width={64}
          height={36}
          onError={() => setFailed(true)}
        />
      )}
      {withName && <span className="hero-avatar__name">{name}</span>}
    </span>
  )
}
