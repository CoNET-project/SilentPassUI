import { useState, useEffect } from 'react';
import './index.css';

import rfp from './assets/ufp.png';
import rsp from './assets/usp.png'
import rcp from './assets/ucp.png'
import newCoin from './assets/newCoin.gif'
import { useDaemonContext } from '../../providers/DaemonProvider';
import { useTranslation } from 'react-i18next'

interface TokenTabProps {
  setTokenGraph: (tokenGraph: string) => void;
  quotation: any;
  animation: boolean
}

const TokenCard: React.FC<{ token: any, action: () => void}> = ({ token, action }) => {
  return (
    <div className="token-card" onClick={action} >
      <div className="token-info">
        {token.logo}
        <div>
          <p className="token-label">{token.label}</p>
          <p
            className={`token-variation ${
              token.priceVariation >= 0 ? "positive" : "negative"
            }`}
          >
            {/* {token.priceVariation >= 0
              ? `+${(token.priceVariation * 100).toFixed(2)}%`
              : `${(token.priceVariation * 100).toFixed(2)}%`} */}
          </p>
        </div>
      </div>
      <div className="token-values">
        <p className="token-amount" >
		  $ {token.price.toFixed(2)}
          {/* {token.amount.toLocaleString()}{" "} */}
          
        </p>
        <p className="token-price">{token.amount}</p>
      </div>
    </div>
  );
};


export default function SPClubRewardTab({ setTokenGraph, quotation, animation }: TokenTabProps) {
  const { profiles } = useDaemonContext();
  const balance_rfp = parseInt(profiles?.[0]?.SpClubPoints?.SPHolderPoint||0)
  const balance_rsp = parseInt(profiles?.[0]?.SpClubPoints?.SubscriptionPoint||0)
  const balance_rcp = parseInt(profiles?.[0]?.SpClubPoints?.ClaimableSubscriptionPoint||0)
  const { t, i18n } = useTranslation()

  const tokens = [
    {
      "label" : t('comp-SPClubRewardTab-1'),
      "logo": <img src = {animation ? newCoin: rfp } style={{width: '32px'}}/>,
      "priceVariation": 0.5381,
      "amount": balance_rfp.toFixed(0),
      "price": balance_rfp * quotation["ufp"],
      "currency": "$RFP"
    },
    {
      "label" : t('comp-SPClubRewardTab-2'),
      "logo": <img src= {animation ? newCoin: rsp} style={{width: '32px'}}/>,
      "priceVariation": -0.002,
      "amount": balance_rsp.toFixed(0),
      "price": balance_rsp * quotation["usp"],
      "currency": "$RSP"
    },
    {
      "label" : t('comp-SPClubRewardTab-3'),
      "logo": <img src= {animation ? newCoin: rcp} style={{width: '32px'}}/>,
      "priceVariation": -0.002,
      "amount": balance_rcp.toFixed(0),
      "price": balance_rcp * quotation["ucp"],
      "currency": "$RCP"
    },
  ]

  return (
    <div style={{width:"100%"}}>
      <div className="token-list">
        {tokens.map((token, index) => (
          <TokenCard key={index} token={token} action={() => setTokenGraph(token.currency)} />
        ))}
      </div>

      {/* <p style={{margin:"24px 0", textAlign:"left", color:"#989899", fontSize:"11px"}}>Tokens lists are generated using market data provided by various third party providers including CoinGecko, Birdeye and Jupiter. Performance is based on the prior 24 hour period. Past performance is not indicative of future performance.</p> */}

    </div>
  )
}