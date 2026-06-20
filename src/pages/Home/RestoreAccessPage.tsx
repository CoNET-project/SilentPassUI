import { useRef, useState } from 'react'
import jsQR from 'jsqr'
import { AlertTriangle, ArrowLeft, ArrowRight, HelpCircle, Lock, QrCode, ShieldCheck } from 'lucide-react'

const headlineFont = "font-['Manrope',ui-sans-serif,system-ui,sans-serif]"

type RestoreAccessPageProps = {
	onBack: () => void
	onRestoreCode: (code: string) => Promise<void>
}

export default function RestoreAccessPage({
	onBack,
	onRestoreCode,
}: RestoreAccessPageProps) {
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [recoveryCode, setRecoveryCode] = useState('')
	const [selectedFileName, setSelectedFileName] = useState('')
	const [error, setError] = useState('')
	const [isParsingFile, setIsParsingFile] = useState(false)
	const [isRestoring, setIsRestoring] = useState(false)

	const openFilePicker = () => {
		if (isParsingFile || isRestoring) return
		fileInputRef.current?.click()
	}

	const parseRecoveryCodeFromImage = async (file: File): Promise<string> => {
		const objectUrl = URL.createObjectURL(file)
		try {
			const image = await new Promise<HTMLImageElement>((resolve, reject) => {
				const img = new Image()
				img.onload = () => resolve(img)
				img.onerror = () => reject(new Error('Unable to read the selected image.'))
				img.src = objectUrl
			})
			const canvas = document.createElement('canvas')
			canvas.width = image.naturalWidth || image.width
			canvas.height = image.naturalHeight || image.height
			const ctx = canvas.getContext('2d')
			if (!ctx) throw new Error('Unable to process the selected image.')
			ctx.drawImage(image, 0, 0)
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
			const result = jsQR(imageData.data, imageData.width, imageData.height)
			const text = result?.data?.trim()
			if (!text) throw new Error('No recovery QR code was found in that image.')
			return text
		} finally {
			URL.revokeObjectURL(objectUrl)
		}
	}

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		event.currentTarget.value = ''
		if (!file) return
		setError('')
		setSelectedFileName(file.name)
		if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
			setRecoveryCode('')
			setError('PDF recovery import is not supported yet. Please choose a PNG or JPG QR image.')
			return
		}
		if (!file.type.startsWith('image/')) {
			setRecoveryCode('')
			setError('Please choose a PNG or JPG image that contains your recovery QR code.')
			return
		}
		setIsParsingFile(true)
		try {
			const nextCode = await parseRecoveryCodeFromImage(file)
			setRecoveryCode(nextCode)
		} catch (err) {
			setRecoveryCode('')
			setError((err as Error)?.message ?? 'Unable to read that recovery QR image.')
		} finally {
			setIsParsingFile(false)
		}
	}

	const handleValidateRestore = async () => {
		if (isParsingFile || isRestoring) return
		if (!recoveryCode.trim()) {
			setError('Please select a recovery QR image first.')
			return
		}
		setError('')
		setIsRestoring(true)
		try {
			await onRestoreCode(recoveryCode)
		} catch (err) {
			setError((err as Error)?.message ?? 'Unable to restore from that recovery code.')
		} finally {
			setIsRestoring(false)
		}
	}

	return (
		<div
			className={`flex min-h-[max(100dvh,884px)] flex-col overflow-x-hidden bg-[#f5f7f9] text-[#2c2f31] ${headlineFont}`}
			style={{
				backgroundImage: `
					radial-gradient(at 0% 0%, rgba(21, 98, 240, 0.05) 0px, transparent 50%),
					radial-gradient(at 100% 100%, rgba(122, 157, 255, 0.08) 0px, transparent 50%)`,
			}}
		>
			<header
				className="fixed left-0 right-0 top-0 z-50 bg-white/70 backdrop-blur-xl"
				style={{ paddingTop: 'env(safe-area-inset-top)' }}
			>
				<div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
					<div className="flex items-center gap-4">
						<button
							type="button"
							onClick={onBack}
							className="text-[#0051d1] transition-transform active:scale-95"
							aria-label="返回"
						>
							<ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
						</button>
						<h1 className="text-lg font-bold tracking-tight text-[#2c2f31]">Recovery</h1>
					</div>
					<div className="text-xl font-black tracking-tighter text-[#0051d1]">Beamio</div>
				</div>
			</header>

			<main className="flex flex-grow items-center justify-center px-6 pb-12 pt-24">
				<div className="w-full max-w-lg">
					<div className="mb-12 text-center">
						<h2 className={`${headlineFont} mb-4 text-4xl font-extrabold leading-tight tracking-tight text-[#2c2f31] lg:text-5xl`}>
							Restore Access
						</h2>
						<p className="mx-auto max-w-sm text-lg leading-relaxed text-[#595c5e]">
							Use your Recovery QR code to regain access to your workspace without a password.
						</p>
					</div>

					<div className="group relative overflow-hidden rounded-xl bg-white p-2 shadow-[0_20px_40px_rgba(21,98,240,0.06)]">
						<input
							ref={fileInputRef}
							type="file"
							accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
							className="hidden"
							onChange={handleFileChange}
						/>
						<div className="pointer-events-none absolute inset-0 bg-[#0051d1]/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
						<div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#dfe3e6] bg-[#eef1f3]/30 p-10 text-center transition-all duration-300 hover:border-[#0051d1]/30">
							<div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#7a9dff]/20 text-[#0051d1]">
								<QrCode className="h-10 w-10" strokeWidth={1.8} aria-hidden />
								<div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-[#0051d1] animate-pulse" />
							</div>
							<p className="mb-2 font-semibold text-[#2c2f31]">
								Upload or scan your Recovery QR code image
							</p>
							<p className="text-xs uppercase tracking-[0.05em] text-[#595c5e]">
								Supports PNG, JPG or PDF
							</p>
							{selectedFileName ? (
								<p className="mt-4 max-w-full truncate text-xs font-semibold text-[#0051d1]">
									{selectedFileName}
								</p>
							) : null}
							<button
								type="button"
								onClick={openFilePicker}
								disabled={isParsingFile || isRestoring}
								className="mt-8 rounded-full bg-[#dfe3e6] px-6 py-2.5 text-sm font-medium text-[#2c2f31] transition-all hover:bg-[#d9dde0] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isParsingFile ? 'Reading File…' : 'Select File'}
							</button>
						</div>
					</div>

					<div className="mt-10 flex flex-col items-center gap-6">
						<button
							type="button"
							onClick={handleValidateRestore}
							disabled={!recoveryCode.trim() || isParsingFile || isRestoring}
							className="relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[#0051d1] text-lg font-bold text-white shadow-lg shadow-[#0051d1]/20 transition-all hover:shadow-[#0051d1]/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
						>
							<span className="absolute inset-0 bg-gradient-to-r from-[#0051d1] to-[#7a9dff] opacity-50" />
							<span className="absolute left-0 top-0 h-px w-full bg-white/20" />
							<span className="relative z-10">{isRestoring ? 'Restoring…' : 'Validate & Restore'}</span>
							<ArrowRight className="relative z-10 h-5 w-5" strokeWidth={2.25} aria-hidden />
						</button>

						{error ? (
							<div className="flex w-full items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-800">
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
								<span>{error}</span>
							</div>
						) : null}

						<a
							href="mailto:support@beamio.app?subject=Beamio%20Business%20recovery"
							className="inline-flex items-center gap-2 font-medium text-[#0051d1] transition-all hover:underline"
						>
							<HelpCircle className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
							Where can I find my Recovery QR code?
						</a>
					</div>

					<div className="mt-16 grid grid-cols-2 gap-4">
						<div className="rounded-lg border border-white/40 bg-[#eef1f3]/50 p-6 backdrop-blur-md">
							<Lock className="mb-3 h-5 w-5 text-[#648eff]" strokeWidth={2} aria-hidden />
							<h3 className={`${headlineFont} mb-1 text-sm font-bold text-[#2c2f31]`}>Encrypted Recovery</h3>
							<p className="text-[11px] leading-normal text-[#595c5e]">
								Your recovery data is decrypted locally using your device&apos;s secure enclave.
							</p>
						</div>
						<div className="rounded-lg border border-white/40 bg-[#eef1f3]/50 p-6 backdrop-blur-md">
							<ShieldCheck className="mb-3 h-5 w-5 text-[#648eff]" strokeWidth={2} aria-hidden />
							<h3 className={`${headlineFont} mb-1 text-sm font-bold text-[#2c2f31]`}>Workspace Safety</h3>
							<p className="text-[11px] leading-normal text-[#595c5e]">
								Restoring access will log out all other active sessions for security.
							</p>
						</div>
					</div>
				</div>
			</main>

			<footer className="mt-auto py-8 text-center">
				<p className="text-[10px] uppercase tracking-widest text-[#595c5e]/60">
					Powered by Beamio Cryptographic Infrastructure
				</p>
			</footer>

			<div className="pointer-events-none fixed -left-20 top-1/4 h-64 w-64 rounded-full bg-[#0051d1]/5 blur-[100px]" />
			<div className="pointer-events-none fixed -right-20 bottom-1/4 h-96 w-96 rounded-full bg-[#7a9dff]/10 blur-[120px]" />
		</div>
	)
}
