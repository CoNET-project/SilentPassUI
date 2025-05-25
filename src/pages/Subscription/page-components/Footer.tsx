import { Step } from '../../../types/global-types';
import { ReactComponent as ProgressIcon } from "../assets/progress-activity.svg";
import { useDaemonContext } from '../../../providers/DaemonProvider';
import { useTranslation } from 'react-i18next'

interface FooterProps {
  step: Step;
  isSubmitButtonDisabled: boolean;
  handleButtonAction: () => void;
}

export default function Footer({ step, isSubmitButtonDisabled, handleButtonAction }: FooterProps) {
	const { profiles, isIOS, paymentKind } = useDaemonContext();
	const { t, i18n } = useTranslation()
  return (
    <div className="subscription-footer">
      {(step === 2 || step === 3) && paymentKind === 1 &&
	  	<p>{t('Subscription-Footer-transferInfo')}</p>
	  }
      <button className={`step-${step} ${isSubmitButtonDisabled ? "disabled" : ""}`} disabled={isSubmitButtonDisabled} onClick={() => !isSubmitButtonDisabled && handleButtonAction()} style={{ cursor: isSubmitButtonDisabled ? "not-allowed" : "pointer" }}>
        {step === 3 && <ProgressIcon />}
        {step === 1 && "Pay with $SP"}
        {step === 2 && 
			<>
			{
				isSubmitButtonDisabled ? t('comp-comm-Insufficient-balance') : t('comp-comm-Pay')
			}
			</>
		
		}
        {step === 3 && t('')}
        {step === 4 && "Back to My Wallet"}
        {step === 5 && t('comp-comm-backToWallet')}
      </button>
    </div>
  )
}