import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css"; // Import external CSS file
import SuccessModal from './SuccessModal';
import { RealizationRedeem } from '../../services/wallets';
import SimpleLoadingRing from '../SimpleLoadingRing';
import { Divider } from '@mui/material';
import { useDaemonContext } from "../../providers/DaemonProvider"

interface plan {
	total: string
	publicKey: string
	Solana: string
	transactionId: string
	productId: string
}

export default function RedeemPassport(showFree: boolean) {
  const [redeemCode, setRedeemCode] = useState("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [anErrorOccurred, setAnErrorOccurred] = useState<boolean>(false);
  const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState<boolean>(false);
  const [successNFTID, setSuccessNFTID] = useState(0);
  const { profiles, setSelectedPlan } = useDaemonContext()

  const [selectedPlan1, setSelectedPlan1] = useState<'12' | '1'>('12');

  const navigate = useNavigate()

    const startSubscription = () => {
	if (!profiles ||profiles.length < 2) {
		return
	}

		const planObj: plan = {
		publicKey: profiles[0].keyID,
		Solana: profiles[1].keyID,
		total: selectedPlan1 === '12' ? '2': selectedPlan1,
		transactionId: '',
		productId: ''
	}

	setSelectedPlan(selectedPlan1)
	const base64VPNMessage = btoa(JSON.stringify(planObj));
	
	window?.webkit?.messageHandlers["pay"]?.postMessage(base64VPNMessage)
	
	navigate("/subscription")
	
  }

  async function handlePassportRedeem() {
      setIsRedeemProcessLoading(true);
      const redeem = await RealizationRedeem(redeemCode);
      setIsRedeemProcessLoading(false);
      if (!redeem) {
        return setAnErrorOccurred(true);
      }
      if (typeof redeem === 'number') {
        setSuccessNFTID(redeem)
      }

      setIsSuccessModalOpen(true);
      setRedeemCode('')
  }

  return (
    <>
      <div className={`redeem-dropdown ${isOpen ? "is-open" : ""}`}>
        {/* Dropdown Button */}
        <button className="redeem-header cta-button" onClick={() => setIsOpen(!isOpen)}>
          <div className="redeem-header-content">
            <img src="/assets/conet-outline-white.svg" alt="Platform" className="redeem-icon" />
            <p>Get Silent Pass Passport</p>
          </div>
          <span className={`redeem-arrow ${isOpen ? "rotate" : ""}`}>▼</span>
        </button>

        <>
					<div className="passport-options">
						<p>Unlock the full power of Silent Pass VPN with the Silent Pass Passport</p>
						<div className="option-list">
							
							<button className={`option ${selectedPlan1 === '12' ? 'selected' : ''}`} onClick={() => setSelectedPlan1('12')}>
								
								<div>
									<p style={{fontSize: '16px', color: '#989899'}}>Annual Plan (12 Months)</p>
									<p style={{padding: "0.5rem 0"}}>$32.49 / year</p>
									<p style={{fontSize: '16px', color: '#989899'}}>Billed immediately, auto-renews yearly</p>
								</div>
							</button>
							<button className={`option ${selectedPlan1 === '1' ? 'selected' : ''}`} onClick={() => setSelectedPlan1('1')}>
								
								<div>
									<p style={{fontSize: '16px', color: '#989899'}}>Monthly Plan (1 Month)</p>
									<p style={{padding: "0.5rem 0"}}>$3.29 / month</p>
									<p style={{fontSize: '16px', color: '#989899'}}>Billed monthly, auto-renews</p>
								</div>
							</button>
							{
								showFree && 
								<>
									<p>
										You're currently on a 7-day free access period.
									</p>
									<p>
										⚠️Subscribing now will start your paid plan immediately.
									</p>
								</>
							}
							
						</div>
						<button className="buttonPay" onClick={() => startSubscription()}>Start subscription</button>
					</div>
					<div className="redeem-divider">
						<div className="line"></div>
					</div>
					<div className="subscription">
						<div className="sub-details">
						<p>Subscription details:</p>
						<ul>
							<li>Your Apple ID account will be charged when you start subscription.</li>
							<li>Your subscription will automatically renew at the end of each billing period unless it is canceled at least 24 hours before the expiry date.</li>
							<li>You can manage and cancel your subscriptions by going to your App Store account settings after purchase.</li>
							<li>Silent Pass includes a 7-day free access period from first app launch. Subscribing during this period ends the remaining free days.</li>
							<li>By subscribing, you agree to the <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" style={{color:"lightblue"}}>Apple’s Terms of Use</a>, and <a href="https://silentpass.io/privacy-cookies/" style={{color:"lightblue"}} target="_blank">Privacy Policy.</a></li>
						</ul>
						</div>
					</div>
		</>
      </div>

      {/* Success Modal */}
      {isSuccessModalOpen && <SuccessModal nftID= {successNFTID}  onClose={() => setIsSuccessModalOpen(false)} />}
    </>
  );
}
