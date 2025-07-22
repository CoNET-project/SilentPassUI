import { useState, useRef, useEffect } from 'react';
import styles from './swapBox.module.scss';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import { ReactComponent as SolanaToken } from './../assets/solana-token.svg';
import { ReactComponent as ConetToken } from './../assets/sp-token.svg';
import { ReactComponent as UsdtToken } from './../assets/usdt-token.svg';
import { ReactComponent as SwapBtn } from './../assets/swap-icon-black.svg';
import { Input,Button,Popup,Empty } from 'antd-mobile';
import { DownOutline } from 'antd-mobile-icons';
import * as motion from "motion/react-client";
import { getPrice } from './../../../services/subscription';

const SwapBox = ({}) => {
    const { t, i18n } = useTranslation();
    const { profiles } = useDaemonContext();
    const [rotation, setRotation] = useState(0);
    const [options, setOptions] = useState(['SP','SOL','USDT']);
    const [fromToken, setFromToken] = useState('SP');
    const [toToken, setToToken] = useState('SOL');
    const [fromAmount, setFromAmount] = useState('0');
    const [toAmount, setToAmount] = useState('0');
    const latestRequestId = useRef(0);
    const [visible, setVisible] = useState(false);
    const [showIsPay, setShowIsPay] = useState(true);
    const [errorInfo, setErrorInfo] = useState('');

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
    const convertStringToNumber=(str:string|number): number => {
        const multiplier: Record<'K'|'M'|'B'|'T', number> = {
            'K': 1e3,   // 千
            'M': 1e6,   // 百万
            'B': 1e9,   // 十亿
            'T': 1e12   // 万亿
        };

        // 提取数字部分和单位
        const match = (str+'').match(/^([\d.]+)([KMBT]?)$/i);
        if (!match) return NaN;

        const num = parseFloat(match[1]);
        const unit = match[2].toUpperCase() as keyof typeof multiplier;

        return unit ? num * multiplier[unit] : num;
    }
    const usdRatio=(type:string)=>{
        let target;
        switch(type) {
            case 'SP':
                target=profiles?.[1]?.tokens?.sp;
                return BigNumber(target?.usd).dividedBy(BigNumber(convertStringToNumber(target?.balance)));
                break;
            case 'SOL':
                target=profiles?.[1]?.tokens?.sol;
                return BigNumber(target?.usd).dividedBy(BigNumber(convertStringToNumber(target?.balance)));
                break;
            case 'USDT':
                return new BigNumber(1).dividedBy(1);
                break;
            default:
                return '0';
        }
    }
    const calcRelativeValue = async (inputType: string, outputType: string, amount: number, resType:string) => {
        const safeTruncateTo6Decimals=(strNum:string) =>{
            if (!/^[-+]?\d*(\.\d*)?$/.test(strNum)) return '0'; // 防止非法字符串
            return strNum.replace(/^(-?\d+)(\.\d{0,6})?.*$/, (_, intPart, decimalPart) => {
                return intPart + (decimalPart || '');
            });
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
                default:
                    return '';
            }
        }
        const requestId = ++latestRequestId.current; // 标记本次请求
        const inputMint=getMintAddr(inputType);
        const outputMint=getMintAddr(outputType);
        if(Number(amount)){
            //需修改 
            const resultVal = await getPrice(inputMint,outputMint,amount);
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
                        setErrorInfo('Pay值无效');
                    }
                    if(resType == 'pay'){
                        setFromAmount('0');
                        setErrorInfo('Receive值无效');
                    }
                }
            }
        }else{
            if(resType == 'receive'){
                setToAmount('0');
            }
            if(resType == 'pay'){
                setFromAmount('0');
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
                    // handleSwap();
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
                    // handleSwap();
                    setFromToken(toToken);
                    setToToken(fromToken);
                    calcRelativeValue(item,fromToken,Number(toAmount),'pay');
                }else{
                    setToToken(item);
                    calcRelativeValue(item,fromToken,Number(toAmount),'pay');
                }
            }
        }
        setVisible(false);
    }
    const isDisabled=()=>{
        if(Number(calcBalance(fromToken,false)) < Number(fromAmount)){
            // setErrorInfo('余额不足');
            return true;
        }
        return !toAmount || !fromAmount || toAmount=='0' || fromAmount=='0';
    }

    return (
        <>
            <div className={styles.swapBox}>
                <div className={styles.swapItem}>
                    <div className={styles.view}>
                        <label className={styles.label}>{t('swap-asset-pay')}</label>
                        <Input 
                            className={styles.input} 
                            placeholder="0" 
                            value={fromAmount} 
                            clearable 
                            type="number" 
                            step='0.01' 
                            onChange={(val) => {
                                const v = Number(val);
                                if (!/^\d*(\.\d{0,6})?$/i.test(val)) {return setFromAmount(fromAmount)}
                                if (v <0 ) {return setFromAmount(val)}
                                setFromAmount(v.toString())
                                calcRelativeValue(fromToken,toToken,v,'receive');
                            }}
                        />
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
                        <Input 
                            className={styles.input} 
                            placeholder="0" 
                            value={toAmount} 
                            clearable 
                            type="number" 
                            step='0.01' 
                            onChange={(val) => {
                                const v = Number(val);
                                if (!/^\d*(\.\d{0,6})?$/i.test(val)) {return setToAmount(toAmount)}
                                if (v <0 ) {return setToAmount(val)}
                                setToAmount(v.toString())
                                calcRelativeValue(toToken,fromToken,v,'pay');
                            }}
                        />
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
            <Button className={styles.confirmBtn} disabled={isDisabled()} block color='primary' size='large'>{t('swap-asset-confirm')}</Button>
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