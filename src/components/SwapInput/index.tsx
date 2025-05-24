import { useEffect, useMemo, useState } from 'react';
import './index.css';
import { useDaemonContext } from '../../providers/DaemonProvider';

import { ReactComponent as SwapIconBlack } from "./assets/swap-icon-black.svg";
import * as motion from "motion/react-client";
import TokenTab from '../TokenTab';
import ActivityTab from '../ActivityTab';

import { ReactComponent as SpToken } from "./assets/sp-token.svg";
import { ReactComponent as SolanaToken } from "./assets/solana-token.svg";
import { getOracle } from '../../services/passportPurchase';
import { refreshSolanaBalances } from '../../services/wallets'
import { calcSpInUsd } from '../../utils/utils';
import Skeleton from '../Skeleton';
import {Sp2SolQuote, Sol2SpQuote, swapTokens, solanaAddr, spAddr } from '../../services/swap'
import SimpleLoadingRing from '../SimpleLoadingRing'
import { useTranslation } from 'react-i18next'

interface SwapInputProps {
  setTokenGraph: (tokenGraph: string) => void;
}

interface SPSelectorProps {
  option: string;
  onChange: () => void;
}

function SPSelector({ option, onChange }: SPSelectorProps) {
  return (
    <motion.div
      className="sp-selector"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      { option === "SP" ? <SpToken width={32} height={32} /> : <SolanaToken width={32} height={32} /> }
      <button
        className="sp-button"
        onClick={() => onChange()}
        style={{marginLeft:"8px"}}
      >
        <span>{option}</span>
        <motion.span
          animate={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
          className="sp-chevron"
        >
        </motion.span>
      </button>
    </motion.div>
  );
}

export default function SwapInput({ setTokenGraph }: SwapInputProps) {
  const { profiles, getAllNodes } = useDaemonContext()
  const [rotation, setRotation] = useState(0)
  const [tabSelector, setTabSelector] = useState("tokens")

  const [fromToken, setFromToken] = useState<'SP'|'SOL'>("SP")
  const [toToken, setToToken] = useState<'SP'|'SOL'>("SOL");
  const [fromAmount, setFromAmount] = useState('0')
  const [toAmount, setToAmount] = useState<string>('0.00000000')
  const [showConfirm, setShowConfirm] = useState(false)
  const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState(false)
  const [isQuotationLoading, setIsQuotation] = useState(true)
  const [swapError, setSwapError] = useState("")
  const [swapSuccess, setSwapSuccess] = useState("")
  const { t, i18n } = useTranslation()
  const [quotation, setQuotation] = useState({
    "SP": "",
    "SOL": "",
  })

  const tokenData = useMemo(() => ({
    "provider": t('comp-SwapInput-provide'),
    "token_from": fromToken,
    "token_to": toToken,
    "price_to": (quotation as any)[fromToken] / (quotation as any)[toToken] || 0,
    "fees": 0,
    "impact": 1.41
  }), [fromToken, quotation, toToken])

  const inputOver = () => {
	const ba = fromToken == 'SP' ? profiles?.[1]?.tokens?.sp?.balance1 : profiles?.[1]?.tokens?.sol.balance1
	if (fromAmount < ba) {
		return ''
	}
	return 'darkred'
  }

  const tokenClick = () => {

  }

  const confirmClick = async () => {
	if (swapError||swapSuccess) {
		setSwapSuccess('')
		return setSwapError('')
	}

	setIsRedeemProcessLoading(true)
	const from = (fromToken === 'SOL') ? solanaAddr : spAddr
	const to = (fromToken === 'SOL') ? spAddr : solanaAddr
	const tx = await swapTokens(from, to,profiles?.[1]?.privateKeyArmor, fromAmount)
	setIsRedeemProcessLoading(false)
	if (tx) {
		await refreshSolanaBalances()
		return setSwapSuccess(tx)
	}
	setSwapError('Error!')
  }
  
  function toggleTokens() {
    setFromToken((prev) => prev === "SP" ? "SOL" : "SP")
    setToToken((prev) => prev === "SP" ? "SOL" : "SP")

    setFromAmount('0')
    setToAmount('0.000000')
  }

  /* function toggleAccount(accountAddress: string) {
    setOpenAccountList((prev) => (
      prev.includes(accountAddress) ? prev.filter((item) => item !== accountAddress) : [...prev, accountAddress]
    ))
  } */

  useEffect(() => {
    (async () => {
      try {
        const oracleData = await getOracle();
		const nodes = getAllNodes
        const index = Math.floor(Math.random() * (nodes.length - 1))
		//await refreshSolanaBalances(nodes[index])
        if (!oracleData?.data) throw new Error("Unable to obtain oracle data");

        const quotationData = {
          "SP": String(calcSpInUsd(oracleData.data.sp9999)),
          "SOL": oracleData.data.so,
        }

        setQuotation(quotationData);
      } catch (err: any) {
        console.log("ERR: ", err);
      } finally {
        setIsQuotation(false);
      }
    })()

  }, [])

  const getQuote = async () => {
	const quote = await (fromToken === 'SOL' ?  Sol2SpQuote(fromAmount.toString()) : Sp2SolQuote(fromAmount.toString()))
	const total = parseFloat(parseFloat(quote).toFixed(6))
	
	if (total > 0) {
		setToAmount(total.toFixed(6))
		const ba = fromToken == 'SP' ? profiles?.[1]?.tokens?.sp?.balance1 : profiles?.[1]?.tokens?.sol.balance1
		if (fromAmount < ba) {
			setShowConfirm(true)
		} else {
			setShowConfirm(false)
		}
	}
  }

  useEffect(() => {
	if (parseFloat(fromAmount) > 0) {
		getQuote()
	}

  }, [fromAmount])
  

  useEffect(() => {
	
  }, [fromToken])

  const useMax=()=>{
      let val=fromToken === 'SOL'?(profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6)):(profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(6))
      setFromAmount(val);
  }
  
  return (
    <div style={{display: 'flex', flexDirection: 'column', marginTop:"38px", alignItems:"center"
    }}>

      <div className='input-box'>
        <div style={{justifyContent:'space-between', textAlign: 'left', display: 'flex', flexDirection: 'column'}}>
          <p className='box-text' style={{fontSize: '14px'}}>{t('comp-SwapInput-pay')}</p>
          {
            isQuotationLoading ? (
              <Skeleton width="180px" height="100px" />
            ) : (
              <>
                <input type="number"
				  step='0.01'
                  className='box-text'
                  style={{fontSize: '28px', lineHeight: '36px', color: inputOver() }}
                  value={fromAmount}
				  onKeyDown={(evt) => ["e", "E", "+", "-"].includes(evt.key) && evt.preventDefault()}
                  onChange={(e) => {
					const v = Number(e.target.value)
					const kk = fromAmount
					if (!/^\d*(\.\d{0,6})?$/i.test(e.target.value)) {

						return setFromAmount(fromAmount)
					}

					// if (/e/i.test(e.target.value)) {
					// 	const replace = e.target.value.replace(/e/i, '')
					// 	return setFromAmount(replace)
					// }
					if (v <=0 ) {
						return setFromAmount(e.target.value)
					}
                    setFromAmount(v.toString())
                    setToAmount(((v * Number((quotation as any)[fromToken])) / (quotation as any)[toToken]).toFixed(5))
                  }}
                  placeholder="0"
                />
                <p className='box-text' style={{fontSize: '14px'}}>$ {(Number(fromAmount) * Number((quotation as any)[fromToken])).toFixed(2)}</p>
              </>
            )
          }
        </div>


        <div style={{justifyContent:'center', textAlign: 'left', display: 'flex', flexDirection: 'column', maxWidth:"146px", gap: '8px'}}>
          <SPSelector option={fromToken} onChange={tokenClick}/>
          {/* <div style={{display:"flex", gap:"4px"}}>
            <p style={{padding: '4px 6px', color:"#676768", background:"#3B3B3C", borderRadius:"40px", textAlign:"center", fontSize:"12px"}}>0%</p>
            <p style={{padding: '4px 6px', color:"#676768", background:"#3B3B3C", borderRadius:"40px", textAlign:"center", fontSize:"12px"}}>50%</p>
            <p style={{padding: '4px 6px', color:"#676768", background:"#3B3B3C", borderRadius:"40px", textAlign:"center", fontSize:"12px"}}>Max</p>
          </div> */}
          <div className="make-max" onClick={useMax}>{t('comp-SwapInput-Max')}</div>
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
        <div className='swap-button' onClick={toggleTokens}>
          <SwapIconBlack/>
        </div>
      </motion.button>

      <div className='input-box'>
        <div style={{justifyContent:'space-between', textAlign: 'left', display: 'flex', flexDirection: 'column'}}>
          <p className='box-text' style={{fontSize: '14px'}}>{t('comp-SwapInput-Receive')}</p>
          <p className='box-text' style={{fontSize: '28px', lineHeight: '36px'}}>{toAmount}</p>
          <p className='box-text' style={{fontSize: '14px'}}>$ {( Number(toAmount) * Number((quotation as any)[toToken])).toFixed(2)}</p>
        </div>

        <div style={{justifyContent:'flex-end', textAlign: 'left', display: 'flex', flexDirection: 'column', maxWidth:"146px", gap: '8px'}}>
        <SPSelector option={toToken} onChange={tokenClick}/>
          {/* <div style={{display:"flex", gap:"4px"}}>
            <p style={{color:"#676768", textAlign:"right", fontSize:"12px"}}>0</p>
          </div> */}
        </div>

      </div>
	  {
			swapError && 
				<div className="declined-description">
					<p>{swapError}</p>
				</div>
	  }
	  {
		swapSuccess && 
			<div className="success-description">
				<a target='_blank' href={'https://solscan.io/tx/'+swapSuccess} >Success! Click to See The Detail</a>
			</div>
	  }
	  {
		showConfirm &&
			<button className="redeem-button confirm" onClick={confirmClick} style={{color : swapError ? 'darkred': swapSuccess ? '#249517': ''}}>
				{isRedeemProcessLoading ? <SimpleLoadingRing /> : t('comp-comm-Confirm')}
			</button>
	  }
      <div style={{background:"#191919", borderRadius:"8px", padding:"4px", marginTop: "2rem", marginBottom:"24px" }}>
        <div style={{display:"flex"}}>
          <p className="tab-selector" style={{background: tabSelector === "tokens" ? "#3F3F40" : "none"}} onClick={()=> setTabSelector('tokens')}>{t('comp-accountlist-assets')}</p>
          {/* <p className="tab-selector" style={{background: tabSelector === "activity" ? "#3F3F40" : "none"}} onClick={()=> setTabSelector('activity')}>Activity</p> */}
        </div>
      </div>

      {tabSelector === "tokens" ? <TokenTab quotation={quotation} setTokenGraph={setTokenGraph} tokenData={tokenData} /> : <ActivityTab />}
	
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