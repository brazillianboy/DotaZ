import { useI18n } from '../i18n/I18nContext'
import { LOCALES, type Locale } from '../i18n/translations'

/**
 * Переключатель языка RU/EN (Task 13).
 *
 * Кнопки доступны с клавиатуры, состояние объявляется через `aria-pressed`,
 * подписи читаются скринридером. Переключение мгновенное: приложение не
 * перезагружается, запросы к OpenDota и записи отчётов не выполняются.
 */
export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="lang-select" role="group" aria-label={t('language.label')}>
      {LOCALES.map((code: Locale) => {
        const active = code === locale
        const label = code === 'ru' ? t('language.ru') : t('language.en')
        return (
          <button
            key={code}
            type="button"
            className={`lang-select__option${active ? ' lang-select__option--active' : ''}`}
            aria-pressed={active}
            lang={code}
            title={active ? label : t('language.switchTo', { language: label })}
            onClick={() => setLocale(code)}
          >
            {code.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}