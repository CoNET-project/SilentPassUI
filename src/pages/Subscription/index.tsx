import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FirstStep from './page-components/FirstStep';
import Header from './page-components/Header';
import PageFooter from './page-components/Footer';
import SecondStep from './page-components/SecondStep';
import ThirdStep from './page-components/ThirdStep';
import FifthStep from './page-components/FifthStep';
import FourthStep from './page-components/FourthStep';

import './index.css';
import { getOracle, purchasePassport } from '../../services/passportPurchase';
import { useDaemonContext } from '../../providers/DaemonProvider';

export type Step = 1 | 2 | 3 | 4 | 5;

export default function Subscription() {
  const [step, setStep] = useState<Step>(1);
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

  const { profiles, purchasingPlan, purchasingPlanPaymentTime } = useDaemonContext();

  const navigate = useNavigate();

  function nextStep() {
    if (step > 4) return;
    setStep((prev) => (prev + 1 as Step));
  }

  useEffect(() => {
    const interval = setInterval(() => setUpdateCounter((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [])

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (isLoading) return

      setUpdateCounter(updateCounter - 1)

      if (updateCounter <= 0 || oracleError) {
        setIsLoading(true)
        const oracleData = await getOracle()

        if (oracleData && oracleData.data) {
          setOracleError(false)

          setSp249(oracleData.data.sp249)
          setSp2499(oracleData.data.sp2499)
          setSp999(oracleData.data.sp999)
          setSp9999(oracleData.data.sp9999)

          const _spInUsd = calcSpInUsd(oracleData.data.sp9999)

          setSolInUsd(parseFloat(oracleData.data.so))
          setSpInUsd(_spInUsd)
          setUpdateCounter(60)
        } else {
          setOracleError(true)
        }

        setIsLoading(false)
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [updateCounter]);

  useEffect(() => {
    if (purchasingPlan === 'standard' && purchasingPlanPaymentTime === 'monthly')
      setPriceInSp(sp249)
    else if (purchasingPlan === 'standard' && purchasingPlanPaymentTime === 'yearly')
      setPriceInSp(sp2499)
    else if (purchasingPlan === 'premium' && purchasingPlanPaymentTime === 'monthly')
      setPriceInSp(sp999)
    else if (purchasingPlan === 'premium' && purchasingPlanPaymentTime === 'yearly')
      setPriceInSp(sp9999)
  }, [purchasingPlan, purchasingPlanPaymentTime, sp249, sp2499, sp999, sp9999])

  const calcSpInUsd = (sp9999: string) => {
    const sp9999Number = Number(sp9999)
    const _spInUsd = 99.99 / sp9999Number
    return _spInUsd
  }

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
    if (step === 1) {
      const result = (!profiles?.[1]?.tokens?.sp?.balance || Number(price) > profiles?.[1]?.tokens?.sp?.balance);
      return setIsSubmitButtonDisabled(result);
    }

    if (step === 2) {
      const result = (!profiles?.[1]?.tokens?.sp?.balance || (Number(price) > profiles?.[1]?.tokens?.sp?.balance) || (Number(gasfee) > profiles?.[1]?.tokens?.sol?.balance));
      return setIsSubmitButtonDisabled(result);
    }

    return setIsSubmitButtonDisabled(false);
  }, [step, price, gasfee, profiles]);

  return (
    <div className={`page-container ${(step === 3 || step === 4 || step === 5) ? 'h-full' : ''}`}>
      {step === 4 && <div></div>}

      <Header step={step} setStep={setStep} />

      {step === 1 && <FirstStep spInUsd={spInUsd} solInUsd={solInUsd} />} {/* Purchase payment */}
      {step === 2 && <SecondStep price={price} gasfee={gasfee} updateCounter={updateCounter} spInUsd={spInUsd} solInUsd={solInUsd} />} {/* Purchase confirmation */}
      {step === 3 && <ThirdStep />} {/* Purchase loading */}
      {step === 4 && <FourthStep price={price} gasfee={gasfee} />} {/* Purchase successful */}
      {step === 5 && <FifthStep />} {/* Purchase declined */}

      <PageFooter step={step} handleButtonAction={handleButtonAction} isSubmitButtonDisabled={isSubmitButtonDisabled} />
    </div>
  )
}