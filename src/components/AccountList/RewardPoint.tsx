import { useEffect, useState } from 'react';

import "./index.css";
import SpClubCongratsPopup from '../SpClubCongratsPopup';
import { joinSpClub } from '../../api';
import { useDaemonContext } from '../../providers/DaemonProvider';
import { getSpClubMemberId } from '../../services/wallets';
import SPClubRewardUser from '../SPClubRewardUser'

export default function RewardPoint() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isCongratsPopupOpen, setIsCongratsPopupOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [memberId, setMemberId] = useState<string>('0');
  const [animation, setAnimation] = useState(false);
  const [passportTimeLeft, setPassportTimeLeft] = useState<number>(0);
  const [quotation, setQuotation] = useState({
    "ufp": 1/31,
    "usp": 1/31,
	"ucp": 0,
  })
  const { miningData, profiles, setIsPassportInfoPopupOpen, activePassportUpdated, activePassport } = useDaemonContext();
  let first = true

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

  const setTokenGraph = () => {

  }
  return (
    <>
      <div className={`account-wrapper referral-program fit-content ${isOpen ? 'active' : ''}`} style={{paddingBottom: '20px'}}>
        <div className="account-main-card" onClick={() => {
			if (!isOpen) {
				setAnimation(true)
				setTimeout(() => {
					setAnimation(false)
				}, 2000)
			}
			setIsOpen((prev) => !prev)
		}}>
          {/* <div className="disabled account-main-card"> */}
          <div className="name">
            <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center' }}>
              <h3>User Reward Point</h3>
            </div>
            <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
          </div>
        </div>
		<div className="info-card" style={{padding: '1.5rem 1rem'}} >
			<SPClubRewardUser quotation={quotation} setTokenGraph={setTokenGraph} animation={animation}/>
		</div>
		
        
      </div>
    </>
  )
}