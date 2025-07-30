import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './../generalSetting/generalSetting.module.scss';
import { useTranslation } from 'react-i18next';
import { List,Modal } from 'antd-mobile';
import { BarsOutlined } from '@ant-design/icons';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import CopyBtn from './../../Wallet/copyBtn/CopyBtn';

const ProxyInfo = ({}) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState(false);
    const { serverIpAddress, serverPort, serverPac } = useDaemonContext();
    const modalParentRef = useRef<HTMLDivElement>(null);

    return (
        <>
            <div className={styles.general} ref={modalParentRef}>
                <List header={t('proxy-header')} style={{'--active-background-color':'#323131'}}>
                    <List.Item 
                        prefix={<span className={styles.icon}><BarsOutlined /></span>} 
                        onClick={() => {setVisible(true)}}
                    >
                        {t('proxy-button-label')}
                    </List.Item>
                </List>
            </div>
            <Modal
                visible={visible}
                showCloseButton
                bodyClassName={styles.proxyInfoModal}
                title={t('proxy-button-label')}
                getContainer={() => modalParentRef.current!}
                content={
                    <div className={styles.proxyInfoList}>
                        <div className={styles.item}>
                            <div className={styles.label}>{t('proxy-server')}</div>
                            <div className={styles.val}><span>{serverIpAddress}</span><CopyBtn copyVal={serverIpAddress} /></div>
                        </div>
                        <div className={styles.item}>
                            <div className={styles.label}>{t('proxy-port')}</div>
                            <div className={styles.val}><span>{serverPort}</span><CopyBtn copyVal={serverPort} /></div>
                        </div>
                        <div className={styles.item}>
                            <div className={styles.label}>{t('proxy-pac')}</div>
                            <div className={styles.val}><span>{serverPac}</span><CopyBtn copyVal={serverPac} /></div>
                        </div>
                    </div>
                }
                closeOnMaskClick
                onClose={() => {setVisible(false)}}
            />
        </>
    );
};

export default ProxyInfo;