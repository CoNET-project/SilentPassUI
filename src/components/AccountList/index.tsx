import { useState } from 'react';
import './index.css';
import Separator from '../Separator';
import CopyAccountInfo from './CopyAccountInfo';
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton';

import { ReactComponent as ConetToken } from './assets/conet-token.svg';
import { ReactComponent as ConetEthToken } from './assets/conet-eth-token.svg';
import { ReactComponent as SolanaToken } from './assets/solana-token.svg';
import { ReactComponent as SpToken } from './assets/sp-token.svg';
import { CoNET_Data } from '../../utils/globals';
import { useNavigate } from 'react-router-dom';

interface AccountListProps {
  showMainWallet?: boolean;
  simplifiedView?: boolean;
  spInUsd?: number;
  solInUsd?: number;
}

export default function AccountList({ showMainWallet = true, simplifiedView = false, spInUsd = 0, solInUsd = 0 }: AccountListProps) {
  const [openAccountList, setOpenAccountList] = useState<string[]>([]);
  const { profiles, setProfiles, randomSolanaRPC, getAllNodes } = useDaemonContext();

  const [mainAccountAddressCopied, setMainAccountAddressCopied] = useState(false);
  const [solanaAccountAddressCopied, setSolanaAccountAddressCopied] = useState(false);
  const [passportToChange, setPassportToChange] = useState();
  const [isRefreshingSolanaBalances, setIsRefreshingSolanaBalances] = useState(false);

  const navigate = useNavigate();

  function toggleAccount(accountAddress: string) {
    setOpenAccountList((prev) => (
      prev.includes(accountAddress) ? prev.filter((item) => item !== accountAddress) : [...prev, accountAddress]
    ))
  }

  function handleCopy(e: any, account: 'main' | 'solana') {
    e.preventDefault();

    if (account === 'main') {
      navigator.clipboard.writeText(profiles?.[0]?.keyID);
      setMainAccountAddressCopied(true);
    }

    if (account === 'solana') {
      navigator.clipboard.writeText(profiles?.[1]?.keyID);
      setSolanaAccountAddressCopied(true);
    }

    setTimeout(() => {
      setMainAccountAddressCopied(false);
      setSolanaAccountAddressCopied(false);
    }, 2000)
  }

  const renderRefreshButton = () => {
    if (!profiles?.[1]?.keyID) {
      return <p className='refresh disabled'>Refresh</p>
    }

    if (isRefreshingSolanaBalances) {
      return <p className='refresh'>Refreshing...</p>
    }

    return <p className='refresh'>Refresh</p>
  }

  return (
    <div className="account-list">
      {showMainWallet &&
        <div className={`account-wrapper ${simplifiedView ? 'simplified' : ''} ${openAccountList.includes(profiles?.[0]?.keyID) ? 'active' : ''}`}>
          <div className="account-main-card" onClick={() => toggleAccount(profiles?.[0]?.keyID)}>
            <div className="name">
              <h3>Main Wallet</h3>
              <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
            </div>
            {
              simplifiedView && (
                <div className="copy">
                  {
                    profiles?.[0].keyID ? (
                      <p>{profiles?.[0]?.keyID?.slice(0, 5)}...{profiles?.[0]?.keyID?.slice(-5)}</p>
                    ) : (
                      <Skeleton width="100%" height="20px" />
                    )
                  }
                  <button onClick={(e) => handleCopy(e, 'main')}>
                    {
                      mainAccountAddressCopied ? (
                        <img src="/assets/check.svg" alt="Copy icon" />
                      ) : (
                        <img src="/assets/copy-purple.svg" alt="Copy icon" />
                      )
                    }
                  </button>
                </div>
              )
            }
          </div>
          <div className="info-card">
            <div className="info-wrapper">
              <div className='token-assets-title'>
                <p className='title'>Token assets</p>
              </div>
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
            <CopyAccountInfo wallet={profiles?.[0]} isEthers={false} />
          </div>
        </div>
      }

      {
        !simplifiedView && (
          <div className="cta-buttons" style={{ marginBottom: "0px" }}>
            <div className="highlight-1">
              <button onClick={() => navigate('/transfer')}>
                <p>Transfer Silent Pass Passport</p>
              </button>
            </div>
          </div>
        )
      }

      <div className={`account-wrapper solana ${simplifiedView ? 'simplified' : ''} ${openAccountList.includes("123") ? 'active' : ''}`}>
        <div className="account-main-card" onClick={() => toggleAccount("123")}>
          <div className="name">
            <h3>Solana Wallet</h3>
            <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
          </div>
          {
            simplifiedView && (
              <div className="copy">
                {
                  profiles?.[1].keyID ? (
                    <p>{profiles?.[1]?.keyID?.slice(0, 5)}...{profiles?.[1]?.keyID?.slice(-5)}</p>
                  ) : (
                    <Skeleton width="100%" height="20px" />
                  )
                }
                <button onClick={(e) => handleCopy(e, 'solana')}>
                  {
                    solanaAccountAddressCopied ? (
                      <img src="/assets/check.svg" alt="Copy icon" />
                    ) : (
                      <img src="/assets/copy-purple.svg" alt="Copy icon" />
                    )
                  }
                </button>
              </div>
            )
          }
        </div>

        <div className="info-card">
          <div className="info-wrapper">
            <div className='token-assets-title'>
              <p className='title'>Token assets</p>
              {renderRefreshButton()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <SpToken />
                {
                  simplifiedView ? (
                    <div>
                      <p>Silent Pass</p>
                      <p>{profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(6)}</p>
                    </div>
                  ) : (
                    <p>$SP</p>
                  )
                }
              </div>
              {
                simplifiedView ? (
                  <p>${(spInUsd * parseFloat(profiles?.[1]?.tokens?.sp?.balance || '0')).toFixed(2)}</p>
                ) : (
                  <p>{profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(6)}</p>
                )
              }
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <SolanaToken />
                {
                  simplifiedView ? (
                    <div>
                      <p>Solana</p>
                      <p>{profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6)}</p>
                    </div>
                  ) : (
                    <p>$SOL</p>
                  )
                }
              </div>
              {
                simplifiedView ? (
                  <p>${(solInUsd * parseFloat(profiles?.[1]?.tokens?.sol?.balance || '0')).toFixed(2)}</p>
                ) : (
                  <p>{profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6)}</p>
                )
              }
            </div>
          </div>
          {
            !simplifiedView && (
              <>
                <Separator />
                <CopyAccountInfo wallet={profiles?.[1]} isEthers={false} />
              </>
            )
          }
        </div>
      </div>
    </div>
  )
}