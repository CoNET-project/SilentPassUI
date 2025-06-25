import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './genesis.module.css';
import { useTranslation } from 'react-i18next';
import { List,Modal,SpinLoading,Toast } from 'antd-mobile';
import { LockFill,ExclamationCircleFill,LeftOutline } from 'antd-mobile-icons';
import { CoNET_Data } from './../../../utils/globals';
import { ReactComponent as CrownBadge } from './../assets/GC.svg';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import {getCryptoPay} from './../../../services/subscription';
import { waitingPaymentReady,changeActiveNFT } from './../../../services/wallets';
import PayBNB from './../payBnb/PayBNB';
import PayBSC from './../payBsc/PayBSC';
import PayALI from './../payAli/PayALI';
import PayWECHAT from './../payWechat/PayWECHAT';
import PaySTRIPE from './../payStripe/PaySTRIPE';
import PayModal from './../payModal/PayModal';

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX';

const Genesis = ({}) => {
    const { t, i18n } = useTranslation();
    const {profiles, setSuccessNFTID, isIOS, isLocalProxy} = useDaemonContext();
    const [visible, setVisible] = useState<boolean>(false);
    const [codeVisible, setCodeVisible] = useState(false);
    const [cryptoName, setCryptoName] = useState<cryptoName>('BSC USDT');
    const [QRWallet, setQRWallet] = useState('');
    const [showPrice, setShowPrice] = useState('');
    const [showBuyClusloading, setShowBuyClusloading] = useState(false);
    const [timeoutError, setTimeoutError] = useState(false);
    const [payUrl, setPayUrl] = useState('https://cashier.alphapay.ca/commodity/details/order/5728/100001644');

    const purchaseBluePlan = async (token: cryptoName) => {
        const profile: profile = profiles[0];
        const agentWallet = profile.referrer||'';
        setShowBuyClusloading(true);
        setCryptoName(token);
        const res = await getCryptoPay(token, '3100');
        setShowBuyClusloading(false);
        if (!res?.wallet||!res?.transferNumber) {
            Toast.show({
                icon: 'fail',
                content: t('genesis-pay-request-error')
            });
            return ;
        }
        setVisible(false);
        setTimeoutError(false);
        setShowPrice(res?.transferNumber)
        setQRWallet(res.wallet)
        setCodeVisible(true);

        const waiting = await waitingPaymentReady (res?.wallet)
        if (!waiting?.status) {
            Toast.show({
                icon: 'fail',
                content: waiting?.error
            });
            return ;
        }
        setSuccessNFTID(waiting.status)
        changeActiveNFT(waiting.status)
        setQRWallet('')
        setShowPrice('')
    }
    const payClick = () => {
        if (window?.webkit?.messageHandlers && isIOS && !isLocalProxy ) {
            return window?.webkit?.messageHandlers["openUrl"]?.postMessage(payUrl)
        } else 
        //@ts-ignore
        if (window?.AndroidBridge && AndroidBridge?.receiveMessageFromJS) {
            const base = btoa(JSON.stringify({cmd: 'openUrl', data: payUrl}))
            //  @ts-ignore
            return AndroidBridge?.receiveMessageFromJS(base)
        } else {
            window.open(payUrl, '_blank')
        }
        
    }

    return (
        <>
            <List.Item onClick={() => {setVisible(true)}}>
                <div className={styles.item}>
                    <div className={styles.icon}><CrownBadge /></div>
                    <div className={styles.text}>
                        <div className={styles.title}>{t('genesis-title')}</div>
                        <div className={styles.subTitle}>$31</div>
                    </div>
                </div>
            </List.Item>
            <Modal
                visible={visible}
                closeOnAction
                disableBodyScroll={false}
                closeOnMaskClick={true}
                onClose={() => {setVisible(false)}}
                className={styles.genesisModal}
                content={<div className={styles.genesisCont}>
                    <div className={styles.hd}>{t('genesis-title')}</div>
                    <div className={styles.character}>{t('genesis-charater-1')}</div>
                    <div className={styles.character}>{t('genesis-charater-2')}</div>
                    <div className={styles.icon}><CrownBadge /></div>
                    <div className={styles.price}>$31</div>
                    <div className={styles.rights}>{t('genesis-charater-3')}</div>
                    <div className={styles.rights}>{t('genesis-charater-4')}</div>
                    <div className={styles.rights}>{t('genesis-charater-5')}</div>
                    <div className={styles.label}>{t('genesis-pay-ways')}</div>
                    <div className={styles.payMethods}>
                        <PayBNB purchaseBluePlan={purchaseBluePlan} />
                        <PayBSC purchaseBluePlan={purchaseBluePlan} />
                        <PayALI payClick={payClick} />
                        <PayWECHAT payClick={payClick} />
                        <PaySTRIPE />
                    </div>

                    <LeftOutline className={styles.close} onClick={() => {setVisible(false)}} />
                    {showBuyClusloading?<div className={styles.loading}><div className={styles.spinBox}><SpinLoading /></div></div>:''}
                </div>}
            />
            <PayModal visible={codeVisible} setVisible={setCodeVisible} QRWallet={QRWallet} cryptoName={cryptoName} showPrice={showPrice} timeoutError={timeoutError} setTimeoutError={setTimeoutError} purchaseBluePlan={purchaseBluePlan} />
        </>     
    );
};

export default Genesis;