import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Popup, Button, Toast, SpinLoading, Modal } from 'antd-mobile';
import { CloseCircleOutline } from 'antd-mobile-icons';
import styles from './html5QrcodePlugin.module.scss';
import { useTranslation } from 'react-i18next';

interface Props {
    shouldStart: boolean;
    qrbox?: number;
    onScanSuccess?: (text: string) => void;
    onStop?: () => void;
}

const Html5QrcodePlugin = ({ shouldStart, qrbox = 250, onScanSuccess, onStop }: Props) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const [loading, setLoading] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const { t } = useTranslation();
    let video = document.createElement("video");

    useEffect(() => {
        if (shouldStart) {
            setTimeout(()=>{startScan()},1000);
        } else {
            stopScan();
        }
        setRedirecting(false);
        return () => stopScan();
    }, [shouldStart]);

    const startScan = async () => {
        setLoading(true);
        try{
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (!video) return;
            video.srcObject = stream;
            video.setAttribute("playsinline", "true"); // required to tell iOS safari we don't want fullscreen
            video.play();
            scanLoop();
            setLoading(false);
        }catch(error:any){
            const errorMsg = error?.message || error?.toString() || "";
            if(errorMsg.toLowerCase().includes("permission")){
                onStop?.();
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
            }
        }
    }
    const stopScan = () => {
        animationRef.current && cancelAnimationFrame(animationRef.current);
        if (video?.srcObject) {
            (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        const canvas = canvasRef.current;

        if (!video || !canvas) return;
        canvas.style.display = 'none';
    }
    const scanLoop = () => {
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
            animationRef.current = requestAnimationFrame(scanLoop);
            return;
        }
        canvas.style.display = 'block';
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height,{inversionAttempts: "dontInvert"});

        if (code?.data) {
            drawLine(ctx,code.location.topLeftCorner, code.location.topRightCorner, "#FF3B58");
            drawLine(ctx,code.location.topRightCorner, code.location.bottomRightCorner, "#FF3B58");
            drawLine(ctx,code.location.bottomRightCorner, code.location.bottomLeftCorner, "#FF3B58");
            drawLine(ctx,code.location.bottomLeftCorner, code.location.topLeftCorner, "#FF3B58");
            stopScan();
            setRedirecting(true);
            onScanSuccess?.(code.data);
            onStop?.();
        } else {
            animationRef.current = requestAnimationFrame(scanLoop);
        }
    }
    const drawLine = (ctx: CanvasRenderingContext2D,begin: { x: number; y: number },end: { x: number; y: number },color: string) => {
        ctx.beginPath();
        ctx.moveTo(begin.x, begin.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineWidth = 4;
        ctx.strokeStyle = color;
        ctx.stroke();
    }
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        setUploading(true);
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
                const code = jsQR(imageData.data, img.width, img.height,{inversionAttempts: "dontInvert"});
                if (code?.data) {
                    onScanSuccess?.(code.data);
                } else {
                    Toast.show({
                        icon: 'fail',
                        content: t('wallet-receive-code-scan-tip-6')
                    });
                }
                onStop?.();
                setUploading(false);
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
                <canvas ref={canvasRef} className={styles.reader} style={{ display: 'none' }} />

                {loading ? (
                    <div className={styles.loading}>
                        <SpinLoading />
                        <div className={styles.loadingText}>{t('wallet-scan-camera-tip')}...</div>
                    </div>
                ) : null}

                {redirecting ? (
                    <div className={styles.loading}>
                        <SpinLoading />
                        <div className={styles.loadingText}>跳转中...</div>
                    </div>
                ) : null}

                <Button
                    className={styles.uploadBtn}
                    color='primary'
                    fill='outline'
                    loading={uploading}
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
            </div>
        </Popup>
    )
}

export default Html5QrcodePlugin;

