import { useState } from 'react';

export default function BuyMore() {
  const [choosenOption, setChoosenOption] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <div className="buy-more">
      <h3>Buy more</h3>
      <div className="plan-options">
        <button onClick={() => setChoosenOption('monthly')} className={choosenOption === 'monthly' ? 'active' : ''}>Monthly</button>
        <button onClick={() => setChoosenOption('yearly')} className={choosenOption === 'yearly' ? 'active' : ''}>Yearly</button>
      </div>
      <div className="plan-cards">
        <div className="plan">
          <div>
            <p>Premium</p>
            <span>1 device</span>
          </div>
          <div>
            <span>$USDT</span>
            <p>24.99</p>
            <span className="pay-type">paid {choosenOption}</span>
          </div>
        </div>
        <div className="plan">
          <div>
            <p>Platinum</p>
            <span>5 devices</span>
          </div>
          <div>
            <span>$USDT</span>
            <p>99.99</p>
            <span className="pay-type">paid {choosenOption}</span>
          </div>
        </div>
      </div>
      <p>*If you are a Guardian or CoNETian, ​​transfer your NFT to your Main Account on Silent Pass VPN app.</p>
    </div>
  )
}