import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './genesis.module.scss';
import { useTranslation } from 'react-i18next';
import { List,Modal,SpinLoading,Toast,Grid } from 'antd-mobile';
import { LockFill,ExclamationCircleFill,LeftOutline } from 'antd-mobile-icons';
import { CoNET_Data } from './../../../utils/globals';
import { ReactComponent as CrownBadge } from './../assets/GC.svg';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import {getCryptoPay} from './../../../services/subscription';
import { waitingPaymentStatus,changeActiveNFT, getSpClubMemberId } from './../../../services/wallets';
import PayBNB from './../payBnb/PayBNB';
import PayBSC from './../payBsc/PayBSC';
import PayALI from './../payAli/PayALI';
import PayWECHAT from './../payWechat/PayWECHAT';
import PaySTRIPE from './../payStripe/PaySTRIPE';
import PaySP from './../paySp/PaySP';
import PayAPPLE from './../payApple/PayAPPLE';
import PayModal from './../payModal/PayModal';
import AppleModal from './../payApple/AppleModal';
import {openWebLinkNative} from './../../../api';

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX';

const Genesis = ({}) => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const {profiles, setSuccessNFTID, setSelectedPlan, setPaymentKind, isIOS, isLocalProxy, setSubscriptionVisible} = useDaemonContext();
    const [visible, setVisible] = useState<boolean>(false);
    const [appleVisible, setAppleVisible] = useState<boolean>(false);
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
            return ;
        }
        setVisible(false);
        setTimeoutError(false);
        setShowPrice(res?.transferNumber)
        setQRWallet(res.wallet)
        setCodeVisible(true);

        const waiting = await waitingPaymentStatus ();
        if (waiting === false) {
            return 
        }
		const waitingNum = parseInt(waiting)
		if (isNaN(waitingNum)) {
			return
		}

        setSuccessNFTID(waiting)
		
        changeActiveNFT(waiting)
        setQRWallet('')
        setShowPrice('')
    }

    const payClick = () => {
        openWebLinkNative(payUrl,isIOS,isLocalProxy);
        Modal.show({
            className:styles.helperModal,
            content: (<div className={styles.helper}>
                <div className={styles.hd}>{t('comp-accountlist-SpClub-showAlipayPurchase')}</div>
                <div className={styles.bd}>{t('comp-accountlist-SpClub-showAlipayPurchase-1')}</div>
                <div className={styles.ft}>
                    {t('comp-accountlist-SpClub-showAlipayPurchase-2')}
                    <a onClick={() => {
                        //@ts-ignore
                        openWebLinkNative('https://vue.comm100.com/chatwindow.aspx?siteId=90007504&planId=efd822ce-7299-4fda-9fc1-252dd2f01fc5#',isIOS,isLocalProxy);
                    }}>{t('comp-comm-customerService')}</a>
                </div>
            </div>),
            closeOnMaskClick: true,
        });
    }
    const stripeClick = () => {
        setPaymentKind(2);
        setSelectedPlan('31');
        setSubscriptionVisible(true);
    }
    const SPClick = () => {
        setPaymentKind(1);
        setSelectedPlan('3100')
        setSubscriptionVisible(true);
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
                        <Grid columns={3} gap={5}>
                            <Grid.Item>
                                <PayBNB purchaseBluePlan={purchaseBluePlan} />
                            </Grid.Item>
                            <Grid.Item>
                                <PayBSC purchaseBluePlan={purchaseBluePlan} />
                            </Grid.Item>
                            <Grid.Item>
                                <PaySP payClick={SPClick} />
                            </Grid.Item>
                            {/* <Grid.Item>
                                <PayALI payClick={payClick} />
                            </Grid.Item> */}
                        </Grid>
                        <Grid columns={3} gap={5}>
                            <Grid.Item>
                                <PaySTRIPE stripeClick={stripeClick} />
                            </Grid.Item>
                            <Grid.Item>
                                <PayWECHAT payClick={payClick} />
                            </Grid.Item>
                            <Grid.Item>
                                { isIOS &&  <PayAPPLE parentVisible={visible} setParentVisible={setVisible} appleVisible={appleVisible} setAppleVisible={setAppleVisible} /> }
                            </Grid.Item>
   
                        </Grid>
                    </div>
                    <LeftOutline className={styles.close} onClick={() => {setVisible(false)}} />
                    {showBuyClusloading?<div className={styles.loading}><div className={styles.spinBox}><SpinLoading /></div></div>:''}
                </div>}
            />
            <AppleModal appleVisible={appleVisible} setAppleVisible={setAppleVisible} />
            <PayModal visible={codeVisible} setVisible={setCodeVisible} QRWallet={QRWallet} cryptoName={cryptoName} showPrice={showPrice} timeoutError={timeoutError} setTimeoutError={setTimeoutError} purchaseBluePlan={purchaseBluePlan} />
        </>     
    );
};

export default Genesis;