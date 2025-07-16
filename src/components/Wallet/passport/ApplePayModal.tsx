import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './applePayModal.module.css';
import { useTranslation } from 'react-i18next';
import { Popup,CheckList,Button,NavBar } from 'antd-mobile';
import { ExclamationTriangleOutline,RightOutline } from 'antd-mobile-icons';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import { getPassportTitle } from "./../../../utils/utils";
import {openWebLinkNative} from './../../../api';

interface ApplePayModalParams {
    visible:boolean;
    setVisible:React.Dispatch<React.SetStateAction<boolean>>;
}

interface plan {
    total: string
    publicKey: string
    Solana: string
    transactionId: string
    productId: string
}

const ApplePayModal = ({visible,setVisible}:ApplePayModalParams) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { isIOS, isLocalProxy, profiles, selectedPlan, setSelectedPlan, activePassport, setPaymentKind } = useDaemonContext();
    
    const handleChange=(value: (string | number)[])=>{
        if(value.length) setSelectedPlan(String(value[0]));
    }
    const startSubscription = () => {
        if (!profiles ||profiles.length < 2) {
            return
        }
        const planObj: plan = {
            publicKey: profiles[0].keyID,
            Solana: profiles[1].keyID,
            total: (isIOS?(selectedPlan === '12' ? '2': selectedPlan):selectedPlan),
            transactionId: '',
            productId: ''
        }
        const base64VPNMessage = btoa(JSON.stringify(planObj));
        window?.webkit?.messageHandlers["pay"]?.postMessage(base64VPNMessage);
        if(isIOS){
            setPaymentKind(3);
        }
        navigate("/subscription");
    }

    return (
        <Popup
            visible={visible}
            onMaskClick={() => {setVisible(false)}}
            position='right'
            bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
            className={styles.applePayModal}
            closeOnMaskClick={true}
        >
            <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>Apple Pay</NavBar>
            <div className={styles.bd}>
                <div className={styles.iosType}>
                    <div className={styles.title}>{t('passport-pay-plan-ios-title')}</div>
                    <div className={styles.specs}>
                        <CheckList value={[selectedPlan]} onChange={handleChange}>
                            <CheckList.Item value='1'>
                                <div className={styles.specItem}>
                                    <div className={styles.name}>{t('passport-pay-plan-ios-plan-name-2')}</div>
                                    <div className={styles.price}>$3.29 / {t('passport-pay-plan-ios-plan-unit-2')}</div>
                                    <div className={styles.desc}>{t('passport-pay-plan-ios-plan-desc-2')}</div>
                                </div>
                            </CheckList.Item>
                            <CheckList.Item value='12'>
                                <div className={styles.specItem}>
                                    <div className={styles.name}>{t('passport-pay-plan-ios-plan-name-1')}</div>
                                    <div className={styles.price}>$32.49 / {t('passport-pay-plan-ios-plan-unit-1')}</div>
                                    <div className={styles.desc}>{t('passport-pay-plan-ios-plan-desc-1')}</div>
                                </div>
                            </CheckList.Item>
                        </CheckList>
                    </div>
                    {(getPassportTitle(activePassport)==='passport_Freemium' && activePassport?.expiresDays!=='0')?<>
                        <div className={styles.tips}>{t('passport-pay-plan-ios-tips-1')}</div>
                        <div className={styles.warning}><ExclamationTriangleOutline className={styles.icon} />{t('passport-pay-plan-ios-tips-2')}</div>
                    </>:''}
                    <div className={styles.subscription}>
                        <Button className={styles.btn} block fill='solid' onClick={() => startSubscription()}>{t('passport-pay-btn')}</Button>
                    </div>
                    <div className={styles.extraInfo}>
                        <div className={styles.title}>{t('passport-pay-plan-ios-extra-title')}:</div>
                        <ul className={styles.list}>
                            <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-ios-extra-item-1')}</span></li>
                            <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-ios-extra-item-2')}</span></li>
                            <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-ios-extra-item-3')}</span></li>
                            <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-ios-extra-item-4')}</span></li>
                            <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-ios-extra-item-5')} <a onClick={()=>{openWebLinkNative("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",isIOS,isLocalProxy)}}>{t('passport-pay-plan-ios-extra-item-6')}</a>, {t('passport-pay-plan-ios-extra-item-7')} <a onClick={()=>{openWebLinkNative("https://silentpass.io/privacy-cookies/",isIOS,isLocalProxy)}}>{t('passport-pay-plan-ios-extra-item-8')}</a></span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </Popup>   
    );
};

export default ApplePayModal;