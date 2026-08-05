import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@/components/Wallet/walletDetail.module.scss';
import RedeemBtn from '@/components/Wallet/redeemBtn/RedeemBtn';
import CheckInBtn from '@/components/Wallet/checkInBtn/CheckInBtn';
import GbDashboard from '@/components/Wallet/gbDashboard/GbDashboard';
import { Modal, Result, Button } from 'antd-mobile';
import { CheckCircleFill } from 'antd-mobile-icons';
import { useDaemonContext } from '@/providers/DaemonProvider';
import {openWebLinkNative} from '@/api';

const WalletDetail = ({}) => {
    const { t } = useTranslation();
    const { successNFTID, setSuccessNFTID, isIOS, isLocalProxy, setSubscriptionVisible } = useDaemonContext();
    const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState<boolean>(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);

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
			<div className={styles.dashboardWrap}>
				<GbDashboard />
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