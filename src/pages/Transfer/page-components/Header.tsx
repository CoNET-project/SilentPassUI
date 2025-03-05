import { useNavigate } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { Step } from '../../../types/global-types';

export default function Header({ step, setStep }: { step: Step, setStep: (step: Step) => void }) {
  const navigate = useNavigate();

  return (
    <>
      {(step === 1 || step === 2) && (
        <div className="transfer-header">
          <BackButton action={() => step === 1 ? navigate('/wallet') : setStep(1)} />
            <h1>{step === 1 ? 'Transfer Passport' : 'Confirm your transfer'}</h1>
        </div>
      )}
      {step === 3 && (
        <div className="transfer-header">
          <h1>Transaction in progress</h1>
          <p>Your order completion time may vary, please wait and we’ll let you know when it’s completed.</p>
        </div>
      )}
    </>
  )
}