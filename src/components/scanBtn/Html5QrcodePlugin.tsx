import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { X, Loader2, ImageUp } from 'lucide-react'

interface Props {
  shouldStart: boolean
  qrbox?: number
  onScanSuccess?: (text: string) => void
  onStop?: () => void
}

const Html5QrcodePlugin = ({ shouldStart, qrbox = 250, onScanSuccess, onStop }: Props) => {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animationRef = useRef<number>()
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleMyCode = () => {
    stopScan()
    onStop?.()
    navigate('/qr', { state: { tab: 'mycode' } })
  }

  const openFilePicker = () => {
    stopScan()
    setLoading(false)
    setRedirecting(false)

    const input = document.getElementById('qr-upload') as HTMLInputElement | null
    input?.click()
  }


  useEffect(() => {
    if (shouldStart) {
      setTimeout(() => startScan(), 100)
    } else {
      stopScan()
    }
    setRedirecting(false)
    setPermissionError(null)
    return () => stopScan()
  }, [shouldStart])

  const startScan = async () => {
    setLoading(true)
    setPermissionError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })

      const video = videoRef.current
      if (!video) return

      video.srcObject = stream
      await video.play()

      scanLoop()
      setLoading(false)
    } catch (error: unknown) {
      setLoading(false)
      const errorMsg = error instanceof Error ? error.message : String(error ?? '')
      if (errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('denied')) {
        onStop?.()
        setPermissionError('Camera permission denied or unavailable')
      } else {
        showToast('Camera error')
      }
    }
  }

  const stopScan = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = undefined
    }

    const video = videoRef.current
    if (video?.srcObject) {
      ;(video.srcObject as MediaStream).getTracks().forEach(track => track.stop())
      video.srcObject = null
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.display = 'none'
    }
  }

  const scanLoop = () => {
    if (!shouldStart || uploading || redirecting) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanLoop)
      return
    }

    canvas.style.display = 'block'
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: 'dontInvert',
    })

    if (code?.data) {
      drawLine(ctx, code.location.topLeftCorner, code.location.topRightCorner, '#FF3B58')
      drawLine(ctx, code.location.topRightCorner, code.location.bottomRightCorner, '#FF3B58')
      drawLine(ctx, code.location.bottomRightCorner, code.location.bottomLeftCorner, '#FF3B58')
      drawLine(ctx, code.location.bottomLeftCorner, code.location.topLeftCorner, '#FF3B58')

      stopScan()
      setRedirecting(true)
      onScanSuccess?.(code.data)
      onStop?.()
    } else {
      animationRef.current = requestAnimationFrame(scanLoop)
    }
  }

  const drawLine = (
    ctx: CanvasRenderingContext2D,
    begin: { x: number; y: number },
    end: { x: number; y: number },
    color: string
  ) => {
    ctx.beginPath()
    ctx.moveTo(begin.x, begin.y)
    ctx.lineTo(end.x, end.y)
    ctx.lineWidth = 4
    ctx.strokeStyle = color
    ctx.stroke()
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploading(true)

    const file = event.target.files?.[0]
    if (!file) {
      setUploading(false)
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      showToast('Image size cannot exceed 5MB')
      event.target.value = ''
      setUploading(false)
      return
    }

    stopScan()

    const reader = new FileReader()
    const img = new Image()

    reader.onload = () => {
      img.onload = () => {
        try {
          const canvas = canvasRef.current
          if (!canvas) {
            showToast('Internal error: canvas not ready')
            return
          }

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            showToast('Internal error: canvas not ready')
            return
          }

          const w = img.naturalWidth || img.width
          const h = img.naturalHeight || img.height

          canvas.width = w
          canvas.height = h
          canvas.style.display = 'block'

          ctx.drawImage(img, 0, 0, w, h)

          const imageData = ctx.getImageData(0, 0, w, h)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          })

          if (code?.data) {
            onScanSuccess?.(code.data)
            onStop?.()
          } else {
            showToast('File scan failed')
          }
        } catch {
          showToast('File scan error')
        } finally {
          setUploading(false)
          event.target.value = ''
        }
      }

      img.onerror = () => {
        showToast('Image load failed')
        setUploading(false)
      }

      img.src = reader.result as string
    }

    reader.onerror = () => {
      showToast('File read failed')
      setUploading(false)
    }

    reader.readAsDataURL(file)
  }

  if (!shouldStart) return null

  return (
    <div className="fixed inset-0 z-[9999999] flex flex-col pointer-events-auto bg-black">
      {/* 摄像头外景作为背景 */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      />
      {/* 渐变遮罩 60% 不透明度 + 1rem 背景模糊（摄像头的毛玻璃效果） */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background: 'linear-gradient(135deg, rgba(26,26,46,0.6) 0%, rgba(22,33,62,0.6) 25%, rgba(15,52,96,0.6) 50%, rgba(233,69,96,0.6) 100%)',
          backdropFilter: 'blur(1rem)',
          WebkitBackdropFilter: 'blur(0.5rem)',
          pointerEvents: 'none',
        }}
      />
      <div className="flex-1 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] relative z-10">
        {/* Header - Scan | My Code 分段，同 QrOperationPage */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onStop?.()}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <div className="flex p-1 rounded-full bg-white/10">
              <button
                type="button"
                className="px-5 py-2 rounded-full text-sm font-semibold bg-white text-slate-800"
              >
                Scan
              </button>
              <button
                type="button"
                onClick={handleMyCode}
                className="px-5 py-2 rounded-full text-sm font-semibold text-white/80 hover:text-white transition-colors"
              >
                Show to pay
              </button>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Scanner area - 与 QrOperationPage 相同布局 */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="relative w-full max-w-[280px] aspect-square">
            <div className="relative w-full h-full rounded-2xl overflow-hidden flex flex-col items-center justify-center border-2 border-white/20 bg-black/50">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ display: 'none' }}
              />

              {/* Loading overlay */}
              {(loading || redirecting) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10">
                  <Loader2 className="w-10 h-10 text-blue-400 animate-spin" strokeWidth={2} />
                  <p className="mt-3 text-sm text-white/80">
                    {redirecting ? 'Redirecting...' : 'Starting camera...'}
                  </p>
                </div>
              )}

              {/* 四角白框 */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-4 top-4 w-12 h-12 border-l-4 border-t-4 border-white/60 rounded-tl-lg" />
                <div className="absolute right-4 top-4 w-12 h-12 border-r-4 border-t-4 border-white/60 rounded-tr-lg" />
                <div className="absolute left-4 bottom-4 w-12 h-12 border-l-4 border-b-4 border-white/60 rounded-bl-lg" />
                <div className="absolute right-4 bottom-4 w-12 h-12 border-r-4 border-b-4 border-white/60 rounded-br-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作：Choose File，样式同 Pay/Gift/Add */}
        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={openFilePicker}
            disabled={uploading}
            className="w-full flex flex-col items-center justify-center py-4 rounded-2xl bg-black/30 text-white hover:bg-black/40 active:scale-95 transition-all disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-8 h-8 text-slate-400 mb-2 animate-spin" strokeWidth={2} />
            ) : (
              <ImageUp className="w-8 h-8 text-slate-300 mb-2" strokeWidth={2} />
            )}
            <span className="text-xs font-semibold uppercase">
              {uploading ? 'Scanning...' : 'Choose File'}
            </span>
          </button>
        </div>
      </div>

      <input
        type="file"
        id="qr-upload"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Permission error modal */}
      {permissionError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 px-6">
          <div className="rounded-2xl bg-slate-800 p-6 max-w-[320px] text-center">
            <p className="text-white mb-4">{permissionError}</p>
            <button
              type="button"
              onClick={() => { setPermissionError(null); onStop?.() }}
              className="px-6 py-2 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+6rem)] left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-slate-800/95 text-white text-sm shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  )
}

export default Html5QrcodePlugin
