import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@/components/Home/Status/status.module.scss';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { Modal } from 'antd-mobile';

const Status = ({}) => {
    const { t, i18n } = useTranslation();
    const [passportTimeLeft, setPassportTimeLeft] = useState<number>(0);
    const { profiles, activePassportUpdated, statusVisible, setStatusVisible} = useDaemonContext();

    useEffect(() => {
        const passportExpiration = profiles?.[0]?.activePassport?.expires
        if (passportExpiration) {
            const timeLeft = passportExpiration - Math.floor(Date.now() / 1000)
            setPassportTimeLeft(timeLeft)
        }
    }, [activePassportUpdated, profiles]);

    return (
        <Modal
            visible={statusVisible}
            closeOnAction
            showCloseButton
            disableBodyScroll={false}
            closeOnMaskClick={true}
            onClose={() => {setStatusVisible(false)}}
            className={styles.statusModal}
            content={<div className={styles.statusCont}>
                {passportTimeLeft <= 0?<>已过期</>:<>进行中</>}
            </div>}
        />
    );
};

export default Status;