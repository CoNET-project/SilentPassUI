import { useState } from 'react'

import "./index.css";

export default function ReferralProgram() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState('');

  return (
    <div className={`account-wrapper referral-program ${isOpen ? 'active' : ''}`}>
      {/* <div className="account-main-card" onClick={() => setIsOpen((prev) => !prev)}> */}
      <div className="disabled account-main-card">
        <div>
          <h3>Referral Program</h3>
          <img className="chevron" src="./assets/right-chevron.svg" />
        </div>
      </div>
      <div className="info-card">
        <div className="info-wrapper">
          <div>
            <p>Input you inviter wallet address</p>
            <input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="wallet address" />
          </div>
          <button><p>Confirm</p></button>
        </div>
      </div>
    </div>
  )
}