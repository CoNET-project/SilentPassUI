import React, { useState } from "react";
import { Button,Modal,Toast } from "antd-mobile";
import { ScanCodeOutline } from "antd-mobile-icons";
import Html5QrcodePlugin from "./Html5QrcodePlugin";
import styles from "./scanButton.module.css";
import { useTranslation } from 'react-i18next';
import VConsole from 'vconsole'
const vConsole=new VConsole()

interface Props {
    solSendRef: any;
    spSendRef: any;
}

const ScanButton = ({solSendRef,spSendRef}:Props) => {
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const { t, i18n } = useTranslation();

    const handleGoScan=async()=>{
        setLoading(true);
        try{
            // 主动请求摄像头权限（必须在用户交互后触发）
            await navigator.mediaDevices.getUserMedia({ video: true });
        }catch(error){
            console.log(error,'errorrrrrrrrrrrrrrrrrrraafsfasfsffasfas')
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
            return ;
        }
        setLoading(false);
        setScanning(true);
    }
    const handleScanSuccess = (text: string) => {
        try{
            const obj=JSON.parse(text);
            if(obj?.type==='$SP'){
                spSendRef?.current?.setExternalVisible(true);
                if(obj&&obj.address){
                    spSendRef?.current?.setExternalAddress(obj.address);
                }
                if(obj&&obj.amount){
                    spSendRef?.current?.setExternalAmount(String(obj.amount));
                }
                return ;
            }
            if(obj?.type==='$SOL'){
                solSendRef?.current?.setExternalVisible(true);
                if(obj&&obj.address){
                    solSendRef?.current?.setExternalAddress(obj.address);
                }
                if(obj&&obj.amount){
                    solSendRef?.current?.setExternalAmount(String(obj.amount));
                }
                return ;
            }
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
