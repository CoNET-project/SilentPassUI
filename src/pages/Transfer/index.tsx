import { useEffect, useState } from 'react';
import './index.css';
import { Step } from '../../types/global-types';
import Loading from '../../components/global-steps/Loading';
import Declined from '../../components/global-steps/Declined';
import Header from './page-components/Header';
import PageFooter from './page-components/Footer';
import { useNavigate } from 'react-router-dom';
import { calculateTransferNftGas, transferNft } from '../../services/wallets';
import FirstStep from './page-components/FirstStep';
import SecondStep from './page-components/SecondStep';
import FourthStep from './page-components/FourthStep';

export default function Transfer() {
  const [step, setStep] = useState<Step>(1);
  const [to, setTo] = useState<string>('');
  const [selectedNftId, setSelectedNftId] = useState<string>('');
  const [gasFee, setGasFee] = useState<string>('');
  const [updateCounter, setUpdateCounter] = useState<number>(60);

  const [firstGasCalculationDone, setFirstGasCalculationDone] = useState<boolean>(false);

  const navigate = useNavigate();

  function nextStep() {
    if (step > 4) return;
    setStep((prev) => (prev + 1 as Step));
  }

  async function handleButtonAction() {
    if (step === 1) {
      nextStep();
      return;
    }

    if (step === 2) {
      try {
        nextStep();
        await transferNft(to, selectedNftId);
        setTimeout(() => setStep(4), 2000);
      } catch (error) {
        setStep(5);
      }

      return
    }

    if (step === 4 || step === 5) {
      navigate("/wallet")
      return;
    }
  }

  async function calculateGas() {
    const gas = await calculateTransferNftGas(to, selectedNftId);

    if (!gas) return;

    setGasFee(gas.gasFee);
  }

  useEffect(() => {
    if (!to || !selectedNftId || firstGasCalculationDone) return;

    (async () => {
      await calculateGas();
      setFirstGasCalculationDone(true);
    })()
  }, [to, selectedNftId, firstGasCalculationDone]);

  useEffect(() => {
    if (step !== 2) return;

    setTimeout(() => {
      setUpdateCounter((prev) => prev === 0 ? 60 : prev - 1)
    }, 1000);

    if (updateCounter === 0) {
      (async () => {
        setGasFee('');
        await calculateGas();
      })()
    }
  }, [updateCounter, step])

  return (
    <div className={`page-container ${step !== 2 ? 'h-full' : ''}`}>
      <div style={step === 1 ? { flex: 1, display: 'flex', flexDirection: 'column' } : {}}>
        <Header step={step} setStep={setStep} />
        {step === 1 && <FirstStep to={to} setTo={setTo} selectedNftId={selectedNftId} setSelectedNFtId={setSelectedNftId} />} {/* Purchase payment */}
      </div>
      {step === 2 && <SecondStep gasFee={gasFee} updateCounter={updateCounter} selectedNftId={selectedNftId} />} {/* Purchase confirmation */}
      {step === 3 && <Loading />} {/* Purchase loading */}
      {step === 4 && <FourthStep gasFee={gasFee} selectedNftId={selectedNftId} />} {/* Purchase successful */}
      {step === 5 && <Declined />} {/* Purchase declined */}

      <PageFooter step={step} handleButtonAction={handleButtonAction} isSubmitButtonDisabled={!to || !selectedNftId || !gasFee} />
    </div>
  )
}