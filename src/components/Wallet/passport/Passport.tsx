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
import { ReactComponent as ApplePay } from './../assets/Apple_Pay_logo.svg'
import { useDaemonContext } from './../../../providers/DaemonProvider';
import { getPassportTitle } from "./../../../utils/utils";
import ApplePayModal from './ApplePayModal';

const Passport = ({}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [visible, setVisible] = useState<boolean>(false);
    const { isIOS, profiles, selectedPlan, setSelectedPlan, setPaymentKind, activePassport, isLocalProxy } = useDaemonContext();
    const [payType, setPayType] = useState<number>(1);
    const [applePayVisible, setApplePayVisible] = useState<boolean>(false);
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
        ...(isIOS && !isLocalProxy
            ? [{
                label: <div className={styles.applePayBtn}><ApplePay /></div>,
                value: 999,
              }]
            : []
        )
    ];

    const handleChange=(value: (string | number)[])=>{
        setSelectedPlan(String(value[0]));
    }
    const handlePurchase=(type: number)=> {
        if(type!==999){
            setPaymentKind(type);
            navigate("/subscription");
        }else{
            setVisible(false);
            setApplePayVisible(true);
        }
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
                        <div className={styles.pcType}>
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
                        </div>

                    </div>
                </div>
            </Popup>
            <ApplePayModal visible={applePayVisible} setVisible={setApplePayVisible} />
        </>     
    );
};

export default Passport;