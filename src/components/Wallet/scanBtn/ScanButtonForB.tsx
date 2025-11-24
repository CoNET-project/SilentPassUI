// ScanButtonForB.tsx

import React, { useState } from "react"
import { Button, Modal, Toast } from "antd-mobile"
import { ScanCodeOutline } from "antd-mobile-icons"
import Html5QrcodePlugin from "./Html5QrcodePlugin"
import styles from "./scanButton.module.scss"
import { useTranslation } from "react-i18next"
import { useDaemonContext } from "@/providers/DaemonProvider"

interface Props {
  // 在 Header 小圆点里用时传 true
  compact?: boolean
}

const ScanButton = ({ compact = false }: Props) => {
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()
  const { darkModle } = useDaemonContext()

  const handleGoScan = async () => {
    setLoading(true)

    try {
      const status = await navigator.permissions.query({ name: "camera" as PermissionName })

      if (status.state === "denied") {
        Modal.show({
          content: t("wallet-receive-code-scan-tip-1"),
          closeOnAction: true,
          actions: [
            {
              key: "confirm",
              text: t("wallet-receive-code-confirm"),
            },
          ],
        })
        setLoading(false)
        return
      }
      setScanning(true)
      setLoading(false)
      return
    } catch (err: any) {
      // iOS 或首次使用的 prompt 状态
      try {
        await navigator.mediaDevices.getUserMedia({ video: true })
        setScanning(true)
        setLoading(false)
      } catch (e: any) {
        Modal.show({
          content: t("wallet-receive-code-scan-tip-1"),
          closeOnAction: true,
          actions: [
            {
              key: "confirm",
              text: t("wallet-receive-code-confirm"),
            },
          ],
        })
        setLoading(false)
      }
    }
  }

  const handleScanSuccess = (text: string) => {
    try {
      const obj = JSON.parse(text)
      // 这里你后面可以加真正的逻辑
      Toast.show({
        icon: "fail",
        content: t("wallet-receive-code-scan-tip-2"),
      })
    } catch (err) {
      Toast.show({
        icon: "fail",
        content: t("wallet-receive-code-scan-tip-2"),
      })
    }
    setScanning(false)
  }

  return (
    <>
      {compact ? (
        // ✅ 只渲染一个小图标，由外层按钮控制整体 w-7 h-7
        <span
          onClick={handleGoScan}
          className="inline-flex items-center justify-center w-3.5 h-3.5"
        >
          <ScanCodeOutline style={{ fontSize: 14 }} />
        </span>
      ) : (
        // 原来的大按钮模式，其他地方照常用
        <Button
          onClick={handleGoScan}
          loading={loading}
          className={styles.scanBtn}
          color="primary"
          fill="none"
        >
          <ScanCodeOutline />
        </Button>
      )}

      <Html5QrcodePlugin
        shouldStart={scanning}
        qrbox={250}
        onScanSuccess={handleScanSuccess}
        onStop={() => setScanning(false)}
      />
    </>
  )
}

export default ScanButton
