import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './appleModal.module.scss';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CrownBadge } from './../assets/crown.svg'
import { Modal,Button,Tag } from 'antd-mobile';
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
    const {profiles,setSelectedPlan,setPaymentKind,isIOS,setSubscriptionVisible} = useDaemonContext();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const startSubscription = () => {
        if (!profiles ||profiles.length < 2||!isIOS) {
            return
        }
        const planObj = {
            publicKey: profiles[0].keyID,
            Solana: profiles[1].keyID,
            total: '3100',
            transactionId: '',
            productId: ''
        }
        const base64VPNMessage = btoa(JSON.stringify(planObj));
        window?.webkit?.messageHandlers["pay"]?.postMessage(base64VPNMessage)
        setPaymentKind(3);
        setSubscriptionVisible(true);
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
                <div className={styles.hd}>
                    <CrownBadge /> {t('passport-pay-plan-apple-modal-title')}
                </div>
                <div className={styles.desc}>
                    {t('passport-pay-plan-apple-modal-desc-1')}
                </div>
                <div className={styles.desc}>
                    {t('passport-pay-plan-apple-modal-desc-2')}
                </div>
                <div className={styles.spec}>
                    <div className={styles.item}><label>{t('passport-pay-plan-apple-modal-spec-label')}</label><span className={styles.price}>$ 41.99</span></div>
                    <div className={styles.tags}>
                        <Tag className={styles.tag} color='rgba(45,183,245,0.5)'>{t('passport-pay-plan-apple-modal-spec-tag-1')}</Tag>
                        <Tag className={styles.tag} color='rgba(45,183,245,0.5)'>{t('passport-pay-plan-apple-modal-spec-tag-2')}</Tag>
                        <Tag className={styles.tag} color='rgba(45,183,245,0.5)'>{t('passport-pay-plan-apple-modal-spec-tag-3')}</Tag>
                    </div>
                </div>
                <div className={styles.subscription}>
                    <Button className={styles.btn} block fill='solid' onClick={() => startSubscription()}>{t('passport-pay-plan-apple-modal-btn')}</Button>
                </div>
                <div className={styles.extraInfo}>
                    <div className={styles.title}>{t('passport-pay-plan-apple-modal-extra-title')}:</div>
                    <ul className={styles.list}>
                        <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-apple-modal-extra-list-1')}</span></li>
                        <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-apple-modal-extra-list-2')}</span></li>
                        <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-apple-modal-extra-list-3')}</span></li>
                        <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-apple-modal-extra-list-4')}</span></li>
                        <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-apple-modal-extra-list-5')}</span></li>
                    </ul>
                </div>
                <LeftOutline className={styles.close} onClick={() => {setAppleVisible(false)}} />
            </div>}
        /> 
    );
};

export default AppleModal;