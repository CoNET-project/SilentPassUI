import { useState } from 'react';
import './index.css';
import Separator from '../Separator';
import CopyAccountInfo from './CopyAccountInfo';
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton';

import { ReactComponent as ConetToken } from './assets/conet-token.svg'
import { ReactComponent as EthToken } from './assets/eth-token.svg'
import { ReactComponent as ConetEthToken } from './assets/conet-eth-token.svg'
import { ReactComponent as SolanaToken } from './assets/solana-token.svg'
import { ReactComponent as SpToken } from './assets/sp-token.svg'
import { getRemainingTime } from '../../utils/utils';

export default function AccountList() {
  const [openAccountList, setOpenAccountList] = useState<string[]>([]);
  const { profiles } = useDaemonContext();

  function toggleAccount(accountAddress: string) {
    setOpenAccountList((prev) => (
      prev.includes(accountAddress) ? prev.filter((item) => item !== accountAddress) : [...prev, accountAddress]
    ))
  }

  return (
    <div className="account-list">
      <div className={`account-wrapper ${openAccountList.includes(profiles?.[0]?.keyID) ? 'active' : ''}`}>
        <div className="account-main-card" onClick={() => toggleAccount(profiles?.[0]?.keyID)}>
          <div>
            <h3>Main Wallet</h3>
            <img className="chevron" src="./assets/right-chevron.svg" />
          </div>
        </div>
        <div className="info-card">
          <div className="info-wrapper">
            <p>Tokens</p>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ConetToken />
                <p>$CONET</p>
              </div>
              <p>{profiles?.[0]?.tokens?.conetDepin?.balance || (0.0).toFixed(6)}</p>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ConetEthToken />
                <p>$ETH</p>
              </div>
              <p>{profiles?.[0]?.tokens?.conet_eth?.balance || (0.0).toFixed(6)}</p>
            </div>
          </div>
          <Separator />
          <div className="info-wrapper">
            <p>Silent Pass Passport</p>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <p>Freemium</p>
              {
                profiles?.[0]?.activePassport?.expires ?
                  <p>{getRemainingTime(profiles?.[0]?.activePassport?.expires)}</p>
                  : <Skeleton width='50px' height='20px' />
              }
            </div>
          </div>
          <Separator />
          <CopyAccountInfo wallet={profiles?.[0]} />
        </div>
      </div>

      <div className="cta-buttons" style={{ marginBottom: "0px" }}>
        <div className="highlight-1">
          <button className='disabled'>
            <p>Transfer Silent Pass Passport</p>
          </button>
        </div>
      </div>

      <div className={`account-wrapper solana ${openAccountList.includes("123") ? 'active' : ''}`}>
        <div className="account-main-card" onClick={() => toggleAccount("123")}>
          <div>
            <h3>Solana Wallet</h3>
            <img className="chevron" src="./assets/right-chevron.svg" />
          </div>
        </div>

        <div className="info-card">
          <div className="info-wrapper">
            <p>Tokens</p>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <SpToken />
                <p>$SP</p>
              </div>
              <p>{profiles?.[1]?.tokens?.SP?.balance || (0.0).toFixed(6)}</p>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <SolanaToken />
                <p>$SOL</p>
              </div>
              <p>{profiles?.[1]?.tokens?.solana?.balance || (0.0).toFixed(6)}</p>
            </div>
          </div>
          <Separator />
          <CopyAccountInfo wallet={profiles?.[1]} />
        </div>
      </div>
    </div>
  )
}