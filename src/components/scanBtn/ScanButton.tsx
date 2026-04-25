import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback
} from "react"
import { Button, Modal } from "antd-mobile"
import Html5QrcodePlugin from "./Html5QrcodePlugin"
import styles from "./scanButton.module.scss"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { QrCode } from "lucide-react"
import { emitWalletEvent } from "@/services/beamio"

export type ScanButtonHandle = {
  start: (options?: { hideModeSwitcher?: boolean }) => void
  stop: () => void
  isScanning: () => boolean
}

interface Props {
  iconSize?: number
  hidden?: boolean // ✅ 新增：让它可以“看不见但常驻”
  hideModeSwitcher?: boolean
}

const ScanButton = forwardRef<ScanButtonHandle, Props>(({ iconSize = 18, hidden, hideModeSwitcher = false }, ref) => {
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [runtimeHideModeSwitcher, setRuntimeHideModeSwitcher] = useState(false)

  const { setScanData } = useDaemonContext()

  const handleGoScan = useCallback(async () => {
    setLoading(true)

    try {
      const status = await navigator.permissions.query({ name: "camera" as PermissionName })

      if (status.state === "denied") {
        Modal.show({
          content: "Camera permission denied or unavailable",
          closeOnAction: true,
          actions: [{ key: "confirm", text: "Confirm" }]
        })
        setLoading(false)
        return
      }

      setScanning(true)
      setLoading(false)
      return
    } catch (err: any) {
      // iOS 或 prompt 触发 getUserMedia
      try {
        await navigator.mediaDevices.getUserMedia({ video: true })
        setScanning(true)
        setLoading(false)
      } catch (e: any) {
        Modal.show({
          content: "Camera permission denied or unavailable",
          closeOnAction: true,
          actions: [{ key: "confirm", text: "Confirm" }]
        })
        setLoading(false)
      }
    }
  }, [])

  const stopScan = useCallback(() => {
    setScanning(false)
    setRuntimeHideModeSwitcher(false)
  }, [])

  useImperativeHandle(ref, () => ({
    start: (options) => {
      // 防抖：避免重复触发
      if (!scanning && !loading) {
        setRuntimeHideModeSwitcher(Boolean(options?.hideModeSwitcher))
        handleGoScan()
      }
    },
    stop: () => stopScan(),
    isScanning: () => scanning
  }), [handleGoScan, scanning, loading, stopScan])

  const handleScanSuccess = (text: string) => {
    setScanData(text)
    emitWalletEvent("scan:url", text)
  }

  return (
    <div
      // ✅ hidden 时不占布局、不响应点击，但组件仍挂载
      style={hidden ? { position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" } : undefined}
      aria-hidden={hidden ? true : undefined}
    >
      {/* 你仍然可以保留按钮（非 hidden 时可见） */}
      {!hidden && (
        <Button
          onClick={handleGoScan}
          loading={loading}
          className={styles.scanBtn}
          color="primary"
          fill="none"
        >
          <QrCode
            className="text-slate-700"
            style={{ width: iconSize, height: iconSize }}
          />
        </Button>
      )}

      <Html5QrcodePlugin
        shouldStart={scanning}
        qrbox={250}
        onScanSuccess={handleScanSuccess}
      onStop={stopScan}
      hideModeSwitcher={hideModeSwitcher || runtimeHideModeSwitcher}
      />
    </div>
  )
})

ScanButton.displayName = "ScanButton"

export default ScanButton
