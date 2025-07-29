import { useState, useRef, useEffect } from 'react'
import { useNavigate } from "react-router-dom"
import styles from './checkInBtn.module.scss'
import { useTranslation } from 'react-i18next'
import { Button,Modal,Popup,NavBar, Grid, Result, Ellipsis } from 'antd-mobile'
import { ExclamationShieldOutline } from 'antd-mobile-icons'
import { getRewordStaus } from './../../../services/wallets'
import { useDaemonContext } from "./../../../providers/DaemonProvider"
import { CoNET_Data } from '../../../utils/globals'
import { getOracle } from '../../../services/passportPurchase'
import {getCryptoPay} from './../../../services/subscription'
import PaySTRIPE from '../payStripe/PaySTRIPE'
import PayBNB from './../payBnb/PayBNB'
import PayBSC from './../payBsc/PayBSC';
import PayModal from './../payModal/PayModal';
import { ReactComponent as StripeIcon } from "./../assets/stripe-white.svg"
import { waitingPaymentStatus  } from './../../../services/wallets'
import {openWebLinkNative} from './../../../api';

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX';

const CheckInBtn = ({}) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState<boolean>(false)
	const [disabled, setDisabled] = useState<boolean>(true)
	const [todayCheckIN, setTodayCheckIN] = useState<boolean>(false)
	const { isIOS, profiles, selectedPlan, setSelectedPlan, setPaymentKind, activePassport, isLocalProxy, setSuccessNFTID } = useDaemonContext()
	const [cryptoName, setCryptoName] = useState<cryptoName>('BSC USDT');

    const [codeVisible, setCodeVisible] = useState(false);
    const [QRWallet, setQRWallet] = useState('');
    const [showPrice, setShowPrice] = useState('');
    const [timeoutError, setTimeoutError] = useState(false);

	const navigate = useNavigate()

    // const navigate = useNavigate();
    // const { setPaymentKind } = useDaemonContext();
    // const [disabled, setDisabled] = useState(false);
    // const [loading, setLoading] = useState(true);
    // const firstRef=useRef(true);

    // useEffect(() => {
    //     if (firstRef && firstRef.current) {
    //         getReword();
    //         firstRef.current = false;
    //     }
    // }, []);

	const checkBalance = async () => {
		const status = await getRewordStaus()
		if (status === null) {
			return
		}
		if (status === false) {
			return setTodayCheckIN(true)
		}
		return setDisabled(false)

	}
	useEffect(()=> {
		checkBalance()
	})

	const stripePay = () => {
		setSelectedPlan('3')
		setPaymentKind(2)
		navigate("/subscription")
	}

    const spRewordProcess = () => {
        if (disabled) {
            Modal.alert({
                className:styles.warningTipModal,
                content: t('wallet-checkin-btn-warning'),
                closeOnMaskClick: true
            })
            return
        }

        setPaymentKind(5)
        navigate("/subscription")

    }
    const goCheck=() => {
        setVisible(true)
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
            <div className={styles.btnWrap}>
                <Button onClick={goCheck} block color='primary' fill='solid'>{t('wallet-checkin-btn')}</Button>
            </div>
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.popup}
                closeOnMaskClick={true}
            >
                <div className={styles.modalWrap}>
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('wallet-checkin-btn-title')}</NavBar>
                    <div className={styles.bd}>
						<div className={styles.take}>
							<div className={styles.title}>
								<ExclamationShieldOutline className={styles.icon} />{t('wallet-checkin-info1')}
							</div>
							<div className={styles.title}>
								<ExclamationShieldOutline className={styles.icon} />{t('wallet-checkin-info2')}
							</div>
							<div className={styles.operation}>
								<Button className={styles.btn} block color='primary' size='large' onClick={spRewordProcess}  disabled={disabled}>{t(todayCheckIN ? 'comp-RedeemPassport-alreadyRedeem': 'wallet-checkin-betton-title')}</Button>
							</div>
						</div>
						<div className={styles.warning}>
							<div className={styles.title}>
								{t('wallet-checkin-remind')}
							</div>
							<div className={styles.desc}>
								{t('wallet-checkin-remind-detail')}
							</div>
						</div>
						<div className={styles.introduce}>
							<div className={styles.title}>
								{t('wallet-checkin-deposit-btn')}
							</div>
							<div className={styles.desc}>
								<ExclamationShieldOutline className={styles.icon} />{t('wallet-checkin-deposit-detail-1')}
							</div>
                            <div className={styles.desc}>
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
						</div>
                        <div className={styles.introduce}>
                            <div className={styles.title}>
                                {t('wallet-checkin-deposit-btn')}
                            </div>
                            <div className={styles.payways}>
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
                        </div>
                    </div>
					
					
                </div>
            </Popup>
            <PayModal visible={codeVisible} setVisible={setCodeVisible} QRWallet={QRWallet} cryptoName={cryptoName} showPrice={showPrice} timeoutError={timeoutError} setTimeoutError={setTimeoutError} purchaseBluePlan={purchaseBluePlan} />
        </>
    );
};

export default CheckInBtn;