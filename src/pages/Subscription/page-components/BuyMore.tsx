import { useEffect, useState } from 'react';
import { useDaemonContext } from '../../../providers/DaemonProvider';

export default function BuyMore() {
  const { purchasingPlan, setPurchasingPlan, purchasingPlanPaymentTime, setPurchasingPlanPaymentTime } = useDaemonContext();

  const [standardPrice, setStandardPrice] = useState('2.49');
  const [premiumPrice, setPremiumPrice] = useState('9.99');

  useEffect(() => {
    if (purchasingPlanPaymentTime === 'monthly') {
      setStandardPrice('2.49');
      setPremiumPrice('9.99');
    } else {
      setStandardPrice('24.99');
      setPremiumPrice('99.99');
    }

  }, [purchasingPlanPaymentTime]);

  return (
    <div className="buy-more">
      <h3>Buy more</h3>
      <div className="plan-options">
        <button onClick={() => setPurchasingPlanPaymentTime('monthly')} className={purchasingPlanPaymentTime === 'monthly' ? 'active' : ''}>Monthly</button>
        <button onClick={() => setPurchasingPlanPaymentTime('yearly')} className={purchasingPlanPaymentTime === 'yearly' ? 'active' : ''}>Yearly</button>
      </div>
      <div className="plan-cards">
        <div className={`plan ${purchasingPlan === 'standard' ? 'active' : ''}`} onClick={() => setPurchasingPlan('standard')}>
          <div>
            <p>Standard</p>
            <span>1 device</span>
          </div>
          <div>
            <span>$USD</span>
            <p>{standardPrice}</p>
            <span className="pay-type">paid {purchasingPlanPaymentTime}</span>
          </div>
        </div>
        <div className={`plan ${purchasingPlan === 'premium' ? 'active' : ''}`} onClick={() => setPurchasingPlan('premium')}>
          <div>
            <p>Premium</p>
            <span>5 devices</span>
          </div>
          <div>
            <span>$USD</span>
            <p>{premiumPrice}</p>
            <span className="pay-type">paid {purchasingPlanPaymentTime}</span>
          </div>
        </div>
      </div>
    </div>
  )
}