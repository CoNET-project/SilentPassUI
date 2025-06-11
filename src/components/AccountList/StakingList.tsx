import {useState,useRef,useEffect} from 'react';
import { Popup,NavBar,Button,TextArea,Toast } from 'antd-mobile';
import { ClockCircleFill } from 'antd-mobile-icons';
import styles from './stakingList.module.css';
import { useTranslation } from 'react-i18next';
import _ from 'lodash';
import { CoNET_Data, setCoNET_Data, globalAllNodes } from "./../../utils/globals";

interface StakingListParams {
    simplifiedView:boolean;
}

const StakingList=({simplifiedView}:StakingListParams)=> {
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
        const num = parseFloat(match[1]);
        const unit = match[2].toUpperCase() as keyof typeof multiplier;
        return unit ? num * multiplier[unit] : num;
    }
    const getStaking=()=>{
        return CoNET_Data?.profiles[1]?.tokens?.sp
    }
    const getStakingList=()=>{
        return getStaking()?.staking;
    }

    return (
        <>
            {/*<div className="token-assets-item">
                <div className="token-assets-item-lt">
                    <div className="token-assets-item-label">
                        <div className="token-assets-item-label-name">
                            <SpToken width={20} height={20}/>
                            {
                                simplifiedView ? (
                                    <div>
                                        <p>Silent Pass</p>
                                        <p>{profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)}</p>
                                    </div>
                                ) : (
                                    <p>$SP</p>
                                )
                            }
                        </div>
                        {
                            !simplifiedView &&
                            <>
                                <div className='asset-second-line'>
                                    <p>{profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2)}</p>
                                    
                                </div>
                                {
                                    profiles?.[1]?.tokens?.sp?.staking?.length > 0 &&
                                    <>
                                        <div className='asset-second-line'>
                                            <p style={{color: "#6c4949"}}>{totalLocked(profiles[1].tokens.sp).toFixed(2)} 🔒</p>
                                        </div>
                                    </>
                                }
                            </>
                        }
                    </div>
                    <SendButton type={'$SP'} wallet={profiles?.[1]} isEthers={false} handleRefreshSolanaBalances={handleRefreshSolanaBalances} usd={simplifiedView ? (spInUsd * parseFloat(profiles?.[1]?.tokens?.sp?.usd || '0')).toFixed(2) :profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)} balance={simplifiedView?(profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)):(profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2))} />
                </div>
                <div className="token-assets-item-val">
                    {
                        simplifiedView ? (
                            <p>${(spInUsd * parseFloat(profiles?.[1]?.tokens?.sp?.usd || '0')).toFixed(2)}</p>
                        ) : (
            
                           <p>${profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)}</p>
        
                        )
                    }
                </div>
            </div>*/}

            {getStakingList()&&getStakingList()?.length?<div className={styles.stakingList}>
                <div className={styles.hd}><span>🔒已质押资产</span><span>总数20</span></div>
                <div className={styles.bd}>
                    {getStakingList()?.map((item,index)=>{
                        return (
                            <div className={styles.item} key={index}>
                                <span>{index+1}.</span>
                                <span>{convertStringToNumber(item.claimableAmount)}</span>
                                <span>{formatDateToCustomString(item.startTime)}</span> 
                                <span><ClockCircleFill /> 待解锁</span>
                            </div>
                        )
                    })}
                </div>
            </div> :''}
        </> 
    );
}


export default StakingList;