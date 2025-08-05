import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './payWays.module.scss';
import { useTranslation } from 'react-i18next';
import PaySTRIPE from '../payStripe/PaySTRIPE'
import PayBNB from './../payBnb/PayBNB'
import PayBSC from './../payBsc/PayBSC';
import PayModal from './../payModal/PayModal';
import { Grid, Result, Modal, Collapse, SpinLoading } from 'antd-mobile';
import { ExclamationShieldOutline,RightOutline } from 'antd-mobile-icons';
import { useDaemonContext } from "./../../../providers/DaemonProvider";
import {getCryptoPay} from './../../../services/subscription';
import { waitingPaymentStatus  } from './../../../services/wallets';
import {openWebLinkNative} from './../../../api';
import { BankOutlined } from '@ant-design/icons';

interface params {
    defaultVisible: boolean;
}

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX';

const PayWays = ({defaultVisible}:params) => {
    const { t, i18n } = useTranslation();
    const [cryptoName, setCryptoName] = useState<cryptoName>('BSC USDT');
    const { isIOS, profiles, selectedPlan, setSelectedPlan, setPaymentKind, isLocalProxy, setSuccessNFTID, setSubscriptionVisible } = useDaemonContext();
    const [codeVisible, setCodeVisible] = useState(false);
    const [QRWallet, setQRWallet] = useState('');
    const [showPrice, setShowPrice] = useState('');
    const [timeoutError, setTimeoutError] = useState(false);
    const [showBuyClusloading, setShowBuyClusloading] = useState(false);
    const navigate = useNavigate();

    const stripePay = () => {
        setSelectedPlan('3')
        setPaymentKind(2)
        setSubscriptionVisible(true)
    }

    const purchaseBluePlan = async (token: cryptoName) => {
        setShowBuyClusloading(true);
        const res = await getCryptoPay(token, '2860')
        if (!res) {
            return 
        }
        setShowBuyClusloading(false);
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
                <Collapse 
                    defaultActiveKey={defaultVisible?['1']:[]}
                    arrow={<RightOutline />}
                >
                    <Collapse.Panel key='1' title={<><BankOutlined style={{marginRight:3}} />立即充值</>}>
                        <div className={styles.desc}>
                            <ExclamationShieldOutline className={styles.icon} />{t('wallet-checkin-deposit-detail-1')}
                        </div>
                        <div className={styles.desc} style={{marginTop:5}}>
                            <ExclamationShieldOutline className={styles.icon} />{t('wallet-checkin-deposit-detail-2')}
                        </div>
                        <div className={styles.descItem}>
                            {t('wallet-checkin-deposit-detail-3')}
                        </div>
                        <div className={styles.descItem}>
                            {t('wallet-checkin-deposit-detail-4')}
                        </div>
                        <div className={styles.descItem}>
                            {t('wallet-checkin-deposit-detail-5')}
                        </div>
                        <div className={styles.payList}>
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
                    </Collapse.Panel>
                </Collapse>
            </div> 
            {showBuyClusloading?<div className={styles.loading}><div className={styles.spinBox}><SpinLoading /></div></div>:''} 
            <PayModal visible={codeVisible} setVisible={setCodeVisible} QRWallet={QRWallet} cryptoName={cryptoName} showPrice={showPrice} timeoutError={timeoutError} setTimeoutError={setTimeoutError} purchaseBluePlan={purchaseBluePlan} /> 
        </> 
    );
};

export default PayWays;