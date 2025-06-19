import { useEffect, useState } from 'react';

import "./index.css";
import SpClubCongratsPopup from '../SpClubCongratsPopup';
import { joinSpClub } from '../../api';
import { useDaemonContext } from '../../providers/DaemonProvider';
import { getSpClubMemberId, waitingPaymentReady, changeActiveNFT } from '../../services/wallets';

import AirdropRewards from './assets/airdrop-rewards.png';
import EarlyAccess from './assets/early-access.png';
import EducationHub from './assets/education-hub.png';
import ExclusivePerks from './assets/exclusive-perks.png';
import LoyaltyDiscounts from './assets/loyalty-discounts.png';
import ReferralProgram from './assets/referral-program.png';
import { ReactComponent as CrownBadge } from './assets/GC.svg'
import bnb_token from './assets/bnb_token.png'
import bnb_usdt from './assets/bnb_usdt_token.png'
import SimpleLoadingRing from '../SimpleLoadingRing';
import QRCode from '../QRCode'
import { ReactComponent as QuotesIcon } from './assets/quotes-icon.svg'
import {getCryptoPay} from '../../services/subscription'
import {ReactComponent as QuotesTx} from './assets/trx.svg'
import { CoNET_Data } from '../../utils/globals'
import { useTranslation } from 'react-i18next'
import wachat from './assets/wechat.png'

import { ReactComponent as AliPay } from './assets/alipay.svg'

