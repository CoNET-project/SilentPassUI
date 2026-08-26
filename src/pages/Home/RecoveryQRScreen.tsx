import React, { useState, useRef, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
	Copy,
	Check,
	Loader,
	Loader2,
	Key,
	KeyRound,
	Lock,
	Wifi,
	RefreshCw,
	Image as ImageIcon,
	ArrowRight,
	ShieldCheck,
} from 'lucide-react'
import html2canvas from 'html2canvas'
import { BIZ_PUBLIC_LOGO512, bizBrandFocusRingClass } from '@/pages/Home/brandUi'
import { BizOnboardingLocalePicker } from '@/pages/Home/BizOnboardingLocalePicker'
import { getCurrentBeamioUiLocale, useTu } from '@/locale/beamioLocale'

export const ACTIVATING_STEP_DEFS = [
	{ id: 0, titleKey: 'onb_recovery_activate_step0_title', descKey: 'onb_recovery_activate_step0_desc', icon: KeyRound },
	{ id: 1, titleKey: 'onb_recovery_activate_step1_title', descKey: 'onb_recovery_activate_step1_desc', icon: Lock },
	{ id: 2, titleKey: 'onb_recovery_activate_step2_title', descKey: 'onb_recovery_activate_step2_desc', icon: Wifi },
	{ id: 3, titleKey: 'onb_recovery_activate_step3_title', descKey: 'onb_recovery_activate_step3_desc', icon: RefreshCw },
] as const
const STEP_DURATION_MS = 5000
type RecoveryQRScreenProps = {
	qrDataUrl: string
	recoveryCode: string
	showButton: boolean
	/** 用户输入的 beamio tag，用于保存时作为文件名 */
	beamioTag?: string
	isRedeemFlow?: boolean
	redeemActivating?: boolean
	close: () => void | Promise<void>
	/** Optional; chrome no longer shows a back control. */
	onBack?: () => void
}

