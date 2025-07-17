import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './brief.module.scss';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd-mobile';
import { getRewordStaus } from './../../../services/wallets';
import { useDaemonContext } from "./../../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle } from "./../../../utils/utils";

const Brief = ({}) => {
    const { profiles, activePassport } = useDaemonContext();
    const { t, i18n } = useTranslation();

    return (
        <div className={styles.briefWrap}>
            <div className={styles.type}><label>{t('wallet-account-brief-label')}：</label>{t(getPassportTitle(activePassport))}</div>
            <div className={styles.time}><label>{t('wallet-account-brief-remain')}：</label>
                {
                    profiles?.[0]?.activePassport?.expires ?
                        <p>{getExpirationDate(activePassport, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'))}</p>
                        : '--'
                }
            </div>
        </div>
    );
};

export default Brief;