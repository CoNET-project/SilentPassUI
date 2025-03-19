import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css"; // Import external CSS file
import SuccessModal from './SuccessModal';
import { RealizationRedeem } from '../../services/wallets';
import SimpleLoadingRing from '../SimpleLoadingRing';

export default function RedeemPassport() {
  const [redeemCode, setRedeemCode] = useState("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [anErrorOccurred, setAnErrorOccurred] = useState<boolean>(false);
  const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState<boolean>(false);

  const navigate = useNavigate();

  async function handlePassportRedeem() {
    try {
      setIsRedeemProcessLoading(true);
      const redeem = await RealizationRedeem(redeemCode);

      setIsSuccessModalOpen(true);
    } catch (err: any) {
      setAnErrorOccurred(true);
      console.log("ERROR: ", err);
    } finally {
      setRedeemCode('');
      setIsRedeemProcessLoading(false);
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
          <label className="redeem-label">Input redeem code</label>
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
          </div>
          <button className="redeem-button purchase" onClick={() => navigate("/subscription")}>
            Go to purchase
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {isSuccessModalOpen && <SuccessModal onClose={() => setIsSuccessModalOpen(false)} />}
    </>
  );
}
