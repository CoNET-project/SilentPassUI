import { useNavigate } from 'react-router-dom';
import { Step } from '..';

import { ReactComponent as ProgressIcon } from "../assets/progress-activity.svg";
import { useDaemonContext } from '../../../providers/DaemonProvider';
import { useEffect, useState } from 'react';
import { purchasePassport } from '../../../services/passportPurchase';

interface FooterProps {
  step: Step;
  isSubmitButtonDisabled: boolean;
  handleButtonAction: () => void;
}

export default function Footer({ step, isSubmitButtonDisabled, handleButtonAction }: FooterProps) {

  return (
    <div className="subscription-footer">
      {(step === 2 || step === 3) && <p>Your transaction completion time may vary and can take up to 24 hours. Confirmation of Transaction Hash will display on completion.</p>}
      <button className={`step-${step} ${isSubmitButtonDisabled ? "disabled" : ""}`} disabled={isSubmitButtonDisabled} onClick={() => !isSubmitButtonDisabled && handleButtonAction()} style={{ cursor: isSubmitButtonDisabled ? "not-allowed" : "pointer" }}>
        {step === 3 && <ProgressIcon />}

        {step === 1 && "Pay with $SP"}
        {step === 2 && "Pay"}
        {step === 3 && "Processing"}
        {step === 4 && "Back to My Wallet"}
        {step === 5 && "Dismiss"}
      </button>
    </div>
  )
}