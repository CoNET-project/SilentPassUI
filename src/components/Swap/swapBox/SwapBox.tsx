import { useState, useRef, useEffect } from 'react';
import styles from './swapBox.module.scss';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import { ReactComponent as SolanaToken } from './../assets/solana-token.svg';
import { ReactComponent as ConetToken } from './../assets/sp-token.svg';
import { ReactComponent as UsdtToken } from './../assets/usdt-token.svg';
import { ReactComponent as SwapBtn } from './../assets/swap-icon-black.svg';
import { Input,Button,Popup,Empty,Modal,Result,Skeleton,SpinLoading } from 'antd-mobile';
import { DownOutline } from 'antd-mobile-icons';
import * as motion from "motion/react-client";
import { getPriceFromDown2Up, getPriceFromUp2Down, swapTokens } from './../../../services/subscription';
import {getRandomNode,allNodes} from './../../../services/mining';
import { refreshSolanaBalances } from './../../../services/wallets';
import {openWebLinkNative} from './../../../api';
import { Connection, Keypair, Commitment, VersionedTransaction,RpcResponseAndContext, SignatureResult } from "@solana/web3.js";
import bs58 from "bs58";
import { ethers } from "ethers";

const SwapBox = ({}) => {
    const { t, i18n } = useTranslation();
    const { profiles, isIOS, isLocalProxy } = useDaemonContext();
    const [rotation, setRotation] = useState(0);
    const [options, setOptions] = useState(['SP','SOL','USDT']);
    const [fromToken, setFromToken] = useState('SP');
    const [toToken, setToToken] = useState('SOL');
    const [fromAmount, setFromAmount] = useState('0');
    const [toAmount, setToAmount] = useState('0');
    const [fromAmountLoading, setFromAmountLoading] = useState(false);
    const [toAmountLoading, setToAmountLoading] = useState(false);
    const latestRequestId = useRef(0);
    const [visible, setVisible] = useState(false);
    const [showIsPay, setShowIsPay] = useState(true);
    const [errorInfo, setErrorInfo] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [sp2usdRatio, setSp2usdRatio] = useState(0);
    const [sol2usdRatio, setSol2usdRatio] = useState(0);

    useEffect(()=>{
        if(Number(calcBalance(fromToken,false)) < Number(fromAmount)){
            setErrorInfo(t('swap-asset-insufficient'));
        }
    },[fromToken,fromAmount])

    useEffect(()=>{
        if(allNodes&&allNodes.length){
            getRatio();
        }
    },[allNodes])

    const handleSwap=()=>{
        setFromToken(toToken);
        setToToken(fromToken);
        calcRelativeValue(toToken,fromToken,Number(fromAmount),'receive');
    }
    const renderTag=(type:string,showName:boolean=true)=>{
        switch(type) {
            case 'SP':
                return <><ConetToken className={styles.icon} />{showName?'SP':''}</>;
                break;
            case 'SOL':
                return <><SolanaToken className={styles.icon} />{showName?'SOL':''}</>;
                break;
            case 'USDT':
                return <><UsdtToken className={styles.icon} />{showName?'USDT':''}</>;
                break;
            default:
                return <><ConetToken className={styles.icon} />{showName?'SP':''}</>;
        }
    }
    const useMax=()=>{
        const tokens = profiles?.[1]?.tokens;
        if (!tokens) { return ; }
        const _val = (tokens?.[fromToken.toLowerCase()]?.balance1 || 0);
        const val = (parseFloat(Math.floor(_val * 1000).toFixed(4))/1000).toFixed(4);
        setFromAmount(val);
        calcRelativeValue(fromToken,toToken,Number(val),'receive');
    }
    const getRatio=async()=>{
        const SPRatio = await getPriceFromUp2Down(getMintAddr('USDT'),getMintAddr('SP'),100);
        const SOLRatio = await getPriceFromUp2Down(getMintAddr('USDT'),getMintAddr('SOL'),100);
        setSp2usdRatio(SPRatio?(BigNumber(100).dividedBy(BigNumber(SPRatio)).toNumber()):0);
        setSol2usdRatio(SOLRatio?(BigNumber(100).dividedBy(BigNumber(SOLRatio)).toNumber()):0);
    }
    const usdRatio=(type:string)=>{
        switch(type) {
            case 'SP':
                return sp2usdRatio;
                break;
            case 'SOL':
                return sol2usdRatio;
                break;
            case 'USDT':
                return new BigNumber(1).dividedBy(1);
                break;
            default:
                return '0';
        }
    }
    const getMintAddr=(type:string)=>{
        switch(type) {
            case 'SP':
                return 'Bzr4aEQEXrk7k8mbZffrQ9VzX6V3PAH4LvWKXkKppump';
                break;
            case 'SOL':
                return 'So11111111111111111111111111111111111111112';
                break;
            case 'USDT':
                return 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
                break;
            case 'USDC':
                return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
                break;
            default:
                return '';
        }
    }
    const calcRelativeValue = async (inputType: string, outputType: string, amount: number, resType:string) => {
        const safeTruncateTo6Decimals=(strNum:string) =>{
            if (!/^[-+]?\d*(\.\d*)?$/.test(strNum)) return '0'; // 防止非法字符串
            return strNum.replace(/^(-?\d+)(\.\d{0,6})?.*$/, (_, intPart, decimalPart) => {
                return intPart + (decimalPart || '');
            });
        }
        const requestId = ++latestRequestId.current; // 标记本次请求
        const inputMint=getMintAddr(inputType);
        const outputMint=getMintAddr(outputType);
        if(Number(amount)){
            if(resType == 'receive'){setToAmountLoading(true)}else{setFromAmountLoading(true)}
            const resultVal = await (resType == 'receive'?getPriceFromUp2Down(inputMint,outputMint,amount):getPriceFromDown2Up(inputMint,outputMint,amount));
            // 只有最新的一次请求才能设置结果
            if (requestId === latestRequestId.current) {
                if(resultVal){
                    if(resType == 'receive'){
                        setToAmount(safeTruncateTo6Decimals(resultVal));
                    }
                    if(resType == 'pay'){
                        setFromAmount(safeTruncateTo6Decimals(resultVal));
                    }
                }else{
                    if(resType == 'receive'){
                        setToAmount('0');
                        setErrorInfo(t('swap-asset-pay-invalid'));
                    }
                    if(resType == 'pay'){
                        setFromAmount('0');
                        setErrorInfo(t('swap-asset-receive-invalid'));
                    }
                }
                if(resType == 'receive'){setToAmountLoading(false)}else{setFromAmountLoading(false)}
            }
        }else{
            if(resType == 'receive'){
                setToAmount('0');
                setToAmountLoading(false);
            }
            if(resType == 'pay'){
                setFromAmount('0');
                setFromAmountLoading(false);
            }
        }
    }
    const calcName=(type:string)=>{
        switch(type) {
            case 'SP':
                return 'Silent Pass';
                break;
            case 'SOL':
                return 'Solana';
                break;
            case 'USDT':
                return 'USDT';
                break;
            default:
                return '--';
        }
    }
    const calcBalance=(type:string,showUnit:boolean=true)=>{
        switch(type) {
            case 'SP':
                return showUnit?<>{profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2)} SP</>:(profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2));
                break;
            case 'SOL':
                return showUnit?<>{profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(2)} SOL</>:(profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(2));
                break;
            case 'USDT':
                return showUnit?<>{profiles?.[1]?.tokens?.usdt?.balance || (0.0).toFixed(2)} USDT</>:(profiles?.[1]?.tokens?.usdt?.balance || (0.0).toFixed(2));
                break;
            default:
                return '--';
        }
    }
    const calcPrice=(type:string,showUnit:boolean=true)=>{
        switch(type) {
            case 'SP':
                return showUnit?<>${profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)}</>:(profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2));
                break;
            case 'SOL':
                return showUnit?<>${profiles?.[1]?.tokens?.sol?.usd || (0.0).toFixed(2)}</>:(profiles?.[1]?.tokens?.sol?.usd || (0.0).toFixed(2));
                break;
            case 'USDT':
                return showUnit?<>${profiles?.[1]?.tokens?.usdt?.usd || (0.0).toFixed(2)}</>:(profiles?.[1]?.tokens?.usdt?.usd || (0.0).toFixed(2));
                break;
            default:
                return '--';
        }
    }
    const generateOptions=()=>{
        if(showIsPay){
            return options.filter(item => Number(calcPrice(item,false)) !== 0);
        }else{
            return options;
        }
    }
    const handleSelect=(item:any)=>{
        if(showIsPay){
            if(fromToken !== item){
                if(toToken === item){
                    setFromToken(toToken);
                    setToToken(fromToken);
                    calcRelativeValue(toToken,fromToken,Number(fromAmount),'receive');
                }else{
                    setFromToken(item);
                    calcRelativeValue(item,toToken,Number(fromAmount),'receive');
                }
            }
        }else{
            if(toToken !== item){
                if(fromToken === item){
                    setFromToken(toToken);
                    setToToken(fromToken);
                    calcRelativeValue(item,fromToken,Number(toAmount),'pay');
                }else{
                    setToToken(item);
                    calcRelativeValue(fromToken,item,Number(toAmount),'pay');
                }
            }
        }
        setVisible(false);
    }
    const isDisabled=()=>{
        if(Number(calcBalance(fromToken,false)) < Number(fromAmount)){
            return true;
        }
        return !toAmount || !fromAmount || toAmount=='0' || fromAmount=='0';
    }

	
    const showSuccess=(txid:any)=>{
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
    const showFail=(err:any)=>{
        Modal.alert({
            bodyClassName:styles.failModalWrap,
            content: (<div className={styles.failModal}>
                <Result
                    status='error'
                    title={t('comp-SwapInput-tip-1')}
                />
                <div className={styles.description}>{getErrorMessage(err)}</div>
            </div>),
            confirmText:'Close',
        })
    }
    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        return 'Unknown error';
    };
    const tokenDecimal = (type:string) => {
        switch(type) {
            case 'SP':
                return 6;
                break;
            case 'SOL':
                return 9;
                break;
            case 'USDT':
                return 6;
                break;
            case 'USDC':
                return 6;
                break;
            default:
                return 18;
        }
    }
    // const swapTokens =  (from: string, to: string, privateKey: string, fromEthAmount: string) => new Promise(async resolve => {
    //     const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
    //     const amount = ethers.parseUnits(fromEthAmount, tokenDecimal(fromToken));
    //     const SOLANA_CONNECTION = new Connection(`http://${getRandomNode()}/solana-rpc`, "confirmed");
    //     let signature = '';
    //     try{
    //         const quoteResponse = await (await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${from}&outputMint=${to}&amount=${amount}&slippageBps=250`)).json();
    //         const { swapTransaction } = await (
    //             await fetch('https://quote-api.jup.ag/v6/swap', {
    //                 method: 'POST',
    //                 headers: {'Content-Type': 'application/json'},
    //                 body: JSON.stringify({
    //                     wrapUnwrapSOL: false,
    //                     dynamicComputeUnitLimit: true,
    //                     prioritizationFeeLamports: null,
    //                     quoteResponse,
    //                     userPublicKey: wallet.publicKey.toString()
    //                 })
    //             })).json();
    //         const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    //         const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    //         // get the latest block hash
    //         transaction.sign([wallet]);
    //         signature = await SOLANA_CONNECTION.sendRawTransaction(transaction.serialize());
    //         await SOLANA_CONNECTION.confirmTransaction({
    //             signature,
    //             blockhash: transaction.message.recentBlockhash,
    //             lastValidBlockHeight: await SOLANA_CONNECTION.getBlockHeight()
    //         }, 'confirmed');
    //         return resolve(signature);
    //     } catch (ex: any){
    //         if (signature) {
    //             const status = await SOLANA_CONNECTION.getSignatureStatus(signature);
    //             if (status.value && status.value.confirmationStatus === "confirmed") {
    //                 return resolve(signature);
    //             }
    //         }
    //         setSubmitLoading(false);
    //         showFail(ex.message);
    //         return resolve(false);
    //     }   
    // });
    const handleSubmit=async()=>{
        setSubmitLoading(true);
        const tx = await swapTokens(getMintAddr(fromToken), getMintAddr(toToken), profiles?.[1]?.privateKeyArmor, fromAmount);
        setSubmitLoading(false);
        if (tx) {
            showSuccess(tx);
            refreshSolanaBalances();
        }
    }

    return (
        <>
            <div className={styles.swapBox}>
                <div className={styles.swapItem}>
                    <div className={styles.view}>
                        <label className={styles.label}>{t('swap-asset-pay')}</label>
                        <div className={styles.inputWrap}>
                            <Input 
                                className={styles.input} 
                                placeholder="0" 
                                value={fromAmount} 
                                clearable 
                                type="number" 
                                step='0.01' 
                                onChange={(val) => {
                                    // 只要输入符合小数点后6位以内的规则，就接受
                                    if (/^\d*(\.\d{0,6})?$/.test(val)) {
                                        setFromAmount(val);
                                        const num = Number(val);
                                        // 如果不是空字符串并且是有效数值，再计算
                                        if (val !== '' && !isNaN(num)) {
                                            calcRelativeValue(fromToken, toToken, num, 'receive');
                                        }
                                    }
                                }}
                                onBlur={() => {
                                    if (fromAmount === '') return;
                                    // 去掉前导 0，但保留合法格式
                                    let formatted = fromAmount.replace(/^0+(?=\d)/, ''); // 去掉非小数的前导0
                                    if (/^\./.test(formatted)) {
                                        formatted = '0' + formatted; // 处理 .5 -> 0.5
                                    }
                                    if (formatted.endsWith('.')) {
                                        formatted = formatted.slice(0, -1); // 去掉末尾小数点
                                    }
                                    setFromAmount(formatted);
                                }}
                            />
                            {fromAmountLoading?<div className={styles.skeletonWrap}><Skeleton animated className={styles.skeleton} /></div>:''}
                        </div>
                        <div className={styles.price}>
                            ${
                                new BigNumber(usdRatio(fromToken))
                                .multipliedBy(fromAmount)
                                .decimalPlaces(6, BigNumber.ROUND_DOWN)
                                .toFixed()
                            }
                        </div>
                    </div>
                    <div className={styles.operation}>
                        <div className={styles.type} onClick={()=>{setShowIsPay(true);setVisible(true)}}>{renderTag(fromToken)}<DownOutline className={styles.arrow} /></div>
                        <div className={styles.allBtn} onClick={useMax}>{t('swap-asset-Max')}</div>
                    </div>
                </div>
                <div className={styles.swapItem}>
                    <div className={styles.view}>
                        <label className={styles.label}>{t('swap-asset-Receive')}</label>
                        <div className={styles.inputWrap}>
                            <Input 
                                className={styles.input} 
                                placeholder="0" 
                                value={toAmount} 
                                clearable 
                                type="number" 
                                step='0.01' 
                                onChange={(val) => {
                                    if (/^\d*(\.\d{0,6})?$/.test(val)) {
                                        setToAmount(val);
                                        const num = Number(val);
                                        // 如果不是空字符串并且是有效数值，再计算
                                        if (val !== '' && !isNaN(num)) {
                                            calcRelativeValue(toToken,fromToken,num,'pay');
                                        }
                                    }
                                }}
                                onBlur={() => {
                                    if (toAmount === '') return;
                                    // 去掉前导 0，但保留合法格式
                                    let formatted = toAmount.replace(/^0+(?=\d)/, ''); // 去掉非小数的前导0
                                    if (/^\./.test(formatted)) {
                                        formatted = '0' + formatted; // 处理 .5 -> 0.5
                                    }
                                    if (formatted.endsWith('.')) {
                                        formatted = formatted.slice(0, -1); // 去掉末尾小数点
                                    }
                                    setToAmount(formatted);
                                }}
                            />
                            {toAmountLoading?<div className={styles.skeletonWrap}><Skeleton animated className={styles.skeleton} /></div>:''}
                        </div>
                        <div className={styles.price}>
                            ${
                                new BigNumber(usdRatio(toToken))
                                .multipliedBy(toAmount)
                                .decimalPlaces(6, BigNumber.ROUND_DOWN)
                                .toFixed()
                            }
                        </div>
                    </div>
                    <div className={styles.operation}>
                        <div className={styles.type} onClick={()=>{setShowIsPay(false);setVisible(true)}}>{renderTag(toToken)}<DownOutline className={styles.arrow} /></div>
                    </div>
                </div>
                <motion.button
                    className={styles.swapBtnWrap}
                    animate={{ rotate: rotation }}
                    transition={{ duration: 0.6 }}
                    onTap={() => {if(rotation % 180 == 0){setRotation(rotation + 180)}}}
                >
                    <div className={styles.swapBtn} onClick={handleSwap}><SwapBtn /></div>
                </motion.button>
            </div>
            <div className={styles.swapTip}>{t('swap-asset-tip')}</div>
            <Button onClick={handleSubmit} className={(isDisabled() && !(toAmount=='0' && fromAmount=='0'))?styles.confirmBtnError:styles.confirmBtn} disabled={isDisabled() || fromAmountLoading || toAmountLoading} loading={submitLoading} block color='primary' size='large'>{(isDisabled() && !(toAmount=='0' && fromAmount=='0'))?errorInfo:t('swap-asset-confirm')}</Button>
            {submitLoading?<div className={styles.loadingWrap}>
                <SpinLoading color="#f1f1f1" style={{ '--size': '48px' }} />
                <div className={styles.text}>{t('comp-comm-LoadingRing')}</div>
            </div>:''}
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                onClose={() => {setVisible(false)}}
                bodyStyle={{
                    borderTopLeftRadius: '5vw',
                    borderTopRightRadius: '5vw',
                    minHeight: '40vh',
                    overflow:'hidden'
                }}
            >
                <div className={styles.selectWrap}>
                    {generateOptions().length?<div className={styles.selectList}>
                        {generateOptions().map((item,index)=>{
                            return (
                                <div className={styles.item} key={index} onClick={()=>{handleSelect(item)}}>
                                    <div className={styles.itemInfo}>
                                        {renderTag(item,false)}
                                        <div className={styles.label}>
                                            <div className={styles.name}>{calcName(item)}</div>
                                            <div className={styles.balance}>{calcBalance(item)}</div>
                                        </div>
                                    </div>
                                    <div className={styles.itemPrice}>{calcPrice(item)}</div>
                                </div>
                            )
                        })}
                    </div>:<Empty
                        style={{ padding: '30px 0' }}
                        imageStyle={{ width: 128 }}
                        description={t('swap-asset-select-empty')}
                    />}
                    <Button className={styles.closeBtn} onClick={()=>{setVisible(false)}} block color='primary' size='large'>{t('swap-asset-select-close')}</Button>
                </div>
            </Popup>
        </>
    );
};

export default SwapBox;