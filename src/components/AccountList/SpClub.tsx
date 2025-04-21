import { useEffect, useState } from 'react';

import "./index.css";
import SpClubCongratsPopup from '../SpClubCongratsPopup';
import { joinSpClub } from '../../api';
import { useDaemonContext } from '../../providers/DaemonProvider';
import { getSpClubMemberId } from '../../services/wallets';

import AirdropRewards from './assets/airdrop-rewards.png';
import EarlyAccess from './assets/early-access.png';
import EducationHub from './assets/education-hub.png';
import ExclusivePerks from './assets/exclusive-perks.png';
import LoyaltyDiscounts from './assets/loyalty-discounts.png';
import ReferralProgram from './assets/referral-program.png';

const OneDayInSeconds = 86400;

export default function SpClub() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isCongratsPopupOpen, setIsCongratsPopupOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [memberId, setMemberId] = useState<string>('0');
  const [referrer, setReferrer] = useState<string>('');
  const [passportTimeLeft, setPassportTimeLeft] = useState<number>(0);

  const { miningData, profiles, setIsPassportInfoPopupOpen, activePassportUpdated, activePassport } = useDaemonContext();

  useEffect(() => {
    const passportExpiration = profiles?.[0]?.activePassport?.expires
    if (passportExpiration) {
      const timeLeft = passportExpiration - Math.floor(Date.now() / 1000)
      setPassportTimeLeft(timeLeft)
    }
  }, [activePassportUpdated, profiles])

  const fetchMemberIdWithRetry = async (startTime = Date.now()): Promise<string | null> => {
    const _memberId = await getSpClubMemberId(profiles[0]);

    if (_memberId.toString() !== '0') {
      return _memberId.toString();
    }

    if (Date.now() - startTime >= 60000) { // Stop after 1 minute
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
    return fetchMemberIdWithRetry(startTime); // Recursive call with startTime
  };

  const handleJoinClub = async () => {
    setIsLoading(true)

    try {
      const result = await joinSpClub(profiles[0], profiles[1], referrer);

      if (result !== false) {
        const _memberId = await fetchMemberIdWithRetry()

        if (_memberId === null) throw new Error("Couldn't fetch memberId")

        setMemberId(_memberId);
        setIsCongratsPopupOpen(true)
      }
    } catch (error) {
      console.log(error);
    }

    setTimeout(() => setIsLoading(false), 2000)
  }

  const renderCardContent = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px"}}>
        <h2>Join the SP Club <br />Unlock Premium Benefits </h2>
        <p style={{ textAlign: "left" }}>Upgrade to a Silent Pass subscription and gain access to the SP Club, an exclusive membership designed for those who value privacy, rewards, and Web3 innovation. As a member, you’ll unlock premium features, loyalty incentives, and community-driven opportunities.</p>
        <div className="sp-club-grid">
          <div>
            <img src={AirdropRewards} />
            <p>Airdrops & Rewards</p>
          </div>
          <div>
            <img src={LoyaltyDiscounts} />
            <p>Loyalty Discounts</p>
          </div>
          <div>
            <img src={ReferralProgram} />
            <p>Referral Program</p>
          </div>
          <div>
            <img src={EducationHub} />
            <p>Education Hub</p>
          </div>
          <div>
            <img src={EarlyAccess} />
            <p>Early Access</p>
          </div>
          <div>
            <img src={ExclusivePerks} />
            <p>Exclusive Perks</p>
          </div>
        </div>
        <p style={{ fontSize: "12px", textAlign: "left" }}>Find out more at <a style={{ color: "#9FBFE5FE" }} href="https://subscription.silentpass.io" target='_blank'>https://subscription.silentpass.io</a></p>
      </div>
    )
  }

  return (
    <>
      <div className={`account-wrapper referral-program fit-content ${isOpen ? 'active' : ''}`}>
        <div className="account-main-card" onClick={() => setIsOpen((prev) => !prev)}>
          {/* <div className="disabled account-main-card"> */}
          <div className="name">
            <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center' }}>
              <h3>Join SP Club</h3>
            </div>
            <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
          </div>
        </div>
        <div className="info-card">

          {renderCardContent()}
        </div>
      </div>

      {
        isCongratsPopupOpen && (
          <SpClubCongratsPopup setIsCongratsPopupOpen={setIsCongratsPopupOpen} memberId={memberId} />
        )
      }
    </>
  )
}