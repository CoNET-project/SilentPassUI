import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './passport.module.css';
import { useTranslation } from 'react-i18next';
import { List,Popup,NavBar,Empty,CheckList,Button,Selector } from 'antd-mobile';
import { ExclamationTriangleOutline,RightOutline } from 'antd-mobile-icons';
import { CoNET_Data } from './../../../utils/globals';
import { ReactComponent as SpToken } from './../assets/sp-token.svg';
import { ReactComponent as StripeIcon } from "./../assets/stripe-white.svg";
import { ReactComponent as PaypalIcon } from "./../assets/paypal.svg";
import { useDaemonContext } from './../../../providers/DaemonProvider';
import { getPassportTitle } from "./../../../utils/utils";

interface plan {
    total: string
    publicKey: string
    Solana: string
    transactionId: string
    productId: string
}

const Passport = ({}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [visible, setVisible] = useState<boolean>(false);
    const { isIOS, profiles, selectedPlan, setSelectedPlan, successNFTID, setPaymentKind, setSuccessNFTID, activePassport } = useDaemonContext();
    const [payType, setPayType] = useState<number>(1);
    const options=[
        {
            label: <div className={styles.spPayBtn}>$SP</div>,
            value: 1,
        },
        {
            label: <div className={styles.stripePayBtn}><StripeIcon /></div>,
            value: 2,
        },
        {
            label: <div className={styles.paypalPayBtn}><PaypalIcon /></div>,
            value: 4,
        },
    ];

    const handleChange=(value: (string | number)[])=>{
        setSelectedPlan(String(value[0]));
    }
    const handlePurchase=(type: number)=> {
        setPaymentKind(type);
        navigate("/subscription");
    }
    const startSubscription = () => {
        if (!profiles ||profiles.length < 2) {
            return
        }
        const planObj: plan = {
            publicKey: profiles[0].keyID,
            Solana: profiles[1].keyID,
            total: (isIOS?(selectedPlan === '12' ? '2': selectedPlan):selectedPlan),
            transactionId: '',
            productId: ''
        }
        const base64VPNMessage = btoa(JSON.stringify(planObj));
        window?.webkit?.messageHandlers["pay"]?.postMessage(base64VPNMessage);
        if(!isIOS){
            setPaymentKind(3);
        }
        navigate("/subscription");
    }

    return (
        <>
            <List.Item onClick={() => {setVisible(true)}}>
                <div className={styles.item}>
                    <div className={styles.icon}><SpToken /></div>
                    <div className={styles.text}>
                        <div className={styles.title}>{t('passport-pay-title')}</div>
                        <div className={styles.subTitle}>{t('passport-pay-extra-title')}</div>
                    </div>
                </div>
            </List.Item>
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.popup}
                closeOnMaskClick={true}
            >
                <div className={styles.modalWrap}>
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('passport-pay-title')}</NavBar>
                    <div className={styles.bd}>
                        {isIOS?<div className={styles.iosType}>
                            <div className={styles.title}>{t('passport-pay-plan-ios-title')}</div>
                            <div className={styles.specs}>
                                <CheckList value={[selectedPlan]} onChange={handleChange}>
                                    <CheckList.Item value='12'>
                                        <div className={styles.specItem}>
                                            <div className={styles.name}>{t('passport-pay-plan-ios-plan-name-1')}</div>
                                            <div className={styles.price}>$32.49 / {t('passport-pay-plan-ios-plan-unit-1')}</div>
                                            <div className={styles.desc}>{t('passport-pay-plan-ios-plan-desc-1')}</div>
                                        </div>
                                    </CheckList.Item>
                                    <CheckList.Item value='1'>
                                        <div className={styles.specItem}>
                                            <div className={styles.name}>{t('passport-pay-plan-ios-plan-name-2')}</div>
                                            <div className={styles.price}>$3.29 / {t('passport-pay-plan-ios-plan-unit-2')}</div>
                                            <div className={styles.desc}>{t('passport-pay-plan-ios-plan-desc-2')}</div>
                                        </div>
                                    </CheckList.Item>
                                </CheckList>
                            </div>
                            {(getPassportTitle(activePassport)==='passport_Freemium' && activePassport?.expiresDays!=='0')?<>
                                <div className={styles.tips}>{t('passport-pay-plan-ios-tips-1')}</div>
                                <div className={styles.warning}><ExclamationTriangleOutline className={styles.icon} />{t('passport-pay-plan-ios-tips-2')}</div>
                            </>:''}
                            <div className={styles.subscription}>
                                <Button className={styles.btn} block fill='solid' onClick={() => startSubscription()}>{t('passport-pay-btn')}</Button>
                            </div>
                            <div className={styles.extraInfo}>
                                <div className={styles.title}>{t('passport-pay-plan-ios-extra-title')}:</div>
                                <ul className={styles.list}>
                                    <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-ios-extra-item-1')}</span></li>
                                    <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-ios-extra-item-2')}</span></li>
                                    <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-ios-extra-item-3')}</span></li>
                                    <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-ios-extra-item-4')}</span></li>
                                    <li><RightOutline className={styles.icon} /><span>{t('passport-pay-plan-ios-extra-item-5')} <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank">{t('passport-pay-plan-ios-extra-item-6')}</a>, {t('passport-pay-plan-ios-extra-item-7')} <a href="https://silentpass.io/privacy-cookies/" target="_blank">{t('passport-pay-plan-ios-extra-item-8')}</a></span></li>
                                </ul>
                            </div>
                        </div>:''}

                        {!isIOS?<div className={styles.pcType}>
                            <div className={styles.title}>{t('passport-pay-plan-pc-title')}</div>
                            <div className={styles.specs}>
                                <CheckList value={[selectedPlan]} onChange={handleChange}>
                                    <CheckList.Item value='1'>
                                        <div className={styles.specItem}>
                                            <div className={styles.name}>{t('passport-pay-plan-pc-plan-unit-1')}</div>
                                            <div className={styles.price}>$USD 2.99 {t('passport-pay-plan-pc-plan-name-1')}</div>
                                            <div className={styles.desc}>{t('passport-pay-plan-pc-plan-desc')}</div>
                                        </div>
                                    </CheckList.Item>
                                    <CheckList.Item value='12'>
                                        <div className={styles.specItem}>
                                            <div className={styles.name}>{t('passport-pay-plan-pc-plan-unit-2')}</div>
                                            <div className={styles.price}>$USD 24.99 {t('passport-pay-plan-pc-plan-name-2')}</div>
                                            <div className={styles.desc}>{t('passport-pay-plan-pc-plan-desc')}</div>
                                        </div>
                                    </CheckList.Item>
                                </CheckList>
                            </div>
                            {(getPassportTitle(activePassport)==='passport_Freemium' && activePassport?.expiresDays!=='0')?<>
                                <div className={styles.tips}>{t('passport-pay-plan-ios-tips-1')}</div>
                                <div className={styles.warning}><ExclamationTriangleOutline className={styles.icon} />{t('passport-pay-plan-ios-tips-2')}</div>
                            </>:''}
                            <div className={styles.selector}>
                                <Selector
                                    columns={3}
                                    options={options}
                                    value={[payType]}
                                    onChange={v => {
                                        if (v.length) {
                                            setPayType(v[0])
                                        }
                                    }}
                                    style={{
                                        '--border': 'solid transparent 1px',
                                        '--checked-border': 'solid #3b80f6 1px',
                                    }}
                                />
                            </div>
                            <div className={styles.operation}>
                                <Button className={styles.btn} block color='primary' size='large' onClick={()=>{handlePurchase(payType)}}>{t('wallet-account-buy-btn')}</Button>
                            </div>
                        </div>:''}

                    </div>
                </div>
            </Popup>
        </>     
    );
};

export default Passport;