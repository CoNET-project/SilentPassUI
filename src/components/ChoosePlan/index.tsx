import { useEffect, useState } from 'react';
import { useDaemonContext } from '../../providers/DaemonProvider';

export default function ChoosePlan() {
  const { purchasingPlan, setPurchasingPlan, purchasingPlanPaymentTime, setPurchasingPlanPaymentTime } = useDaemonContext();

  const [standard, setStandard] = useState(0);
  const [premium, setPremium] = useState(0);

  const [standardPrice, setStandardPrice] = useState('2.49');
  const [premiumPrice, setPremiumPrice] = useState('9.99');

  useEffect(() => {
    if (purchasingPlanPaymentTime === 'monthly') {
      setStandardPrice('2.99');
      setPremiumPrice('24.99');
    } else {
      setStandardPrice('24.99');
      setPremiumPrice('99.99');
    }

  }, [purchasingPlanPaymentTime]);

  return (
    <div className="buy-more">
      <h3>Choose plan</h3>
      {/* <div className="plan-options">
        <button onClick={() => setPurchasingPlanPaymentTime('monthly')} className={purchasingPlanPaymentTime === 'monthly' ? 'active' : ''}>Monthly</button>
        <button onClick={() => setPurchasingPlanPaymentTime('yearly')} className={purchasingPlanPaymentTime === 'yearly' ? 'active' : ''}>Yearly</button>
      </div> */}
      <div className="plan-cards">
        <div className={`plan ${purchasingPlan === 'standard' ? 'active' : ''}`} onClick={() => setPurchasingPlan('standard')}>
          <div>
            <p>Monthly</p>
            <span>1 device</span>
          </div>
          <div>
            {/* <button onClick={() => setStandard((prev) => prev === 0 ? 0 : prev - 1)} disabled={standard === 0}>-</button>
            <div>{standard}</div>
            <button onClick={() => setStandard((prev) => prev + 1)}>+</button> */}
          </div>
          <div>
            <span>$USD</span>
            <p>{standardPrice}</p>
            {/* <span className="pay-type">paid {purchasingPlanPaymentTime}</span> */}
          </div>
        </div>
        <div className={`plan ${purchasingPlan === 'premium' ? 'active' : ''}`} onClick={() => setPurchasingPlan('premium')}>
          <div>
            <p>Annual</p>
            <span>1 devices</span>
          </div>
          <div>
            {/* <button onClick={() => setPremium((prev) => prev === 0 ? 0 : prev - 1)} disabled={premium === 0}>-</button>
            <div>{premium}</div>
            <button onClick={() => setPremium((prev) => prev + 1)}>+</button> */}
          </div>
          <div>
            <span>$USD</span>
            <p>{premiumPrice}</p>
            {/* <span className="pay-type">Annual</span> */}
          </div>
        </div>
      </div>
    </div>
  )
}