const OneDayInSeconds = 86400;
const alipayUrl = 'https://cashier.alphapay.ca/commodity/details/order/5728/100001644'

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
	const { t, i18n } = useTranslation()
	const [showpayment, setShowPayment] = useState(false)
	const [showPurchase, setShowPurchase] = useState(false)

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

	const alipayClick = () => {
		setShowPurchase(true)
		if (window?.webkit) {
			return window?.webkit?.messageHandlers["openUrl"].postMessage(alipayUrl)
		}
		//@ts-ignore
		if (window.AndroidBridge && AndroidBridge.receiveMessageFromJS) {
			const base = btoa(JSON.stringify({cmd: 'openUrl', data: alipayUrl}))
			//	@ts-ignore
			return AndroidBridge.receiveMessageFromJS(base)
		}
		window.open(alipayUrl, '_blank')
	}

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
	const kkk = await getCryptoPay(token, '3100')

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
	changeActiveNFT(waiting.status)

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
		<div className="passport-options" style={{gap:"2px", alignSelf: "center"}}>
			<div style={{display: 'flex', alignItems:'center'}}>
				<CrownBadge style={{width: "1.5rem", marginRight:'1rem'}}/>
				<span style={{fontSize: 'x-large', color: 'gold', fontWeight: 'bold'}}>{t('comp-accountlist-SpClub-detail-1')}</span>
			</div>
		
			<p>
				{t('comp-accountlist-SpClub-detail-2')}
			</p>
			<p>
				{t('comp-accountlist-SpClub-detail-2-1')}
			</p>
			{
				!showPurchase &&
				<>
					<div style={{display: 'flex', alignItems:'center', justifyContent: 'center'}}>
						<span>{t('comp-comm-price')}</span>
						<span style={{color: 'gold', fontWeight: 'bold', paddingLeft: '3rem', fontSize: 'xx-large', paddingRight: '0.2rem'}}>$</span>
						<span style={{fontSize: 'xxx-large', color: 'gold', fontWeight: 'bold'}}>31</span>
					</div>
					
					<p style={{color: '#989899'}}>
						{t('comp-accountlist-SpClub-detail-3')}
					</p>
					<p style={{color: '#989899'}}>
						{t('comp-accountlist-SpClub-detail-4')}
					</p>
					<p style={{color: '#989899'}}>
						{t('comp-accountlist-SpClub-detail-5')}
					</p>
					{/* <p style={{color: '#989899'}}>
						{t('comp-accountlist-SpClub-detail-6')}
					</p>
					<p style={{color: '#989899'}}>
						{t('comp-accountlist-SpClub-detail-7')}
					</p> */}
				</>
			}
			
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
						!showPurchase &&
						<>
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
										<div>
											{
												!showpayment &&
												<div className="inner" style={{width: '100%'}}>
													<button style={{width: '100%'}} className='redeem-button purchase' onClick={() => setShowPayment(true)} >
														{t('comp-comm-buyNow')}
													</button>
												</div>
											}
											{
												showpayment &&
												<>
													<p style={{padding: "0 0 1rem 0", fontWeight: 'bolder'}}>{t('comp-comm-payment')}</p>
													<div className="inner" style={{width: '100%', display: 'flex', alignItems:'center'}}>
													
														<div style={{cursor: 'pointer', padding: '0 0.5rem', textAlign: 'center'}} onClick={() => purchaseBluePlan('BNB')}>
															<img  src={bnb_token} className="button_img"/>
															<p style={{color: '#989899'}}>BNB</p>
														</div>
														<div style={{cursor: 'pointer', padding: '0 0.5rem', textAlign: 'center'}} onClick={() => purchaseBluePlan('BSC USDT')}>
															<img  src={bnb_usdt} className="button_img"/>
															<p style={{color: '#989899'}}>BSC USDT</p>
														</div>
														{/* <div style={{cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems:'center', padding: '0 0.5rem'}}>
															<QuotesTx style={{width: '26px', height: '26px'}}/>
															<span>BSC USDT</span>
														</div> */}
														<a style={{cursor: 'pointer', padding: '0 0.5rem', textAlign: 'center'}} onClick={alipayClick}>
															<AliPay width="6.5rem"/>
														</a>
														<a style={{cursor: 'pointer', padding: '0 0.5rem', textAlign: 'center'}} onClick={alipayClick}>
															<img  src={wachat} className="button_img"/>
															<p style={{color: '#989899'}}>WeChat</p>
														</a>
													</div>
												</>
											}
											
											{/* <div className="inner" style={{marginRight: "1rem"}}>
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
											</div> */}
										</div>
									</>
							}
						
						</>
					}
					{
						showPurchase &&
							<>
								<div className="redeem-divider">
									<div className="line"></div>
								</div>
								<p style={{color: '#9fbfe5', fontWeight: 'bolder'}}>
									{t('comp-accountlist-SpClub-showAlipayPurchase')}
								</p>
								<p style={{color: '#989899'}}>
									{t('comp-accountlist-SpClub-showAlipayPurchase-1')}
								</p>
								<p style={{color: '#989899'}}>
									{t('comp-accountlist-SpClub-showAlipayPurchase-2')}
									<a style={{color: '#9fbfe5', fontWeight: 'bolder'}} onClick={() => {
										//@ts-ignore
										window?.Comm100API?.open_chat_window?.()
									}}>{t('comp-comm-customerService')}</a>
								</p>
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
		
		{/* {
			!QRWallet &&
			<>
				<div className="redeem-divider">
					<div className="line"></div>
				</div>
				<h2>{t('comp-accountlist-SpClub-title1')} <br />{t('comp-accountlist-SpClub-title2')}</h2>
				<p style={{ textAlign: "left" }}>{t('comp-accountlist-SpClub-detail')} </p>
				<div className="sp-club-grid">
				<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
					<img src={AirdropRewards} />
					<p>{t('comp-accountlist-SpClub-detail1')} </p>
				</div>
				<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
					<img src={LoyaltyDiscounts} />
					<p>{t('comp-accountlist-SpClub-detail2')} </p>
				</div>
				<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
					<img src={ReferralProgram} />
					<p>{t('comp-accountlist-SpClub-detail3')} </p>
				</div>
				<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
					<img src={EducationHub} />
					<p>{t('comp-accountlist-SpClub-detail4')} </p>
				</div>
				<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
					<img src={EarlyAccess} />
					<p>{t('comp-accountlist-SpClub-detail5')} </p>
				</div>
				<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
					<img src={ExclusivePerks} />
					<p>{t('comp-accountlist-SpClub-detail6')} </p>
				</div>
				</div>
				<p style={{ fontSize: "12px", textAlign: "left" }}>{t('comp-accountlist-SpClub-findMore')} <a style={{ color: "#9FBFE5FE" }} href="https://subscription.silentpass.io" target='_blank'>https://subscription.silentpass.io</a></p>
			</>
		} */}
		
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
              <h3>{t('comp-accountlist-SpClub-title')} </h3>
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