import BackButton from '../../../components/BackButton';
import { Step } from '..';

export default function Header({ step, setStep }: { step: Step, setStep: (step: Step) => void }) {
  return (
    <>
      {(step === 2) && <BackButton to="/" />}
      {step === 2 && <h1>Confirm your order</h1>}
      {step === 3 && (
        <div className="subscription-header">
          <h1>Transaction in progress</h1>
          <p>Your order completion time may vary, please wait and we’ll let you know when it’s completed.</p>
        </div>
      )}
    </>
  )
}