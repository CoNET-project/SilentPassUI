import { IpfsImg } from '@/components/IpfsImg';
import { FormEvent, useEffect, useState } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { onWalletEvent, restoreWithRedeem, restoreWithUserPin } from '@/services/beamio'
import { warmArgon2Worker } from '@/services/argon2WorkerBridge'
import RecoveryQrScanPanel from './RecoveryQrScanPanel'
import { getCashTreesNativeNfcBridge, getCashTreesNativeNfcHost } from '@/utils/cashTreesNativeNfc'
import {
	AlertCircle,
	ArrowRight,
	Check,
	Eye,
	EyeOff,
	KeyRound,
	QrCode,
	RefreshCw,
} from 'lucide-react'
import { VerraFloatingNavChrome } from './VerraFloatingNavChrome'
import { APP_FLOATING_CHROME_MAIN_TOP_PT, APP_TITLE_BLOCK_TO_FIRST_CONTROL_MB } from '@/ui/appContentSpacing'
import { useTu } from '@/locale/beamioLocale'

/** Three screens: Unlock (ID & password) → Use Recovery Code → Scan Recovery QR. */
type RestoreTab = 'login' | 'recovery' | 'scan'
const APP_LOGO_SRC = `${process.env.PUBLIC_URL ?? ''}/logo192.png`
/** Align step chrome with CreateUsernamePinScreen passport loading. */
const RESTORE_LOADING_STEPS = [
	{ id: 0, titleKey: 'restoring_wallet', descKey: 'decrypting_your_secure_vault' },
] as const
const RESTORE_STEP_DURATION_MS = 2000

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

