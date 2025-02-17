import { useState } from 'react';
import ClickableItem from '../../components/ClickableItem';
import { useNavigate } from 'react-router-dom';

import faqIcon from "./assets/faq-icon.svg";
import FirstStep from './page-components/FirstStep';
import Header from './page-components/Header';
import Footer from './page-components/Footer';

import './index.css';
import SecondStep from './page-components/SecondStep';

export type Step = number /* 1 | 2 | 3 | 4 | 5 */;

export default function Subscription() {
  const [step, setStep] = useState<Step>(2);

  const navigate = useNavigate();

  function nextStep() {
    if (step === 5) return;
    setStep((prev) => prev + 1);
  }

  return (
    <div className="page-container">
      <p>{step}</p>
      <button onClick={() => setStep((prev) => prev - 1)}>MENOS</button>
      <button onClick={() => setStep((prev) => prev + 1)}>MAIS</button>
      <Header step={step} setStep={setStep} />

      {step === 1 && <FirstStep />}
      {step === 2 && <SecondStep />}

      <Footer step={step} nextStep={nextStep} backToMyWallet={() => navigate("/wallet")} />

      {step === 1 && <ClickableItem title="FAQ" icon={faqIcon} action={() => navigate("/about")} />}
    </div>
  )
}