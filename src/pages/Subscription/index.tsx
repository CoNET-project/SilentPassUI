import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from './page-components/Header';
import PageFooter from './page-components/Footer';
import SecondStep from './page-components/SecondStep';
import FourthStep from './page-components/FourthStep';

import './index.css';
import { useDaemonContext } from '../../providers/DaemonProvider';
import Loading from '../../components/global-steps/Loading';
import Declined from '../../components/global-steps/Declined';
import { getPaymentUrl, waitingPaymentStatus } from '../../services/wallets';

global.Buffer = require('buffer').Buffer;
export type Step = 2 | 3 | 4 | 5;

export default function Subscription() {
  const { paymentKind, purchasingPlan, profiles, setSuccessNFTID, setPaymentKind } = useDaemonContext();
  const [step, setStep] = useState<Step>(2);
  const [price, setPriceInSp] = useState('0');
  const [gasfee, setGasfee] = useState('0');
  const [updateCounter, setUpdateCounter] = useState(0);
  const [spInUsd, setSpInUsd] = useState(0);
  const [solInUsd, setSolInUsd] = useState(0);
  const [isSubmitButtonDisabled, setIsSubmitButtonDisabled] = useState(false);

  const navigate = useNavigate();

  function nextStep() {
    if (step > 4) return;
    setStep((prev) => (prev + 1 as Step));
  }
  let ffcus = false
  useEffect(() => {
	if (ffcus) {
		return
	}
	ffcus = true
	const processVisa = async () => {
		if (paymentKind === 2) {
			setStep(3)
			const price = purchasingPlan === 'standard'? 299: 2499
			const result = await getPaymentUrl(price)
			if (result === null || !result?.url) {
				return setStep(5);
			}
			window.open(result.url, '_blank')
			const re1 = await waitingPaymentStatus()
			if (!re1) {
				return setStep(5);
			}
			setSuccessNFTID(re1)
			setPaymentKind(0)
			return navigate('/wallet')
		} else {
      setStep(2);
    }
	}
	processVisa()
    const interval = setInterval(() => setUpdateCounter((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [])


  async function handleButtonAction() {
    /* if (step === 1) {
      nextStep();
      return;
    } */

    if (step === 2) {
      try {
        nextStep();
        setStep(4);
      } catch (error) {
        setStep(5);
        console.log('error purchasing passport')
      }

      return
    }

    if (step === 4 || step === 5) {
      navigate("/")
      return;
    }
  }

  useEffect(() => {
    /* if (step === 1) {
      const result = (!profiles?.[1]?.tokens?.sp?.balance || Number(price) > profiles?.[1]?.tokens?.sp?.balance);
      return setIsSubmitButtonDisabled(result);
    } */

    if (step === 2) {
      const result = (!profiles?.[1]?.tokens?.sp?.balance || (Number(price) > profiles?.[1]?.tokens?.sp?.balance) || (Number(gasfee) > profiles?.[1]?.tokens?.sol?.balance));
      return setIsSubmitButtonDisabled(result);
    }

    return setIsSubmitButtonDisabled(false);
  }, [step, price, gasfee, profiles]);

  return (
    <div className={`page-container ${(step === 3 || step === 4 || step === 5) ? 'h-full' : ''}`}>
      {step === 4 && <div></div>}

      <Header step={step} />

      {/* {step === 1 && <FirstStep spInUsd={spInUsd} solInUsd={solInUsd} />} */}
      {step === 2 && <SecondStep price={price} gasfee={gasfee} updateCounter={updateCounter} spInUsd={spInUsd} solInUsd={solInUsd} />} {/* Purchase confirmation */}
      {step === 3 && <Loading />} {/* Purchase loading */}
      {step === 4 && <FourthStep price={price} gasfee={gasfee} />} {/* Purchase successful */}
      {step === 5 && <Declined />} {/* Purchase declined */}

      <PageFooter step={step} handleButtonAction={handleButtonAction} isSubmitButtonDisabled={isSubmitButtonDisabled} />
    </div>
  )
}