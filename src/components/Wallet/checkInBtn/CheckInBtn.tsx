import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './checkInBtn.module.scss';
import { useTranslation } from 'react-i18next';
import { Button,Modal,Popup,NavBar } from 'antd-mobile';
import { ExclamationShieldOutline } from 'antd-mobile-icons';
import { getRewordStaus } from './../../../services/wallets';
import { useDaemonContext } from "./../../../providers/DaemonProvider";

const CheckInBtn = ({}) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState<boolean>(false);
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

    // const getReword = async() => {
    //     setLoading(true)
    //     const status = await getRewordStaus();
    //     if (status === true) {
    //         setDisabled (!status)
    //     } else {
    //         setDisabled (true)
    //     }
    //     setLoading(false)
    // }
    // const spRewordProcess = () => {
    //     if (disabled) {
    //         Modal.alert({
    //             className:styles.warningTipModal,
    //             content: t('wallet-checkin-btn-warning'),
    //             closeOnMaskClick: true
    //         });
    //         return ;
    //     }
    //     setLoading(true);
    //     setPaymentKind(5);
    //     navigate("/subscription")
    //     setLoading(false);
    // }
    const goCheck=()=>{
        setVisible(true);
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

                    


                    
                    </div>
                </div>
            </Popup>
        </>
    );
};

export default CheckInBtn;