import {useState,useRef,useEffect} from 'react';
import { Popup,NavBar,Button,TextArea,Toast } from 'antd-mobile';
import { ClockCircleFill } from 'antd-mobile-icons';
import styles from './stakingList.module.css';
import { useTranslation } from 'react-i18next';
import _ from 'lodash';
import SendButton from './SendButton';
import { CoNET_Data, setCoNET_Data, globalAllNodes } from "./../../utils/globals";
import { ReactComponent as SpToken } from './assets/sp-token.svg';

interface StakingListParams {
    simplifiedView:boolean;
    profiles:any;
    handleRefreshSolanaBalances:any;
    spInUsd:any;
}

const StakingList=({simplifiedView,profiles,handleRefreshSolanaBalances,spInUsd}:StakingListParams)=> {
    const { t, i18n } = useTranslation();

    const formatDateToCustomString=(isoString: string | Date): string => {
        const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
        // 获取年月日部分
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        // 获取12小时制时间
        const options: Intl.DateTimeFormatOptions = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        const timeString = new Intl.DateTimeFormat('en-US', options)
            .format(date)
            .toUpperCase();
        return `${year}-${month}-${day} ${timeString}`;
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
        const num = parseFloat(match[1])
        const unit = match[2].toUpperCase() as keyof typeof multiplier;
        return unit ? num * multiplier[unit] : num;
    }
    const convertNumberToString = (num: number): string => {
        const units = [
            { value: 1e12, symbol: 'T' },
            { value: 1e9, symbol: 'B' },
            { value: 1e6, symbol: 'M' },
            { value: 1e3, symbol: 'K' }
        ];
        
        const absNum = Math.abs(num);
        for (const unit of units) {
            if (absNum >= unit.value) {
                return (num / unit.value).toFixed(2) + unit.symbol;
            }
        }
        return num.toFixed(2).toString();
    }

    const getStaking=()=>{
        return CoNET_Data?.profiles[1]?.tokens?.sp
    }
    const getStakingList=()=>{
        return getStaking()?.staking;
    }
    const totalLocked = (token: CryptoAsset) => {
        if (!token?.staking) {
            return 0
        }
        let total = 0
        token.staking.forEach(n => {
            total += n.totalAmount - n.claimedAmount
        })
        return total
    }
    const calcAvailablePrice = () => {
        const totalAmount = Number(profiles?.[1]?.tokens?.sp?.balance1 || 0);
        const lockAmount = Number(totalLocked(profiles?.[1].tokens.sp) || 0);
        const totalPrice = Number(profiles?.[1]?.tokens?.sp?.usd || 0);
        const rawValue = ((totalAmount - lockAmount) / totalAmount) * totalPrice;
        const decimalPlaces = (totalPrice.toString().split('.')[1] || '').length || 2;
        return totalPrice>0 ? Number(rawValue.toFixed(decimalPlaces)) : (0.0).toFixed(2);
    }

    return (
        <>
            <div className={styles.item}>
                <SpToken width={20} height={20}/>
                <div className={styles.infos}>
                    <div className={styles.infosItem}>
                        <span>{t('comp-accountlist-staking-total-assets')}</span>
                        <span>{convertNumberToString( Number( (profiles?.[1]?.tokens?.sp?.balance1 || (0.0)).toFixed(2) ) )}</span>
                        <span>${profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)}</span>
                    </div>
                    <div className={styles.infosItem}>
                        <span>{t('comp-accountlist-staking-total-available')}</span>
                        <span>{convertNumberToString(Number((profiles?.[1]?.tokens?.sp?.balance1 || (0.0)).toFixed(2)) - Number(totalLocked(profiles?.[1].tokens.sp).toFixed(2)) )}</span>
                        <span>${calcAvailablePrice()}</span>
                    </div>
                </div>
                <SendButton type={'$SP'} wallet={profiles?.[1]} isEthers={false} handleRefreshSolanaBalances={handleRefreshSolanaBalances} usd={simplifiedView ? (spInUsd * parseFloat(profiles?.[1]?.tokens?.sp?.usd || '0')).toFixed(2) :profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)} balance={simplifiedView?(profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)):(profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2))} />
            </div>
            {CoNET_Data&&getStakingList()&&getStakingList()?.length?<div className={styles.stakingList}>
                <div className={styles.hd}><span>🔒{t('comp-accountlist-staking-title')}</span><span>{t('comp-accountlist-staking-total-num')} {getStakingList()?.length}</span></div>
                <div className={styles.bd}>
                    {getStakingList()?.map((item,index)=>{
                        return (
                            <div className={styles.item} key={index}>
                                <span>{index+1}.</span>
                                <span>{convertNumberToString(Number(item.lockedAmount.toFixed(2)))}</span>
                                <span>{formatDateToCustomString(item.startTime)}</span> 
                                <span><ClockCircleFill /> {t('comp-accountlist-staking-locking')}</span>
                            </div>
                        )
                    })}
                </div>
            </div> :''}
        </> 
    );
}


export default StakingList;