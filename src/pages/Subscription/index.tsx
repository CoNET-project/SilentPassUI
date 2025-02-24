import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FirstStep from './page-components/FirstStep';
import Header from './page-components/Header';
import PageFooter from './page-components/Footer';
import SecondStep from './page-components/SecondStep';
import ThirdStep from './page-components/ThirdStep';
import FifthStep from './page-components/FifthStep';
import FourthStep from './page-components/FourthStep';

import './index.css';

export type Step = 1 | 2 | 3 | 4 | 5;

export default function Subscription() {
  const [step, setStep] = useState<Step>(1);

  const navigate = useNavigate();

  function nextStep() {
    if (step > 4) return;
    setStep((prev) => (prev + 1 as Step));
  }

  return (
    <div className={`page-container ${(step === 3 || step === 4 || step === 5) ? 'h-full' : ''}`}>
      {step === 4 && <div></div>}

      <Header step={step} setStep={setStep} />

      {step === 1 && <FirstStep />} {/* Purchase payment */}
      {step === 2 && <SecondStep />} {/* Purchase confirmation */}
      {step === 3 && <ThirdStep />} {/* Purchase loading */}
      {step === 4 && <FourthStep />} {/* Purchase successful */}
      {step === 5 && <FifthStep />} {/* Purchase declined */}

      <PageFooter step={step} nextStep={nextStep} backToMyWallet={() => navigate("/wallet")} />
    </div>
  )
}