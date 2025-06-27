import { useState, useRef, useEffect } from 'react';
import styles from './walletDetail.module.css';
import { useTranslation } from 'react-i18next';
import RedeemBtn from './redeemBtn/RedeemBtn';
import CheckInBtn from './checkInBtn/CheckInBtn';
import Brief from './brief/Brief';
import MainWallet from './mainWallet/MainWallet';
import SPWallet from './spWallet/SPWallet';
import Genesis from './genesis/Genesis';
import Referrals from './referrals/Referrals';
import Passport from './passport/Passport';
import { List, Modal, Result, Button } from 'antd-mobile';
import { CheckCircleFill } from 'antd-mobile-icons';
import { useDaemonContext } from './../../providers/DaemonProvider';
import { getPassportTitle } from "./../../utils/utils";
import { ReactComponent as CrownBadge } from './assets/GC.svg';

const WalletDetail = ({}) => {
    const { t, i18n } = useTranslation();
    const { successNFTID, setSuccessNFTID, activePassport } = useDaemonContext();
    const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState<boolean>(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);

    useEffect(() => {
        if (successNFTID > 100) {
            setIsSuccessModalOpen(true);
        }
    }, [successNFTID])

    return (
        <div className={styles.wallet}>
            <h1 className={styles.title}>
                {t('wallet-title')}
                <div className={styles.armBand}>
                    {getPassportTitle(activePassport) === 'passport_Monthly'?'':''}
                    {getPassportTitle(activePassport) === 'passport_Annually'?'':''}
                    {getPassportTitle(activePassport) === 'passport_Infinite'?<CrownBadge />:''}
                </div>
            </h1>
            <Brief />
            <div className={styles.list}>
                <List style={{'--active-background-color':'#343434'}}>
                    <MainWallet />
                    <SPWallet />
                    <Genesis />
                    <Passport />
                    <Referrals />
                </List>
            </div>
            <div className={styles.operateBar}>
                <RedeemBtn isRedeemProcessLoading={isRedeemProcessLoading} setIsRedeemProcessLoading={setIsRedeemProcessLoading} />
                <CheckInBtn />
            </div>
            <Modal
                className={styles.successModal}
                visible={isSuccessModalOpen}
                content={<div className={styles.successModalCont}>
                    <Result
                        status='success'
                        title={t('wallet-account-buy-success-title')}
                        description={
                            <div className={styles.resInfos}>
                                <div className={styles.desc}>{t('wallet-account-buy-success-desc-1')}</div>
                                <div className={styles.val}>{t('wallet-account-buy-success-desc-2')}:<span className={styles.id}>#{successNFTID}</span></div>
                            </div>
                        }
                        icon={<CheckCircleFill />}
                    />
                    <div className={styles.operateBar}><Button className={styles.btn} block color='primary' size='large' onClick={()=>{setIsSuccessModalOpen(false);setSuccessNFTID(0)}}>{t('wallet-account-buy-success-close')}</Button></div>
                </div>}
            />
        </div>
    );
};

export default WalletDetail;