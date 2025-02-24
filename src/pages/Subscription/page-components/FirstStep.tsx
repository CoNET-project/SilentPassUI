import AccountList from '../../../components/AccountList';
import BuyMore from './BuyMore';
import CurrentSubscription from './CurrentSubscription';

export default function FirstStep() {
  return (
    <div className="step-container">
      <AccountList simplifiedView />
      <CurrentSubscription />
      <BuyMore />
    </div>
  )
}