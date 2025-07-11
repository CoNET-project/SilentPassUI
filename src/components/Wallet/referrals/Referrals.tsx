import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './referrals.module.css';
import { useTranslation } from 'react-i18next';
import { List,Popup,NavBar,Empty } from 'antd-mobile';
import { LockFill,ExclamationCircleFill } from 'antd-mobile-icons';
import { CoNET_Data } from './../../../utils/globals';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import { getExpirationDate } from './../../../utils/utils';
import ReferralCont from './ReferralCont';
import Inviters from './../inviters/Inviters';
import ReferralIcon from './../assets/Referrals.png';

const Referrals = ({}) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState<boolean>(false);
    const { profiles,activePassport,setIsSelectPassportPopupOpen } = useDaemonContext();

    
    const nft = parseInt(profiles?.[0]?.activePassport?.nftID)
    const expiration = nft === 0 || getExpirationDate(profiles?.[0]?.activePassport?.expires, t('passport_unlimit'), t('passport_notUsed'), t('passport_day'), t('passport_hour')) === '00:00:00' ? true : false
    const freePassportActive = nft > 0 && Number(profiles[0].activePassport.expiresDays) <= 7 && Number(profiles[0].activePassport.expiresDays) > 0;


    return (
        <>
            <List.Item onClick={() => {setVisible(true)}}>
                <div className={styles.item}>
                    <div className={styles.icon}><img src={ReferralIcon} width="25" height="25" /></div>
                    <div className={styles.text}>
                        <div className={styles.title}>{t('referrals-title')}</div>
                        {/*<div className={styles.subTitle}>{t('referrals-extra-title')}</div>*/}
                    </div>
                </div>
            </List.Item>
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.popup}
                closeOnMaskClick={true}
            >
                <div className={styles.modalWrap}>
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('referrals-title')}</NavBar>
                    <div className={styles.bd}>
                        {/*{(freePassportActive || expiration)?<div className={styles.warning}><ExclamationCircleFill className={styles.icon} />{t('referrals-extra-title')}</div>:''}*/}
                        <ReferralCont />
                        <Inviters />
                    </div>
                </div>
            </Popup>
        </>     
    );
};

export default Referrals;