import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './checkInBtn.module.css';
import { useTranslation } from 'react-i18next';
import { Button,Modal } from 'antd-mobile';
import { ExclamationShieldOutline } from 'antd-mobile-icons';
import { getRewordStaus } from './../../../services/wallets';
import { useDaemonContext } from "./../../../providers/DaemonProvider";

const CheckInBtn = ({}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { setPaymentKind } = useDaemonContext();
    const [disabled, setDisabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const firstRef=useRef(true);

    useEffect(() => {
        if (firstRef && firstRef.current) {
            getReword();
            firstRef.current = false;
        }
    }, []);

    const getReword = async() => {
        setLoading(true)
        const status = await getRewordStaus();
        if (status === true) {
            setDisabled (status)
        } else {
            setDisabled (false)
        }
        setLoading(false)
    }
    const spRewordProcess = () => {
        if (!disabled) {
            Modal.alert({
                className:styles.warningTipModal,
                content: t('wallet-checkin-btn-warning'),
                closeOnMaskClick: true
            });
            return ;
        }
        setLoading(true);
        setPaymentKind(5);
        navigate("/subscription")
        setLoading(false);
    }

    return (
        <div className={styles.btnWrap}>
            <Button onClick={spRewordProcess} block color='primary' fill='solid' style={{opacity:(!disabled?0.5:1)}}>{!disabled?<ExclamationShieldOutline className={styles.warning} />:''}{t('wallet-checkin-btn')}</Button>
        </div>
    );
};

export default CheckInBtn;