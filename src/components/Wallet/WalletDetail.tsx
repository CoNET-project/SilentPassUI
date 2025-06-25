import { useState, useRef, useEffect } from 'react';
import styles from './walletDetail.module.css';
import { useTranslation } from 'react-i18next';
import RedeemBtn from './redeemBtn/RedeemBtn';
import CheckInBtn from './checkInBtn/CheckInBtn';
import Brief from './brief/Brief';
import MainWallet from './mainWallet/MainWallet';
import SPWallet from './spWallet/SPWallet';
import Genesis from './genesis/Genesis';
import { List } from 'antd-mobile';

const WalletDetail = ({}) => {
    const { t, i18n } = useTranslation();
    const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState<boolean>(false);

    return (
        <div className={styles.wallet}>
            <h1 className={styles.title}>{t('wallet-title')}</h1>
            <Brief />
            <div className={styles.list}>
                <List style={{'--active-background-color':'#343434'}}>
                    <MainWallet />
                    <SPWallet />
                    <Genesis />
                </List>
            </div>
            <div className={styles.operateBar}>
                <RedeemBtn isRedeemProcessLoading={isRedeemProcessLoading} setIsRedeemProcessLoading={setIsRedeemProcessLoading} />
                <CheckInBtn />
            </div>
        </div>
    );
};

export default WalletDetail;