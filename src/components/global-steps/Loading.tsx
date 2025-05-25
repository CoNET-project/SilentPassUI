import LoadingRing from '../LoadingRing';
import { useTranslation } from 'react-i18next'

export default function Loading() {
	const { t, i18n } = useTranslation()
  return (
    <div className="step-container">
      <LoadingRing />
      <p className="blue-text">{t('comp-comm-LoadingRing')}</p>
    </div>
  )
}