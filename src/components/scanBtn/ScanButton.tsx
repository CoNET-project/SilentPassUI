import React, { useState } from "react";
import { Button, Modal, Toast } from "antd-mobile";
import Html5QrcodePlugin from "./Html5QrcodePlugin";
import styles from "./scanButton.module.scss";
import { useDaemonContext } from "@/providers/DaemonProvider"
import { QrCode } from "lucide-react";
import {emitWalletEvent} from '@/services/beamio'

interface Props {
  iconSize?: number; // <----- 新增
}

const ScanButton = ({ iconSize = 18 }: Props) => {  // <----- 默认18
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);

const { 
		setScanData
	} = useDaemonContext()
  const handleGoScan = async () => {
		setLoading(true);

		try {
		const status = await navigator.permissions.query({ name: 'camera' as PermissionName });

		if (status.state === 'denied') {
			Modal.show({
			content: "Camera permission denied or unavailable",
			closeOnAction: true,
			actions: [
				{ key: 'confirm', text: 'Confirm' },
			],
			});
			setLoading(false);
			return;
		}

		setScanning(true);
		setLoading(false);
		return;

		} catch (err: any) {
		// iOS 或 prompt 触发 getUserMedia
		try {
			await navigator.mediaDevices.getUserMedia({ video: true });
			setScanning(true);
			setLoading(false);
		} catch (e: any) {
			Modal.show({
			content: "Camera permission denied or unavailable",
			closeOnAction: true,
			actions: [
				{ key: 'confirm', text: 'Confirm' },
			],
			});
			setLoading(false);
		}
		}
	};

	const handleScanSuccess = (text: string) => {
			setScanData(text)
			emitWalletEvent("scan:url", text);
			return
	}

  return (
    <>
      <Button
        onClick={handleGoScan}
        loading={loading}
        className={styles.scanBtn}
        color="primary"
        fill="none"
      >
		
        <QrCode
			// stroke="currentColor"
			className="text-slate-700"
			style={{
				width: iconSize,
				height: iconSize,
			}}
		/>
      </Button>

      <Html5QrcodePlugin
        shouldStart={scanning}
        qrbox={250}
        onScanSuccess={handleScanSuccess}
        onStop={() => setScanning(false)}
      />
    </>
  );
};

export default ScanButton;
