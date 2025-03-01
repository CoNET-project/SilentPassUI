import AccountList from '../../../components/AccountList';
import BuyMore from './BuyMore';
import CurrentSubscription from './CurrentSubscription';

export default function FirstStep({ spInUsd, solInUsd }: any) {
  return (
    <div className="step-container">
      <AccountList showMainWallet={false} simplifiedView spInUsd={spInUsd} solInUsd={solInUsd} />
      <CurrentSubscription />
      <BuyMore />
    </div>
  )
}