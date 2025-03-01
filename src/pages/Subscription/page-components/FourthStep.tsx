import Separator from '../../../components/Separator';

export default function FourthStep({ price, gasfee }: { price: string, gasfee: string }) {
  return (
    <div className="step-container">
      <div className="purchase-success">
        <img src="/assets/purchase-check.svg" />
        <div>
          <p>The transaction</p>
          <p>was successful</p>
        </div>
      </div>
      <div className="purchase-details">
        <div className="detail">
          <p>Silent Pass Passport</p>
          <p>{price} $SP</p>
        </div>
        <div className="detail">
          <p>GAS fee</p>
          <p>{gasfee} $SOL</p>
        </div>
        <Separator />
        <div className="detail">
          <p>Total</p>
          <p>{price} $SP + ${gasfee} $SOL</p>
        </div>
      </div>
    </div>
  )
}