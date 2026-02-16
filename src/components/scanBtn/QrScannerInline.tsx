import React, { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { emitWalletEvent } from "@/services/beamio"
import { Loader2 } from "lucide-react"

interface Props {
  active: boolean
  onClose?: () => void
}

/** 内联 QR 扫描器：渲染在容器内，无 Popup */
export default function QrScannerInline({ active, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [loading, setLoading] = useState(false)
  const { setScanData } = useDaemonContext()

  const stopScan = React.useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = undefined
    }
    const video = videoRef.current
    if (video?.srcObject) {
      ;(video.srcObject as MediaStream).getTracks().forEach((track) => track.stop())
      video.srcObject = null
    }
    const canvas = canvasRef.current
    if (canvas) canvas.style.display = "none"
  }, [])

  useEffect(() => {
    if (!active) {
      stopScan()
      return () => stopScan()
    }

    let cancelled = false
    const video = videoRef.current
    if (!video) return () => stopScan()

    const startScan = async () => {
      setLoading(true)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        if (cancelled) return
        video.srcObject = stream
        await video.play()
        scanLoop()
      } catch {
        setLoading(false)
        onClose?.()
      }
      setLoading(false)
    }

    const scanLoop = () => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!video || !canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx || video.readyState !== 4) {
        animationRef.current = requestAnimationFrame(scanLoop)
        return
      }
      canvas.style.display = "block"
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" })
      if (code?.data) {
        stopScan()
        setScanData(code.data)
        emitWalletEvent("scan:url", code.data)
        onClose?.()
      } else {
        animationRef.current = requestAnimationFrame(scanLoop)
      }
    }

    startScan()
    return () => {
      cancelled = true
      stopScan()
    }
  }, [active, stopScan, setScanData, onClose])

  if (!active) return null

  return (
    <div className="relative w-full aspect-square max-w-[280px] mx-auto overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: "none", transform: "scaleX(-1)" }}
      />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          <Loader2 className="w-12 h-12 text-white animate-spin" strokeWidth={2} />
          <span className="mt-3 text-sm text-white/90">Starting camera...</span>
        </div>
      )}
    </div>
  )
}