/** Restore never creates a new Recovery Code; the existing one stays valid. */
export type RestoreWalletFlowPayload = {
	temp: encrypt_keys_object
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
	const { tu } = useTu()
	const prefillTag = normalizeBeamioTagInput(initialBeamioTag)
	const [tab, setTab] = useState<RestoreTab>(initialRecoveryCode ? 'recovery' : 'login')

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
	const [restoreStep, setRestoreStep] = useState(0)

	useEffect(() => {
		if (initialRecoveryCode) {
			setRecoveryCode(initialRecoveryCode)
			setTab('recovery')
		}
	}, [initialRecoveryCode])

	// Fail a dead Argon2 worker before Unlock, so decrypt does not wait 20s per hash.
	useEffect(() => {
		warmArgon2Worker()
	}, [])

	useEffect(() => {
		if (!loginLoading) {
			setRestoreStep(0)
			return
		}
		setRestoreStep(0)
		const advance = () => setRestoreStep((prev) => Math.min(prev + 1, RESTORE_LOADING_STEPS.length - 1))
		const timer = window.setTimeout(advance, RESTORE_STEP_DURATION_MS)
		return () => window.clearTimeout(timer)
	}, [loginLoading])

	useEffect(() => {
		const tag = normalizeBeamioTagInput(initialBeamioTag)
		if (!tag) return
		setUsername(tag)
		if (!initialRecoveryCode) setTab('login')
	}, [initialBeamioTag, initialRecoveryCode])

	useEffect(() => {
		const off = onWalletEvent('scan:url', (url: string) => {
			if (tab !== 'recovery') return
			if (/^http/i.test(url)) {
				setRecoveryError(tu('invalid_recovery_code_format'))
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
	}, [tab, tu])

	useEffect(() => {
		if (!recoveryError) return
		const t = setTimeout(() => setRecoveryError(''), 4000)
		return () => clearTimeout(t)
	}, [recoveryError])

	const formatBeamioName = () => {
		let trimmed = username.trim().replace(/^@+/, '')
		if (!trimmed) {
			setLoginError(tu('please_enter_a_username'))
			return ''
		}
		if (!/^[a-zA-Z0-9_.-]{3,26}$/.test(trimmed)) {
			setLoginError(tu('use_3_26_letters_numbers_dots_underscore_or_hyphen'))
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
			setLoginError(tu('password_must_be_at_least_6_characters'))
			return
		}
		setLoginLoading(true)
		try {
			const canRestore = await restoreWithUserPin(trimmed, password)
			if (!canRestore || typeof canRestore === 'boolean') {
				setLoginError(tu('something_went_wrong_while_restoring_your_wallet'))
				return
			}

			const mnemonicPhrase = canRestore?.mnemonicPhrase
			const beamioProfile = canRestore?.beamio
			const privateKey = canRestore?.profiles?.[0]?.privateKeyArmor
			if (!mnemonicPhrase || !beamioProfile || !privateKey) {
				setLoginError(tu('restored_wallet_is_incomplete'))
				return
			}

			await onRestore({
				temp: canRestore,
				beamioTag: beamioProfile.accountName || trimmed,
			})
		} catch {
			setLoginError(tu('something_went_wrong_while_restoring_your_wallet'))
		} finally {
			setLoginLoading(false)
		}
	}

	const handleRecoverySubmit = async (e: FormEvent) => {
		e.preventDefault()
		setRecoveryError('')
		if (!recoveryCode.trim()) {
			setRecoveryError(tu('please_enter_your_recovery_code'))
			return
		}
		setRecoveryLoading(true)
		try {
			const canRestore = await restoreWithRedeem(recoveryCode, '')
			if (!canRestore || typeof canRestore === 'boolean') {
				setRecoveryError(tu('invalid_recovery_code'))
				return
			}
			await onRestore({
				temp: canRestore,
				beamioTag: canRestore?.beamio?.accountName || '',
			})
		} catch {
			setRecoveryError(tu('something_went_wrong_while_restoring_your_wallet'))
		} finally {
			setRecoveryLoading(false)
		}
	}

	/** A scanned or picked QR fills the code field and returns to Use Recovery Code. */
	const onScannedCode = (code: string) => {
		setTab('recovery')
		if (/^http/i.test(code)) {
			setRecoveryError(tu('invalid_recovery_code_format'))
			return
		}
		setRecoveryCode(code)
		setRecoveryError('')
	}

	const iosNativeScan =
		getCashTreesNativeNfcHost() === 'ios' && typeof getCashTreesNativeNfcBridge()?.scanRecoveryQr === 'function'

	if (loginLoading) {
		return (
			<div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f9f9ff] font-[Inter,system-ui,sans-serif] text-[#151c27]">
				<style>{`
					@keyframes beamio-passport-ripple {
						0% { transform: translateZ(0) scale(0.5); opacity: 0; }
						50% { opacity: 1; }
						100% { transform: translateZ(0) scale(1.2); opacity: 0; }
					}
					@keyframes beamio-passport-orbit {
						from { transform: translateZ(0) rotate(0deg); }
						to { transform: translateZ(0) rotate(360deg); }
					}
				`}</style>

				<main className="flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center self-center overflow-hidden px-6 pt-[max(1rem,env(safe-area-inset-top))] py-12 text-center [@media(max-height:700px)]:py-8 [@media(max-height:640px)]:py-6">
					<div
						className="relative mb-12 flex w-full max-w-[320px] aspect-square shrink-0 items-center justify-center
							[@media(max-height:700px)]:mb-8 [@media(max-height:700px)]:max-w-[260px]
							[@media(max-height:640px)]:mb-6 [@media(max-height:640px)]:max-w-[220px]"
					>
						<div className="absolute inset-0 -z-10 rounded-full bg-[#004bc3]/5 blur-3xl" aria-hidden />
						<div className="relative flex h-[240px] w-[240px] items-center justify-center [@media(max-height:700px)]:h-[200px] [@media(max-height:700px)]:w-[200px] [@media(max-height:640px)]:h-[168px] [@media(max-height:640px)]:w-[168px]">
							{[0, 1, 2].map((i) => (
								<div
									key={i}
									className="absolute rounded-full border border-[rgba(21,98,240,0.1)]"
									style={{
										width: `${100 - i * 20}%`,
										height: `${100 - i * 20}%`,
										animation: `beamio-passport-ripple 3s linear infinite`,
										animationDelay: `${i}s`,
										opacity: 0,
										willChange: 'transform, opacity',
										transform: 'translateZ(0)',
									}}
									aria-hidden
								/>
							))}
							<div
								className="absolute inset-0"
								style={{
									animation: 'beamio-passport-orbit 4s linear infinite',
									willChange: 'transform',
									transform: 'translateZ(0)',
								}}
								aria-hidden
							>
								<div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1562f0]" />
							</div>
							<div
								className="relative z-10 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg [@media(max-height:640px)]:h-20 [@media(max-height:640px)]:w-20"
								style={{ transform: 'translateZ(0)' }}
							>
								<IpfsImg
									src={APP_LOGO_SRC}
									alt="Beamio"
									className="h-16 w-16 rounded-xl object-contain shadow-[0_4px_20px_rgba(0,75,195,0.15)] [@media(max-height:640px)]:h-12 [@media(max-height:640px)]:w-12 [@media(max-height:640px)]:rounded-lg"
									draggable={false}
								/>
							</div>
						</div>
					</div>

					<h1 className="mb-8 max-w-md text-center text-[32px] font-bold leading-10 tracking-[-0.02em] text-[#151c27] [@media(max-height:700px)]:mb-6 [@media(max-height:700px)]:text-[28px] [@media(max-height:700px)]:leading-9 [@media(max-height:640px)]:mb-4 [@media(max-height:640px)]:text-[22px] [@media(max-height:640px)]:leading-7">
						{tu('securing_your_identity')}
					</h1>

					<div className="w-full max-w-md space-y-4 px-4 text-left [@media(max-height:700px)]:space-y-3 [@media(max-height:640px)]:space-y-2.5 [@media(max-height:640px)]:px-2">
						{RESTORE_LOADING_STEPS.map((s, idx) => {
							const isCompleted = idx < restoreStep
							const isActive = idx === restoreStep
							const isPending = !isCompleted && !isActive
							return (
								<div
									key={s.id}
									className={[
										'flex items-start space-x-4 transition-opacity',
										isActive ? 'opacity-70' : '',
										isPending ? 'opacity-40' : '',
									]
										.filter(Boolean)
										.join(' ')}
								>
									<div
										className={[
											'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-[0_4px_10px_rgba(0,0,0,0.03)]',
											isCompleted
												? 'border-[#dce2f3] bg-[#e2e8f8]'
												: isActive
													? 'border-[#1562f0] bg-white text-[#1562f0] shadow-[0_4px_20px_rgba(21,98,240,0.1)]'
													: 'border-[#dce2f3] bg-white',
										].join(' ')}
									>
										{isCompleted ? (
											<Check className="h-5 w-5 text-[#22c55e]" strokeWidth={3} aria-hidden />
										) : isActive ? (
											<RefreshCw className="h-5 w-5 animate-spin text-[#1562f0]" strokeWidth={2.25} aria-hidden />
										) : (
											<span className="h-2 w-2 rounded-full bg-[#c3c6d8]" aria-hidden />
										)}
									</div>
									<div className="flex min-w-0 flex-col pt-1">
										<span className="text-lg font-semibold leading-7 text-[#151c27] [@media(max-height:640px)]:text-base [@media(max-height:640px)]:leading-6">
											{tu(s.titleKey)}
										</span>
										{s.descKey ? (
											<span className="mt-0.5 text-xs text-[#424655] [@media(max-height:640px)]:text-[11px]">
												{tu(s.descKey)}
											</span>
										) : null}
									</div>
								</div>
							)
						})}
					</div>
				</main>

				<footer className="flex shrink-0 flex-col items-center px-6 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-3 [@media(max-height:700px)]:pt-2 [@media(max-height:640px)]:pt-1.5">
					<p className="mb-2 text-center text-xs font-semibold uppercase leading-4 tracking-[0.05em] text-[#737687]">
						{tu('do_not_close_the_app_during_this_process')}
					</p>
					<div className="flex space-x-1.5" aria-hidden>
						<div className="h-1.5 w-1.5 rounded-full bg-[#1562f0]/40" />
						<div className="h-1.5 w-1.5 rounded-full bg-[#1562f0]" />
						<div className="h-1.5 w-1.5 rounded-full bg-[#1562f0]/40" />
					</div>
				</footer>
			</div>
		)
	}

	const fieldLabelClass = 'block px-1 text-xs font-bold uppercase tracking-[0.14em] text-[#1a1c1f]'
	/** `ring-inset`: outer focus ring is clipped by parent `overflow-x-hidden` (left/right only). */
	const fieldBoxClass =
		'w-full rounded-2xl border bg-white text-[15px] font-medium text-[#1a1c1f] outline-none transition-all placeholder:text-[#8a8fa3] focus:border-[#1562f0] focus:ring-2 focus:ring-inset focus:ring-[#1562f0]/15 disabled:opacity-70'
	const primaryButtonClass =
		'h-12 rounded-full text-[16px] font-semibold !bg-[#1562f0] !text-white shadow-[0_8px_24px_rgba(21,98,240,0.25)] hover:!bg-[#0f52d4] active:!scale-[0.98] focus-visible:!ring-2 focus-visible:!ring-[#004bc3]/40'
	const errorLine = (message: string) => (
		<div className="flex items-center gap-2 px-1 text-orange-600">
			<AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
			<span className="text-[13px] font-semibold leading-snug">{message}</span>
		</div>
	)

	const title = tab === 'login' ? tu('unlock_your_beamio_id') : tab === 'recovery' ? tu('use_recovery_code') : tu('scan_recovery_qr')
	const subtitle = tab === 'login' ? tu('welcome_back_subtitle') : tab === 'recovery' ? tu('enter_your_code_or_scan_your_recovery_qr') : ''

	const onBack = () => {
		if (tab === 'scan') {
			setTab('recovery')
			return
		}
		if (tab === 'recovery') {
			setTab('login')
			setRecoveryError('')
			return
		}
		onClose()
	}

	return (
		<div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f3f4fb] font-[Inter,system-ui,sans-serif] text-[#1a1c1f]">
			<VerraFloatingNavChrome onBack={onBack} tone="restore" />

			<div
				className={`flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] [@media(max-height:560px)]:px-5 ${APP_FLOATING_CHROME_MAIN_TOP_PT}`}
			>
				<div className={`shrink-0 text-center ${APP_TITLE_BLOCK_TO_FIRST_CONTROL_MB}`}>
					<h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-[#151c3a]">{title}</h1>
					{subtitle ? <p className="mt-2 text-[15px] font-medium text-[#6b7186]">{subtitle}</p> : null}
				</div>

				<div className="relative -mx-6 mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-6 pb-6 [@media(max-height:560px)]:-mx-5 [@media(max-height:560px)]:px-5">
					{tab === 'login' ? (
						<form onSubmit={handleLoginSubmit} className="flex flex-col gap-5" noValidate>
							<div className="space-y-2">
								<label htmlFor="welcome-back-beamio-id" className={fieldLabelClass}>
									{tu('beamiotag')}
								</label>
								<div className="relative">
									<div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
										<span className="text-xl font-semibold text-[#1562f0]">@</span>
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
											fieldBoxClass,
											'h-12 pl-11 pr-4',
											loginError && !username.trim() ? 'border-orange-400' : 'border-[#c9d4f2]',
										].join(' ')}
										placeholder={tu('yourtag')}
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
									{tu('password')}
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
											fieldBoxClass,
											'h-12 pl-4 pr-12',
											loginError && !pin.trim() ? 'border-orange-400' : 'border-[#c9d4f2]',
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
										className="absolute inset-y-0 right-3 flex items-center rounded-lg p-1 text-[#1a1c1f] transition-colors hover:text-[#1562f0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/30"
										onClick={() => setPeekPin(p => !p)}
										aria-label={peekPin ? tu('hide_password') : tu('show_password')}
									>
										{peekPin ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
									</button>
								</div>
							</div>
							{loginError ? errorLine(loginError) : null}
							<AppButton type="submit" fullWidth disabled={loginLoading} loading={loginLoading} className={primaryButtonClass}>
								<span className="inline-flex items-center gap-2">
									{tu('unlock')}
									<ArrowRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</span>
							</AppButton>
							<div className="flex items-center gap-4 px-2 text-[13px] font-semibold text-[#727786]">
								<div className="h-px flex-1 bg-[#d3d8e8]" />
								<span>{tu('or')}</span>
								<div className="h-px flex-1 bg-[#d3d8e8]" />
							</div>
							<button
								type="button"
								className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#c9d4f2] bg-white text-[15px] font-semibold text-[#1d3fa8] transition-colors hover:bg-[#f3f6ff] active:scale-[0.98]"
								onClick={() => {
									setTab('recovery')
									setRecoveryError('')
								}}
							>
								<KeyRound className="h-5 w-5 text-[#1562f0]" strokeWidth={2.25} aria-hidden />
								{tu('use_recovery_code')}
							</button>
						</form>
					) : tab === 'recovery' ? (
						<form onSubmit={handleRecoverySubmit} className="flex flex-col gap-5" noValidate>
							<div className="space-y-2">
								<label htmlFor="welcome-back-recovery-code" className={fieldLabelClass}>
									{tu('recovery_code_label')}
								</label>
								<div
									className={[
										'flex h-14 w-full items-center gap-3 rounded-2xl border bg-white pl-4 pr-1.5 transition focus-within:border-[#1562f0] focus-within:ring-2 focus-within:ring-[#1562f0]/15',
										recoveryError ? 'border-orange-400' : 'border-[#c9d4f2]',
									].join(' ')}
								>
									<input
										id="welcome-back-recovery-code"
										type="text"
										className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#1a1c1f] outline-none placeholder:text-[#8a8fa3]"
										placeholder={tu('enter_or_paste_your_code')}
										value={recoveryCode}
										onChange={e => {
											setRecoveryCode(e.target.value)
											setRecoveryError('')
										}}
										autoCapitalize="none"
										autoCorrect="off"
										spellCheck={false}
										autoComplete="off"
									/>
									<div className="h-7 w-px shrink-0 bg-[#d3d8e8]" aria-hidden />
									<button
										type="button"
										onClick={() => {
											setRecoveryError('')
											setTab('scan')
										}}
										aria-label={tu('scan_recovery_qr')}
										className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e6edff] text-[#1562f0] transition-colors hover:bg-[#dce5fb] active:scale-[0.96]"
									>
										<QrCode className="h-5 w-5" strokeWidth={2.25} aria-hidden />
									</button>
								</div>
							</div>
							{recoveryError ? errorLine(recoveryError) : null}
							<AppButton
								type="submit"
								fullWidth
								disabled={recoveryLoading || !recoveryCode.trim()}
								loading={recoveryLoading}
								className={`${primaryButtonClass} disabled:!opacity-50`}
							>
								<span className="inline-flex items-center gap-2">
									{tu('unlock')}
									<ArrowRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</span>
							</AppButton>
							<p className="text-center text-[14px] font-medium text-[#6b7186]">{tu('keep_your_recovery_code_private')}</p>
						</form>
					) : (
						<div className="flex flex-col gap-4">
							<RecoveryQrScanPanel
								onCode={onScannedCode}
								onError={message => setRecoveryError(message)}
								nativeScan={iosNativeScan ? scanRecoveryQrWithIosBridge : undefined}
							/>
							{recoveryError ? errorLine(recoveryError) : null}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
