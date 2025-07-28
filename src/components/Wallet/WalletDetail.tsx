import { useState, useRef, useEffect } from 'react';
import styles from './walletDetail.module.scss';
import { useTranslation } from 'react-i18next';
import RedeemBtn from './redeemBtn/RedeemBtn';
import CheckInBtn from './checkInBtn/CheckInBtn';
import Brief from './brief/Brief';
import MainWallet from './mainWallet/MainWallet';
import SPWallet from './spWallet/SPWallet';
import Genesis from './genesis/Genesis';
import Referrals from './referrals/Referrals';
import Passport from './passport/Passport';
import Backups from './backups/Backups';
import { List, Modal, Result, Button } from 'antd-mobile';
import { CheckCircleFill } from 'antd-mobile-icons';
import { useDaemonContext } from './../../providers/DaemonProvider';
import { getPassportTitle } from "./../../utils/utils";
import { ReactComponent as CrownBadge } from './assets/GC.svg';
import { ReactComponent as ArmBand } from './assets/blue-badge.svg';
import {openWebLinkNative} from './../../api';

const WalletDetail = ({}) => {
    const { t, i18n } = useTranslation();
    const { successNFTID, setSuccessNFTID, activePassport, isIOS, isLocalProxy } = useDaemonContext();
    const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState<boolean>(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);

    useEffect(() => {
        if (!isNaN(Number(successNFTID))) {
            const successNFTIDNum = parseInt(successNFTID)
            if (successNFTIDNum > 100) {
                setIsSuccessModalOpen(true)
            }
        }else{
            if(successNFTID.length > 4){
                Modal.alert({
                    bodyClassName:styles.successModalWrap,
                    content: <div className={styles.successModal}>
                        <Result
                            status='success'
                            title='Send successful'
                        />
                        <div className={styles.link}><a onClick={()=>{openWebLinkNative('https://solscan.io/tx/'+successNFTID,isIOS,isLocalProxy)}}>View transactions</a></div>
                    </div>,
                    confirmText:'Close',
                })
            }
        }
    }, [successNFTID])

    return (
        <div className={styles.wallet}>
            <h1 className={styles.title}>
                {t('wallet-title')}
                <div className={styles.armBand}>
                    {getPassportTitle(activePassport) === 'passport_Monthly'?<ArmBand />:''}
                    {getPassportTitle(activePassport) === 'passport_Annually'?<ArmBand />:''}
                    {getPassportTitle(activePassport) === 'passport_Infinite'?<CrownBadge />:''}
                </div>
            </h1>
            <Brief />
            <div className={styles.list}>
                <List style={{'--active-background-color':'#343434'}}>
                    <MainWallet />
                    <Backups />
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
                    <div className={styles.operateBar}><Button className={styles.btn} block color='primary' size='large' onClick={()=>{setIsSuccessModalOpen(false);setSuccessNFTID('0')}}>{t('wallet-account-buy-success-close')}</Button></div>
                </div>}
            />
        </div>
    );
};

export default WalletDetail;