import React, { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Popup, Button, Toast, SpinLoading, Modal } from 'antd-mobile'
import { CloseCircleOutline } from 'antd-mobile-icons'
import styles from './html5QrcodePlugin.module.scss'

interface Props {
  shouldStart: boolean
  qrbox?: number
  onScanSuccess?: (text: string) => void
  onStop?: () => void
}

const Html5QrcodePlugin = ({ shouldStart, qrbox = 250, onScanSuccess, onStop }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animationRef = useRef<number>()
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [uploading, setUploading] = useState(false)

   // ✅ 打开文件选择器前就停掉摄像头 loop
  const openFilePicker = () => {
    stopScan()
    setLoading(false)
    setRedirecting(false)

    const input = document.getElementById('qr-upload') as HTMLInputElement | null
    input?.click()
  }

  // 初始化 video，只建一次
  useEffect(() => {
    if (!videoRef.current) {
      const v = document.createElement('video')
      v.setAttribute('playsinline', 'true') // iOS 不要全屏
      videoRef.current = v
    }
  }, [])

  useEffect(() => {
    if (shouldStart) {
      setTimeout(() => {
        startScan()
      }, 1000)
    } else {
      stopScan()
    }
    setRedirecting(false)
    return () => stopScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldStart])

  const startScan = async () => {
    setLoading(true)
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
    } catch (error: any) {
      setLoading(false)
      const errorMsg = error?.message || error?.toString() || ''
      if (errorMsg.toLowerCase().includes('permission')) {
        onStop?.()
        Modal.show({
          content: 'Camera permission denied or unavailable',
          closeOnAction: true,
          actions: [{ key: 'confirm', text: 'Confirm' }],
        })
      } else {
        Toast.show({ icon: 'fail', content: 'Camera error' })
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
    // ✅ guard：如果已经不该扫描了，就别继续 loop
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
      Toast.show({
        icon: 'fail',
        content: 'Image size cannot exceed 5MB, please select another file!',
      })
      event.target.value = ''
      setUploading(false)
      return
    }

    // ⛔ 先停掉摄像头那套
    stopScan()

    const reader = new FileReader()
    const img = new Image()

    reader.onload = () => {
      img.onload = () => {
        try {
          const canvas = canvasRef.current
          if (!canvas) {
            console.warn('canvasRef is null')
            Toast.show({ icon: 'fail', content: 'Internal error: canvas not ready' })
            return
          }

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            console.warn('2d context is null')
            Toast.show({ icon: 'fail', content: 'Internal error: canvas not ready' })
            return
          }

          const w = img.naturalWidth || img.width
          const h = img.naturalHeight || img.height

          console.log('img size =', w, h)

          canvas.width = w
          canvas.height = h
          canvas.style.display = 'block'

          ctx.drawImage(img, 0, 0, w, h)

          const imageData = ctx.getImageData(0, 0, w, h)
          console.log('imageData', imageData.width, imageData.height)

          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          })

          console.log('jsQR result =', code)

          if (code?.data) {
            onScanSuccess?.(code.data)
            onStop?.()
          } else {
            Toast.show({
              icon: 'fail',
              content: 'File scan failed',
            })
          }
        } catch (err) {
          console.error('decode error', err)
          Toast.show({
            icon: 'fail',
            content: 'File scan error',
          })
        } finally {
          setUploading(false)
          event.target.value = ''
        }
      }

      img.onerror = e => {
        console.error('image load error', e)
        Toast.show({ icon: 'fail', content: 'Image load failed' })
        setUploading(false)
      }

      img.src = reader.result as string
    }

    reader.onerror = e => {
      console.error('file read error', e)
      Toast.show({ icon: 'fail', content: 'File read failed' })
      setUploading(false)
    }

    reader.readAsDataURL(file)
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

				{loading && (
				<div className={styles.loading}>
					<SpinLoading />
					<div className={styles.loadingText}>Starting camera...</div>
				</div>
				)}

				{redirecting && (
				<div className={styles.loading}>
					<SpinLoading />
					<div className={styles.loadingText}>跳转中...</div>
				</div>
				)}

				<Button
				className={styles.uploadBtn}
				color='primary'
				fill='outline'
				loading={uploading}
				// ✅ 改这里：不再直接 click input
				onClick={openFilePicker}
				>
				Choose File
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

export default Html5QrcodePlugin
