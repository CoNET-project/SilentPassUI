import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { FolderOpen, Loader2, QrCode } from 'lucide-react'
import { useTu } from '@/locale/beamioLocale'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type NativeScanResult = { status: 'unhandled' } | { status: 'scanned'; code: string } | { status: 'failed'; error?: string }

type Props = {
	/** Called once with the decoded QR text. */
	onCode: (code: string) => void
	onError: (message: string) => void
	/** iOS shell: native scanner instead of in-page camera. */
	nativeScan?: () => Promise<NativeScanResult>
}

function decodeImageData(data: ImageData) {
	return jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' })?.data?.trim() || ''
}

/** "Scan Recovery QR": camera viewfinder plus "Choose from Files", both decoded with jsQR. */
export default function RecoveryQrScanPanel({ onCode, onError, nativeScan }: Props) {
	const { tu } = useTu()
	const videoRef = useRef<HTMLVideoElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const fileRef = useRef<HTMLInputElement>(null)
	const frameRef = useRef<number>()
	const doneRef = useRef(false)
	const [cameraState, setCameraState] = useState<'starting' | 'live' | 'off'>(nativeScan ? 'off' : 'starting')
	const [decodingFile, setDecodingFile] = useState(false)

	const stopCamera = useCallback(() => {
		if (frameRef.current) cancelAnimationFrame(frameRef.current)
		frameRef.current = undefined
		const video = videoRef.current
		if (video?.srcObject) {
			;(video.srcObject as MediaStream).getTracks().forEach((t) => t.stop())
			video.srcObject = null
		}
	}, [])

	const finish = useCallback(
		(code: string) => {
			if (doneRef.current) return
			doneRef.current = true
			stopCamera()
			onCode(code)
		},
		[onCode, stopCamera],
	)

	const runNativeScan = useCallback(async () => {
		if (!nativeScan) return
		const result = await nativeScan()
		if (result.status === 'scanned') finish(result.code)
		else if (result.status === 'failed' && result.error && result.error !== 'cancelled') {
			onError(tu('unable_to_scan_recovery_qr'))
		}
	}, [nativeScan, finish, onError, tu])

	useEffect(() => {
		if (nativeScan) {
			void runNativeScan()
			return
		}
		let cancelled = false
		const video = videoRef.current
		const canvas = canvasRef.current
		if (!video || !canvas || !navigator.mediaDevices?.getUserMedia) {
			setCameraState('off')
			return
		}
		const loop = () => {
			if (cancelled || doneRef.current) return
			const ctx = canvas.getContext('2d', { willReadFrequently: true })
			if (ctx && video.readyState === 4 && video.videoWidth > 0) {
				canvas.width = video.videoWidth
				canvas.height = video.videoHeight
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
				const code = decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))
				if (code) {
					finish(code)
					return
				}
			}
			frameRef.current = requestAnimationFrame(loop)
		}
		;(async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
				if (cancelled) {
					stream.getTracks().forEach((t) => t.stop())
					return
				}
				video.srcObject = stream
				await video.play()
				setCameraState('live')
				loop()
			} catch {
				if (!cancelled) setCameraState('off')
			}
		})()
		return () => {
			cancelled = true
			stopCamera()
		}
		// Run once per mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const input = event.target
		const file = input.files?.[0]
		if (!file) return
		if (file.size > MAX_IMAGE_BYTES) {
			onError(tu('image_size_cannot_exceed_5mb'))
			input.value = ''
			return
		}
		setDecodingFile(true)
		const url = URL.createObjectURL(file)
		const img = new Image()
		const cleanup = () => {
			URL.revokeObjectURL(url)
			input.value = ''
			setDecodingFile(false)
		}
		img.onload = () => {
			try {
				const canvas = document.createElement('canvas')
				canvas.width = img.naturalWidth || img.width
				canvas.height = img.naturalHeight || img.height
				const ctx = canvas.getContext('2d')
				if (!ctx) throw new Error('no canvas')
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
				const code = decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))
				if (code) finish(code)
				else onError(tu('no_qr_code_found_in_this_image'))
			} catch {
				onError(tu('unable_to_scan_recovery_qr'))
			} finally {
				cleanup()
			}
		}
		img.onerror = () => {
			onError(tu('unable_to_scan_recovery_qr'))
			cleanup()
		}
		img.src = url
	}

	const corner = 'absolute h-12 w-12 border-[#1562f0]'
	return (
		<div className="flex flex-col gap-6">
			<div
				className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-3xl bg-[#1c1f26] shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
				onClick={nativeScan ? () => void runNativeScan() : undefined}
				role={nativeScan ? 'button' : undefined}
				aria-label={nativeScan ? tu('tap_to_scan_recovery_qr') : undefined}
			>
				<video
					ref={videoRef}
					playsInline
					muted
					className={`absolute inset-0 h-full w-full object-cover ${cameraState === 'live' ? '' : 'invisible'}`}
				/>
				<canvas ref={canvasRef} className="hidden" />
				{cameraState !== 'live' && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
						{cameraState === 'starting' ? (
							<Loader2 className="h-10 w-10 animate-spin text-white/60" strokeWidth={2} aria-hidden />
						) : (
							<QrCode className="h-16 w-16 text-white/45" strokeWidth={1.75} aria-hidden />
						)}
						{cameraState === 'off' && !nativeScan ? (
							<span className="text-xs font-medium text-white/60">{tu('camera_unavailable_choose_a_qr_image')}</span>
						) : null}
					</div>
				)}
				<div className="pointer-events-none absolute inset-[16%]" aria-hidden>
					<span className={`${corner} left-0 top-0 rounded-tl-xl border-l-4 border-t-4`} />
					<span className={`${corner} right-0 top-0 rounded-tr-xl border-r-4 border-t-4`} />
					<span className={`${corner} bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4`} />
					<span className={`${corner} bottom-0 right-0 rounded-br-xl border-b-4 border-r-4`} />
				</div>
			</div>

			<button
				type="button"
				onClick={() => fileRef.current?.click()}
				disabled={decodingFile}
				className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#c9d4f2] bg-white text-[15px] font-semibold text-[#1d3fa8] transition-colors hover:bg-[#f3f6ff] active:scale-[0.98] disabled:opacity-60"
			>
				{decodingFile ? (
					<Loader2 className="h-5 w-5 animate-spin text-[#1562f0]" strokeWidth={2.25} aria-hidden />
				) : (
					<FolderOpen className="h-5 w-5 text-[#1562f0]" strokeWidth={2.25} aria-hidden />
				)}
				{tu('choose_from_files')}
			</button>
			<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
		</div>
	)
}
