// GetPicture.tsx
import React, { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, X, Check } from 'lucide-react'
import { tu } from '@/locale/beamioLocale'

type Props = {
  open: boolean
  onClose: () => void
  // 返回最终图片 dataUrl（已 downscale / 原图）
  onPicked: (dataUrl: string) => void
  // 可选：限制大小（默认 5MB）
  maxSizeBytes?: number
  // 可选：只在 w>250 && h>250 时 downscale
  downscaleTo250?: (img: HTMLImageElement) => string | null
}

export default function GetPicture({
  open,
  onClose,
  onPicked,
  maxSizeBytes = 5 * 1024 * 1024,
  downscaleTo250,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [starting, setStarting] = useState(false)
  const [shooting, setShooting] = useState(false)
  const [error, setError] = useState<string>('')

  // 只创建 video element 一次（跟你 QR 的写法一致）
  useEffect(() => {
    if (!videoRef.current) {
      const v = document.createElement('video')
      v.setAttribute('playsinline', 'true') // iOS 不要全屏
      v.muted = true
      v.autoplay = true
      videoRef.current = v
    }
  }, [])

  useEffect(() => {
    if (!open) {
      stopCamera()
      setError('')
      return
    }

    // open 时自动启相机（你也可以改成由按钮触发）
    startCamera()

    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const startCamera = async () => {
    setError('')
    setStarting(true)
    try {
      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })

      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('video not ready')

      video.srcObject = stream
      await video.play()
    } catch (e: any) {
      const msg = e?.message || String(e)
      setError(msg.toLowerCase().includes('permission') ? 'Camera permission denied' : 'Camera error')
      // 失败也要确保释放
      stopCamera()
    } finally {
      setStarting(false)
    }
  }

  const stopCamera = () => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    const video = videoRef.current
    if (video?.srcObject) {
      video.srcObject = null
    }
  }

  // ✅ 关键：打开文件前先停相机，释放“昂贵进程”
  const openFilePicker = () => {
    stopCamera()
    setStarting(false)
    setShooting(false)
    setError('')
    fileInputRef.current?.click()
  }

  // ✅ 新的文件读取函数：GetPicture（就是你要的“统一读取逻辑”）
  const GetPicture = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Not an image file')
      return
    }
    if (file.size > maxSizeBytes) {
      setError(`Image too large (max ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB)`)
      return
    }

    const dataUrl = await readAsDataURL(file)

    // downscale（如果有传入）
    if (downscaleTo250) {
      const img = new Image()
      const resized = await new Promise<string | null>((resolve) => {
        img.onload = () => resolve(downscaleTo250(img))
        img.onerror = () => resolve(null)
        img.src = dataUrl
      })
      onPicked(resized || dataUrl)
      return
    }

    onPicked(dataUrl)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // 清空 value，保证同一张图重复选也触发
    e.target.value = ''
    if (!file) return

    // 文件模式下已经 stopCamera 了，但这里再保险一次
    stopCamera()
    await GetPicture(file)
    onClose()
  }

  // （可选）拍照按钮：从 video 当前帧抓图
  const takePhotoFromPreview = async () => {
    const video = videoRef.current
    if (!video) return
    if (!streamRef.current) return

    setShooting(true)
    try {
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) throw new Error('camera not ready')

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas error')

      ctx.drawImage(video, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/png')

      // 拍完立刻关相机释放资源
      stopCamera()

      // 走同样的 downscale 流程（复用你的 downscaleTo250）
      if (downscaleTo250) {
        const img = new Image()
        const resized = await new Promise<string | null>((resolve) => {
          img.onload = () => resolve(downscaleTo250(img))
          img.onerror = () => resolve(null)
          img.src = dataUrl
        })
        onPicked(resized || dataUrl)
      } else {
        onPicked(dataUrl)
      }

      onClose()
    } catch (e: any) {
      setError(e?.message || 'Take photo failed')
    } finally {
      setShooting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[99999] bg-black/70">
      <div className="absolute inset-0 flex flex-col">
        {/* top bar */}
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                stopCamera()
                onClose()
              }}
              className="
                h-10 w-10 rounded-full
                bg-white/10 backdrop-blur
                ring-1 ring-white/20
                flex items-center justify-center
                active:scale-95
              "
              aria-label={tu('close')}
            >
              <X className="h-5 w-5 text-white/80" strokeWidth={2.5} />
            </button>

            <div className="text-[13px] font-semibold tracking-[0.12em] text-white/60">
              GET PICTURE
            </div>

            <div className="w-10" />
          </div>
        </div>

        {/* preview area */}
        <div className="flex-1 px-4 py-4">
          <div className="h-full w-full overflow-hidden rounded-[28px] bg-black ring-1 ring-white/10">
            {/* 用一个真实 video element 挂载 */}
            <VideoMount videoRef={videoRef} />
          </div>

          {starting && (
            <div className="mt-3 text-center text-[12px] text-white/60">
              Starting camera...
            </div>
          )}

          {!!error && (
            <div className="mt-3 text-center text-[12px] text-rose-200/90">
              {error}
            </div>
          )}
        </div>

        {/* bottom actions */}
        <div className="px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="mb-4 flex items-center gap-3">
            {/* ✅ 选择文件：按下先 stopCamera 再打开 file picker */}
            <button
              type="button"
              onClick={openFilePicker}
              className="
                flex-1 h-12 rounded-2xl
                bg-white/10 backdrop-blur
                ring-1 ring-white/20
                flex items-center justify-center gap-2
                text-[14px] font-semibold text-white/85
                active:scale-[0.99]
              "
            >
              <ImageIcon className="h-5 w-5" />
              Choose File
            </button>

            {/* ✅ 从预览拍照（可选） */}
            <button
              type="button"
              onClick={takePhotoFromPreview}
              disabled={starting || shooting || !streamRef.current}
              className="
                h-12 w-12 rounded-2xl
                bg-white text-slate-900
                flex items-center justify-center
                shadow-[0_16px_40px_rgba(0,0,0,0.25)]
                active:scale-[0.98]
                disabled:opacity-40
              "
              aria-label="Take photo"
            >
              <Camera className="h-5 w-5" />
            </button>
          </div>

          {/* hidden input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  )
}

function VideoMount({ videoRef }: { videoRef: React.MutableRefObject<HTMLVideoElement | null> }) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    const video = videoRef.current
    if (!host || !video) return

    if (!host.contains(video)) {
      // 清空后再 append，避免重复挂载
      host.innerHTML = ''
      host.appendChild(video)
    }

    // video 样式（cover）
    video.style.width = '100%'
    video.style.height = '100%'
    video.style.objectFit = 'cover'
  }, [videoRef])

  return <div ref={hostRef} className="h-full w-full" />
}

function readAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
