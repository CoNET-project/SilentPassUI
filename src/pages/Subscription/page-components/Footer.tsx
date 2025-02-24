import { useNavigate } from 'react-router-dom';
import { Step } from '..';

import { ReactComponent as ProgressIcon} from "../assets/progress-activity.svg";

interface FooterProps {
  step: Step;
  nextStep: () => void;
  backToMyWallet: () => void;
}

export default function Footer({ step, nextStep, backToMyWallet }: FooterProps) {
  const navigate = useNavigate();

  function handleButtonAction() {
    if (step === 4 || step === 5) {
      navigate("/wallet")
      return;
    }

    if (step === 1 || step === 2) {
      nextStep();
      return;
    }
  }

  return (
    <div className="subscription-footer">
      {(step === 2 || step === 3) && <p>Your transaction completion time may vary and can take up to 24 hours. Confirmation of Transaction Hash will display on completion.</p>}
      <button className={`step-${step}`} onClick={handleButtonAction}>
        {step === 3 && <ProgressIcon />}
        {step === 1 && "Subscribe"}
        {step === 2 && "Pay"}
        {step === 3 && "Processing"}
        {step === 4 && "Back to My Wallet"}
        {step === 5 && "Dismiss"}
      </button>
    </div>
  )
}