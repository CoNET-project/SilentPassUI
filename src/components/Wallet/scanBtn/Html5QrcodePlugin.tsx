// import React, { useEffect, useRef, useState } from "react";
// import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode";
// import { Popup,Button,Toast,SpinLoading } from "antd-mobile";
// import { CloseCircleOutline } from 'antd-mobile-icons';
// import styles from "./html5QrcodePlugin.module.css";
// import { useTranslation } from 'react-i18next';
// import VConsole from 'vconsole'
// const vConsole=new VConsole()

// interface Props {
//     shouldStart: boolean;
//     fps?: number;
//     qrbox?: number;
//     onScanSuccess?: (text: string) => void;
//     onStop?: () => void;
// }

// const Html5QrcodePlugin = ({shouldStart, fps=10, qrbox=250, onScanSuccess, onStop}:Props) => {
//     const scannerRef = useRef<Html5Qrcode | null>(null);
//     const [loading, setLoading] = useState(false);
//     const { t, i18n } = useTranslation();

//     useEffect(() => {
//         if (shouldStart) {
//             // 清理旧 DOM，避免 QR 渲染失败
//             const container = document.getElementById("qr-reader");
//             if (container) {
//                 const newDiv = document.createElement("div");
//                 newDiv.id = "qr-reader";
//                 newDiv.className = styles.reader;
//                 container.replaceWith(newDiv);
//             }
//             startScanner();
//         }else{
            
//             stopAndClear();
//         }
//     }, [shouldStart]);

//     const startScanner = async () => {
//         try {
//             setLoading(true);
//             const qr = new Html5Qrcode("qr-reader");
//             scannerRef.current = qr;

//             const devices = await Html5Qrcode.getCameras();
//             let cameraId = devices[0]?.id;
//             if (!cameraId) {
//                 Toast.show({
//                     icon: 'fail',
//                     content: t('wallet-receive-code-scan-tip-3')
//                 });
//                 onStop?.();
//                 return;
//             }
//             // 尝试优先选后置摄像头
//             const backCamera = devices.find(device =>
//               /back|rear/i.test(device.label)
//             );

//             const fallbackCamera = devices[0]; // 兜底使用第一个

//             const preferredCamera = backCamera || fallbackCamera;

//             await qr.start(
//                 // preferredCamera.id,
//                 { facingMode: "environment" },
//                 { fps, qrbox:{ width: qrbox, height: qrbox } },
//                 (text, result) => {
//                     onScanSuccess?.(text);
//                     qr.stop().then(() => onStop?.());
//                     setLoading(false);
//                 },
//                 () => {}
//             );
//             setLoading(false);
//         } catch (err: any) {
//             console.log(err,'err')
//             Toast.show({
//                 icon: 'fail',
//                 content: t('wallet-receive-code-scan-tip-1')
//             });
//             onStop?.();
//             setLoading(false);
//         }
//     }
//     const stopAndClear = async () => {
//         try {
//             if (scannerRef.current?.getState?.() === 2) { // 2 = SCANNING
//                 await scannerRef.current.stop();
//             }
//             await scannerRef.current?.clear();
//         } catch (err) {
//             Toast.show({
//                 icon: 'fail',
//                 content: t('wallet-receive-code-scan-tip-5')
//             });
//         }
//     }
//     const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
//         const file = event.target.files?.[0];
//         if (!file) return;
//         const maxSize = 5 * 1024 * 1024; // 5MB
//         if (file.size > maxSize) {
//             Toast.show({
//                 icon: 'fail',
//                 content: t('wallet-receive-code-scan-tip-4')
//             });
//             event.target.value = ""; // 清空选择，允许重复上传
//             return;
//         }

//         try {
//             if(scannerRef.current){
//                 await stopAndClear();
//                 const result = await scannerRef.current.scanFile(file, true);
//                 onScanSuccess?.(result);
//                 onStop?.();
//             }
//         } catch (err) {
//             Toast.show({
//                 icon: 'fail',
//                 content: t('wallet-receive-code-scan-tip-6')
//             });
//         } finally {
//             event.target.value = ""; // 允许再次上传相同文件
//         }
//     };


