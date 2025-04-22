import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {ethers} from 'ethers'
import Header from './page-components/Header';
import PageFooter from './page-components/Footer';
import SecondStep from './page-components/SecondStep';
import FourthStep from './page-components/FourthStep';

import './index.css';
import { useDaemonContext } from '../../providers/DaemonProvider';
import Loading from '../../components/global-steps/Loading';
import Declined from '../../components/global-steps/Declined';
import { getPaymentUrl, waitingPaymentStatus, getPaypalUrl, spRewardRequest, RealizationRedeem } from '../../services/wallets';
import {getOracle, purchasePassport} from '../../services/passportPurchase'

global.Buffer = require('buffer').Buffer;
export type Step = 2 | 3 | 4 | 5;

export default function Subscription() {
  const { paymentKind, selectedPlan, setSelectedPlan,  profiles, setSuccessNFTID, setPaymentKind, getAllNodes } = useDaemonContext();
  const [step, setStep] = useState<Step>(2);
  const [price, setPriceInSp] = useState('0');
  const [gasfee, setGasfee] = useState('0');
  const [updateCounter, setUpdateCounter] = useState(0);
  const [spInUsd, setSpInUsd] = useState(0);
  const [solInUsd, setSolInUsd] = useState(0);
  const [isSubmitButtonDisabled, setIsSubmitButtonDisabled] = useState(false);
  const [spBalance, setSPBalance] = useState(0);
  const navigate = useNavigate();
  
  const setReflashQuote = () => {
	setUpdateCounter((prev) => prev - 1)
  }

  useEffect(() => {
	if (updateCounter) {
		setTimeout(() => setUpdateCounter((prev) => prev - 1), 1000)
		return
	}
	getSolanaQuote()
  }, [updateCounter])

  function nextStep() {
    if (step > 4) return;
    setStep((prev) => (prev + 1 as Step));
  }
  let ffcus = false

  const getSolanaQuote = async () => {
	const quote = await getOracle()
	if (quote?.data) {
		const data = quote.data
		if (selectedPlan === '1') {
			setPriceInSp(data.sp249)
		} else {
			setPriceInSp(data.sp2499)
		}
		( selectedPlan === '1') ? setSpInUsd(2.49/parseFloat(data.sp249)) : setSpInUsd(24.99/parseFloat(data.sp2499))
		setSolInUsd(parseFloat(data.so))
		setGasfee('0.00007999')
	}
	
	if (profiles && profiles?.length) {
		const _spBalance= profiles[1]?.tokens?.sp
		setSPBalance(parseFloat(_spBalance.balance))
	}
	setUpdateCounter(60)
	setReflashQuote()
  }

  useEffect(() => {
	if (ffcus) {
		return
	}
	ffcus = true
	const processVisa = async () => {
		switch(paymentKind) {
			//		
			case 6: {
				setStep(3)
				const redeemCode = selectedPlan
				const redeem = await RealizationRedeem(redeemCode)
				setSelectedPlan('12')
				if (redeem === null ) {
					return setStep(5)
				}
				
				setSuccessNFTID(redeem)
				setPaymentKind(0)
				return navigate('/wallet')
			}
			//		get SP Reword
			case 5: {
				setStep(3)
				const result = await spRewardRequest ()
				if (result < 0) {
					return setStep(5)
				}
				const re1 = await waitingPaymentStatus()
				if (re1 === false) {
					return setStep(5)
				}
				setSuccessNFTID(re1)
				setPaymentKind(0)
				return navigate('/wallet')
				
			}

			//		Pay with Paypal
			case 4: {
				
				setStep(3)
				const price = selectedPlan === '1' ? 1 : 2
				const result = await getPaypalUrl(price)
				if(result && result.code===0){
					let codeUrl=(result.data && result.data.ordersPayVo && result.data.ordersPayVo.payUrl && JSON.parse(result.data.ordersPayVo.payUrl).code_url?result.data && result.data.ordersPayVo && result.data.ordersPayVo.payUrl && JSON.parse(result.data.ordersPayVo.payUrl).code_url || '' :'');
					if (!codeUrl) {
						return setStep(5);
					}
					window.open(codeUrl, '_blank')
					const re1 = await waitingPaymentStatus()
					if (!re1) {
						return setStep(5);
					}
					setSuccessNFTID(re1)
					setPaymentKind(0)
					return navigate('/wallet')
				}
				return setStep(5);
				
			}
			//		pay with Stripe
			case 2: {
				setStep(3)
				const price = selectedPlan === '1' ? 299 : 2499
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
			}
			//		Apple Pay
			case 3: {
				setStep(3)
				const re1 = await waitingPaymentStatus()
				if (!re1) {
					return setStep(5);
				}
				setSuccessNFTID(re1)
				setPaymentKind(0)
				return navigate('/wallet')
			}
			//		Pay with SP
			default:
			case 1: {
				setStep(2);
				return getSolanaQuote();
			}
			
			
		}
	}
	
	processVisa()
  }, [])


  async function handleButtonAction() {
    /* if (step === 1) {
      nextStep();
      return;
    } */

    if (step === 2) {
      try {
        nextStep();
		await purchasePassport(price, getAllNodes)
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
      {step === 2 && <SecondStep price={price} gasfee={gasfee} updateCounter={updateCounter} spInUsd={spInUsd} solInUsd={solInUsd} SP_balance={spBalance} />} {/* Purchase confirmation */}
      {step === 3 && <Loading />} {/* Purchase loading */}
      {step === 4 && <FourthStep price={price} gasfee={gasfee} />} {/* Purchase successful */}
      {step === 5 && <Declined />} {/* Purchase declined */}

      <PageFooter step={step} handleButtonAction={handleButtonAction} isSubmitButtonDisabled={isSubmitButtonDisabled} />
    </div>
  )
}