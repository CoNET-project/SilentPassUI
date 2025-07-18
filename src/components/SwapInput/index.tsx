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
import { calcSpInUsd, formatNumber, parseFormattedNumber } from '../../utils/utils';
import Skeleton from '../Skeleton';
import {Sp2SolQuote, Sol2SpQuote, solanaAddr, spAddr } from '../../services/swap'
import SimpleLoadingRing from '../SimpleLoadingRing'
import { useTranslation } from 'react-i18next';

import { Button, SpinLoading, Modal, Result } from 'antd-mobile';
import { globalAllNodes } from "./../../utils/globals";
import { Connection, Keypair, Commitment, VersionedTransaction,RpcResponseAndContext, SignatureResult } from "@solana/web3.js";
import bs58 from "bs58";
import styles from './swapInput.module.scss';
import { ethers } from "ethers";

import {openWebLinkNative} from './../../api';

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
    const { profiles, getAllNodes, isIOS, isLocalProxy } = useDaemonContext()
    const [rotation, setRotation] = useState(0)
    const [tabSelector, setTabSelector] = useState("tokens")

    const [fromToken, setFromToken] = useState<'SP'|'SOL'>("SP")
    const [toToken, setToToken] = useState<'SP'|'SOL'>("SOL");
    const [fromAmount, setFromAmount] = useState('0')
	const [lastOnChangeNumber, setLastOnChangeNumber] = useState(0)
    const [toAmount, setToAmount] = useState<string>('0.00000000')
    const [showConfirm, setShowConfirm] = useState(true)
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const oracleData = await getOracle();
                // const nodes = getAllNodes
                // const index = Math.floor(Math.random() * (nodes.length - 1))
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
        };
        fetchData();
    }, [])

    useEffect(() => {
        if (parseFloat(fromAmount) > 0) {
            onChangeProcess()
        }
    }, [fromAmount])

    const showSuccess=(txid:string)=>{
        Modal.alert({
            bodyClassName:styles.successModalWrap,
            content: <div className={styles.successModal}>
                <Result
                    status='success'
                    title={t('comp-SwapInput-tip-2')}
                />
                <div className={styles.description}>{t('comp-SwapInput-tip-4')}!</div>
                <div className={styles.link}><a onClick={()=>{openWebLinkNative('https://solscan.io/tx/'+txid,isIOS,isLocalProxy)}}>{t('comp-SwapInput-tip-5')}</a></div>
            </div>,
            confirmText:'Close',
        })
    }

    const inputOver = () => {
	   const ba = fromToken == 'SP' ? profiles?.[1]?.tokens?.sp?.balance1 : profiles?.[1]?.tokens?.sol.balance1
	   if (fromAmount < ba) {
		  return ''
	   }
	   return 'darkred'
    }

    const tokenDecimal = (tokenAddr: string) => {
        const solanaAddr = "So11111111111111111111111111111111111111112"
        const spAddr = "Bzr4aEQEXrk7k8mbZffrQ9VzX6V3PAH4LvWKXkKppump"
        const usdcAddr = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        const usdtAddr = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
        const solanaDecimalPlaces = 9
        const usdtDecimalPlaces = 6
        const usdcDecimalPlaces = 6
        const spDecimalPlaces = 6
        switch(tokenAddr) {
            case usdtAddr: {
                return usdtDecimalPlaces
            }
            case solanaAddr: {
                return solanaDecimalPlaces
            }
            case spAddr: {
                return spDecimalPlaces
            }
            case usdcAddr: {
                return usdcDecimalPlaces
            }
            default: {
                return 18
            }
        }
    }

	const onChangeProcess = async () => {
		const fromAmountNumber = parseFloat(fromAmount)
		if (fromAmountNumber > 0 && fromAmountNumber !== lastOnChangeNumber ) {
			setLastOnChangeNumber(fromAmountNumber)
			const from = (fromToken === 'SOL') ? solanaAddr : spAddr
			const to = (fromToken === 'SOL') ? spAddr : solanaAddr
			const amount = ethers.parseUnits(fromAmount, tokenDecimal(from))

			const quoteResponse = await (await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${from}&outputMint=${to}&amount=${amount}&slippageBps=250`)).json()
			const out = ethers.formatUnits(quoteResponse.outAmount, tokenDecimal(to))
			const formated = formatNumber(out)
			setToAmount (formated)
		}
	}

    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        return 'Unknown error';
    };

    async function confirmTxWithTimeout(
        connection: Connection,
        txid: string,
        blockhash: string,
        lastValidBlockHeight: number,
        timeoutMs = 40000
    ): Promise<RpcResponseAndContext<SignatureResult>> {
        return await Promise.race([
            connection.confirmTransaction({
                signature: txid,
                blockhash,
                lastValidBlockHeight
            }, "confirmed"),
            new Promise((_, reject) => setTimeout(() => reject(new Error("确认交易超时")), timeoutMs))
        ]) as Promise<RpcResponseAndContext<SignatureResult>>;
    }

	const convertToAmountUSD = (): string => {
		const toNum = parseFormattedNumber(toAmount)
		
		const total = toNum * (quotation as any)[toToken]
		return formatNumber(total.toFixed(4))
	}

	const convertFromAmountUSD = (): string => {
		const toNum = parseFormattedNumber(fromAmount)
		const total = toNum * (quotation as any)[fromToken]
		if ( isNaN(total) ) {
			return '0'
		}
		return formatNumber(total.toFixed(4))
	}

    const getTransaction = (tx: string, SOLANA_CONNECTION: Connection, count = 0): Promise<false|string> => new Promise( async resolve => {
        count ++
        const thash = await SOLANA_CONNECTION.getTransaction(tx,{ maxSupportedTransactionVersion: 0 })
        if (!thash) {
            if (count < 6) {
                return setTimeout(async () => {
                    return resolve(await getTransaction(tx, SOLANA_CONNECTION, count))
                }, 1000 * 10 )
            }
            setIsRedeemProcessLoading(false);
            Modal.alert({
                bodyClassName:styles.failModalWrap,
                content: <div className={styles.failModal}>
                    <Result
                        status='error'
                        title={t('comp-SwapInput-tip-1')}
                    />
                    <div className={styles.description}>{t('comp-SwapInput-tip-3')}</div>
                </div>,
                confirmText:'Close',
            })
            return ;
        }
        if (thash.meta?.err) {
            setIsRedeemProcessLoading(false);
            Modal.alert({
                bodyClassName:styles.failModalWrap,
                content: <div className={styles.failModal}>
                    <Result
                        status='error'
                        title={t('comp-SwapInput-tip-1')}
                    />
                    <div className={styles.description}>{getErrorMessage(thash.meta.err)}</div>
                </div>,
                confirmText:'Close',
            })
            return ;
        }
        setIsRedeemProcessLoading(false);
        Modal.alert({
            bodyClassName:styles.successModalWrap,
            content: <div className={styles.successModal}>
                <Result
                    status='success'
                    title={t('comp-SwapInput-tip-2')}
                />
                <div className={styles.description}>{t('comp-SwapInput-tip-4')}!</div>
                <div className={styles.link}><a onClick={()=>{openWebLinkNative('https://solscan.io/tx/'+thash,isIOS,isLocalProxy)}}>{t('comp-SwapInput-tip-5')}</a></div>
            </div>,
            confirmText:'Close',
        })
        setFromAmount('0');
        await refreshSolanaBalances();
        return ;
    })

    

    const swapTokens =  (from: string, to: string, privateKey: string, fromEthAmount: string): Promise<false|string> => new Promise(async resolve => {
        const wallet = Keypair.fromSecretKey(bs58.decode(privateKey))
        const amount = ethers.parseUnits(fromEthAmount, tokenDecimal(from))
        const _node1 = globalAllNodes[Math.floor(Math.random() * (globalAllNodes.length - 1))]
        const SOLANA_CONNECTION = new Connection(`https://${_node1.domain}/solana-rpc`, "confirmed")
		let signature = ''
        try{
            const quoteResponse = await (await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${from}&outputMint=${to}&amount=${amount}&slippageBps=250`)).json()
            const { swapTransaction } = await (
                await fetch('https://quote-api.jup.ag/v6/swap', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        wrapUnwrapSOL: false,
						dynamicComputeUnitLimit: true,
						prioritizationFeeLamports: null,
                        quoteResponse,
                        userPublicKey: wallet.publicKey.toString()
                    })
                })).json()

            const swapTransactionBuf = Buffer.from(swapTransaction, 'base64')
            const transaction = VersionedTransaction.deserialize(swapTransactionBuf)
            // get the latest block hash
            
            transaction.sign([wallet])
            signature = await SOLANA_CONNECTION.sendRawTransaction(transaction.serialize())
            
            await SOLANA_CONNECTION.confirmTransaction({
				signature,
				blockhash: transaction.message.recentBlockhash,
				lastValidBlockHeight: await SOLANA_CONNECTION.getBlockHeight()
			}, 'confirmed')

			return resolve(signature)

            
        } catch (ex: any){
			if (signature) {
				await new Promise(resolve=> setTimeout(() => resolve(true), 5000))
				const status = await SOLANA_CONNECTION.getSignatureStatus(signature)
				if (status.value && status.value.confirmationStatus === "confirmed") {
					
					return resolve(signature)
				}
			}
			
            setIsRedeemProcessLoading(false);
            Modal.alert({
                bodyClassName:styles.failModalWrap,
                content: <div className={styles.failModal}>
                    <Result
                        status='error'
                        title={t('comp-SwapInput-tip-1')}
                    />
                    <div className={styles.description}>{getErrorMessage(ex.message)}</div>
                </div>,
                confirmText:'Close',
            })
			return resolve(false)
			
        }   
    })

    const confirmClick = async () => {
      	// if (swapError||swapSuccess) {
      	// 	setSwapSuccess('')
      	// 	return setSwapError('')
      	// }
        setIsRedeemProcessLoading(true)
        const from = (fromToken === 'SOL') ? solanaAddr : spAddr
        const to = (fromToken === 'SOL') ? spAddr : solanaAddr

        const tx = await swapTokens(from, to, profiles?.[1]?.privateKeyArmor, fromAmount)

        setIsRedeemProcessLoading(false)
        if (tx) {
            showSuccess(tx);
            await refreshSolanaBalances()
            return setSwapSuccess(tx)
        }
        // setSwapError('Error!')
    }
  
    const toggleTokens=() =>{
        setFromToken((prev) => prev === "SP" ? "SOL" : "SP")
        setToToken((prev) => prev === "SP" ? "SOL" : "SP")

        setFromAmount('0')
        setToAmount('0.000000')
    }


    const useMax=()=>{
		const tokens = profiles?.[1]?.tokens;
        console.log(tokens,'tokens')
		if (!tokens) {
			return
		}
		const _val = fromToken === 'SOL'? (tokens?.sol?.balance1 || 0) : (tokens?.sp?.balance1 || 0)
		const val = (parseFloat(Math.floor(_val * 1000).toFixed(4))/1000).toFixed(4)
        // let val=fromToken === 'SOL'?(tokens?.sol?.balance1.toFixed(4)|| (0.0).toFixed(6)):(tokens?.sp?.balance1.toFixed(4) || (0.0).toFixed(6))
        setFromAmount(val);
    }
    
    const isDisabled=()=>{
        const isZeroOrNegative=(value:any)=> {
            // 转换为数字类型
            const num = Number(value);
            // 检查是否为有效数字且小于等于0
            return !isNaN(num) && num <= 0;
        }
        const isEmptyValue=isZeroOrNegative(profiles?.[1]?.tokens?.sol?.balance);
        return !showConfirm || (fromAmount=='0') || (!fromAmount) || isEmptyValue;
    }
  
    return (
        <div style={{display: 'flex', flexDirection: 'column', marginTop:"38px", alignItems:"center"}}>
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
                                        if (v <=0 ) {
                                            return setFromAmount(e.target.value)
                                        }
                                        setFromAmount(v.toString())
										onChangeProcess()
                                    }}
                                    placeholder="0"
                                />
                                <p className='box-text' style={{fontSize: '14px'}}>$ {convertFromAmountUSD()}</p>
                            </>
                        )
                    }
                </div>

                <div style={{justifyContent:'center', textAlign: 'left', display: 'flex', flexDirection: 'column', maxWidth:"146px", gap: '8px'}}>
                    <SPSelector option={fromToken} onChange={()=>{}} />
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
                    <p className='box-text' style={{fontSize: '14px'}}>$ {convertToAmountUSD()}</p>
                </div>

                <div style={{justifyContent:'flex-end', textAlign: 'left', display: 'flex', flexDirection: 'column', maxWidth:"146px", gap: '8px'}}>
                    <SPSelector option={toToken} onChange={()=>{}} />
                </div>
            </div>
            
            {isRedeemProcessLoading?<div className={styles.loadingWrap}>
                <SpinLoading style={{ '--size': '48px' }} />
                <div className={styles.text}>{t('comp-comm-LoadingRing')}</div>
            </div>:''}
            <div style={{color:'gery',margin:'5px 0 0'}}>{t('comp-SwapInput-tip-6')}</div>
			
				<Button className="swap-confirm-btn" onClick={confirmClick} loading={isRedeemProcessLoading} block color='primary' size='large' disabled={isDisabled()}>
					{t('comp-SwapInput-confirm')}
				</Button>
			
            
            <div style={{background:"#191919", borderRadius:"8px", padding:"4px", marginTop: "2rem", marginBottom:"24px" }}>
                <div style={{display:"flex"}}>
                    <p className="tab-selector" style={{background: tabSelector === "tokens" ? "#3F3F40" : "none"}} onClick={()=> setTabSelector('tokens')}>{t('comp-accountlist-assets')}</p>
                </div>
            </div>
            {tabSelector === "tokens" ? <TokenTab quotation={quotation} setTokenGraph={setTokenGraph} tokenData={tokenData} /> : <ActivityTab />}
        </div>
    )
}