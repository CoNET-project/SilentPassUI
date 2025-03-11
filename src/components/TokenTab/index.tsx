import { useState } from 'react';
import './index.css';

import { ReactComponent as SolanaToken } from './assets/solana-token.svg';
import { ReactComponent as SpToken } from './assets/sp-token.svg';

const TokenCard: React.FC<{ token: any }> = ({ token }) => {
  return (
    <div className="token-card">
      <div className="token-info">
        {token.logo}
        <div>
          <p className="token-label">{token.label}</p>
          <p
            className={`token-variation ${
              token.priceVariation >= 0 ? "positive" : "negative"
            }`}
          >
            {token.priceVariation >= 0
              ? `+${(token.priceVariation * 100).toFixed(2)}%`
              : `${(token.priceVariation * 100).toFixed(2)}%`}
          </p>
        </div>
      </div>
      <div className="token-values">
        <p className="token-amount">
          {token.amount.toLocaleString()}{" "}
          {token.label.includes("Solana") ? "SOL" : "$SP"}
        </p>
        <p className="token-price">${token.price.toFixed(2)}</p>
      </div>
    </div>
  );
};


export default function TokenTab() {

  const tokens = [
    {
      "label" : "Silent Pass",
      "logo": <SpToken width={32} height={32} />,
      "priceVariation": 0.5381,
      "amount": "18.61M",
      "price": 541.51,
      "currency": "$SP"
    },
    {
      "label" : "Solana",
      "logo": <SolanaToken width={32} height={32} />,
      "priceVariation": -0.002,
      "amount": 0.902,
      "price": 138.39,
      "currency": "SOL"
    },

  ]

  const [tokenData, setTokenData] = useState<any>({
    "provider": "CoNet",
    "token_from": "SOL",
    "token_to": "$SP",
    "price_to": 29831412.44,
    "fees": 0.011,
    "impact":1.41
  })



  return (
    <div style={{width:"100%"}}>
      <div className="token-list">
        {tokens.map((token, index) => (
          <TokenCard key={index} token={token} />
        ))}
      </div>

      <p style={{margin:"24px 0", textAlign:"left", color:"#989899", fontSize:"11px"}}>Tokens lists are generated using market data provided by various third party providers including CoinGecko, Birdeye and Jupiter. Performance is based on the prior 24 hour period. Past performance is not indicative of future performance.</p>

      <div className='token-data'>
        <div className="detail-row">
          <div>
            <p>Provider</p>
          </div>
          <p style={{color:"#989899"}}>{tokenData?.provider}</p>
        </div>
        <div className="detail-row">
          <div>
            <p>Price</p>
          </div>
          <p style={{color:"#989899"}}>1 {tokenData?.token_from} ≈ {tokenData?.price_to} {tokenData?.token_to}</p>
        </div>
        <div className="detail-row">
          <div>
            <p>Slippage</p>
          </div>
          <div  style={{display:"flex", gap:"4px"}}>
            <p style={{color:"#989899"}}>Auto</p>
            <p style={{color:"#989899"}}>2.50%</p>
          </div>
        </div>

        <div className="detail-row">
          <div>
            <p>Fee</p>
          </div>
          <div>
            <p style={{color:"#989899"}}>$ {tokenData?.fees}</p>
          </div>
        </div>

        <div className="detail-row last-row">
          <div>
            <p>Price Impact</p>
          </div>
          <div>
            <p style={{color:"#989899"}}>{tokenData?.impact}%</p>
          </div>
        </div>
      </div>
    </div>
  )
}