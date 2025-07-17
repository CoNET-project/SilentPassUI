import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './payModal.module.scss';
import { useTranslation } from 'react-i18next';
import { Toast,Modal,Ellipsis } from 'antd-mobile';
import { LeftOutline,ClockCircleFill,ExclamationCircleOutline } from 'antd-mobile-icons';
import QRCode from './../../QRCode';
import CopyBtn from './../copyBtn/CopyBtn';
import Countdown from 'react-countdown';

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX';

interface payModalParams {
    visible: boolean; 
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
    QRWallet: string;
    cryptoName: cryptoName;
    showPrice: string;
    timeoutError: boolean; 
    setTimeoutError: React.Dispatch<React.SetStateAction<boolean>>;
    purchaseBluePlan:(token: cryptoName) => Promise<void>;
}

const PayModal = ({visible,setVisible,QRWallet, cryptoName, showPrice, timeoutError, setTimeoutError, purchaseBluePlan}:payModalParams) => {
    const { t, i18n } = useTranslation();
    const [countTime, setCountTime] = useState(Date.now() + 3600000);

    useEffect(()=>{
        if(visible){
            setCountTime(Date.now() + 3600000);
        }else{
            setCountTime(Date.now());
        }
    },[visible])

    const handleRefresh=()=>{
        setCountTime(Date.now() + 3600000);
        purchaseBluePlan(cryptoName);
    }
    const pad = (num: number) => String(num).padStart(2, '0');
    const renderer=({days,hours,minutes,seconds,completed}: {
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        completed: boolean;
    })=>{
        if(completed){
            setTimeoutError(true);
            return <span className={styles.countTime}><b>00</b>:<b>00</b></span>
        }else{
            setTimeoutError(false);
            return <span className={styles.countTime}><b>{pad(minutes)}</b>:<b>{pad(seconds)}</b></span>
        }
    }

    return (
        <>
        <Modal
            visible={visible}
            closeOnAction
            disableBodyScroll={false}
            closeOnMaskClick={true}
            onClose={() => {setVisible(false)}}
            className={styles.payModal}
            content={<div className={styles.payCont}>
                <div className={styles.hd}>{t('genesis-pay-modal-title')}</div>
                <div className={styles.countdown}><ClockCircleFill /> <Countdown key={countTime} date={countTime} renderer={renderer} /></div>
                <div className={styles.tips}><ExclamationCircleOutline /> {t('genesis-pay-modal-tip-1')} {cryptoName} {t('genesis-pay-modal-tip-2')}</div>
                <div className={styles.code}>
                    {QRCode(QRWallet)}
                    {timeoutError?<div className={styles.timeout} onClick={handleRefresh}>刷新</div>:''}
                </div>
                <div className={styles.address}>
                    <label><Ellipsis direction='middle' content={QRWallet} /></label><div className={styles.copyBtn}><CopyBtn copyVal={QRWallet} /></div>
                </div>
                <div className={styles.total}>
                    <label>{t('genesis-pay-modal-label')}</label><div className={styles.val}>{showPrice} {cryptoName}</div>
                </div>
                    
                <LeftOutline className={styles.close} onClick={() => {setVisible(false)}} />
            </div>}
        />  
        </>
    );
};

export default PayModal;