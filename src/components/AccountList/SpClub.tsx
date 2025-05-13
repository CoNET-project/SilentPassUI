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
import { ReactComponent as BlueBadge } from './assets/blue-badge.svg'
import bnb_token from './assets/bnb_token.png'
import bnb_usdt from './assets/bnb_usdt_token.png'
import SimpleLoadingRing from '../SimpleLoadingRing';
import QRCode from '../QRCode'
import { ReactComponent as QuotesIcon } from './assets/quotes-icon.svg'
const OneDayInSeconds = 86400;

type cryptoName = 'BNB' | 'BSC USDT'
export default function SpClub(isOpen: boolean, setIsOpen: React.Dispatch<React.SetStateAction<boolean>>) {
  const [isCongratsPopupOpen, setIsCongratsPopupOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [memberId, setMemberId] = useState<string>('0');
  const [referrer, setReferrer] = useState<string>('');
  const [passportTimeLeft, setPassportTimeLeft] = useState<number>(0);
  const { miningData, profiles, setIsPassportInfoPopupOpen, activePassportUpdated, activePassport } = useDaemonContext()
  const [showBuyClusBlue, setShowBuyClusBlue] = useState(true)
  const [showBuyClusloading, setShowBuyClusloading] = useState(false)
  const [QRWallet, setQRWallet] = useState('')
  const [updateCounter, setUpdateCounter] = useState(new Date('1970/12/1 12:0:1'))
  const [showPrice, setShowPrice] = useState('')
  const [cryptoName, setCryptoName] = useState<cryptoName>('BSC USDT')
  	const [error, setError] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')
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

  const purchaseBluePlan = (token: cryptoName) => {
	setShowBuyClusloading(true)
	setTimeout(() => {
		setShowBuyClusloading(false)
		setShowBuyClusBlue(false)
		setQRWallet('0x31e95B9B1a7DE73e4C911F10ca9de21c969929ff')
	}, 1000)
  }
  	const setTimeElm = () => {
		if (updateCounter.getHours() === 0) {
			setError(true)
			return setErrorMessage(`Timeout Error!`)
		}
		setUpdateCounter((prev) => new Date(prev.getTime() - 1000))
	}
	useEffect(() => {
		
		setTimeout (() => {
			setTimeElm()
		}, 1000)
	},[updateCounter])

  const renderCardContent = () => {
  	
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px"}}>
		{
			QRWallet &&
				<>
					<div className="summary-heading">
						<p>Send payment</p>
						<div className="quotes">
							
							<p>{updateCounter.getMinutes()+':'+updateCounter.getSeconds()}</p>
							<QuotesIcon />
						</div>
					</div>
					<div className="qr-container">
						<div className="left">
							
							{QRCode(QRWallet)}
							
						</div>
						<div className="right" style={{paddingLeft: '1rem'}}>
							<p>Only send {cryptoName} to this address</p>
						</div>
					</div>

					<div className="summary-heading" style={{fontSize: 'small'}}>
						<p>{QRWallet}</p>
					</div>
					<div className="summary-heading">
						<p>Total amount</p>
						<div className="quotes">
							<p>{showPrice} {cryptoName} </p>
						</div>
					</div>
				</>
		}
		{
			showBuyClusBlue && 
				<div id="">
					<div className="passport-options" style={{gap:"2px"}}>
						<p>
							🎫 1 Silent Pass Passport for 3 months-usage right;
						</p>
						<p>
							🎁 One-time issuance of 93 subscription points;
						</p>
						<p>
							💰 Immediately receive $25U worth of $SP tokens.
						</p>
						<div className="option-list" style={{marginTop: "1rem"}}>
							<button className='option selected'>
								<BlueBadge style={{width: "60px"}}/>
									<div style={{display: "flex", flexDirection: "column", marginLeft: "-20px", width: "20rem"}}>
										<span style={{textAlign: "left"}}>1 device</span>
										<span style={{textAlign: "left"}}>3 months VPN</span>
									</div>
								
								<div>
									<span>$USD</span>
									<p>31.00</p>
								</div>
							</button>
						</div>
					</div>
					{
						showBuyClusloading &&
						<>
							<div className="inner" style={{marginRight: "1rem"}}>
								<button className='redeem-button purchase'>
									<SimpleLoadingRing />
								</button>
							</div>
						</>
					}
					{
						!showBuyClusloading &&
						<div id="outer">
							<div className="inner" style={{marginRight: "1rem"}}>
								<button className='redeem-button purchase' onClick={() => purchaseBluePlan('BNB')}>
									<img src = {bnb_token} className="button_img"/>
								</button>
							</div>
							<div className="inner" style={{marginRight: "1rem"}}>
								<button className='redeem-button purchase' onClick={() => purchaseBluePlan('BSC USDT')}>
									<img src = {bnb_usdt} className="button_img"/>
								</button>
							</div>
						</div>
					}
				
				</div>
		}
		
		
		<div className="redeem-divider">
			<div className="line"></div>
		</div>
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