const toSafeFilename = (tag: string) =>
	tag
		.trim()
		.replace(/^@+/, '')
		.replace(/[/\\:*?"<>|]/g, '-')
		.replace(/\s+/g, '-') || 'beamio-master-key'

/** Display-only grouping (clipboard still uses raw `recoveryCode`). */
function formatRecoveryKeyForDisplay(code: string): string {
	if (!code) return ''
	const trimmed = code.trim()
	if (/^(verra-|beamio-)/i.test(trimmed)) return trimmed.toUpperCase()
	const alnum = trimmed.replace(/[^a-zA-Z0-9]/g, '')
	if (alnum.length === 0) return trimmed
	const groups = alnum.toUpperCase().match(/.{1,4}/g) ?? []
	return groups.join('-')
}

function detectRecoveryDeviceLabel(): string {
	if (typeof navigator === 'undefined') return 'This device'
	const ua = navigator.userAgent
	if (/iPad/i.test(ua)) return 'iPad'
	if (/Macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document) return 'iPad'
	if (/Mac OS X/i.test(ua)) return 'MacBook Pro'
	if (/iPhone/i.test(ua)) return 'iPhone'
	if (/Android/i.test(ua)) return 'Android'
	if (/Windows/i.test(ua)) return 'Windows'
	if (/Linux/i.test(ua)) return 'Linux'
	return 'This device'
}

function recoveryPanelUserLabel(tag?: string): string {
	const clean = (tag ?? '').trim().replace(/^@+/, '')
	return clean ? `@${clean}` : '@Beamio'
}

/** Public ID for the export panel — never derived from the recovery key. */
function recoveryPanelIdLabel(tag?: string): string {
	const clean = (tag ?? '').replace(/^@+/, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
	if (clean.length >= 4) return `#${clean.slice(0, 6)}`
	return '#BIZ'
}

const HEX_BG = `url("data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="48" viewBox="0 0 28 48">
		<path d="M14 2.2 L25.5 9.1 V22.9 L14 29.8 L2.5 22.9 V9.1 Z" fill="none" stroke="rgba(186,214,255,0.22)" stroke-width="0.7"/>
	</svg>`,
)}")`

const headlineClass = "font-['Manrope',ui-sans-serif,system-ui,sans-serif]"
const outlineBtnClass = `flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white py-3.5 text-[15px] font-semibold text-[#0f172a] transition-colors hover:bg-[#f8fafc] active:scale-[0.99] disabled:cursor-not-allowed ${bizBrandFocusRingClass}`

const RecoveryQRScreen = ({
	qrDataUrl,
	recoveryCode,
	showButton,
	beamioTag,
	isRedeemFlow = false,
	redeemActivating = false,
	close,
}: RecoveryQRScreenProps) => {
	const { tu } = useTu()
	const uiLocale = getCurrentBeamioUiLocale()
	const [copied, setCopied] = useState(false)
	const [loading, setLoading] = useState(false)
	const [savingImage, setSavingImage] = useState(false)
	const [isConfirmed, setIsConfirmed] = useState(false)
	const [activatingStep, setActivatingStep] = useState(0)
	const [hasBackedUp, setHasBackedUp] = useState(false)

	const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)
	const captureRef = useRef<HTMLDivElement | null>(null)
	const saveInFlightRef = useRef(false)

	const isActivating = (loading || redeemActivating) && isRedeemFlow
	useEffect(() => {
		if (!isActivating) {
			setActivatingStep(0)
			return
		}
		const advance = () => {
			setActivatingStep((prev) => Math.min(prev + 1, ACTIVATING_STEP_DEFS.length - 1))
		}
		const timers: ReturnType<typeof setTimeout>[] = []
		for (let i = 1; i < ACTIVATING_STEP_DEFS.length; i++) {
			timers.push(setTimeout(advance, i * STEP_DURATION_MS))
		}
		return () => timers.forEach((t) => clearTimeout(t))
	}, [isActivating])

	const handleSaveImage = async () => {
		if (saveInFlightRef.current) return
		saveInFlightRef.current = true
		setSavingImage(true)
		try {
			let dataUrl = ''
			if (captureRef.current) {
				const canvas = await html2canvas(captureRef.current, {
					scale: 2,
					backgroundColor: '#071126',
					useCORS: true,
					logging: false,
				})
				dataUrl = canvas.toDataURL('image/png')
			} else if (qrCanvasRef.current) {
				dataUrl = qrCanvasRef.current.toDataURL('image/png')
			}
			if (!dataUrl) return
			const link = document.createElement('a')
			link.href = dataUrl
			link.download = `${toSafeFilename(beamioTag ?? '')}.png`
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			setHasBackedUp(true)
		} catch {
			if (qrCanvasRef.current) {
				const dataUrl = qrCanvasRef.current.toDataURL('image/png')
				const link = document.createElement('a')
				link.href = dataUrl
				link.download = `${toSafeFilename(beamioTag ?? '')}.png`
				document.body.appendChild(link)
				link.click()
				document.body.removeChild(link)
				setHasBackedUp(true)
			}
		} finally {
			saveInFlightRef.current = false
			setSavingImage(false)
		}
	}

	const handleCopyCode = async () => {
		if (!recoveryCode) return
		try {
			await navigator.clipboard.writeText(recoveryCode)
			setCopied(true)
			setHasBackedUp(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// ignore
		}
	}

	if (isActivating) {
		return (
			<div
				key={uiLocale}
				className="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto bg-white p-8"
			>
				<div className="relative mb-8">
					<div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#1562f0] shadow-xl shadow-[#1562f0]/40">
						<Loader className="h-9 w-9 animate-spin text-white" strokeWidth={2.5} />
					</div>
					<div className="absolute -inset-4 animate-pulse rounded-[40px] bg-[#1562f0] opacity-10 blur-xl" />
				</div>
				<div className="w-full max-w-sm space-y-6">
					{ACTIVATING_STEP_DEFS.map((step, idx) => {
						const isCompleted = idx < activatingStep
						const isActive = idx === activatingStep
						const Icon = step.icon
						return (
							<div key={step.id} className="flex items-start gap-4">
								<div
									className={[
										'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors',
										isCompleted && 'bg-emerald-500',
										isActive && 'bg-[#1562f0]',
										!isCompleted && !isActive && 'bg-slate-200',
									]
										.filter(Boolean)
										.join(' ')}
								>
									{isCompleted ? (
										<Check className="h-5 w-5 text-white" strokeWidth={2.5} />
									) : isActive ? (
										<Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
									) : (
										<Icon className="h-5 w-5 text-slate-400" strokeWidth={2.5} />
									)}
								</div>
								<div className="min-w-0 flex-1 pt-0.5">
									<p
										className={[
											'text-[15px] font-semibold transition-colors',
											isActive && 'text-[#1562f0]',
											isCompleted && 'text-slate-700',
											!isCompleted && !isActive && 'text-slate-400',
										]
											.filter(Boolean)
											.join(' ')}
									>
										{tu(step.titleKey)}
									</p>
									<p
										className={[
											'mt-0.5 text-sm transition-colors',
											isActive && 'text-slate-700',
											isCompleted && 'text-slate-500',
											!isCompleted && !isActive && 'text-slate-400',
										]
											.filter(Boolean)
											.join(' ')}
									>
										{tu(step.descKey)}
									</p>
								</div>
							</div>
						)
					})}
				</div>
			</div>
		)
	}

	const displayRecoveryKey = formatRecoveryKeyForDisplay(recoveryCode)
	const deviceLabel = detectRecoveryDeviceLabel()
	const userLabel = recoveryPanelUserLabel(beamioTag)
	const idLabel = recoveryPanelIdLabel(beamioTag)

	return (
		<div
			key={uiLocale}
			className="flex min-h-full w-full flex-1 flex-col bg-[#f4f6f8] text-[#0f172a] antialiased"
		>
			<div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
				<div className="mb-2 flex justify-end">
					<BizOnboardingLocalePicker />
				</div>

				<header className="mb-8 text-center">
					<h1
						className={`${headlineClass} text-[1.75rem] font-extrabold leading-tight tracking-tight text-[#0b1220] sm:text-[1.9rem]`}
					>
						{tu('onb_recovery_title')}
					</h1>
					<Key
						className="mx-auto my-5 h-8 w-8 rotate-45 text-[#0b1220]"
						strokeWidth={1.75}
						aria-hidden
					/>
					<p className="mx-auto max-w-[22rem] text-[15px] leading-relaxed text-[#64748b]">
						{tu('onb_recovery_sub')}
					</p>
				</header>

				<section className="mb-4 rounded-[22px] bg-white px-5 pb-6 pt-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
					<p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#1562F0]">
						{tu('onb_recovery_key_label')}
					</p>

					{/* Tablet-on-desk scene — live QR inside the dark ACCOUNT RECOVERY screen */}
					<div className="relative mb-5 overflow-hidden rounded-2xl">
						<div
							className="absolute inset-0"
							style={{
								background:
									'radial-gradient(ellipse 90% 80% at 28% 18%, rgba(255,255,255,0.42) 0%, transparent 46%), linear-gradient(155deg, #d5dbe3 0%, #9aa3ae 40%, #6a7380 100%)',
							}}
							aria-hidden
						/>
						<div className="pointer-events-none absolute -left-8 top-5 h-16 w-28 rounded-xl bg-white/25 blur-md" aria-hidden />
						<div className="pointer-events-none absolute -right-6 bottom-4 h-20 w-32 rounded-xl bg-sky-200/25 blur-lg" aria-hidden />
						<div className="relative flex justify-center px-8 py-7">
							<div className="w-full max-w-[228px] rounded-[22px] bg-gradient-to-b from-[#2c3036] to-[#0c0e12] p-[6px] shadow-[0_22px_48px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.12)]">
								<div
									ref={captureRef}
									className="relative overflow-hidden rounded-[16px]"
									style={{
										background:
											'linear-gradient(165deg, #0d1c3d 0%, #081428 46%, #050b1d 100%)',
									}}
								>
									<div
										className="pointer-events-none absolute inset-0"
										style={{
											background:
												'radial-gradient(ellipse 72% 58% at 50% 46%, rgba(92,156,236,0.30) 0%, rgba(20,42,86,0.10) 44%, transparent 70%)',
										}}
										aria-hidden
									/>
									<div
										className="pointer-events-none absolute inset-0"
										style={{
											backgroundImage: HEX_BG,
											backgroundSize: '28px 48px',
										}}
										aria-hidden
									/>
									<div className="relative flex flex-col items-center px-3 pb-5 pt-6">
										<h2 className="text-center text-[13px] font-bold uppercase tracking-[0.20em] text-white">
											ACCOUNT RECOVERY
										</h2>
										<p className="mt-1.5 text-center text-[9px] font-medium leading-snug text-white/80">
											Scan to Initiate Secure Password Reset
										</p>

										<div className="relative my-4 flex h-[168px] w-full items-center justify-center overflow-hidden">
											<div
												className="absolute left-1/2 top-1/2 h-[148px] w-[148px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-200/30"
												aria-hidden
											/>
											<div
												className="absolute left-1/2 top-1/2 h-[178px] w-[178px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-200/18"
												aria-hidden
											/>
											<div
												className="absolute left-1/2 top-1/2 h-[208px] w-[208px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-200/10"
												aria-hidden
											/>
											<div className="absolute left-1/2 top-[calc(50%-74px)] z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0b1733] ring-1 ring-sky-200/35">
												<ShieldCheck className="h-3 w-3 text-sky-300" strokeWidth={2.25} aria-hidden />
											</div>
											<div className="relative z-10 flex h-[108px] w-[108px] items-center justify-center rounded-md bg-white p-1 shadow-[0_10px_28px_rgba(0,0,0,0.32)]">
												{qrDataUrl ? (
													<QRCodeCanvas
														ref={qrCanvasRef}
														value={qrDataUrl}
														size={100}
														level="H"
														includeMargin={false}
														bgColor="#ffffff"
														fgColor="#000000"
														imageSettings={{
															src: BIZ_PUBLIC_LOGO512,
															height: 22,
															width: 22,
															excavate: true,
														}}
													/>
												) : (
													<div className="h-full w-full animate-pulse rounded-sm bg-[#e2e8f0]" />
												)}
											</div>
										</div>

										<p className="text-center text-[8px] leading-relaxed tracking-wide text-white/85">
											Device: {deviceLabel} / User: {userLabel} / ID: {idLabel}
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="mb-4 w-full rounded-xl bg-[#f1f5f9] px-3 py-3.5">
						<code
							className={`${headlineClass} block select-all break-all text-center text-[15px] font-bold tracking-wide text-[#0b1220]`}
						>
							{displayRecoveryKey || '—'}
						</code>
					</div>

					<div className="flex flex-col gap-2.5">
						<button
							type="button"
							onClick={() => void handleSaveImage()}
							disabled={savingImage}
							aria-busy={savingImage}
							aria-label={tu('onb_recovery_save_image')}
							className={outlineBtnClass}
						>
							{savingImage ? (
								<Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#1562f0]" aria-hidden />
							) : (
								<ImageIcon className="h-5 w-5 shrink-0 text-[#0f172a]" strokeWidth={2} aria-hidden />
							)}
							{tu('onb_recovery_save_image')}
						</button>
						<button
							type="button"
							onClick={() => void handleCopyCode()}
							className={outlineBtnClass}
						>
							{copied ? (
								<>
									<Check className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
									<span className="text-emerald-700">{tu('onb_recovery_copied')}</span>
								</>
							) : (
								<>
									<Copy className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
									{tu('onb_recovery_copy_key')}
								</>
							)}
						</button>
					</div>
				</section>

				<section className="mb-6 rounded-[22px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
					<label
						className={`flex items-start gap-3 ${hasBackedUp ? 'cursor-pointer' : 'cursor-not-allowed'}`}
					>
						<input
							type="checkbox"
							className="mt-0.5 h-5 w-5 shrink-0 rounded-[5px] border-[#cbd5e1] text-[#1562F0] focus:ring-[#1562F0]/20"
							checked={isConfirmed}
							disabled={!hasBackedUp}
							onChange={(e) => hasBackedUp && setIsConfirmed(e.target.checked)}
						/>
						<div className="min-w-0 flex-1">
							<span className="block text-[15px] font-semibold leading-snug text-[#0b1220]">
								{tu('onb_recovery_confirm_label')}
							</span>
							<p className="mt-1.5 text-[13px] leading-relaxed text-[#94a3b8]">
								{tu('onb_recovery_confirm_body')}
							</p>
						</div>
					</label>
				</section>

				{showButton ? (
					<button
						type="button"
						disabled={!isConfirmed || loading}
						aria-busy={loading}
						aria-label={tu('continue')}
						onClick={() => {
							void (async () => {
								if (!isConfirmed || loading) return
								setLoading(true)
								try {
									await Promise.resolve(close?.())
								} finally {
									setLoading(false)
								}
							})()
						}}
						className={`${headlineClass} mt-auto flex min-h-[3.4rem] w-full items-center justify-center gap-2 rounded-full text-[17px] font-bold transition-colors ${
							isConfirmed
								? `bg-[#1562f0] text-white shadow-[0_12px_30px_rgba(21,98,240,0.3)] hover:bg-[#2b74f5] ${bizBrandFocusRingClass}`
								: 'cursor-not-allowed bg-[#1562F0]/15 text-[#1562F0]/40'
						}`}
					>
						{loading && !isRedeemFlow ? (
							<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
						) : (
							<>
								{tu('continue')}
								<ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
							</>
						)}
					</button>
				) : null}
			</div>
		</div>
	)
}

export default RecoveryQRScreen
