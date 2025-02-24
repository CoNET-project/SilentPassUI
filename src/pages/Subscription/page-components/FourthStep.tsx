import Separator from '../../../components/Separator';

export default function FourthStep() {
  return (
    <div className="step-container">
      <div className="purchase-success">
        <img src="/assets/purchase-check.svg" />
        <p>The transaction</p>
        <p>was successful</p>
      </div>
      <div className="purchase-details">
        <div className="detail">
          <p>Silent Pass Passport</p>
          <p>24.99 SP</p>
        </div>
        <div className="detail">
          <p>GAS fee</p>
          <p>1 SOL</p>
        </div>
        <Separator />
        <div className="detail">
          <p>Total</p>
          <p>24.99 SP + 1 SOL</p>
        </div>
      </div>
    </div>
  )
}