import { useEffect, useState } from 'react'
import Separator from '../../../components/Separator';

import { ReactComponent as UsdtIcon } from '../assets/usdt-icon.svg';
import { ReactComponent as WalletIcon } from '../assets/wallet-icon.svg';
import { ReactComponent as QuotesIcon } from '../assets/quotes-icon.svg';
import AccountList from '../../../components/AccountList';

export default function SecondStep() {
  const [updatesIn, setUpdatesIn] = useState(60);

  useEffect(() => {
    const interval = setInterval(() => setUpdatesIn((prev) => prev - 1), 1000);

    return () => clearInterval(interval);
  }, [])

  useEffect(() => {
    if (updatesIn === 0) {
      setTimeout(() => setUpdatesIn(60), 1000);
    }
  }, [updatesIn]);

  return (
    <div className="transaction-details">
      <AccountList showMainWallet={false} simplifiedView />

      <div className="transaction-info">
        <p>You're buying</p>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '20px', fontWeight: '700' }}>Premium Passport</p>
              <p style={{ fontSize: '14px', fontWeight: '400', color: '#989899', width: 'auto !important' }}>365 days</p>
            </div>
            <span>Expirantion date: 15/01/2026</span>
          </div>
        </div>
      </div>

      <div className="transaction-info">
        <p>Paying with</p>
        <div className='simple-content'>
          <UsdtIcon />
          <p>USDT</p>
        </div>
      </div>

      <div className="transaction-info">
        <p>Wallet</p>
        <div>
          <WalletIcon />
          <div>
            <p>Main Wallet</p>
            <span>0x412BA4...03AB46</span>
          </div>
        </div>
      </div>

      <div className="summary">
        <div className="summary-heading">
          <p>Summary</p>
          <div className="quotes">
            <QuotesIcon />
            <p>Quote updates in {updatesIn}s</p>
          </div>
        </div>

        <div className="summary-table">
          <div>
            <p>Guardian NFT</p>
            <p>1250 USDT</p>
          </div>

          <div>
            <p>GAS Fee</p>
            <p>10 ETH</p>
          </div>

          <Separator />

          <div>
            <p>Total</p>
            <p>1250 USDT + 10 ETH</p>
          </div>
        </div>
      </div>
    </div>
  )
}