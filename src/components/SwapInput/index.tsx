import { useState } from 'react';
import './index.css';
import Separator from '../Separator';
import CopyAccountInfo from './CopyAccountInfo';
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton';

import { ReactComponent as ConetToken } from './assets/conet-token.svg'
import { ReactComponent as EthToken } from './assets/eth-token.svg'
import { ReactComponent as ConetEthToken } from './assets/conet-eth-token.svg'
import { ReactComponent as SolanaToken } from './assets/solana-token.svg'
import { ReactComponent as SpToken } from './assets/sp-token.svg'
import { getRemainingTime } from '../../utils/utils';
import { ReactComponent as SwapIconBlack } from "./assets/swap-icon-black.svg"
import * as motion from "motion/react-client"
import TokenTab from '../TokenTab';
import ActivityTab from '../ActivityTab';


interface SPSelectorProps {
  options: string[];
  onChange: (value: string) => void;
}

function SPSelector({ options, onChange }: SPSelectorProps) {
  const [selected, setSelected] = useState(options[0]);

  return (
    <motion.div 
      className="sp-selector" 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="sp-icon">SP</div>
      <button
        className="sp-button"
        onClick={() => onChange(selected)}
        style={{marginLeft:"8px"}}
      >
        <span>{selected}</span>
        <motion.span
          animate={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
          className="sp-chevron"
        >
          ▼
        </motion.span>
      </button>
    </motion.div>
  );
} 


export default function SwapInput() {
  const [openAccountList, setOpenAccountList] = useState<string[]>([]);
  const { profiles } = useDaemonContext();
  const [rotation, setRotation] = useState(0);
  const [tabSelector, setTabSelector] = useState<string>("tokens")

  const [fromAmount, setFromAmount] = useState<any>(0)
  const [toAmount, setToAmount] = useState<any>(0)

  function toggleAccount(accountAddress: string) {
    setOpenAccountList((prev) => (
      prev.includes(accountAddress) ? prev.filter((item) => item !== accountAddress) : [...prev, accountAddress]
    ))
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', marginTop:"38px", alignItems:"center"
    }}>

      <div className='input-box'>
        <div style={{justifyContent:'space-between', textAlign: 'left', display: 'flex', flexDirection: 'column'}}>
          <p className='box-text' style={{fontSize: '14px'}}>You Pay</p>
          <input
          type="number"
          className='box-text'
          style={{fontSize: '28px', lineHeight: '36px'}}
          value={fromAmount}
          onChange={(e) => setFromAmount(e.target.value)}
          placeholder="0"
        />
          <p className='box-text' style={{fontSize: '14px'}}>$0.00</p>
        </div>


        <div style={{justifyContent:'flex-end', textAlign: 'left', display: 'flex', flexDirection: 'column', maxWidth:"146px", gap: '8px'}}>
          <SPSelector options={['SP', 'SOLANA']} onChange={()=>{console.log("change")}}/>
          <div style={{display:"flex", gap:"4px"}}>
            <p style={{padding: '4px 6px', color:"#676768", background:"#3B3B3C", borderRadius:"40px", textAlign:"center", fontSize:"12px"}}>0%</p>
            <p style={{padding: '4px 6px', color:"#676768", background:"#3B3B3C", borderRadius:"40px", textAlign:"center", fontSize:"12px"}}>50%</p>
            <p style={{padding: '4px 6px', color:"#676768", background:"#3B3B3C", borderRadius:"40px", textAlign:"center", fontSize:"12px"}}>Max</p>
          </div>
        </div>
      </div>

      <motion.button
        animate={{ rotate: rotation }}
        transition={{ duration: 0.8 }}
        onTap={() => {
          if(rotation % 360 == 0){
            setRotation(rotation + 360)
          }

        }}

        style={{cursor:"pointer"}}
      >
        <div className='swap-button'>
          <SwapIconBlack/>
        </div>
      </motion.button>
      
      <div className='input-box'>
        <div style={{justifyContent:'space-between', textAlign: 'left', display: 'flex', flexDirection: 'column'}}>
          <p className='box-text' style={{fontSize: '14px'}}>You Receive</p>
          <p className='box-text' style={{fontSize: '28px', lineHeight: '36px'}}>0</p>
          <p className='box-text' style={{fontSize: '14px'}}>$0.00</p>
        </div>


        <div style={{justifyContent:'flex-end', textAlign: 'left', display: 'flex', flexDirection: 'column', maxWidth:"146px", gap: '8px'}}>
          <SPSelector options={['SP', 'SOLANA']} onChange={()=>{console.log("change")}}/>
          <div style={{display:"flex", gap:"4px"}}>
            <p style={{color:"#676768", textAlign:"right", fontSize:"12px"}}>0</p>
          </div>
        </div>

      </div>

      <div style={{background:"#191919", borderRadius:"8px", padding:"4px", marginTop: "48px", marginBottom:"24px"}}>
        <div style={{display:"flex"}}>
          <p className="tab-selector" style={{background: tabSelector === "tokens" ? "#3F3F40" : "none"}} onClick={()=> setTabSelector('tokens')}>Tokens</p>
          <p className="tab-selector" style={{background: tabSelector === "activity" ? "#3F3F40" : "none"}} onClick={()=> setTabSelector('activity')}>Activity</p>
        </div>
      </div>

      {tabSelector === "tokens" ? <TokenTab/> : <ActivityTab/>}

    </div>


    // <div className="account-list">
    //   <div className={`account-wrapper ${openAccountList.includes(profiles?.[0]?.keyID) ? 'active' : ''}`}>
    //     <div className="account-main-card" onClick={() => toggleAccount(profiles?.[0]?.keyID)}>
    //       <div>
    //         <h3>Main Wallet</h3>
    //         <img className="chevron" src="./assets/right-chevron.svg" />
    //       </div>
    //     </div>
    //     <div className="info-card">
    //       <div className="info-wrapper">
    //         <p>Tokens</p>
    //         <div>
    //           <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    //             <ConetToken />
    //             <p>$CONET</p>
    //           </div>
    //           <p>{profiles?.[0]?.tokens?.conetDepin?.balance || (0.0).toFixed(6)}</p>
    //         </div>
    //         <div>
    //           <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    //             <ConetEthToken />
    //             <p>$ETH</p>
    //           </div>
    //           <p>{profiles?.[0]?.tokens?.conet_eth?.balance || (0.0).toFixed(6)}</p>
    //         </div>
    //       </div>
    //       <Separator />
    //       <div className="info-wrapper">
    //         <p>Silent Pass Passport</p>
    //         <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
    //           <p>Freemium</p>
    //           {
    //             profiles?.[0]?.activePassport?.expires ?
    //               <p>{getRemainingTime(profiles?.[0]?.activePassport?.expires)}</p>
    //               : <Skeleton width='50px' height='20px' />
    //           }
    //         </div>
    //       </div>
    //       <Separator />
    //       <CopyAccountInfo wallet={profiles?.[0]} />
    //     </div>
    //   </div>

    //   <div className="cta-buttons" style={{ marginBottom: "0px" }}>
    //     <div className="highlight-1">
    //       <button className='disabled'>
    //         <p>Transfer Silent Pass Passport</p>
    //       </button>
    //     </div>
    //   </div>

    //   <div className={`account-wrapper solana ${openAccountList.includes("123") ? 'active' : ''}`}>
    //     <div className="account-main-card" onClick={() => toggleAccount("123")}>
    //       <div>
    //         <h3>Solana Wallet</h3>
    //         <img className="chevron" src="./assets/right-chevron.svg" />
    //       </div>
    //     </div>

    //     <div className="info-card">
    //       <div className="info-wrapper">
    //         <p>Tokens</p>
    //         <div>
    //           <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    //             <SpToken />
    //             <p>$SP</p>
    //           </div>
    //           <p>{profiles?.[1]?.tokens?.conetDepin?.balance || (0.0).toFixed(6)}</p>
    //         </div>
    //         <div>
    //           <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    //             <SolanaToken />
    //             <p>$SOL</p>
    //           </div>
    //           <p>{profiles?.[1]?.tokens?.conetDepin?.balance || (0.0).toFixed(6)}</p>
    //         </div>
    //       </div>
    //       <Separator />
    //       <CopyAccountInfo wallet={profiles?.[1]} />
    //     </div>
    //   </div>
    // </div>
  )
}