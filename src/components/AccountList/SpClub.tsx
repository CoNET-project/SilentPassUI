import { useState } from 'react'

import "./index.css";
import SpClubCongratsPopup from '../SpClubCongratsPopup';
import SimpleLoadingRing from '../SimpleLoadingRing';
import { joinSpClub } from '../../api';
import { useDaemonContext } from '../../providers/DaemonProvider';

export default function SpClub() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [isCongratsPopupOpen, setIsCongratsPopupOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { profiles } = useDaemonContext();

  const handleJoinClub = async () => {
    setIsLoading(true)

    try {
      const result = await joinSpClub(profiles[0], profiles[1]);

      if (result !== false)
        setIsCongratsPopupOpen(true)
    } catch (error) {
      console.log(error);
    }

    setTimeout(() => setIsLoading(false), 2000)
  }

  return (
    <>
      <div className={`account-wrapper referral-program ${isOpen ? 'active' : ''}`}>
        <div className="account-main-card" onClick={() => setIsOpen((prev) => !prev)}>
          {/* <div className="disabled account-main-card"> */}
          <div className="name">
            <h3>Join SP Club</h3>
            <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
          </div>
        </div>
        <div className="info-card">
          <div className="info-wrapper">
            <div>
              <p>Input you inviter wallet address</p>
              <input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="wallet address" />
            </div>

            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '24px', flexDirection: 'row', alignItems: 'center' }}>
              <div style={{ width: '100%', height: '1px', background: '#FFFFFF' }} />

              <div>
                <p style={{ fontSize: '20px' }}>or</p>
              </div>

              <div style={{ width: '100%', height: '1px', background: '#FFFFFF' }} />

            </div>

            <div style={{ width: '100%' }}>
              <p style={{ width: '100%', textAlign: 'center', fontSize: '16px' }}>Get Silent Pass Passport and join the club</p>
            </div>

            <button onClick={handleJoinClub}>
              {isLoading ? <SimpleLoadingRing /> :
                <p>Join Club</p>
              }
            </button>
          </div>
        </div>
      </div>

      {
        isCongratsPopupOpen && (
          <SpClubCongratsPopup setIsCongratsPopupOpen={setIsCongratsPopupOpen} />
        )
      }
    </>
  )
}