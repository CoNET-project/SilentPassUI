import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css"; // Import external CSS file
import SuccessModal from './SuccessModal';
import { RealizationRedeem } from '../../services/wallets';
import SimpleLoadingRing from '../SimpleLoadingRing';
import { useDaemonContext } from "../../providers/DaemonProvider";
import { ReactComponent as StripeIcon } from "./assets/stripe.svg";

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

  const { isIOS, profiles, selectedPlan, setSelectedPlan, successNFTID, setPaymentKind, setSuccessNFTID } = useDaemonContext();
  const navigate = useNavigate();

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
      <div className="redeem-passport">
				<div className="passport-options">
					<h3>Choose plan</h3>
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
				<button className="redeem-button stripe" onClick={() => handlePurchase(2)}>
					Pay with
					<StripeIcon />
				</button>
			</div>

      {/* Success Modal */}
      {isSuccessModalOpen && <SuccessModal nftID= {successNFTID} onClose={() => setIsSuccessModalOpen(false)} />}
    </>
  );
}
