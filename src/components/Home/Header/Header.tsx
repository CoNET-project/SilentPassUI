import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from '@/components/Home/Header/header.module.scss';
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from '@/providers/DaemonProvider';
import { ReactComponent as ConetToken } from '@/components/Home/assets/conet-token.svg';
import { ReactComponent as SpToken } from '@/components/Home/assets/sp-token.svg';
import { getPassportTitle, isInfinite, getExpirationDate } from '@/utils/utils';
import { InformationCircleOutline } from 'antd-mobile-icons';
import { Modal } from 'antd-mobile';

const Header = ({}) => {
    const OneDayInSeconds = 86400;
    const { t, i18n } = useTranslation();
    const { miningData, profiles, activePassportUpdated, activePassport, setStatusVisible } = useDaemonContext();
    const [passportTimeLeft, setPassportTimeLeft] = useState<number>(0);

    useEffect(() => {
        const passportExpiration = profiles?.[0]?.activePassport?.expires
        if (passportExpiration) {
            const timeLeft = passportExpiration - Math.floor(Date.now() / 1000)
            setPassportTimeLeft(timeLeft)
        }
    }, [activePassportUpdated, profiles]);

    const getColor=()=>{
        return passportTimeLeft < OneDayInSeconds ? passportTimeLeft <= 0 ? "#b3261e" : "#f0b90b" : isInfinite(activePassport) ? '#cd7f32' : "#05a21e"
    }
    const handleShowStatus=()=>{
        setStatusVisible(true);
        // Modal.alert({
        //     className:styles.statusModal,
        //     closeOnMaskClick:true,
        //     content: (<div className={styles.statusInfo}>
        //         <div className={styles.passport}>
        //             <label className={styles.label}>{t('comp-PassportInfoPopup-1')}</label>
        //             <div className={styles.val} style={{color: isInfinite(activePassport) ? '#cd7f32' : ''}}>{profiles?.[0]?.activePassport ? <>{t(getPassportTitle(activePassport))}</> : '--'}</div>
        //         </div>
        //         <div className={styles.passport}>
        //             <label className={styles.label}>{t('comp-PassportInfoPopup-2')}</label>
        //             <div className={styles.val}>{profiles?.[0]?.activePassport?.expires ?<>{getExpirationDate(activePassport, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'))}</>: '--'}</div>
        //         </div>
        //     </div>)
        // })
    }

    return (
        <div className={styles.header}>
            <div className={styles.onlineNum}>
                <ConetToken /> {miningData?.online ? miningData.online : '--'}
            </div>
            <div className={styles.status} onClick={handleShowStatus}>
                <div className={styles.dot} style={{background:getColor()}}></div>
                {profiles?.[0]?.activePassport ? <>{t(getPassportTitle(activePassport))}</> : '--'}
                <InformationCircleOutline className={styles.icon} />
            </div>
            <div className={styles.totalUsers}>
                <SpToken />{miningData?.totalUsers ? miningData.totalUsers : '--'}
            </div>
        </div>    
    );
};

export default Header;