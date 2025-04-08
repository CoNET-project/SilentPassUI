import BackButton from '../../../components/BackButton';
import { Step } from '../../../types/global-types';

export default function Header({ step }: { step: Step }) {
  return (
    <>
      {(step === 2 || step === 3) && (
        <div>
          <BackButton to="/wallet" />
          {step === 3 && (
            <div className="subscription-header">
              <h1>Transaction in progress</h1>
              <p>Your order completion time may vary, please wait and we’ll let you know when it’s completed.</p>
            </div>
          )}
        </div>
      )}
      {step === 2 && <h1>Confirm your order</h1>}
    </>
  )
}