import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css"; // Import external CSS file
import SuccessModal from './SuccessModal';
import { getRewordStaus } from '../../services/wallets';
import SimpleLoadingRing from '../SimpleLoadingRing';
import { useDaemonContext } from "../../providers/DaemonProvider";
import { ReactComponent as StripeIcon } from "./assets/stripe.svg";
import { ReactComponent as PaypalIcon } from "./assets/paypal.svg";
import { ReactComponent as ApplePay } from "./assets/Apple_Pay_logo.svg";
import { useTranslation } from 'react-i18next'

interface plan {
	total: string
	publicKey: string
	Solana: string
	transactionId: string
	productId: string
}
interface RedeemPassportProps {
  isOpen: boolean;
  setIsOpen:React.Dispatch<React.SetStateAction<boolean>>;
  redeemRef:React.RefObject<HTMLDivElement>;
}

export default function RedeemPassport({isOpen, setIsOpen, redeemRef}:RedeemPassportProps) {
  const [redeemCode, setRedeemCode] = useState("");
  // const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [anErrorOccurred, setAnErrorOccurred] = useState<boolean>(false);
  const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState<boolean>(false);
  const [spRewordEnable, setSpRewordEnable] = useState(false)
  const [spRewordloading, setSpRewordloading] = useState(true)
  const { isIOS, profiles, selectedPlan, setSelectedPlan, successNFTID, setPaymentKind, setSuccessNFTID, isLocalProxy } = useDaemonContext();
  const { t, i18n } = useTranslation()
  const navigate = useNavigate();

	/* 1 = $SP
	2 = STRIPE */
	function handlePurchase(type: 1 | 2 | 4) {
		setPaymentKind(type);
		navigate("/subscription");
	}
	let first = true

	const _getRewordStaus = async() => {
		setSpRewordloading(true)
		const status = await getRewordStaus()
		if (status === true) {
			setSpRewordEnable (status)
		} else {
			setSpRewordEnable (false)
		}
		
		setSpRewordloading(false)
	}



	useEffect(() => {
		if (!first) {
			return
		}
		first = false
		_getRewordStaus()

	}, [])

	useEffect(() => {
		const successNFTID_num = parseInt(successNFTID)
		if (successNFTID_num > 100) {
			setIsSuccessModalOpen(true);
      		setRedeemCode('')
		}

	}, [successNFTID])


  async function handlePassportRedeem() {
	setPaymentKind(6)
	setSelectedPlan(redeemCode)
	setIsRedeemProcessLoading(true);
	navigate("/subscription")
  }


  const spRewordProcess = () => {
	if (!spRewordEnable) {
		return
	}
	setSpRewordloading(true)
	setPaymentKind(5)
	navigate("/subscription")

  }

	function handleChooseOption(option: '1' | '12') {
		setSelectedPlan(option);
	}

  const startSubscription = () => {
	if (!profiles ||profiles.length < 2||!isIOS) {
		return
	}

	const planObj: plan = {
		publicKey: profiles[0].keyID,
		Solana: profiles[1].keyID,
		total: selectedPlan === '12' ? '2': selectedPlan,
		transactionId: '',
		productId: ''
	}

	const base64VPNMessage = btoa(JSON.stringify(planObj));
	
	window?.webkit?.messageHandlers["pay"]?.postMessage(base64VPNMessage)
	setPaymentKind(3);
	navigate("/subscription");
	
  }

  return (
    <>
      <div className={`redeem-dropdown ${isOpen ? "is-open" : ""} ${isIOS && !isLocalProxy ? "is-ios": ""}`}>
        {/* Dropdown Button */}
        <button className="redeem-header cta-button" onClick={() => setIsOpen(!isOpen)}>
          <div className="redeem-header-content">
            <img src="/assets/conet-outline-white.svg" alt="Platform" className="redeem-icon" />
			<p>{t('comp-RedeemPassport-title')} </p>
          </div>
          <span className={`redeem-arrow ${isOpen ? "rotate" : ""}`}>▼</span>
        </button>

        <div className="redeem-content">
			
				<>
					<label className="redeem-label">{t('comp-RedeemPassport-25usdRedeem')} </label>
					<button className={spRewordEnable ? "redeem-button confirm" : "redeem-button confirm disable" } onClick={spRewordProcess}>
						{spRewordloading ? <SimpleLoadingRing /> : t('comp-RedeemPassport-RedeemNow')}
					</button>
					<div className="redeem-divider" ref={redeemRef}>
						<div className="line"></div>
						<span>or</span>
						<div className="line"></div>
					</div>
				</>
			
			
			{
				!isRedeemProcessLoading &&
				<>
					{
						<>
							{
								isIOS && !isLocalProxy ? <label className="redeem-label">Already a Subscriber?</label>
								:  <label className="redeem-label">{t('comp-RedeemPassport-imput')} </label>
							}
							<p className="redeem-label">{t('comp-RedeemPassport-detail')}</p>
							<input
								type="text"
								placeholder="#1234"
								className="redeem-input"
								value={redeemCode}
								onChange={(e) => setRedeemCode(e.target.value)}
							/>
							{anErrorOccurred && <span className="error-warn">An error occurred, try again later.</span>}
							<button className="redeem-button confirm" onClick={handlePassportRedeem} disabled={!redeemCode}>
								{isRedeemProcessLoading ? <SimpleLoadingRing /> : t('comp-comm-Claim')}
							</button>
							<div className="redeem-divider">
								<div className="line"></div>
								<span>or</span>
								<div className="line"></div>
							</div>
						</>
					}
					
				</>
				
			}

          
		  {
			!isRedeemProcessLoading &&
			<>
				
				
						

							<div className="passport-options">
								<p>{t('comp-RedeemPassport-choosePlan')} </p>
								<div className="option-list">
									<button className={`option ${selectedPlan === '1' ? 'selected' : ''}`} onClick={() => handleChooseOption('1')}>
										<div>
											<p>{t('passport_Monthly')} </p>
											<span>{t('comp-RedeemPassport-1device')}, {t('passport_unlimitBandweidth')}  </span>
										</div>
										<div>
											<span>$USD</span>
											<p>2.99</p>
											<span>{t('comp-RedeemPassport-paidMonthly')} </span>
										</div>
									</button>
									<button className={`option ${selectedPlan === '12' ? 'selected' : ''}`} onClick={() => handleChooseOption('12')}>
										<div>
											<p>{t('passport_Annually')} </p>
											<span>{t('comp-RedeemPassport-1device')}, {t('passport_unlimitBandweidth')} </span>
										</div>
										<div>
											<span>$USD</span>
											<p>24.99</p>
											<span>{t('comp-RedeemPassport-paidAnnually')} </span>
										</div>
									</button>
								</div>
							</div>
							<div id="outer">
								<div className="inner" style={{marginRight: "1rem"}}>
									<button className='redeem-button purchase' onClick={() => handlePurchase(1)}>
										$SP
									</button>
								</div>
								<div className="inner" style={{marginRight: "1rem", marginTop: "-1rem"}}>
									<button className="redeem-button stripe" onClick={() => handlePurchase(2)}>
										<StripeIcon />
									</button>
								</div>
								<div className="inner" style={{marginTop: "-1rem"}}>
									<button className="redeem-button paypal" onClick={() => handlePurchase(4)}>
										<PaypalIcon style={{width: "4rem"}}/>
									</button>
								</div>
								
							</div>
							<div style={{padding:"1rem 0"}} id="outer">
								{
									isIOS && !isLocalProxy && 
									<div className="inner" style={{marginTop: "-1rem"}}>
										<button style={{backgroundColor: "dimgray"}} className="redeem-button paypal" onClick={startSubscription}>
											<ApplePay style={{width: "3.2rem"}}/>
										</button>
									</div>
								}
							</div>
							
						
				
			</>
		  }


        </div>
      </div>

      {/* Success Modal */}
      {isSuccessModalOpen && <SuccessModal nftID= {successNFTID} onClose={() => {setIsSuccessModalOpen(false); setSuccessNFTID('0')}} />}
    </>
  );
}
