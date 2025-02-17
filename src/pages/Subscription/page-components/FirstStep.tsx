import BuyMore from './BuyMore';
import CurrentSubscription from './CurrentSubscription';

export default function FirstStep() {
  return (
    <div className="step-container">
      <CurrentSubscription />
      <BuyMore />
    </div>
  )
}