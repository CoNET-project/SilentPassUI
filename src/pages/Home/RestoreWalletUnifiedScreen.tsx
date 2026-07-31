import { IpfsImg } from '@/components/IpfsImg';
import { FormEvent, useEffect, useState } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { RegenerateRecover, onWalletEvent, restoreWithRedeem, restoreWithUserPin } from '@/services/beamio'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { getCashTreesNativeNfcBridge, getCashTreesNativeNfcHost } from '@/utils/cashTreesNativeNfc'
import {
	AlertCircle,
	Check,
	Eye,
	EyeOff,
	KeyRound,
	QrCode,
	RefreshCw,
	ShieldCheck,
} from 'lucide-react'
import { VerraFloatingNavChrome } from './VerraFloatingNavChrome'
import { APP_FLOATING_CHROME_MAIN_TOP_PT, APP_TITLE_BLOCK_TO_FIRST_CONTROL_MB } from '@/ui/appContentSpacing'
import { tu } from '@/locale/beamioLocale'

type RestoreTab = 'login' | 'recovery'
const APP_LOGO_SRC = `${process.env.PUBLIC_URL ?? ''}/logo192.png`
const RESTORE_LOADING_STEPS = [
	{ id: 0, title: 'Restoring Wallet', desc: 'Decrypting your secure vault', icon: KeyRound },
	{ id: 1, title: 'Preparing Security Backup', desc: 'Creating your local recovery package', icon: RefreshCw },
] as const

function scanRecoveryQrWithIosBridge() {
	const native = getCashTreesNativeNfcBridge()
	const scanRecoveryQr = native?.scanRecoveryQr
	if (getCashTreesNativeNfcHost() !== 'ios' || typeof scanRecoveryQr !== 'function') {
		return Promise.resolve<{ status: 'unhandled' } | { status: 'scanned'; code: string } | { status: 'failed'; error?: string }>({
			status: 'unhandled',
		})
	}

	const requestId = `recovery-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`
	return new Promise<{ status: 'scanned'; code: string } | { status: 'failed'; error?: string }>((resolve) => {
		let done = false
		const cleanup = () => {
			window.clearTimeout(timeout)
			window.removeEventListener('cashtreesios', onResult as EventListener)
		}
		const finish = (result: { status: 'scanned'; code: string } | { status: 'failed'; error?: string }) => {
			if (done) return
			done = true
			cleanup()
			resolve(result)
		}
		const onResult = (event: Event) => {
			const detail = (event as CustomEvent<Record<string, unknown>>).detail
			if (!detail || detail.action !== 'scanRecoveryQr') return
			if (detail.requestId !== requestId) return
			if (detail.ok === true && typeof detail.recoveryCode === 'string' && detail.recoveryCode.trim()) {
				finish({ status: 'scanned', code: detail.recoveryCode.trim() })
				return
			}
			finish({ status: 'failed', error: typeof detail.error === 'string' ? detail.error : undefined })
		}
		const timeout = window.setTimeout(() => finish({ status: 'failed', error: 'timeout' }), 60000)
		window.addEventListener('cashtreesios', onResult as EventListener)
		try {
			scanRecoveryQr({ requestId })
		} catch {
			finish({ status: 'failed' })
		}
	})
}

export type RestoreWalletFlowPayload = {
	temp: encrypt_keys_object
	qrDataUrl: string
	recoveryCode: string
	beamioTag: string
}

function normalizeBeamioTagInput(raw: string): string {
	return raw.trim().replace(/^@+/, '')
}

export type RestoreWalletUnifiedScreenProps = {
	onClose: () => void
	onRestore: (payload: RestoreWalletFlowPayload) => void | Promise<void>
	initialRecoveryCode?: string
	/** Prefill Beamio ID on Welcome Back when tag is known (local storage or URL). */
	initialBeamioTag?: string
}

