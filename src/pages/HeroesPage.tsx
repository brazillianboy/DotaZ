import PlaceholderPanel from '../components/PlaceholderPanel'
import { useI18n } from '../i18n/I18nContext'

export default function HeroesPage() {
  const { t } = useI18n()

  return <PlaceholderPanel title={t('heroes.title')} description={t('heroes.description')} />
}