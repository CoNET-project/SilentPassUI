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
import { refreshSolanaBalances, storeSystemData } from '../../services/wallets';
import { CoNET_Data } from '../../utils/globals';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';

import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";

export default function ReferralProgram() {
  const [openAccountList, setOpenAccountList] = useState<string[]>([]);
  const { profiles, activePassport, setProfiles, randomSolanaRPC, getAllNodes } = useDaemonContext();

  const [mainAccountAddressCopied, setMainAccountAddressCopied] = useState(false);
  const [solanaAccountAddressCopied, setSolanaAccountAddressCopied] = useState(false);
  const [passportToChange, setPassportToChange] = useState();
  const [isRefreshingSolanaBalances, setIsRefreshingSolanaBalances] = useState(false);
  const [isAddressHidden, setIsAddressHidden] = useState(true);
  const [copied, setCopied] = useState(false);

  const { isSelectPassportPopupOpen, setIsSelectPassportPopupOpen } = useDaemonContext();

  function toggleAccount(accountAddress: string) {
    setOpenAccountList((prev) => (
      prev.includes(accountAddress) ? prev.filter((item) => item !== accountAddress) : [...prev, accountAddress]
    ))
  }

  function handleCopy() {
    navigator.clipboard.writeText(profiles?.[0]?.keyID);
    setCopied(true)

    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const getAddress = (wallet: any) => {
    return ethers.getAddress(wallet?.keyID).slice(0, 7) + '...' + ethers.getAddress(wallet?.keyID).slice(-5);
  }

  return (
    <div className={`account-wrapper ${openAccountList.includes(profiles?.[0]?.keyID) ? 'active' : ''}`}>
      <div className="account-main-card" onClick={() => toggleAccount(profiles?.[0]?.keyID)}>
        <div className="name">
          <h3>Referral Program</h3>
          <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
        </div>
      </div>

      <div className="info-card">
        <div className="copy-div">
          {profiles?.[0]?.keyID ?
            <>
              <div className="copy-text">
                <p>Wallet Address</p>
                {
                  isAddressHidden ?
                    <div style={{ filter: 'blur(3px)' }}>
                      <span>{getAddress(profiles[0])}
                      </span>
                    </div>
                    :
                    <span>{getAddress(profiles[0])}
                    </span>
                }
              </div>
              <div className="button-list">
                <button onClick={() => handleCopy()}>
                  {
                    copied ? (
                      <img src="/assets/check.svg" alt="Copy icon" />
                    ) : (
                      <img src="/assets/copy-purple.svg" alt="Copy icon" />
                    )
                  }
                </button>
                <button className={isAddressHidden ? "hidden" : ""} onClick={() => setIsAddressHidden((prev) => !prev)}>
                  {
                    isAddressHidden ? <VisibilityOffIcon /> : <VisibilityOnIcon />
                  }
                </button>
              </div>
            </>
            : <Skeleton width='100%' height='20px' />
          }
        </div>

        <Separator />

        <div className="info-wrapper">
          <div className='token-assets-title'>
            <p className='title'>Rewards</p>
          </div>
          <div style={{ marginLeft: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p>Referees</p>
            </div>
            <p>{100}</p>
          </div>
          <div style={{ marginLeft: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p>$SP</p>
            </div>
            <p>{100.0006453}</p>
          </div>
        </div>

        <Separator />

        <div className="info-wrapper" style={{ maxHeight: '200px', overflowY: 'auto', }}>
          <p>History</p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%', paddingLeft: '16px' }}>
            {(profiles?.[0]?.silentPassPassports && profiles?.[0]?.activePassport)
              ?
              (
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', gap: '8px' }}>
                  <p style={{ width: 'auto', fontSize: '16px', color: '#989899', fontWeight: 400 }}>{'0x628r9823u98u98sud9f8u'.slice(0, 5) + '...' + '0x628r9823u98u98sud9f8u'.slice(-5)}</p>
                  <p style={{ width: 'auto', fontSize: '16px', color: '#9FBFE5FE', fontWeight: 400 }}>+ 10 $SP</p>
                </div>
              )
              : <Skeleton width={'100%'} height={'20px'} />}
          </div>
        </div>
      </div>
    </div>
  )
}