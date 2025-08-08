import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './brief.module.scss';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd-mobile';
import { BankcardOutline } from 'antd-mobile-icons';
import { getRewordStaus } from '@/services/wallets';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { getExpirationDate, getPassportTitle } from "@/utils/utils";
import { ReactComponent as CrownBadge } from '@/components/Wallet/assets/GC.svg';
import { ReactComponent as ArmBand } from '@/components/Wallet/assets/blue-badge.svg';

const Brief = ({}) => {
    const { profiles, activePassport } = useDaemonContext();
    const { t, i18n } = useTranslation();

    return (
        <div className={styles.briefWrap}>
            <div className={styles.iconBox}>
                <div className={styles.armBand}>
                    {getPassportTitle(activePassport) === 'passport_Freemium'?<BankcardOutline className={styles.icon} />:''}
                    {getPassportTitle(activePassport) === 'passport_Monthly'?<ArmBand />:''}
                    {getPassportTitle(activePassport) === 'passport_Annually'?<ArmBand />:''}
                    {getPassportTitle(activePassport) === 'passport_Infinite'?<CrownBadge />:''}
                </div>
            </div>
            <div className={styles.briefCont}>
                <div className={styles.type}><label>{t('wallet-account-brief-label')}：</label>{t(getPassportTitle(activePassport))}</div>
                <div className={styles.time}><label>{t('wallet-account-brief-remain')}：</label>
                    {
                        profiles?.[0]?.activePassport?.expires ?
                            <p>{getExpirationDate(activePassport, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'))}</p>
                            : '--'
                    }
                </div>
            </div>
        </div>
    );
};

export default Brief;