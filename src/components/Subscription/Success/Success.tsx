import { useState, useRef, useEffect } from 'react';
import styles from './success.module.scss';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PurchaseCheck } from './../assets/purchase-check.svg';
import { Button } from 'antd-mobile';
import { useDaemonContext } from "@/providers/DaemonProvider";

interface params {
    price: string;
    gasfee: string;
}

const Success = ({ price, gasfee }:params) => {
    const { t, i18n } = useTranslation();
    const { subscriptionVisible, setSubscriptionVisible} = useDaemonContext();

    return (
        <div className={styles.success}>
            <div className={styles.icon}><PurchaseCheck /></div>
            <div className={styles.result}>{t('subscription-transaction-success')}</div>
            <div className={styles.aboutInfo}>
                <div className={styles.item}>
                    <label className={styles.label}>{t('subscription-transaction-passport')}</label>
                    <div className={styles.val}>{price} SP</div>
                </div>
                <div className={styles.item}>
                    <label className={styles.label}>{t('subscription-transaction-gas')}</label>
                    <div className={styles.val}>{parseFloat(gasfee).toFixed(6)} SOL</div>
                </div>
                <div className={styles.total}>
                    <label className={styles.label}>{t('subscription-transaction-total')}</label>
                    <div className={styles.val}>{parseFloat(price).toFixed(0)} SP + {parseFloat(gasfee).toFixed(6)} SOL</div>
                </div>
            </div>
            <div className={styles.oper}>
                <Button onClick={()=>{setSubscriptionVisible(false)}} block color='primary' size='large'>{t('comp-comm-backToWallet')}</Button>
            </div>
        </div>
    );
};

export default Success;