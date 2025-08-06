import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@/components/Home/Status/status.module.scss';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { Modal,Button } from 'antd-mobile';

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
                {passportTimeLeft <= 0?<div className={styles.overdue}>
                    <div className={styles.title}>{t('status-overdue-title')}</div>
                    <div className={styles.desc}>
                        <p>{t('status-overdue-des-1')}</p>
                        <p>{t('status-overdue-des-2')}</p>
                    </div>
                    <dl className={styles.list}>
                        <dt>{t('status-list-title-1')}</dt>    
                        <dd>
                            <p>{t('status-list-des-1')}</p>
                            <p>{t('status-list-des-2')}</p>
                        </dd> 
                        <dt>{t('status-list-title-2')}</dt>    
                        <dd>
                            <p>{t('status-list-des-3')}</p>
                            <p>{t('status-list-des-4')}</p>
                        </dd> 
                        <dt>{t('status-list-title-3')}</dt>    
                        <dd>
                            <p>{t('status-list-des-5')}</p>
                            <p>{t('status-list-des-6')}</p>
                        </dd> 
                        <dt>{t('status-list-title-4')}</dt>    
                        <dd>
                            <p>{t('status-list-des-7')}</p>
                            <p>{t('status-list-des-8')}</p>
                        </dd>           
                    </dl>
                    <div className={styles.oper}><Button className={styles.closeBtn} onClick={()=>{setStatusVisible(false)}} block color='primary' size='middle'>{t('swap-asset-select-close')}</Button></div>
                </div>:<div className={styles.ing}>
                    <div className={styles.title}>{t('status-ing-title')}</div>
                    <div className={styles.desc}>
                        <p>{t('status-ing-des-1')}</p>
                        <p>{t('status-ing-des-2')}</p>
                    </div>
                    <dl className={styles.list}>
                        <dt>{t('status-list-title-1')}</dt>    
                        <dd>
                            <p>{t('status-list-des-1')}</p>
                            <p>{t('status-list-des-2')}</p>
                        </dd> 
                        <dt>{t('status-list-title-2')}</dt>    
                        <dd>
                            <p>{t('status-list-des-3')}</p>
                            <p>{t('status-list-des-4')}</p>
                        </dd> 
                        <dt>{t('status-list-title-3')}</dt>    
                        <dd>
                            <p>{t('status-list-des-5')}</p>
                            <p>{t('status-list-des-6')}</p>
                        </dd> 
                        <dt>{t('status-list-title-4')}</dt>    
                        <dd>
                            <p>{t('status-list-des-7')}</p>
                            <p>{t('status-list-des-8')}</p>
                        </dd>           
                    </dl>
                    <div className={styles.oper}><Button className={styles.closeBtn} onClick={()=>{setStatusVisible(false)}} block color='primary' size='middle'>{t('swap-asset-select-close')}</Button></div>
                </div>}
            </div>}
        />
    );
};

export default Status;