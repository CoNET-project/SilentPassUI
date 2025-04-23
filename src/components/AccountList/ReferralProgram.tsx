import { useEffect, useState } from 'react';
import './index.css';
import Separator from '../Separator';
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton';

import { ethers } from 'ethers';

import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";
import { getPassportTitle } from '../../utils/utils';
import { currentPageInvitees, setCurrentPageInvitees } from '../../utils/globals';
import { getRefereesPage } from '../../services/wallets';

const SP_EARNED_FROM_REFERRAL = 10

export default function ReferralProgram() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { profiles } = useDaemonContext();

  const [isAddressHidden, setIsAddressHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shouldRerender, setShouldRerender] = useState(true);


  const handlePreviousPage = async () => {
    if (currentPageInvitees > 0) {
      setCurrentPageInvitees(currentPageInvitees - 1)
      await getRefereesPage(profiles[0], currentPageInvitees)
      setShouldRerender(true)
    }
  }

  const handleNextPage = async () => {
    if (currentPageInvitees < Math.ceil(profiles?.[0]?.spClub?.totalReferees / 100)) {
      setCurrentPageInvitees(currentPageInvitees + 1)
      await getRefereesPage(profiles[0], currentPageInvitees)
      setShouldRerender(true)
    }
  }

  useEffect(() => {
    if (shouldRerender) {
      setShouldRerender(false)
    }
  }, [shouldRerender])

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
    <div className={`account-wrapper fit-content ${isOpen ? 'active' : ''}`}>
      <div className="account-main-card" onClick={() => setIsOpen((prev) => !prev)}>
        {/* <div className="disabled account-main-card"> */}
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
                <p>Copy this wallet address to invite your friends to Silent Pass</p>
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
              <p>Invitees</p>
            </div>
            <p>{profiles?.[0]?.spClub?.referees?.length}</p>
          </div>
          <div style={{ marginLeft: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p>$SP</p>
            </div>
            <p>0</p>
          </div>
        </div>

        <Separator />

        <div className="info-wrapper" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <p>Invitees</p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%', paddingLeft: '16px', maxHeight: '100px', overflowY: 'auto', paddingRight: '10px' }}>
            {profiles?.[0]?.spClub
              ?
              profiles?.[0].spClub?.totalReferees > 0 ?
                profiles?.[0]?.spClub.referees?.map((referee: any) =>
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', gap: '8px' }}>
                    <p style={{ width: 'auto', fontSize: '16px', color: '#FFFFFF', fontWeight: 400 }}>{getPassportTitle(referee?.activePassport)}</p>
                    <p style={{ width: 'auto', fontSize: '16px', color: '#989899', fontWeight: 400 }}>{referee?.walletAddress?.slice(0, 5) + '...' + referee?.walletAddress?.slice(-5)}</p>
                  </div>
                ) :
                <p>No invitees</p>
              : <Skeleton width={'100%'} height={'20px'} />}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ cursor: 'pointer' }} onClick={handlePreviousPage}>
              <img src="/assets/chevron-blue.svg" alt="Back" width={16} height={16} />
            </div>
            <div>{currentPageInvitees + 1} of {Math.ceil(profiles?.[0]?.spClub?.totalReferees / 100)}</div>
            <div style={{ cursor: 'pointer' }} onClick={handleNextPage}>
              <img src="/assets/chevron-blue.svg" alt="Back" width={16} height={16} style={{ transform: 'rotate(180deg)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}