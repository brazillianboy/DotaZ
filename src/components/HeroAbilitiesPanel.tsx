import { useState } from 'react'

import {
  localizedAbilityDescription,
  localizedAbilityName,
  localizedFacetDescription,
  localizedFacetTitle,
  localizedPropertyLabel,
  localizedTalentName,
  localizedTypeLabel,
} from '../i18n/abilityLocalization'
import { useI18n } from '../i18n/I18nContext'
import {
  innateAbilities,
  standardAbilities,
  type HeroAbility,
  type HeroAbilityData,
} from '../lib/heroAbilities'

export type HeroAbilitiesState = 'loading' | 'ready' | 'error'

/** Иконка способности с нейтральной заглушкой (не ломает список при 404 CDN). */
function AbilityIcon({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  if (url === null || failed) {
    return (
      <span className="hero-ability__fallback" aria-hidden="true">
        {name.slice(0, 2).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      className="hero-ability__icon"
      src={url}
      alt=""
      width={36}
      height={36}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

/** Одна способность: имя, подтверждённые теги, описание и значения из справочника. */
function AbilityItem({ ability }: { ability: HeroAbility }) {
  const { t, locale } = useI18n()

  const name = localizedAbilityName(locale, ability.name, ability.displayName)
  const description = localizedAbilityDescription(locale, ability.name, ability.description)
  /**
   * Описание есть в источнике, но русского перевода ещё нет — показывается честная
   * подпись, а не выдуманный текст. Если описания нет в источнике вообще, это
   * отдельное состояние (`description === null`).
   */
  const translationMissing =
    locale === 'ru' && ability.description !== null && description === ability.description

  return (
    <li className="hero-ability" data-ability={ability.name}>
      <div className="hero-ability__head">
        <AbilityIcon url={ability.iconUrl} name={name} />
        <div className="hero-ability__title">
          <span className="hero-ability__name">{name}</span>
          {!ability.hasDisplayName && (
            <span className="hero-ability__chip hero-ability__chip--muted">
              {t('hero.abilities.noDisplayName')}
            </span>
          )}
          {ability.isInnate && (
            <span className="hero-ability__chip">{t('hero.abilities.innate')}</span>
          )}
          <span className="hero-ability__meta">
            {ability.behavior !== null && (
              <span className="hero-ability__chip">
                {t('hero.abilities.type')}: {localizedTypeLabel(locale, ability.behavior)}
              </span>
            )}
            {ability.damageType !== null && (
              <span className="hero-ability__chip">
                {t('hero.abilities.damage')}: {localizedTypeLabel(locale, ability.damageType)}
              </span>
            )}
            {ability.targetType !== null && (
              <span className="hero-ability__chip">
                {t('hero.abilities.target')}: {localizedTypeLabel(locale, ability.targetType)}
              </span>
            )}
            {ability.piercesImmunity === 'Yes' && (
              <span className="hero-ability__chip">{t('hero.abilities.immune')}</span>
            )}
          </span>
        </div>
      </div>

      <p className="hero-ability__description">
        {description ?? t('hero.abilities.noDescription')}
      </p>

      {translationMissing && (
        <p className="hero-ability__note">{t('hero.abilities.descriptionFallback')}</p>
      )}

      {ability.attributes.length > 0 && (
        <dl className="hero-ability__values">
          {ability.attributes.slice(0, 6).map((attribute) => (
            <div className="hero-ability__value" key={attribute.header}>
              <dt>{localizedPropertyLabel(locale, attribute.header)}</dt>
              <dd>{attribute.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}

/** Группа способностей: заголовок и список; пустая группа не выводится. */
function AbilityGroup({
  title,
  list,
  group,
}: {
  title: string
  list: HeroAbility[]
  group: string
}) {
  if (list.length === 0) {
    return null
  }
  return (
    <div className="hero-abilities__group" data-ability-group={group}>
      <h3 className="hero-subsection__title">{title}</h3>
      <ul className="hero-abilities">
        {list.map((ability) => (
          <AbilityItem ability={ability} key={ability.name} />
        ))}
      </ul>
    </div>
  )
}

/**
 * Способности, таланты и фасеты героя (Task 19).
 *
 * Количество способностей не предполагается: показывается ровно то, что вернул
 * справочник (у Phantom Assassin — шесть, у Kez — одиннадцать, у Largo — четырнадцать).
 * Группировка выполняется только по подтверждённому флагу провайдера `is_innate`:
 * обычные и врождённые способности. Отдельной пометки «дополнительная» провайдер не
 * отдаёт, поэтому такая категория не выдумывается — такие способности остаются в
 * обычной группе. Отсутствие описания не выдумывается: выводится пометка «описание
 * недоступно в источнике»; отсутствие `dname` — пометка о техническом имени.
 */
export default function HeroAbilitiesPanel({
  data,
  state,
}: {
  data: HeroAbilityData | null
  state: HeroAbilitiesState
}) {
  const { t, locale } = useI18n()

  const regular = data === null ? [] : standardAbilities(data)
  const innate = data === null ? [] : innateAbilities(data)

  return (
    <section className="lane-report panel" aria-labelledby="hero-abilities-title">
      <h2 className="match-section__title" id="hero-abilities-title">
        {t('hero.section.abilities')}
      </h2>

      {state === 'loading' && (
        <p className="stub__hint" role="status">
          {t('hero.abilities.loading')}
        </p>
      )}

      {state === 'error' && (
        <p className="auth-alert auth-alert--error" role="status">
          {t('hero.abilities.error')}
        </p>
      )}

      {state === 'ready' && data === null && (
        <p className="stub__hint" role="status">
          {t('hero.abilities.empty')}
        </p>
      )}

      {state === 'ready' && data !== null && (
        <>
          {data.abilities.length === 0 ? (
            <p className="stub__hint">{t('hero.abilities.empty')}</p>
          ) : (
            <>
              <AbilityGroup
                title={t('hero.abilities.standardTitle')}
                list={regular}
                group="standard"
              />
              <AbilityGroup
                title={t('hero.abilities.innateTitle')}
                list={innate}
                group="innate"
              />
              <p className="stub__hint">
                {t('hero.abilities.coverage', {
                  total: data.abilities.length,
                  described: data.abilities.length - data.abilitiesWithoutDescription,
                  missing: data.abilitiesWithoutDescription,
                })}
              </p>
              <p className="stub__hint">{t('hero.abilities.additionalNote')}</p>
              {data.innateAbilities > 0 && (
                <p className="stub__hint">
                  {t('hero.abilities.innateCount', { count: data.innateAbilities })}
                </p>
              )}
            </>
          )}

          {data.abilitiesWithoutDisplayName > 0 && (
            <p className="stub__hint">
              {t('hero.abilities.missingNames', { count: data.abilitiesWithoutDisplayName })}
            </p>
          )}

          {data.abilitiesWithoutDescription > 0 && (
            <p className="stub__hint">
              {t('hero.abilities.missingDescriptions', {
                count: data.abilitiesWithoutDescription,
              })}
            </p>
          )}

          <p className="stub__hint">{t('hero.abilities.descriptionLanguage')}</p>

          <h3 className="hero-subsection__title">{t('hero.section.talents')}</h3>
          {data.talents.length === 0 ? (
            <p className="stub__hint">{t('hero.talents.empty')}</p>
          ) : (
            <ul className="hero-talents">
              {data.talents.map((talent) => (
                <li className="hero-talent" key={talent.name}>
                  <span className="hero-talent__level">
                    {t('hero.talents.level', { level: talent.level })}
                  </span>
                  <span className="hero-talent__name">
                    {localizedTalentName(locale, talent.name, talent.displayName) ??
                      t('hero.talents.noName')}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="hero-subsection__title">{t('hero.section.facets')}</h3>
          {data.facets.length === 0 ? (
            <p className="stub__hint">{t('hero.facets.empty')}</p>
          ) : (
            <ul className="hero-facets">
              {data.facets.map((facet) => (
                <li className="hero-facet" key={facet.name} data-facet={facet.name}>
                  <span className="hero-facet__title">
                    {localizedFacetTitle(locale, facet.name, facet.title)}
                  </span>
                  <span className="hero-facet__description">
                    {localizedFacetDescription(locale, facet.name, facet.description) ??
                      t('hero.facets.noDescription')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.facetsWithoutDescription > 0 && (
            <p className="stub__hint">
              {t('hero.facets.missingDescriptions', { count: data.facetsWithoutDescription })}
            </p>
          )}
          <p className="stub__hint">{t('hero.facets.deprecated')}</p>
        </>
      )}
    </section>
  )
}