//     return (
//         <Popup
//             visible={shouldStart}
//             onMaskClick={() => {onStop?.()}}
//             onClose={() => {onStop?.()}}
//             bodyStyle={{ height: '100%' }}
//             style={{'--z-index':'9999999'}}
//             forceRender={true}
//         >
//             <div className={styles.scanCamera}>
//                 <Button onClick={() => {onStop?.()}} className={styles.closeBtn} color='primary' fill='none'><CloseCircleOutline /></Button>
//                 <div id="qr-reader" className={styles.reader} />
//                 <Button
//                     className={styles.uploadBtn}
//                     color="primary"
//                     fill="outline"
//                     onClick={() => document.getElementById("qr-upload")?.click()}
//                 >
//                     {t('wallet-receive-code-scan-file-btn')}
//                 </Button>
//                 <input
//                     type="file"
//                     id="qr-upload"
//                     accept="image/*"
//                     style={{ display: "none" }}
//                     onChange={handleImageUpload}
//                 />
//                 {loading?<div className={styles.loading}><SpinLoading /><div className={styles.loadingText}>{t('wallet-scan-camera-tip')}...</div></div>:''}
//             </div>
//         </Popup>
//     )
// }

// export default Html5QrcodePlugin;

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Popup, Button, Toast, SpinLoading } from 'antd-mobile';
import { CloseCircleOutline } from 'antd-mobile-icons';
import styles from './html5QrcodePlugin.module.css';
import { useTranslation } from 'react-i18next';
import VConsole from 'vconsole'
const vConsole=new VConsole()

interface Props {
    shouldStart: boolean;
    qrbox?: number;
    onScanSuccess?: (text: string) => void;
    onStop?: () => void;
}

const Html5QrcodePlugin = ({ shouldStart, qrbox = 250, onScanSuccess, onStop }: Props) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        if (shouldStart) {
            setTimeout(()=>{startScan()},1000);
        } else {
            stopScan();
        }
        return () => stopScan();
    }, [shouldStart]);

    const startScan = async () => {
        try {
            setLoading(true);
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const video = videoRef.current;
            if (!video) return;

            video.srcObject = stream;
            await video.play();

            scanLoop();
            setLoading(false);
        } catch (err) {
            console.log(err,'errrrrrrrrrrrrrrrrrrrrr')
            Toast.show({
                icon: 'fail',
                content: t('wallet-receive-code-scan-tip-1')
            });
            onStop?.();
            setLoading(false);
        }
    }
    const stopScan = () => {
        animationRef.current && cancelAnimationFrame(animationRef.current);
        const video = videoRef.current;
        if (video?.srcObject) {
            (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
    }
    const scanLoop = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
            animationRef.current = requestAnimationFrame(scanLoop);
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code?.data) {
            stopScan();
            onScanSuccess?.(code.data);
            onStop?.();
        } else {
            animationRef.current = requestAnimationFrame(scanLoop);
        }
    }
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            Toast.show({
                icon: 'fail',
                content: t('wallet-receive-code-scan-tip-4')
            });
            event.target.value = '';
            return;
        }

        const img = new Image();
        const reader = new FileReader();
        reader.onload = () => {
            img.onload = () => {
                const canvas = canvasRef.current!;
                const ctx = canvas.getContext('2d')!;
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const code = jsQR(imageData.data, img.width, img.height);
                if (code?.data) {
                    onScanSuccess?.(code.data);
                } else {
                    Toast.show({
                        icon: 'fail',
                        content: t('wallet-receive-code-scan-tip-6')
                    });
                }
                onStop?.();
            }
            img.src = reader.result as string;
        }
        reader.readAsDataURL(file);
    }

    return (
        <Popup
            visible={shouldStart}
            onMaskClick={() => onStop?.()}
            onClose={() => onStop?.()}
            bodyStyle={{ height: '100%' }}
            style={{ '--z-index': '9999999' }}
            forceRender
        >
            <div className={styles.scanCamera}>
                <Button onClick={() => onStop?.()} className={styles.closeBtn} color='primary' fill='none'>
                    <CloseCircleOutline />
                </Button>
                <video ref={videoRef} className={styles.reader} playsInline muted />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <Button
                    className={styles.uploadBtn}
                    color='primary'
                    fill='outline'
                    onClick={() => document.getElementById('qr-upload')?.click()}
                >
                    {t('wallet-receive-code-scan-file-btn')}
                </Button>
                <input
                    type='file'
                    id='qr-upload'
                    accept='image/*'
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                />
                {loading ? (
                    <div className={styles.loading}>
                        <SpinLoading />
                        <div className={styles.loadingText}>{t('wallet-scan-camera-tip')}...</div>
                    </div>
                ) : null}
            </div>
        </Popup>
    )
}

export default Html5QrcodePlugin;

