import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './payWays.module.scss';
import { useTranslation } from 'react-i18next';
import PaySTRIPE from '../payStripe/PaySTRIPE'
import PayBNB from './../payBnb/PayBNB'
import PayBSC from './../payBsc/PayBSC';
import PayModal from './../payModal/PayModal';
import { Grid, Result, Modal } from 'antd-mobile';
import { useDaemonContext } from "./../../../providers/DaemonProvider";
import {getCryptoPay} from './../../../services/subscription';
import { waitingPaymentStatus  } from './../../../services/wallets';
import {openWebLinkNative} from './../../../api';

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX';

const PayWays = ({}) => {
    const { t, i18n } = useTranslation();
    const [cryptoName, setCryptoName] = useState<cryptoName>('BSC USDT');
    const { isIOS, profiles, selectedPlan, setSelectedPlan, setPaymentKind, isLocalProxy, setSuccessNFTID } = useDaemonContext();
    const [codeVisible, setCodeVisible] = useState(false);
    const [QRWallet, setQRWallet] = useState('');
    const [showPrice, setShowPrice] = useState('');
    const [timeoutError, setTimeoutError] = useState(false);
    const navigate = useNavigate();

    const stripePay = () => {
        setSelectedPlan('3')
        setPaymentKind(2)
        navigate("/subscription")
    }

    const purchaseBluePlan = async (token: cryptoName) => {
        const res = await getCryptoPay(token, '2860')
        if (!res) {
            return 
        }
        showQrModal(res.transferNumber,res.wallet,token)
        
        const waiting = await waitingPaymentStatus ()
        setCodeVisible(false)
        if (!waiting) {
            return
        }
        showSuccess(waiting)
    }
    const showQrModal=(price:any,qrVal:string,token: cryptoName)=>{
        setCryptoName(token);
        setTimeoutError(false);
        setShowPrice(price);
        setQRWallet(qrVal);
        setCodeVisible(true);
    }

    const showSuccess=(signature:string)=>{
        setCodeVisible(false);
        Modal.alert({
            bodyClassName:styles.successModalWrap,
            content: <div className={styles.successModal}>
                <Result
                    status='success'
                    title={t('wallet-checkin-deposit-success-title')}
                />
                <div className={styles.description}>
                    {t('wallet-checkin-deposit-success-detail')}
                </div>
                <div className={styles.link}><a onClick={()=>{openWebLinkNative('https://solscan.io/tx/'+signature,isIOS,isLocalProxy)}}>{t('wallet-checkin-deposit-success-link')}</a></div>
            </div>,
            confirmText:t('wallet-account-buy-success-close'),
        })
    }

    return (
        <>
            <div className={styles.payWays}>
                <Grid columns={3} gap={5}>
                    <Grid.Item>
                        <PaySTRIPE stripeClick={stripePay} />
                    </Grid.Item>
                    <Grid.Item>
                        <PayBNB purchaseBluePlan={purchaseBluePlan} />
                    </Grid.Item>
                    <Grid.Item>
                        <PayBSC purchaseBluePlan={purchaseBluePlan} />
                    </Grid.Item>
                </Grid>
            </div>  
            <PayModal visible={codeVisible} setVisible={setCodeVisible} QRWallet={QRWallet} cryptoName={cryptoName} showPrice={showPrice} timeoutError={timeoutError} setTimeoutError={setTimeoutError} purchaseBluePlan={purchaseBluePlan} /> 
        </> 
    );
};

export default PayWays;