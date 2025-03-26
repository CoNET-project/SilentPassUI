import { useState } from 'react';
import './index.css'
import { useDaemonContext } from '../../providers/DaemonProvider';
import { useNavigate } from 'react-router-dom';
import ChoosePlan from '../ChoosePlan';

import { ReactComponent as PaypalIcon } from './assets/paypal.svg';
import StripeIcon from './assets/stripe.png';

export default function AffiliateOptions() {
  const navigate = useNavigate();

  const { profiles } = useDaemonContext();

  function subscribe() {
    navigate("/subscription");
  }

  function subscribePaypal() {}

  function subscribeStripe() {}

  return (
    <div className="affiliate-options">
      <ChoosePlan />

      <div className="affiliate-footer">
        <button onClick={subscribe} disabled={!profiles?.[0]?.keyID} className="sp-buy-button">
          <p>Pay with $SP</p>
        </button>
        <button onClick={subscribePaypal} disabled={!profiles?.[0]?.keyID} className="paypal-buy-button">
          <p>Pay with</p>
          <PaypalIcon />
        </button>
        <button onClick={subscribeStripe} disabled={!profiles?.[0]?.keyID} className="stripe-buy-button">
          <p>Pay with</p>
          <img src={StripeIcon} alt="Stripe" />
        </button>
      </div>
    </div>
  )
}