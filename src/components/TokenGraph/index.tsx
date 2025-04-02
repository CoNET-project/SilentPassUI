import { useState } from 'react';
import { ReactComponent as SolanaToken } from './assets/solana-token.svg'
import { ReactComponent as SpToken } from './assets/sp-token.svg'

import './index.css'
import PriceChart from '../PriceChart';

interface TokenGraphProps {
  token: string;
}

export default function TokenGraph({ token }: TokenGraphProps) {
  return (
    <div className="token-graph">
      <div className="graph">
        <PriceChart />
      </div>

      <div className="balance">
        <p>Your balance</p>
        <div className="token-card">
          <div className="token-info">
            {
              token === 'SP' ? <SpToken width={32} height={32} /> : <SolanaToken width={32} height={32} />
            }
            <div>
              <p className="token-label">{token === 'SP' ? 'Silent Pass' : 'Solana'}</p>
              <span>0.902 {token}</span>
            </div>
          </div>
          <div className="token-values">
            <p className="token-amount">$ 138.39</p>
            <p className="token-price">$0.00</p>
          </div>
        </div>
      </div>

      <div className="about">
        <p>About</p>
        <p className="about-text">Solana is a highly functional open source project that banks on blockchain technology's permissionless nature to provide decentralized finance (DeFi)
        solutions. It is a layer 1 network that offers fast speeds and affordable costs. While the idea and initial work on the project began in 2017, Solana was officially launched in March 2020 by the Solana Foundation with headquarters in Geneva, Switzerland.</p>
      </div>

      <div className="info">
        <p>Info</p>
        <div className='token-data'>
          <div className="detail-row">
            <div>
              <p>Symbol</p>
            </div>
            <p style={{color:"#989899"}}>SOL</p>
          </div>
          <div className="detail-row">
            <div>
              <p>Network</p>
            </div>
            <p style={{color:"#989899"}}>Solana</p>
          </div>
          <div className="detail-row">
            <div>
              <p>Market Cap</p>
            </div>
            <p style={{color:"#989899"}}>$65.85B</p>
          </div>
          <div className="detail-row">
            <div>
              <p>Total Supply</p>
            </div>
            <p style={{color:"#989899"}}>594.98M</p>
          </div>
          <div className="detail-row last-row">
            <div>
              <p>Circulating Supply</p>
            </div>
            <p style={{color:"#989899"}}>498.14M</p>
          </div>
        </div>
      </div>

      <div className="performance">
        <p>24h Performance</p>
        <div className='token-data'>
          <div className="detail-row">
            <div>
              <p>Volume</p>
            </div>
            <p style={{color:"#989899"}}>$3.00B <span style={{color:"red"}}>-31.44%</span></p>
          </div>
          <div className="detail-row">
            <div>
              <p>Trades</p>
            </div>
            <p style={{color:"#989899"}}>23.56M <span style={{color:"red"}}>-6.38%</span></p>
          </div>
          <div className="detail-row last-row">
            <div>
              <p>Traders</p>
            </div>
            <p style={{color:"#989899"}}>1.37M <span style={{color:"red"}}>-8.92%</span></p>
          </div>
        </div>
      </div>

    </div>
  )
}