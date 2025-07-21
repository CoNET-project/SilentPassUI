import { useState, useRef, useEffect } from 'react';
import styles from './swapBox.module.scss';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import { ReactComponent as SolanaToken } from './../assets/solana-token.svg';
import { ReactComponent as ConetToken } from './../assets/sp-token.svg';
import { ReactComponent as UsdtToken } from './../assets/usdt-token.svg';
import { ReactComponent as SwapBtn } from './../assets/swap-icon-black.svg';
import { Input,Button } from 'antd-mobile';
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

    const handleSwap=()=>{

    }
    const renderTag=(type:string)=>{
        switch(type) {
            case 'SP':
                return <><ConetToken className={styles.icon} />SP</>;
                break;
            case 'SOL':
                return <><SolanaToken className={styles.icon} />SOL</>;
                break;
            case 'USDT':
                return <><UsdtToken className={styles.icon} />USDT</>;
                break;
            default:
                return <><ConetToken className={styles.icon} />SP</>;
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
            const resultVal = await getPrice(inputMint,outputMint,amount);
            // 只有最新的一次请求才能设置结果
            if (requestId === latestRequestId.current && resultVal) {
                if(resType == 'receive'){
                    setToAmount(resultVal);
                }
                if(resType == 'pay'){
                    setFromAmount(resultVal);
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
                        <div className={styles.type}>{renderTag(fromToken)}<DownOutline className={styles.arrow} /></div>
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
                        <div className={styles.type}>{renderTag(toToken)}<DownOutline className={styles.arrow} /></div>
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
            <Button className={styles.confirmBtn} block color='primary' size='large'>{t('swap-asset-confirm')}</Button>
        </>
    );
};

export default SwapBox;