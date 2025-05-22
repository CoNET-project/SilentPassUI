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
import {getCryptoPay, waitingPaymentReady} from '../../services/subscription'
import {ReactComponent as QuotesTx} from './assets/trx.svg'
import { CoNET_Data } from '../../utils/globals';


const OneDayInSeconds = 86400;

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX'
export default function SpClub(isOpen: boolean, setIsOpen: React.Dispatch<React.SetStateAction<boolean>>) {
  const [isCongratsPopupOpen, setIsCongratsPopupOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [memberId, setMemberId] = useState<string>('0');
  const [referrer, setReferrer] = useState<string>('');
  const [passportTimeLeft, setPassportTimeLeft] = useState<number>(0);
  const { miningData, profiles, setIsPassportInfoPopupOpen, activePassportUpdated, activePassport, setSuccessNFTID, airdropProcess, airdropTokens } = useDaemonContext()
  const [showBuyClusBlue, setShowBuyClusBlue] = useState(true)
  const [showBuyClusloading, setShowBuyClusloading] = useState(false)
  const [QRWallet, setQRWallet] = useState('')
  const [updateCounter, setUpdateCounter] = useState(new Date('1970/12/1 12:0:1'))
  const [showPrice, setShowPrice] = useState('')
  const [cryptoName, setCryptoName] = useState<cryptoName>('BSC USDT')
  const [copied, setCopied] = useState(false)
  const [serverAddress, setServerAddress] = useState('')

  	const [showError, setShowError] = useState(false)
	const [errorMessage, setErrorMessage] = useState('The service is unavailable, please try again later.')
  useEffect(() => {
    const passportExpiration = profiles?.[0]?.activePassport?.expires
    if (passportExpiration) {
      const timeLeft = passportExpiration - Math.floor(Date.now() / 1000)
      setPassportTimeLeft(timeLeft)
    }
  }, [activePassportUpdated, profiles])

  useEffect(() => {
	if (airdropProcess) {
		setIsOpen (false)
	}
  }, [])


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
  }

  	const getShotAddress = (address: string) => {
		return address.substring(0, 8) + '...' + address.substring(address.length-6)
	}

	const handleCopy = (value: string) => {
		navigator.clipboard.writeText(value);
    	setCopied(true)
		setTimeout(() => {
			setCopied(false)
		}, 3000)
	}

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

  const showErrorMessage = (errorMessage: string) => {
	if (errorMessage) {
		setErrorMessage(errorMessage)
	}
	setQRWallet('')
	setServerAddress('')
	setShowPrice('')
	setTimeout(() => {
		setShowBuyClusBlue(true)
		return setShowError(false)
	}, 5000)
	return setShowError(true)
  }

  

  const purchaseBluePlan = async (token: cryptoName) => {
	const profile: profile = profiles[0]
	const agentWallet = profile.referrer||''
	setShowBuyClusloading(true)
	setShowBuyClusBlue(false)
	setCryptoName(token)
	const kkk = await getCryptoPay(token, '3')

	setShowBuyClusloading(false)
	if (!kkk?.wallet||!kkk?.transferNumber) {
		return showErrorMessage('')
	}
	
	setServerAddress(kkk.wallet)
	setShowPrice(kkk?.transferNumber)
	setQRWallet(kkk.wallet)
	const waiting = await waitingPaymentReady (kkk?.wallet)
	if (!waiting?.status) {
		showErrorMessage(waiting?.error)
		return
	}

	setSuccessNFTID(waiting.status)
	setQRWallet('')
	setServerAddress('')
	setShowPrice('')
	//		test error 
	// setTimeout(() => {
	// 	setShowBuyClusloading(false)
	// 	return showErrorMessage('')
	// }, 1000)

	//		test error 
	// setTimeout(() => {
	// 	setShowBuyClusloading(false)
	// 	return showErrorMessage('')
	// }, 1000)


	//		test qrcode
	// setTimeout(() => {
	// 	setShowBuyClusloading(false)
	// 	setShowBuyClusBlue(false)
	// 	setQRWallet('0x31e95B9B1a7DE73e4C911F10ca9de21c969929ff')

	// 	setTimeout(() => {
	// 		setSuccessNFTID(5000)
	// 		setQRWallet('')
	// 	}, 5000)
	// }, 1000)

  }
  	const setTimeElm = () => {
		if (updateCounter.getHours() === 0) {
			setShowError(true)
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
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px"}}>
		<div className="passport-options" style={{gap:"2px"}}>
			<p>
				🎫 1 Silent Pass Passport for 3 months-usage right;
			</p>
			<p>
				🎁 One-time issuance of 93 subscription points;
			</p>
			<p>
				💰 Immediately receive 25USD worth of $SP tokens.
			</p>
			<div className="redeem-divider">
				<div className="line"></div>
			</div>
		</div>
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
							{
								QRCode(QRWallet)
							}
						</div>
						<div className="right" style={{paddingLeft: '1rem'}}>
							<p>Only send {cryptoName} to this address</p>
						</div>
					</div>

					<div className="qr-container" style={{fontSize: 'small'}}>
						<div className="left">
							<p>{getShotAddress(QRWallet)}</p>
						</div>
					<div className="right" style={{paddingLeft: '1rem'}}>
					<button onClick={() => handleCopy(QRWallet)}>
						{
							copied ? <img src="/assets/check.svg" alt="Copy icon" /> : <img src="/assets/copy-purple.svg" style={{cursor: 'pointer'}} alt="Copy icon" />
						}
					</button>
						
					</div>
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
			showBuyClusBlue && !showError &&
				<div className="passport-options" style={{gap:"2px"}}>
					{
						showBuyClusloading &&
					
							<div className="inner" style={{marginRight: "1rem"}}>
								<button className='redeem-button purchase'>
									<SimpleLoadingRing />
								</button>
							</div>
						
					}
					{
						!showBuyClusloading &&
						<>
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
								<div className="inner" style={{marginRight: "1rem"}}>
									<button className='redeem-button purchase' onClick={() => purchaseBluePlan('TRON TRX')}>
										<QuotesTx style={{width: '26px', height: '26px'}}/>
									</button>
								</div>
							</div>
						</>
						
					}
				
				</div>
		}
		{
			showError && 
			<>
				<p style={{color: 'red'}}>{errorMessage}</p>
			</>
		}
		
		{
			!QRWallet &&
			<>
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
			</>
		}
		
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