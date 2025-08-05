import { useState, useRef, useEffect } from 'react';
import styles from './failed.module.scss';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Decline } from './../assets/decline.svg';
import { Button } from 'antd-mobile';
import { useDaemonContext } from "@/providers/DaemonProvider";

const Failed = ({}) => {
    const { t, i18n } = useTranslation();
    const { subscriptionVisible, setSubscriptionVisible} = useDaemonContext();

    return (
        <div className={styles.failed}>
            <div className={styles.icon}><Decline /></div>
            <div className={styles.result}>{t('comp-comm-declined')}</div>
            <div className={styles.noHash}>{t('comp-comm-notxHash')}</div>
            <div className={styles.contact}>{t('comp-comm-contactUs')}</div>
            <div className={styles.oper}>
                <Button onClick={()=>{setSubscriptionVisible(false)}} block color='primary' size='large'>{t('comp-comm-backToWallet')}</Button>
            </div>
        </div>
    );
};

export default Failed;