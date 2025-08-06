import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './redeemBtn.module.scss';
import { useTranslation } from 'react-i18next';
import { Button,Modal,Input } from 'antd-mobile';
import { useDaemonContext } from "./../../../providers/DaemonProvider";

interface RedeemBtnProps {
    isRedeemProcessLoading: boolean;
    setIsRedeemProcessLoading: React.Dispatch<React.SetStateAction<boolean>>;
}


const RedeemBtn = ({isRedeemProcessLoading, setIsRedeemProcessLoading}:RedeemBtnProps) => {
    const { t, i18n } = useTranslation();
    const { setSelectedPlan,setPaymentKind, setSubscriptionVisible } = useDaemonContext();
    const navigate = useNavigate();
    const [redeemCode, setRedeemCode] = useState("");
    const [visible, setVisible] = useState(false);

    const handlePassportRedeem=async()=> {
        setPaymentKind(6);
        setSelectedPlan(redeemCode);
        setIsRedeemProcessLoading(true);
        setSubscriptionVisible(true);
		setVisible(false);
        setRedeemCode('');
    }
    const handleRedeem=()=>{
        setVisible(true);
    }

    return (
        <div className={styles.btnWrap}>
            <Button onClick={handleRedeem} block color='primary' fill='solid'>{t('wallet-redeem-btn')}</Button>
            <Modal
                visible={visible}
                content={(<div className={styles.redeem}>
                    <div className={styles.title}>{t('wallet-redeem-code')}</div>
                    <Input
                        className={styles.codeInput}
                        placeholder={t('wallet-redeem-placeholder')}
                        value={redeemCode}
                        onChange={val => {
                            setRedeemCode(val)
                        }}
                    />
                    <div className={styles.apply}>
                        <Button onClick={handlePassportRedeem} size="small" loading={isRedeemProcessLoading} disabled={!redeemCode} color='primary' fill='solid'>{t('wallet-redeem-apply-btn')}</Button>
                    </div>
                </div>)}
                closeOnMaskClick={true}
                showCloseButton={true}
                onClose={() => {setVisible(false)}}
            />
        </div>
    );
};

export default RedeemBtn;