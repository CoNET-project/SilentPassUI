import { useState, useRef, useEffect } from 'react'
import { useNavigate } from "react-router-dom"
import styles from './checkInBtn.module.scss'
import { useTranslation } from 'react-i18next'
import { Button,Modal,Popup,NavBar, Grid } from 'antd-mobile'
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

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX';

const CheckInBtn = ({}) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState<boolean>(false)
	const [disabled, setDisabled] = useState<boolean>(true)
	const [todayCheckIN, setTodayCheckIN] = useState<boolean>(false)
	const { isIOS, profiles, selectedPlan, setSelectedPlan, setPaymentKind, activePassport, isLocalProxy } = useDaemonContext()
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
        
		// const res = await getCryptoPay(token, '2860')

        showQrModal(12,'asfasfasfasfafafa')


		
		// const waiting = await waitingPaymentStatus ()
    }
    const showQrModal=(price,qrVal)=>{
        setTimeoutError(false);
        setShowPrice(price);
        setQRWallet(qrVal);
        setCodeVisible(true);
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
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('wallet-redeem-btn-title')}</NavBar>
                    <div className={styles.bd}>
						<div className={styles.introduce}>
							<div className={styles.title}>
								
								{t('wallet-checkin-info1')}
								
							</div>
							<div className={styles.title}>
								
								{t('wallet-checkin-info2')}
								
							</div>
							<div className={styles.operation}>
								<Button className={styles.btn} block color='primary' size='large' onClick={spRewordProcess}  disabled={disabled}>{t(todayCheckIN ? 'comp-RedeemPassport-alreadyRedeem': 'comp-RedeemPassport-RedeemNow')}</Button>
							</div>
						</div>
						<div className={styles.introduce}>
							<div className={styles.title}>
								{t('wallet-checkin-remind')}
							</div>
							<div className={styles.desc}>
								{t('wallet-checkin-remind-detail')}
							</div>
							<div className={styles.desc}>
								{t('wallet-checkin-remind-detail-1')}
							</div>

						</div>
						<div className={styles.introduce}>
							<div className={styles.title}>
								{t('wallet-checkin-deposit-btn')}
							</div>
							<div className={styles.desc}>
								{t('wallet-checkin-deposit-detail-1')}
							</div>
							<Grid columns={4} gap={5} style={{paddingTop: '2rem'}}>
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
            </Popup>
            <PayModal visible={codeVisible} setVisible={setCodeVisible} QRWallet={QRWallet} cryptoName={cryptoName} showPrice={showPrice} timeoutError={timeoutError} setTimeoutError={setTimeoutError} purchaseBluePlan={purchaseBluePlan} />
        </>
    );
};

export default CheckInBtn;