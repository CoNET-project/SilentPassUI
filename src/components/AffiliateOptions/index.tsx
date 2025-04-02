import { useState } from 'react';
import './index.css'
import { useDaemonContext } from '../../providers/DaemonProvider';
import { useNavigate } from 'react-router-dom';
import ChoosePlan from '../ChoosePlan';

import { ReactComponent as PaypalIcon } from './assets/paypal.svg';
import StripeIcon from './assets/stripe.png';



export default function AffiliateOptions() {
  const navigate = useNavigate();
  const { purchasingPlan, profiles, setPaymentKind } = useDaemonContext();

  function subscribe(val: number) {
	setPaymentKind(val)
  }

  function subscribePaypal() {}

  return (
    <div className="affiliate-options">
      <ChoosePlan />

      <div className="affiliate-footer">
        <button onClick={() => subscribe(0)} disabled={true} className="sp-buy-button">
          <p>Pay with $SP</p>
        </button>
        <button onClick={subscribePaypal} disabled={true} className="paypal-buy-button">
          <p>Pay with</p>
          <PaypalIcon />
        </button>
        <button onClick={() => subscribe(1)} disabled={!profiles?.[0]?.keyID} className="stripe-buy-button">
          <p style={{"width": "none"}}>Pay with</p>
          <img src={StripeIcon} alt="Stripe" />
        </button>
      </div>
    </div>
  )
}