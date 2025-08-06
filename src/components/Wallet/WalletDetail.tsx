import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@/components/Wallet/walletDetail.module.scss';
import RedeemBtn from '@/components/Wallet/redeemBtn/RedeemBtn';
import CheckInBtn from '@/components/Wallet/checkInBtn/CheckInBtn';
import Brief from '@/components/Wallet/brief/Brief';
import MainWallet from '@/components/Wallet/mainWallet/MainWallet';
import SPWallet from '@/components/Wallet/spWallet/SPWallet';
import Genesis from '@/components/Wallet/genesis/Genesis';
import Referrals from '@/components/Wallet/referrals/Referrals';
import Passport from '@/components/Wallet/passport/Passport';
import Backups from '@/components/Wallet/backups/Backups';
import Stake from '@/components/Wallet/stake/Stake';
import { List, Modal, Result, Button } from 'antd-mobile';
import { CheckCircleFill } from 'antd-mobile-icons';
import { useDaemonContext } from '@/providers/DaemonProvider';
import { getPassportTitle } from "@/utils/utils";
import { ReactComponent as CrownBadge } from '@/components/Wallet/assets/GC.svg';
import { ReactComponent as ArmBand } from '@/components/Wallet/assets/blue-badge.svg';
import {openWebLinkNative} from '@/api';

const WalletDetail = ({}) => {
    const { t, i18n } = useTranslation();
    const { successNFTID, setSuccessNFTID, activePassport, isIOS, isLocalProxy, setSubscriptionVisible } = useDaemonContext();
    const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState<boolean>(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
    const [stakeVisible, setStakeVisible] = useState<boolean>(false);

    useEffect(() => {
        if (!isNaN(Number(successNFTID))) {
            const successNFTIDNum = parseInt(successNFTID)
            if (successNFTIDNum > 100) {
                setIsSuccessModalOpen(true);
                setSubscriptionVisible(false);
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
                    <SPWallet stakeVisible={stakeVisible} setStakeVisible={setStakeVisible} />
                    <Genesis />
                    <Passport />
                    <Referrals />
                </List>
            </div>
            <div className={styles.operateBar}>
                <RedeemBtn isRedeemProcessLoading={isRedeemProcessLoading} setIsRedeemProcessLoading={setIsRedeemProcessLoading} />
                <CheckInBtn />
                <div className={styles.stakeBtn}>
                    <Button onClick={()=>{
						// setStakeVisible(true)
					}} disabled block color='primary' fill='solid'>{t('stake-title')}</Button>
                </div>
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
            <Stake visible={stakeVisible} setVisible={setStakeVisible} />
        </div>
    );
};

export default WalletDetail;