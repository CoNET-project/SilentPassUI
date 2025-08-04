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
import PayWays from './../spWallet/payWays';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const CheckInBtn = ({}) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState<boolean>(false)
	const [disabled, setDisabled] = useState<boolean>(true)
	const [todayCheckIN, setTodayCheckIN] = useState<boolean>(false)
	const { setPaymentKind } = useDaemonContext()
	const navigate = useNavigate()

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
								<ExclamationCircleOutlined style={{marginRight:3}} />{t('wallet-checkin-remind')}
							</div>
							<div className={styles.desc}>
								{t('wallet-checkin-remind-detail')}
							</div>
						</div>
                        <div className={styles.payways}><PayWays defaultVisible={true} /></div>
                    </div>
					
					
                </div>
            </Popup>
        </>
    );
};

export default CheckInBtn;