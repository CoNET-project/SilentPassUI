import { useEffect, useState } from 'react';
import { useDaemonContext } from '../../../providers/DaemonProvider';

export default function BuyMore() {
  const { selectedPlan, setSelectedPlan } = useDaemonContext();

  const [standardPrice, setStandardPrice] = useState('2.99');
  const [premiumPrice, setPremiumPrice] = useState('9.99');

  useEffect(() => {
    if (selectedPlan === '1') {
      setStandardPrice('2.99');
      setPremiumPrice('9.99');
    } else {
      setStandardPrice('24.99');
      setPremiumPrice('99.99');
    }

  }, [selectedPlan]);

  return (
    <div className="buy-more">
      <h3>Buy more</h3>
      <div className="plan-cards">
        <div className={`plan ${selectedPlan === '1' ? 'active' : ''}`} onClick={() => setSelectedPlan('1')}>
          <div>
            <p>Monthly</p>
            <span>1 device</span>
          </div>
          <div>
            <span>$USD</span>
            <p>{standardPrice}</p>
            <span className="pay-type">paid monthly</span>
          </div>
        </div>
        <div className={`plan ${selectedPlan === '12' ? 'active' : ''}`} onClick={() => setSelectedPlan('12')}>
          <div>
            <p>Annually</p>
            <span>5 devices</span>
          </div>
          <div>
            <span>$USD</span>
            <p>{premiumPrice}</p>
            <span className="pay-type">paid yearly</span>
          </div>
        </div>
      </div>
    </div>
  )
}