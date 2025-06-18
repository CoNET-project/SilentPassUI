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
}

export default function RedeemPassport() {
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
		total: selectedPlan1
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

        <div className="redeem-content">
          {/* <label className="redeem-label">Input redeem code</label>
          <input
            type="text"
            placeholder="#1234"
            className="redeem-input"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
          />
          {anErrorOccurred && <span className="error-warn">An error occurred, try again later.</span>}
          <button className="redeem-button confirm" onClick={handlePassportRedeem} disabled={!redeemCode}>
            {isRedeemProcessLoading ? <SimpleLoadingRing /> : "Confirm"}
          </button>
          <div className="redeem-divider">
            <div className="line"></div>
            <span>or</span>
            <div className="line"></div>
          </div> */}
          <div className="subscription-plans">
            <div
              className={`plan ${selectedPlan1 === '12' ? 'selected' : ''}`}
              onClick={() => setSelectedPlan1('12')}
            >
              <div className="plan-content">
                <div className={`sub-option ${selectedPlan1 === '12' ? 'selected' : ''}`} />
                <div className="plan-details">
                  <div className="plan-title">12 months plan</div>
                  <div className="plan-price">$2.71/month, billed annually</div>
                  <div className="plan-savings">(Save 18%)</div>
                </div>
              </div>
              <div className="free-trial">7-Day Free Trial</div>
            </div>

            <div
              className={`plan ${selectedPlan1 === '1' ? 'selected' : ''}`}
              onClick={() => setSelectedPlan1('1')}
            >
              <div className="plan-content">
                <div className={`sub-option ${selectedPlan1 === '1' ? 'selected' : ''}`} />
                <div className="plan-details">
                  <div className="plan-title">1 month plan</div>
                  <div className="plan-price">$3.29/month</div>
                </div>
              </div>
              <div className="no-free-trial">No Free Trial</div>
            </div>
          </div>
          <div className="redeem-divider">
            <div className="line"></div>
          </div>
          <div className="subscription">
            <p>7 day free, <br /> then get 12 months for $32.49</p>
            <button onClick={startSubscription}>Start subscription</button>
            <div className="sub-details">
              <p>Subscription details:</p>
              <ul>
                <li>Your Apple ID account will be charged on the last day of your free trial.</li>
                <li>Your subscription will automatically renew at the end of each billing period unless it is canceled at least 24 hours before the expiry date.</li>
                <li>You can manage and cancel your subscriptions by going to your App Store account settings after purchase.</li>
                <li>Any unused portion of a free trial period, if offered, will be forfeited when you purchase a subscription.</li>
                <li>By subscribing, you agree to the Terms of Service and Privacy Policy.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {isSuccessModalOpen && <SuccessModal nftID= {successNFTID}  onClose={() => setIsSuccessModalOpen(false)} />}
    </>
  );
}
