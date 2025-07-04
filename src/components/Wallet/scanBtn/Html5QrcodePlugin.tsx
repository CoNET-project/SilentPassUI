import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode";
import { Popup,Button,Toast,SpinLoading } from "antd-mobile";
import { CloseCircleOutline } from 'antd-mobile-icons';
import styles from "./html5QrcodePlugin.module.css";

interface Props {
    shouldStart: boolean;
    fps?: number;
    qrbox?: number;
    onScanSuccess?: (text: string) => void;
    onStop?: () => void;
}

const Html5QrcodePlugin = ({shouldStart, fps=10, qrbox=250, onScanSuccess, onStop}:Props) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (shouldStart) {
            // 清理旧 DOM，避免 QR 渲染失败
            const container = document.getElementById("qr-reader");
            if (container) {
                const newDiv = document.createElement("div");
                newDiv.id = "qr-reader";
                newDiv.className = styles.reader;
                container.replaceWith(newDiv);
            }
            startScanner();
        }else{
            
            stopAndClear();
        }
    }, [shouldStart]);

    const startScanner = async () => {
        try {
            setLoading(true);
            const qr = new Html5Qrcode("qr-reader");
            scannerRef.current = qr;

            const devices = await Html5Qrcode.getCameras();
            const cameraId = devices[0]?.id;
            if (!cameraId) {
                Toast.show({
                    icon: 'fail',
                    content: '未找到摄像头设备',
                });
                onStop?.();
                return;
            }

            await qr.start(
                { facingMode: "environment" },
                { fps, qrbox:{ width: qrbox, height: qrbox } },
                (text, result) => {
                    onScanSuccess?.(text);
                    qr.stop().then(() => onStop?.());
                },
                () => {}
            );
            setLoading(false);
        } catch (err: any) {
            Toast.show({
                icon: 'fail',
                content: '摄像头权限被拒绝或不可用',
            });
            onStop?.();
        }
    }
    const stopAndClear = async () => {
        try {
            if (scannerRef.current?.getState?.() === 2) { // 2 = SCANNING
                await scannerRef.current.stop();
            }
            await scannerRef.current?.clear();
        } catch (err) {
            Toast.show({
                icon: 'fail',
                content: '停止扫码器失败',
            });
        }
    }
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            Toast.show({
                icon: 'fail',
                content: '图片大小不能超过 5MB，请重新选择！',
            });
            event.target.value = ""; // 清空选择，允许重复上传
            return;
        }

        try {
            if(scannerRef.current){
                await stopAndClear();
                const result = await scannerRef.current.scanFile(file, true);
                onScanSuccess?.(result);
                onStop?.();
            }
        } catch (err) {
            Toast.show({
                icon: 'fail',
                content: '文件扫码失败',
            });
        } finally {
            event.target.value = ""; // 允许再次上传相同文件
        }
    };


    return (
        <Popup
            visible={shouldStart}
            onMaskClick={() => {onStop?.()}}
            onClose={() => {onStop?.()}}
            bodyStyle={{ height: '100vh' }}
            style={{'--z-index':'9999999'}}
            forceRender={true}
        >
            <div className={styles.scanCamera}>
                <Button onClick={() => {onStop?.()}} className={styles.closeBtn} color='primary' fill='none'><CloseCircleOutline /></Button>
                <div id="qr-reader" className={styles.reader} />
                <Button
                    className={styles.uploadBtn}
                    color="primary"
                    fill="outline"
                    onClick={() => document.getElementById("qr-upload")?.click()}
                >
                    选择文件
                </Button>
                <input
                    type="file"
                    id="qr-upload"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageUpload}
                />
                {loading?<div className={styles.loading}><SpinLoading /></div>:''}
            </div>
        </Popup>
    )
}

export default Html5QrcodePlugin;
