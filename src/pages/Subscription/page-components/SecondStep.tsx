import Separator from '../../../components/Separator';

import { ReactComponent as SpToken } from '../assets/sp-token.svg';

import { ReactComponent as WalletIcon } from '../assets/wallet-icon.svg';
import { ReactComponent as QuotesIcon } from '../assets/quotes-icon.svg';
import AccountList from '../../../components/AccountList';
import { useDaemonContext } from '../../../providers/DaemonProvider';

export default function SecondStep({ price, gasfee, updateCounter, spInUsd, solInUsd }: any) {
  const { profiles, purchasingPlan, purchasingPlanPaymentTime } = useDaemonContext();

  return (
    <div className="transaction-details">
      <AccountList showMainWallet={false} simplifiedView spInUsd={spInUsd} solInUsd={solInUsd} />

      <div className="transaction-info">
        <p>You're buying</p>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ flex: 5, fontSize: '20px', fontWeight: '700' }}>{purchasingPlan === 'premium' ? 'Premium' : 'Standard'} Passport</p>
              <p style={{ flex: 1, fontSize: '14px', fontWeight: '400', color: '#989899' }}>{purchasingPlanPaymentTime === 'monthly' ? '30' : '365'} days</p>
            </div>
            <span>{purchasingPlan === 'premium' ? '5' : '1'} Device{purchasingPlan === 'premium' ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="transaction-info">
        <p>Paying with</p>
        <div className='simple-content'>
          <SpToken />
          <p>$SP</p>
        </div>
      </div>

      <div className="transaction-info">
        <p>Wallet</p>
        <div>
          <WalletIcon />
          <div>
            <p>Solana Wallet</p>
            <span>{profiles?.[1]?.keyID?.slice(0, 5)}...{profiles?.[1]?.keyID?.slice(-5)}</span>
          </div>
        </div>
      </div>

      <div className="summary">
        <div className="summary-heading">
          <p>Summary</p>
          <div className="quotes">
            <QuotesIcon />
            <p>Quote updates in {updateCounter >= 0 ? updateCounter : 0}s</p>
          </div>
        </div>

        <div className="summary-table">
          <div>
            <p>{purchasingPlan === 'premium' ? 'Premium' : 'Standard'} Passport </p>
            <p>{parseFloat(price).toFixed(4)} $SP</p>
          </div>

          <div>
            <p>GAS Fee</p>
            <p>{parseFloat(gasfee).toFixed(4)} $SOL</p>
          </div>

          <Separator />

          <div>
            <p>Total</p>
            <p>{parseFloat(price).toFixed(4)} $SP + {parseFloat(gasfee).toFixed(4)} $SOL</p>
          </div>
        </div>
      </div>
    </div>
  )
}