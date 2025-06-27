import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './appleModal.module.css';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CrownBadge } from './../assets/crown.svg'
import { Modal,Button } from 'antd-mobile';
import { LeftOutline,RightOutline } from 'antd-mobile-icons';
import { useDaemonContext } from './../../../providers/DaemonProvider';

interface plan {
    total: string
    publicKey: string
    Solana: string
    transactionId: string
    productId: string
}

interface modalParams {
    appleVisible:boolean;
    setAppleVisible:React.Dispatch<React.SetStateAction<boolean>>;
}

const AppleModal = ({appleVisible,setAppleVisible}:modalParams) => {
    const {profiles,setSelectedPlan} = useDaemonContext();
    const navigate = useNavigate();

    const startSubscription = () => {
        if (!profiles ||profiles.length < 2) {
            return
        }

        const planObj: plan = {
            publicKey: profiles[0].keyID,
            Solana: profiles[1].keyID,
            total: '3100',
            transactionId: '',
            productId: ''
        }
        setSelectedPlan('3100')
        const base64VPNMessage = btoa(JSON.stringify(planObj));
        
        window?.webkit?.messageHandlers["pay"]?.postMessage(base64VPNMessage)
        
        navigate("/subscription")
    
    }

    return (
        <Modal
            visible={appleVisible}
            closeOnAction
            disableBodyScroll={false}
            closeOnMaskClick={true}
            onClose={() => {setAppleVisible(false)}}
            className={styles.appleModal}
            content={<div className={styles.appleCont}>
                <div className={styles.title}>
                    <CrownBadge /> Genesis Circle NFT
                </div>
                <div className={styles.desc}>
                    Unlock Lifetime Access to Silent Pass VPN
                </div>
                <div className={styles.desc}>
                    Your exclusive NFT Passport for unlimited private browsing.
                </div>
                <div>
                    One-Time Payment
                    $41.99
                    1 Device · No Renewal · Lifetime Access
                </div>
                <div className={styles.subscription}>
                    <Button className={styles.btn} block fill='solid' onClick={() => startSubscription()}>Start Purchase</Button>
                </div>
                <div className={styles.extraInfo}>
                    <div className={styles.title}>Purchase Information:</div>
                    <ul className={styles.list}>
                        <li><RightOutline className={styles.icon} /><span>This is a one-time purchase.</span></li>
                        <li><RightOutline className={styles.icon} /><span>No subscription or renewal.</span></li>
                        <li><RightOutline className={styles.icon} /><span>Includes lifetime VPN access for one device.</span></li>
                        <li><RightOutline className={styles.icon} /><span>Payment will be charged to your Apple ID at confirmation.</span></li>
                        <li><RightOutline className={styles.icon} /><span>By purchasing, you agree to Apple’s Terms of Use and Privacy Policy.</span></li>
                    </ul>
                </div>
                <LeftOutline className={styles.close} onClick={() => {setAppleVisible(false)}} />
            </div>}
        /> 
    );
};

export default AppleModal;