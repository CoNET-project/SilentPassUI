import { useState, useRef, useEffect } from 'react';
import styles from './passport.module.scss';
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from "./../../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle } from "./../../../utils/utils";

const Passport = ({}) => {
    const { t, i18n } = useTranslation();
    const { profiles, activePassport } = useDaemonContext();
    
    return (
        <div className={styles.passport}>
            <div className={styles.item}>
                <label className={styles.label}>{t('comp-PassportInfoPopup-1')}</label>
                <div className={styles.val}>{t(getPassportTitle(activePassport))}</div>
            </div>
            <div className={styles.item}>
                <label className={styles.label}>{t('comp-PassportInfoPopup-2')}</label>
                <div className={styles.val}>
                    { profiles?.[0]?.activePassport?.expires ? getExpirationDate(activePassport, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour')): '--' }
                </div>
            </div>
        </div>
    );
};

export default Passport;