/** 单页：ID & Password + Recovery Key（recoverRestore.html），整页 flex 填满、禁止外层纵向滚动 */
export default function RestoreWalletUnifiedScreen({
	onClose,
	onRestore,
	initialRecoveryCode = '',
	initialBeamioTag = '',
}: RestoreWalletUnifiedScreenProps) {
	const prefillTag = normalizeBeamioTagInput(initialBeamioTag)
	const [tab, setTab] = useState<RestoreTab>(prefillTag ? 'login' : 'recovery')
	const { scanRef, scanData } = useDaemonContext()

	// —— Recovery —
	const [recoveryCode, setRecoveryCode] = useState(initialRecoveryCode)
	const [recoveryLoading, setRecoveryLoading] = useState(false)
	const [recoveryError, setRecoveryError] = useState('')

	// —— Login —
	const [username, setUsername] = useState(prefillTag)
	const [pin, setPin] = useState('')
	const [peekPin, setPeekPin] = useState(false)
	const [loginLoading, setLoginLoading] = useState(false)
	const [loginError, setLoginError] = useState('')

	useEffect(() => {
		if (initialRecoveryCode) {
			setRecoveryCode(initialRecoveryCode)
			setTab('recovery')
		}
	}, [initialRecoveryCode])

	useEffect(() => {
		const tag = normalizeBeamioTagInput(initialBeamioTag)
		if (!tag) return
		setUsername(tag)
		if (!initialRecoveryCode) setTab('login')
	}, [initialBeamioTag, initialRecoveryCode])

	useEffect(() => {
		const run = async () => {
			if (!scanData || /^http/i.test(scanData)) {
				if (scanData && /^http/i.test(scanData)) setRecoveryError('Invalid recovery code format')
				return
			}
			setRecoveryCode(scanData)
			setRecoveryError('')
		}
		run()
	}, [scanData])

	useEffect(() => {
		const off = onWalletEvent('scan:url', (url: string) => {
			if (tab !== 'recovery') return
			if (/^http/i.test(url)) {
				setRecoveryError('Invalid recovery code format')
				return
			}
			if (url?.length) {
				setRecoveryCode(url)
				setRecoveryError('')
			}
		})
		return () => {
			if (typeof off === 'function') off()
		}
	}, [tab])

	useEffect(() => {
		if (!recoveryError) return
		const t = setTimeout(() => setRecoveryError(''), 4000)
		return () => clearTimeout(t)
	}, [recoveryError])

	useEffect(() => {
		if (!loginError) return
		const t = setTimeout(() => setLoginError(''), 4000)
		return () => clearTimeout(t)
	}, [loginError])

	const formatBeamioName = () => {
		let trimmed = username.trim().replace(/^@+/, '')
		if (!trimmed) {
			setLoginError('Please enter a username')
			return ''
		}
		if (!/^[a-zA-Z0-9_.-]{3,26}$/.test(trimmed)) {
			setLoginError('Use 3–26 letters, numbers, dots, _ or -')
			return ''
		}
		return trimmed
	}

	const handleLoginSubmit = async (e: FormEvent) => {
		e.preventDefault()
		setLoginError('')
		const trimmed = formatBeamioName()
		if (!trimmed) return
		const password = pin.trim()
		if (password.length < 6) {
			setLoginError('Password must be at least 6 characters')
			return
		}
		setLoginLoading(true)
		try {
			const canRestore = await restoreWithUserPin(trimmed, password)
			if (!canRestore || typeof canRestore === 'boolean') {
				setLoginError('Something went wrong while restoring your wallet.')
				return
			}

			const mnemonicPhrase = canRestore?.mnemonicPhrase
			const beamioProfile = canRestore?.beamio
			const privateKey = canRestore?.profiles?.[0]?.privateKeyArmor
			if (!mnemonicPhrase || !beamioProfile || !privateKey) {
				setLoginError('Restored wallet is incomplete. Please try again.')
				return
			}

			const regenerated = await RegenerateRecover(mnemonicPhrase, beamioProfile, password, privateKey)
			if (!regenerated?.recoverCode || !regenerated?.qrCode) {
				setLoginError('Failed to prepare Security Backup. Please try again.')
				return
			}

			await onRestore({
				temp: canRestore,
				qrDataUrl: regenerated.qrCode,
				recoveryCode: regenerated.recoverCode,
				beamioTag: beamioProfile.accountName || trimmed,
			})
		} catch {
			setLoginError('Something went wrong while restoring your wallet.')
		} finally {
			setLoginLoading(false)
		}
	}

	const handleRecoverySubmit = async (e: FormEvent) => {
		e.preventDefault()
		setRecoveryError('')
		if (!recoveryCode.trim()) {
			setRecoveryError('Please enter your recovery code.')
			return
		}
		setRecoveryLoading(true)
		try {
			const canRestore = await restoreWithRedeem(recoveryCode, '')
			if (!canRestore || typeof canRestore === 'boolean') {
				setRecoveryError('Invalid recovery code')
				return
			}
			await onRestore({
				temp: canRestore,
				qrDataUrl: recoveryCode.trim(),
				recoveryCode: recoveryCode.trim(),
				beamioTag: canRestore?.beamio?.accountName || '',
			})
		} catch {
			setRecoveryError('Something went wrong while restoring your wallet.')
		} finally {
			setRecoveryLoading(false)
		}
	}

	const onOpenScanner = async () => {
		setRecoveryError('')
		const nativeResult = await scanRecoveryQrWithIosBridge()
		if (nativeResult.status === 'scanned') {
			setRecoveryCode(nativeResult.code)
			return
		}
		if (nativeResult.status === 'failed') {
			if (nativeResult.error && nativeResult.error !== 'cancelled') {
				setRecoveryError('Unable to scan Recovery QR. Please try again.')
			}
			return
		}
		scanRef.current?.start({ hideModeSwitcher: true })
	}

	if (loginLoading) {
		return (
			<div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f9f9fe]">
				<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
					<div className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] rounded-full bg-[#004bc3]/5 blur-[120px]" />
					<div className="absolute -bottom-[5%] -right-[5%] h-[50%] w-[50%] rounded-full bg-[#a7bcff]/10 blur-[100px]" />
					<div className="absolute right-[10%] top-[20%] h-[30%] w-[30%] rounded-full bg-[#b3c5ff]/10 blur-[80px]" />
				</div>

				<main className="flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center self-center overflow-hidden px-6 pt-[max(1rem,env(safe-area-inset-top))] text-center">
					<div className="relative mb-10 flex h-72 w-72 shrink-0 items-center justify-center [@media(max-height:700px)]:mb-6 [@media(max-height:700px)]:h-56 [@media(max-height:700px)]:w-56 [@media(max-height:640px)]:mb-4 [@media(max-height:640px)]:h-44 [@media(max-height:640px)]:w-44">
						<div
							className="absolute h-48 w-48 rounded-full bg-[#004bc3]/10 blur-3xl [@media(max-height:700px)]:h-36 [@media(max-height:700px)]:w-36 [@media(max-height:640px)]:h-28 [@media(max-height:640px)]:w-28"
							style={{ animation: 'verra-breath 4s ease-in-out infinite' }}
							aria-hidden
						/>
						<div
							className="absolute inset-0 rounded-full border-[1.5px] border-[#c3c6d8]/30"
							style={{ animation: 'verra-spin-slow 12s linear infinite' }}
							aria-hidden
						/>
						<div
							className="absolute inset-4 rounded-full border-[1px] border-[#004bc3]/20 [@media(max-height:640px)]:inset-3"
							style={{ animation: 'verra-spin-slow 8s linear infinite reverse' }}
							aria-hidden
						/>
						<div
							className="absolute inset-10 rounded-full border-[2px] border-[#1562f0]/10 [@media(max-height:700px)]:inset-8 [@media(max-height:640px)]:inset-6"
							style={{ animation: 'verra-spin-slow 15s linear infinite' }}
							aria-hidden
						/>
						<div
							className="relative z-10 flex h-32 w-32 items-center justify-center rounded-full border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.06)] [@media(max-height:700px)]:h-24 [@media(max-height:700px)]:w-24 [@media(max-height:640px)]:h-20 [@media(max-height:640px)]:w-20"
							style={{ backdropFilter: 'blur(20px)', background: 'rgba(255, 255, 255, 0.7)' }}
						>
							<IpfsImg
								src={APP_LOGO_SRC}
								alt="Beamio"
								className="h-14 w-14 rounded-[14px] object-contain [@media(max-height:700px)]:h-11 [@media(max-height:700px)]:w-11 [@media(max-height:700px)]:rounded-[12px] [@media(max-height:640px)]:h-9 [@media(max-height:640px)]:w-9 [@media(max-height:640px)]:rounded-[10px]"
								style={{ animation: 'verra-pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
								draggable={false}
							/>
						</div>
						<div
							className="absolute inset-0"
							style={{ animation: 'verra-spin-slow 12s linear infinite' }}
							aria-hidden
						>
							<div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1562f0] shadow-[0_0_12px_rgba(21,98,240,0.6)] [@media(max-height:640px)]:h-2.5 [@media(max-height:640px)]:w-2.5" />
						</div>
					</div>

					<div className="w-full space-y-8 [@media(max-height:700px)]:space-y-5 [@media(max-height:640px)]:space-y-3">
						<h1 className="text-3xl font-extrabold tracking-tight text-[#1a1c1f] [@media(max-height:700px)]:text-2xl [@media(max-height:640px)]:text-xl">
							Securing your identity...
						</h1>
						<div className="mx-auto max-w-sm space-y-5 text-left [@media(max-height:700px)]:space-y-3 [@media(max-height:640px)]:space-y-2">
							{RESTORE_LOADING_STEPS.map((step, idx) => {
								const isCompleted = idx === 0
								const isActive = idx === 1
								const Icon = step.icon
								return (
									<div key={step.id} className="flex items-center space-x-4 transition-opacity">
										<div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#004bc3]/10 [@media(max-height:640px)]:h-7 [@media(max-height:640px)]:w-7">
											{isCompleted ? (
												<Check className="h-4 w-4 text-emerald-600" strokeWidth={3} aria-hidden />
											) : isActive ? (
												<>
													<div className="absolute inset-0 animate-spin rounded-full border-2 border-[#004bc3] border-t-transparent" aria-hidden />
													<Icon className="h-4 w-4 text-[#004bc3]" strokeWidth={2.5} aria-hidden />
												</>
											) : null}
										</div>
										<div className="min-w-0 flex-grow">
											<p className="text-base font-semibold leading-none text-[#1a1c1f] [@media(max-height:640px)]:text-sm">
												{step.title}
											</p>
											<p className="mt-1 text-xs text-[#424655] [@media(max-height:640px)]:mt-0.5 [@media(max-height:640px)]:text-[11px]">
												{step.desc}
											</p>
										</div>
									</div>
								)
							})}
						</div>
					</div>
				</main>

				<style>{`
					@keyframes verra-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
					@keyframes verra-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.95); } }
					@keyframes verra-breath { 0%, 100% { box-shadow: 0 0 20px rgba(21, 98, 240, 0.1); } 50% { box-shadow: 0 0 60px rgba(21, 98, 240, 0.3); } }
				`}</style>
			</div>
		)
	}

	/** Match Create your Beamio ID field chrome (`CreateUsernamePinScreen`). */
	const fieldLabelClass =
		'block px-4 text-xs font-bold uppercase tracking-widest text-[#424655]'
	const fieldInputClass =
		'w-full rounded-lg border-none bg-[#e2e2e7] text-base font-semibold text-[#1a1c1f] outline-none transition-all placeholder:text-[#737687]/50 focus:ring-2 focus:ring-[#004bc3]/20 disabled:opacity-70'
	const fieldInputPadClass =
		'py-5 [@media(max-height:780px)]:py-4 [@media(max-height:700px)]:py-3.5 [@media(max-height:640px)]:py-3 [@media(max-height:640px)]:text-[15px] [@media(max-height:560px)]:rounded-[14px] [@media(max-height:560px)]:py-2.5 [@media(max-height:560px)]:text-[14px]'

	return (
		<div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f3f3f8] font-[Inter,system-ui,sans-serif] text-[#1a1c1f]">
			<VerraFloatingNavChrome onBack={onClose} tone="restore" />

			<div
				className={`flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] [@media(max-height:560px)]:px-5 ${APP_FLOATING_CHROME_MAIN_TOP_PT}`}
			>
				<div className={`shrink-0 text-center ${APP_TITLE_BLOCK_TO_FIRST_CONTROL_MB}`}>
					<h1 className="text-3xl font-extrabold tracking-tight text-[#1a1c1f] sm:text-3xl">Welcome Back</h1>
					<p className="mt-0.5 text-base font-medium text-[#424655] [@media(max-height:640px)]:text-sm">
						Access your local community vault.
					</p>
				</div>

				<div className="mt-2 flex h-12 shrink-0 rounded-2xl bg-[#e8e8ed] p-1" role="tablist" aria-label="Restore method">
					<button
						type="button"
						role="tab"
						aria-selected={tab === 'login'}
						onClick={() => {
							setTab('login')
							setLoginError('')
						}}
						className={`flex flex-1 items-center justify-center rounded-xl text-sm font-semibold transition ${
							tab === 'login'
								? 'bg-white text-[#1a1c1f] shadow-sm'
								: 'text-[#424655]'
						}`}
					>
						ID &amp; Password
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={tab === 'recovery'}
						onClick={() => {
							setTab('recovery')
							setRecoveryError('')
						}}
						className={`flex flex-1 items-center justify-center rounded-xl text-sm font-semibold transition ${
							tab === 'recovery'
								? 'bg-white text-[#1a1c1f] shadow-sm'
								: 'text-[#424655]'
						}`}
					>
						Recovery Key
					</button>
				</div>

				<div className="hidden" aria-hidden>
					<ScanBtn />
				</div>

				<div className="relative mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
					{tab === 'login' ? (
						<form onSubmit={handleLoginSubmit} className="flex flex-col" noValidate>
							<div className="flex flex-col gap-5 [@media(max-height:700px)]:gap-4 [@media(max-height:640px)]:gap-3">
								<div className="space-y-2">
									<label htmlFor="welcome-back-beamio-id" className={fieldLabelClass}>
										Beamio ID
									</label>
									<div className="relative">
										<div className="pointer-events-none absolute inset-y-0 left-5 flex items-center [@media(max-height:560px)]:left-4">
											<span className="text-lg font-bold text-[#004bc3] [@media(max-height:560px)]:text-base">@</span>
										</div>
										<input
											id="welcome-back-beamio-id"
											type="text"
											autoCapitalize="none"
											autoCorrect="off"
											spellCheck={false}
											autoComplete="username"
											enterKeyHint="next"
											className={[
												fieldInputClass,
												fieldInputPadClass,
												'pl-12 pr-5 [@media(max-height:560px)]:pl-10 [@media(max-height:560px)]:pr-4',
												loginError && !username.trim() ? 'ring-2 ring-orange-400/80 focus:ring-orange-400/30' : '',
											].join(' ')}
											placeholder="Username"
											value={username}
											onChange={e => {
												setUsername(e.target.value.replace(/@/g, ''))
												setLoginError('')
											}}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<label htmlFor="welcome-back-password" className={fieldLabelClass}>
										Password
									</label>
									<div className="relative">
										<input
											id="welcome-back-password"
											type={peekPin ? 'text' : 'password'}
											autoComplete="current-password"
											autoCapitalize="none"
											autoCorrect="off"
											spellCheck={false}
											enterKeyHint="done"
											className={[
												fieldInputClass,
												fieldInputPadClass,
												'pl-5 pr-14 [@media(max-height:560px)]:pl-4 [@media(max-height:560px)]:pr-12',
												loginError && !pin.trim() ? 'ring-2 ring-orange-400/80 focus:ring-orange-400/30' : '',
											].join(' ')}
											placeholder="••••••••••••"
											value={pin}
											onChange={e => {
												setPin(e.target.value)
												setLoginError('')
											}}
										/>
										<button
											type="button"
											tabIndex={-1}
											className="absolute inset-y-0 right-5 flex items-center rounded-lg p-1 text-[#424655] transition-colors hover:text-[#1a1c1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/30 [@media(max-height:560px)]:right-4"
											onClick={() => setPeekPin(p => !p)}
											aria-label={peekPin ? 'Hide password' : 'Show password'}
										>
											{peekPin ? (
												<EyeOff className="h-6 w-6 [@media(max-height:560px)]:h-5 [@media(max-height:560px)]:w-5" strokeWidth={2} />
											) : (
												<Eye className="h-6 w-6 [@media(max-height:560px)]:h-5 [@media(max-height:560px)]:w-5" strokeWidth={2} />
											)}
										</button>
									</div>
								</div>
								{loginError ? (
									<div className="flex items-center gap-2 px-4 text-orange-600">
										<AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
										<span className="text-[13px] font-semibold leading-snug">{loginError}</span>
									</div>
								) : null}
								<div className="shrink-0 pt-1">
									<AppButton
										type="submit"
										fullWidth
										disabled={loginLoading}
										loading={loginLoading}
										className="h-14 rounded-full text-base font-bold !bg-gradient-to-br !from-[#004bc3] !to-[#1562f0] !text-white shadow-[0_4px_24px_rgba(21,98,240,0.15)] hover:!opacity-90 active:!scale-[0.98] focus-visible:!ring-2 focus-visible:!ring-[#004bc3]/40"
									>
										Unlock
									</AppButton>
								</div>
							</div>
						</form>
					) : (
						<form onSubmit={handleRecoverySubmit} className="flex flex-col" noValidate>
							<div className="flex flex-col gap-5 [@media(max-height:700px)]:gap-4 [@media(max-height:640px)]:gap-3">
								<div className="shrink-0 rounded-lg bg-white px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
									<p className="text-center text-sm font-medium leading-snug text-[#424655]">
										Use your securely saved Recovery QR or alphanumeric code to restore your vault.
									</p>
								</div>
								<button
									type="button"
									onClick={onOpenScanner}
									className="flex h-[100px] max-h-[22vmin] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[#c3c6d8] bg-white transition hover:bg-[#f9f9fe] active:scale-[0.98]"
								>
									<div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1562f0]/10">
										<QrCode className="h-6 w-6 text-[#1562f0]" strokeWidth={2.25} />
									</div>
									<div className="text-center px-3">
										<p className="text-sm font-bold text-[#1a1c1f]">Tap to Scan Recovery QR</p>
										<p className="text-[10px] text-[#424655]">from Camera or Photos</p>
									</div>
								</button>
								<div className="flex shrink-0 items-center gap-2 py-0.5">
									<div className="h-px flex-1 bg-[#e8e8ed]" />
									<span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#424655]">{tu('or')}</span>
									<div className="h-px flex-1 bg-[#e8e8ed]" />
								</div>
								<div className="flex w-full shrink-0 flex-col space-y-2">
									<label htmlFor="welcome-back-recovery-code" className={fieldLabelClass}>
										Enter Recovery Code
									</label>
									<textarea
										id="welcome-back-recovery-code"
										className={[
											fieldInputClass,
											'min-h-[5.5rem] resize-none px-5 py-4 leading-relaxed [@media(max-height:560px)]:px-4 [@media(max-height:560px)]:py-3 [@media(max-height:560px)]:text-[14px]',
											recoveryError ? 'ring-2 ring-orange-400/80 focus:ring-orange-400/30' : '',
										].join(' ')}
										placeholder="Enter your recovery code here..."
										value={recoveryCode}
										onChange={e => {
											setRecoveryCode(e.target.value)
											setRecoveryError('')
										}}
										rows={3}
										autoComplete="off"
									/>
									{recoveryError ? (
										<div className="flex items-center gap-2 px-4 text-orange-600">
											<AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
											<span className="text-[13px] font-semibold leading-snug">{recoveryError}</span>
										</div>
									) : null}
									<div className="shrink-0 pt-1">
										<AppButton
											type="submit"
											fullWidth
											disabled={recoveryLoading || !recoveryCode.trim()}
											loading={recoveryLoading}
											className={`h-14 rounded-full text-base font-bold transition active:!scale-[0.98] focus-visible:!ring-2 focus-visible:!ring-[#004bc3]/40 ${
												!recoveryCode.trim() && !recoveryLoading
													? '!cursor-not-allowed !bg-slate-300 !text-slate-500 !shadow-none'
													: '!bg-[#004bc3] !text-white shadow-[0_8px_30px_rgb(0,75,195,0.2)] hover:!bg-[#1562f0]'
											}`}
										>
											Restore Vault
										</AppButton>
									</div>
								</div>
							</div>
						</form>
					)}
				</div>

				<div className="mt-6 flex shrink-0 justify-center pt-2">
					<div className="flex items-center gap-2 rounded-full border border-[#e8e8ed] bg-white px-3 py-1.5 shadow-sm">
						<ShieldCheck className="h-4 w-4 shrink-0 text-[#1562f0]" strokeWidth={2.25} />
						<span className="text-[9px] font-bold uppercase tracking-widest text-[#1a1c1f]">
							End-to-End Encrypted
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}
