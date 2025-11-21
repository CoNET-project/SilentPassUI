//		ScanButtonForB.tsx


import React, { useState } from "react";
import { Button,Modal,Toast } from "antd-mobile";
import { ScanCodeOutline } from "antd-mobile-icons";
import Html5QrcodePlugin from "./Html5QrcodePlugin";
import styles from "./scanButton.module.scss";
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from '@/providers/DaemonProvider'

interface Props {
}

const ScanButton = ({}:Props) => {
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const { t, i18n } = useTranslation();
  const { darkModle } = useDaemonContext()

    const handleGoScan=async()=>{
        setLoading(true);

        try{
            const status = await navigator.permissions.query({ name: 'camera' as PermissionName });

            if (status.state === 'denied') {
                // 权限被拒绝（安卓等支持 Permissions API 的环境）
                Modal.show({
                    content: t('wallet-receive-code-scan-tip-1'),
                    closeOnAction: true,
                    actions: [
                        {
                            key: 'confirm',
                            text: t('wallet-receive-code-confirm')
                        },
                    ]
                })
                setLoading(false);
                return;
            }
            setScanning(true); // 启动扫描
            setLoading(false);
            return;
        }catch(err:any){
            // iOS 或首次使用的 prompt 状态：必须通过 getUserMedia 触发授权
            try{
                await navigator.mediaDevices.getUserMedia({ video: true });
                setScanning(true); // 启动扫描
                setLoading(false);
            }catch(e:any){
                Modal.show({
                    content: t('wallet-receive-code-scan-tip-1'),
                    closeOnAction: true,
                    actions: [
                        {
                            key: 'confirm',
                            text: t('wallet-receive-code-confirm')
                        },
                    ]
                })
                setLoading(false);
            }
        }
    }
    const handleScanSuccess = (text: string) => {
        try{
            const obj=JSON.parse(text);

            Toast.show({
                icon: 'fail',
                content: t('wallet-receive-code-scan-tip-2')
            });
        }catch(err){
            Toast.show({
                icon: 'fail',
                content: t('wallet-receive-code-scan-tip-2')
            });
        }
        setScanning(false); // 扫完自动关闭        
    }

    return (
        <>
            <Button onClick={handleGoScan} loading={loading} className={styles.scanBtn} color="primary" fill="none"><ScanCodeOutline /></Button>
            <Html5QrcodePlugin
                shouldStart={scanning}
                // fps={10}
                qrbox={250}
                onScanSuccess={handleScanSuccess}
                onStop={() => setScanning(false)}
            />
        </>
    )
}

export default ScanButton;
