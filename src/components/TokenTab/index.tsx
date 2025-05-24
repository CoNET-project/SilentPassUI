import { useState } from 'react';
import './index.css';

import { ReactComponent as SolanaToken } from './assets/solana-token.svg';
import { ReactComponent as SpToken } from './assets/sp-token.svg';
import { useDaemonContext } from '../../providers/DaemonProvider';
import { useTranslation } from 'react-i18next'
interface TokenTabProps {
  setTokenGraph: (tokenGraph: string) => void;
  tokenData: any;
  quotation: any;
}

const TokenCard: React.FC<{ token: any, action: () => void }> = ({ token, action }) => {
	const { t, i18n } = useTranslation()
  return (
    <div className="token-card" onClick={action}>
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


export default function TokenTab({ setTokenGraph, tokenData, quotation }: TokenTabProps) {
  const { profiles } = useDaemonContext();
	const { t, i18n } = useTranslation()
  console.log("PROFILES: ", profiles);

  const tokens = [
    {
      "label" : "Silent Pass",
      "logo": <SpToken width={32} height={32} />,
      "priceVariation": 0.5381,
      "amount": profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(6),
      "price": (profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(6)) * quotation["SP"],
      "currency": "$SP"
    },
    {
      "label" : "Solana",
      "logo": <SolanaToken width={32} height={32} />,
      "priceVariation": -0.002,
      "amount": profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6),
      "price": (profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6)) * quotation["SOL"],
      "currency": "$SOL"
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

      <div className='token-data'>
        <div className="detail-row">
          <div>
            <p>{t('comp-TokenTab-provide')}</p>
          </div>
          <p style={{color:"#989899"}}>{tokenData?.provider}</p>
        </div>
        {/* <div className="detail-row">
          <div>
            <p>Price</p>
          </div>
          <p style={{color:"#989899"}}>1 {tokenData?.token_from} ≈ {tokenData?.price_to} {tokenData?.token_to}</p>
        </div> */}
        <div className="detail-row">
          <div>
            <p>{t('comp-TokenTab-Slippage')}</p>
          </div>
          <div  style={{display:"flex", gap:"4px"}}>
            <p style={{color:"#989899"}}>{t('comp-TokenTab-Auto')}</p>
            <p style={{color:"#989899"}}>2.50%</p>
          </div>
        </div>

        <div className="detail-row last-row">
          <div>
            <p>{t('comp-TokenTab-fee')}</p>
          </div>
          <div>
            <p style={{color:"#989899"}}>$ {tokenData?.fees}</p>
          </div>
        </div>

        {/* <div className="detail-row last-row">
          <div>
            <p>Price Impact</p>
          </div>
          <div>
            <p style={{color:"#989899"}}>{tokenData?.impact}%</p>
          </div>
        </div> */}
      </div>
    </div>
  )
}