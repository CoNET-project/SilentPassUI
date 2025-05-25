import BackButton from '../../../components/BackButton';
import { Step } from '../../../types/global-types';
import { useTranslation } from 'react-i18next'

export default function Header({ step }: { step: Step }) {
	const { t, i18n } = useTranslation()
  return (
    <>
      {(step === 2) && <BackButton to="/wallet" />}
      {step === 2 && <h1>{t('Subscription-Header-title')} </h1>}
      {step === 3 && (
		
        <div className="subscription-header">
			<BackButton to="/wallet" />
          <h1>{t('Subscription-Header-progress')}</h1>
          <p>{t('Subscription-Header-progress-detail')} </p>
        </div>
      )}
    </>
  )
}