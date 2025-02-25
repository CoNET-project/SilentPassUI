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
import PassportInfo from '../PassportInfo';
import SelectActivePassportPopup from '../SelectActivePassportPopup';

interface AccountListProps {
  simplifiedView?: boolean;
}

export default function AccountList({ simplifiedView = false }: AccountListProps) {
  const [openAccountList, setOpenAccountList] = useState<string[]>([]);
  const { profiles, activePassport } = useDaemonContext();
  const [isSelectPassportPopupOpen, setIsSelectPassportPopupOpen] = useState(false);

  const [mainAccountAddressCopied, setMainAccountAddressCopied] = useState(false);
  const [solanaAccountAddressCopied, setSolanaAccountAddressCopied] = useState(false);

  function toggleAccount(accountAddress: string) {
    setOpenAccountList((prev) => (
      prev.includes(accountAddress) ? prev.filter((item) => item !== accountAddress) : [...prev, accountAddress]
    ))
  }

  function handleCopy(e: any, account: 'main' | 'solana') {
    e.preventDefault();

    if (account === 'main') {
      navigator.clipboard.writeText(profiles?.[0].keyID);
      setMainAccountAddressCopied(true);
    }

    if (account === 'solana') {
      navigator.clipboard.writeText(profiles?.[1].keyID);
      setSolanaAccountAddressCopied(true);
    }

    setTimeout(() => {
      setMainAccountAddressCopied(false);
      setSolanaAccountAddressCopied(false);
    }, 2000)
  }

  console.log("PROFILES: ", profiles);

  return (
    <div className="account-list">
      <div className={`account-wrapper ${simplifiedView ? 'simplified' : ''} ${openAccountList.includes(profiles?.[0]?.keyID) ? 'active' : ''}`}>
        <div className="account-main-card" onClick={() => toggleAccount(profiles?.[0]?.keyID)}>
          <div className="name">
            <h3>Main Wallet</h3>
            <img className="chevron" src="./assets/right-chevron.svg" />
          </div>
          {
            simplifiedView && (
              <div className="copy">
                {
                  profiles?.[0].keyID ? (
                    <p>{profiles[0].keyID}</p>
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
            <p>Token assets</p>
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
          {
            !simplifiedView && (
              <>
                <Separator />
                <div className="info-wrapper">
                  <p>Silent Pass Passport</p>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
                    {profiles?.[0]?.silentPassPassports
                      ? [...profiles?.[0]?.silentPassPassports]
                        .sort((a: any, b: any) => {
                          const isAActive = a?.nftID === activePassport?.nftID;
                          const isBActive = b?.nftID === activePassport?.nftID;
                          return isAActive === isBActive ? 0 : isAActive ? -1 : 1;
                        })
                        .map((passport: any) => (
                          <PassportInfo key={passport.nftID} passportInfo={passport} selectedValue={activePassport} onChange={() => setIsSelectPassportPopupOpen(true)} />
                        ))
                      : <Skeleton width={'100%'} height={'20px'} />}
                  </div>
                </div>
                <Separator />
                <CopyAccountInfo wallet={profiles?.[0]} />
              </>
            )
          }
        </div>
      </div>

      {
        !simplifiedView && (
          <div className="cta-buttons" style={{ marginBottom: "0px" }}>
            <div className="highlight-1">
              <button className='disabled'>
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
            <img className="chevron" src="./assets/right-chevron.svg" />
          </div>
          {
            simplifiedView && (
              <div className="copy">
                {
                  profiles?.[1].keyID ? (
                    <p>{profiles[1].keyID}</p>
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
            <p>Token assets</p>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <SpToken />
                {
                  simplifiedView ? (
                    <div>
                      <p>Silent Pass</p>
                      <p>18.61M $SP</p>
                    </div>
                  ) : (
                    <p>$SP</p>
                  )
                }
              </div>
              {
                simplifiedView ? (
                  <p>$543.51</p>
                ) : (
                  <p>{profiles?.[1]?.tokens?.conetDepin?.balance || (0.0).toFixed(6)}</p>
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
                      <p>0.902 SOL</p>
                    </div>
                  ) : (
                    <p>$SP</p>
                  )
                }
              </div>
              {
                simplifiedView ? (
                  <p>$138.39</p>
                ) : (
                  <p>{profiles?.[1]?.tokens?.conetDepin?.balance || (0.0).toFixed(6)}</p>
                )
              }
            </div>
          </div>
          {
            !simplifiedView && (
              <>
                <Separator />
                <CopyAccountInfo wallet={profiles?.[1]} />
              </>
            )
          }
        </div>
      </div>

      <SelectActivePassportPopup />
    </div>
  )
}