import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FirstStep from './page-components/FirstStep';
import Header from './page-components/Header';
import PageFooter from './page-components/Footer';
import SecondStep from './page-components/SecondStep';
import FourthStep from './page-components/FourthStep';

import './index.css';
import { getOracle, purchasePassport } from '../../services/passportPurchase';
import { useDaemonContext } from '../../providers/DaemonProvider';
import Loading from '../../components/Global-steps/Loading';
import Declined from '../../components/Global-steps/Declined';
import { Step } from '../../types/global-types';
import {waitingPaymentStatus} from '../../services/wallets'

export default function Subscription() {
  const [step, setStep] = useState<Step>(3);
  const [price, setPriceInSp] = useState('0');
  const [gasfee, setGasfee] = useState('0');
  const [updateCounter, setUpdateCounter] = useState(0);
  const [spInUsd, setSpInUsd] = useState(0);
  const [solInUsd, setSolInUsd] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [oracleError, setOracleError] = useState(false);
  const [sp249, setSp249] = useState('0');
  const [sp2499, setSp2499] = useState('0');
  const [sp999, setSp999] = useState('0');
  const [sp9999, setSp9999] = useState('0');
  const [isSubmitButtonDisabled, setIsSubmitButtonDisabled] = useState(false);

  const { profiles, setSuccessNFTID} = useDaemonContext();

  const navigate = useNavigate();

  function nextStep() {
    if (step > 4) return;
    setStep((prev) => (prev + 1 as Step));
  }

  const waitResult = async () => {
	await waitingPaymentStatus()
	navigate('/wallet')
	
  }

  let first = true
  useEffect(() => {
	if (first) {
		first = false
		waitResult()
	}
  }, [])



  async function handleButtonAction() {
    if (step === 1) {
      nextStep();
      return;
    }

    if (step === 2) {
      try {
        nextStep();
        await purchasePassport(profiles[1]?.privateKeyArmor, price);
        setStep(4);
      } catch (error) {
        setStep(5);
        console.log('error purchasing passport')
      }

      return
    }

    if (step === 4 || step === 5) {
      navigate("/wallet")
      return;
    }
  }

  useEffect(() => {
	
  }, []);

  return (
    <div className={`page-container ${(step === 3 || step === 4 || step === 5) ? 'h-full' : ''}`}>
      {step === 4 && <div></div>}

      <Header step={step} setStep={setStep} />

      {step === 1 && <FirstStep spInUsd={spInUsd} solInUsd={solInUsd} />} {/* Purchase payment */}
      {step === 2 && <SecondStep price={price} gasfee={gasfee} updateCounter={updateCounter} spInUsd={spInUsd} solInUsd={solInUsd} />} {/* Purchase confirmation */}
      {step === 3 && <Loading />} {/* Purchase loading */}
      {step === 4 && <FourthStep price={price} gasfee={gasfee} />} {/* Purchase successful */}
      {step === 5 && <Declined />} {/* Purchase declined */}

      <PageFooter step={step} handleButtonAction={handleButtonAction} isSubmitButtonDisabled={isSubmitButtonDisabled} />
    </div>
  )
}