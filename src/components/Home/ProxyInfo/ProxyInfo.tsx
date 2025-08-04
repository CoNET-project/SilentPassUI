import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from '@/components/Home/ProxyInfo/proxyInfo.module.scss';
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { ReactComponent as ShareDevices } from '@/components/Home/assets/share_devices.svg';
import { Dropdown } from 'antd-mobile';
import { DownOutline } from 'antd-mobile-icons';
import CopyBtn from '@/components/Wallet/copyBtn/CopyBtn';

const ProxyInfo = ({}) => {
    const { t, i18n } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const { isLocalProxy, serverIpAddress, serverPort, serverPac } = useDaemonContext();

    return (
        <>
            {isLocalProxy && <div className={styles.proxyInfo} ref={containerRef}>
                <Dropdown 
                    arrow={<DownOutline />}
                    closeOnClickAway
                    getContainer={() => containerRef.current!}
                >
                    <Dropdown.Item 
                        key='proxy' 
                        title={<div className={styles.proxyInfoBar}><ShareDevices className={styles.icon} />{t('proxy-button-label')}</div>}
                    >
                        <div className={styles.proxyInfoList}>
                            <div className={styles.item}>
                                <label className={styles.label}>Server:</label>
                                <div className={styles.val}><span className={styles.text}>{serverIpAddress}</span><CopyBtn copyVal={serverIpAddress} /></div>
                            </div>
                            <div className={styles.item}>
                                <label className={styles.label}>Port:</label>
                                <div className={styles.val}><span className={styles.text}>{serverPort}</span><CopyBtn copyVal={serverPort} /></div>
                            </div>
                            <div className={styles.item}>
                                <label className={styles.label}>PAC:</label>
                                <div className={styles.val}><span className={styles.text}>{serverPac}</span><CopyBtn copyVal={serverPac} /></div>
                            </div>
                        </div>
                    </Dropdown.Item>
                </Dropdown>
            </div>} 
        </>  
    );
};

export default ProxyInfo;