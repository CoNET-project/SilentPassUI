import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css"; // Import external CSS file
import SuccessModal from './SuccessModal';
import { RealizationRedeem } from '../../services/wallets';
import SimpleLoadingRing from '../SimpleLoadingRing';
import { useDaemonContext } from "../../providers/DaemonProvider";
import { ReactComponent as StripeIcon } from "./assets/stripe.svg";
import { ReactComponent as PaypalIcon } from "./assets/paypal.svg";

interface plan {
	total: string
	publicKey: string
	Solana: string
}

const VPN_URLS = ['vpn', 'vpn-beta'];

export default function RedeemPassport() {
  const [redeemCode, setRedeemCode] = useState("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [anErrorOccurred, setAnErrorOccurred] = useState<boolean>(false);
  const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState<boolean>(false);

  const { isIOS, profiles, selectedPlan, setSelectedPlan, successNFTID, setPaymentKind, setSuccessNFTID } = useDaemonContext();
  const navigate = useNavigate();

	const isSilentPassVPN = VPN_URLS.some(url => window.location.href.includes(url));
  const isDevelopment = window.location.href.includes('localhost');

	/* 1 = $SP
	2 = STRIPE */
	function handlePurchase(type: 1 | 2) {
		setPaymentKind(type);
		navigate("/subscription");
	}

	useEffect(() => {
		if (successNFTID > 100) {
			setAnErrorOccurred(true);
			setIsSuccessModalOpen(true);
      		setRedeemCode('')
		}

	}, [successNFTID])

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

	function handleChooseOption(option: '1' | '12') {
		setSelectedPlan(option);
	}

  const startSubscription = () => {
	if (!profiles ||profiles.length < 2) {
		return
	}

	const planObj:plan = {
		publicKey: profiles[0].keyID,
		Solana: profiles[1].keyID,
		total: selectedPlan
	}

	const base64VPNMessage = btoa(JSON.stringify(planObj));
		if (window?.webkit?.messageHandlers) {
			window?.webkit?.messageHandlers["pay"].postMessage(base64VPNMessage)
		}
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
			{
				!isRedeemProcessLoading &&
				<>
					{
						isIOS ? <label className="redeem-label">Already a Subscriber?</label>
						:  <label className="redeem-label">Input Redeem Code!</label>
					}

					<input
						type="text"
						placeholder="#1234"
						className="redeem-input"
						value={redeemCode}
						onChange={(e) => setRedeemCode(e.target.value)}
					/>
				</>
			}

          {anErrorOccurred && <span className="error-warn">An error occurred, try again later.</span>}
          <button className="redeem-button confirm" onClick={handlePassportRedeem} disabled={!redeemCode}>
            {isRedeemProcessLoading ? <SimpleLoadingRing /> : "Confirm"}
          </button>
		  {
			!isRedeemProcessLoading &&
			<>
				 {
					isIOS &&
					<>
						<div className="redeem-divider">
						<div className="line"></div>
						<span>or</span>
						<div className="line"></div>
					</div>
					<div className="subscription-plans">
						<div
						className={`plan ${selectedPlan === '12' ? 'selected' : ''}`}
						onClick={() => setSelectedPlan('12')}
						>
						<div className="plan-content">
							<div className={`sub-option ${selectedPlan === '12' ? 'selected' : ''}`} />
							<div className="plan-details">
							<div className="plan-title">12 months plan</div>
							<div className="plan-price">$2.71/month, billed annually</div>
							<div className="plan-savings">(Save 18%)</div>
							</div>
						</div>
						<div className="free-trial">7-Day Free Trial</div>
						</div>

						<div
						className={`plan ${selectedPlan === '1' ? 'selected' : ''}`}
						onClick={() => setSelectedPlan('1')}
						>
						<div className="plan-content">
							<div className={`sub-option ${selectedPlan === '1' ? 'selected' : ''}`} />
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
						<button onClick={() => startSubscription()}>Start subscription</button>
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
					</>
				}
				{
					!isIOS &&
						<>
							<div className="redeem-divider">
								<div className="line"></div>
								<span>or</span>
								<div className="line"></div>
							</div>
							<div className="passport-options">
								<p>Choose plan</p>
								<div className="option-list">
									<button className={`option ${selectedPlan === '1' ? 'selected' : ''}`} onClick={() => handleChooseOption('1')}>
										<div>
											<p>Monthly</p>
											<span>1 device</span>
										</div>
										<div>
											<span>$USD</span>
											<p>2.99</p>
											<span>paid monthly</span>
										</div>
									</button>
									<button className={`option ${selectedPlan === '12' ? 'selected' : ''}`} onClick={() => handleChooseOption('12')}>
										<div>
											<p>Annually</p>
											<span>1 device</span>
										</div>
										<div>
											<span>$USD</span>
											<p>24.99</p>
											<span>paid yearly</span>
										</div>
									</button>
								</div>
							</div>
							<button className="redeem-button purchase" onClick={() => handlePurchase(1)}>
								Pay with $SP
							</button>
							{
								(!isSilentPassVPN || isDevelopment) && (
									<button className="redeem-button paypal">
										Pay with
										<PaypalIcon />
									</button>
								)
							}
							<button className="redeem-button stripe" onClick={() => handlePurchase(2)}>
								Pay with
								<StripeIcon />
							</button>
						</>
				}
			</>
		  }


        </div>
      </div>

      {/* Success Modal */}
      {isSuccessModalOpen && <SuccessModal nftID= {successNFTID} onClose={() => setIsSuccessModalOpen(false)} />}
    </>
  );
}
