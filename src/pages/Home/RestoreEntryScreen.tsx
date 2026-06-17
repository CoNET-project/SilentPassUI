import { IpfsImg } from '@/components/IpfsImg';
import React, { FormEvent, useCallback, useEffect, useState } from 'react'
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	Eye,
	EyeOff,
	HelpCircle,
	KeyRound,
	QrCode,
	Shield,
	Lock,
	BadgeCheck,
	User,
} from 'lucide-react'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { onWalletEvent, restoreWithRedeem, restoreWithUserPin } from '@/services/beamio'
import { BIZ_PUBLIC_LOGO512, bizBrandFocusRingClass } from '@/pages/Home/brandUi'
import WorkspaceCreatingOverlay, { awaitWorkspaceCreatingPaint } from '@/pages/Home/WorkspaceCreatingOverlay'
import {
	BEAMIO_TAG_ALLOWED_RE,
	BEAMIO_TAG_RULE_HINT,
	normalizeBeamioTagInput,
} from '@/utils/beamioTagRules'

const HEADLINE = { fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif" } as const

type RestoreEntryScreenProps = {
	onClose: () => void
	onRestore: (temp: encrypt_keys_object) => Promise<void> | void
	/** From URL / PWA — prefill backup key textarea */
	initialRecoveryCode?: string
	/** Same as BusinessIdentityForm: full-screen WorkspaceCreatingOverlay while restoring / parent init */
	onWorkspaceCreatingChange?: (creating: boolean) => void
}

/**
 * Account Recovery — layout aligned with newOnloading.html (dual-card: @BeamioTag + backup key).
 */
const RestoreEntryScreen = ({
	onClose,
	onRestore,
	initialRecoveryCode = '',
	onWorkspaceCreatingChange,
}: RestoreEntryScreenProps) => {
	const { scanRef } = useDaemonContext()
	const { scanData } = useDaemonContext()

	const [username, setUsername] = useState('')
	const [pin, setPin] = useState('')
	const [peekPin, setPeekPin] = useState(false)
	const [errorTag, setErrorTag] = useState('')
	const [loadingTag, setLoadingTag] = useState(false)

	const [recoveryCode, setRecoveryCode] = useState(initialRecoveryCode)
	const [errorKey, setErrorKey] = useState('')
	const [loadingKey, setLoadingKey] = useState(false)

	const busy = loadingTag || loadingKey

	useEffect(() => {
		if (initialRecoveryCode) setRecoveryCode(initialRecoveryCode)
	}, [initialRecoveryCode])

	useEffect(() => {
		if (!errorTag) return
		const t = setTimeout(() => setErrorTag(''), 4000)
		return () => clearTimeout(t)
	}, [errorTag])

	useEffect(() => {
		if (!errorKey) return
		const t = setTimeout(() => setErrorKey(''), 4000)
		return () => clearTimeout(t)
	}, [errorKey])

	useEffect(() => {
		if (!scanData || /^http/i.test(scanData)) return
		setRecoveryCode(scanData)
	}, [scanData])

	useEffect(() => {
		const off = onWalletEvent('scan:url', (url: string) => {
			if (/^http/i.test(url)) {
				setErrorKey('Invalid recovery code format')
				return
			}
			if (url?.length) setRecoveryCode(url)
		})
		return () => {
			if (typeof off === 'function') off()
		}
	}, [])

	const onOpenScanner = useCallback(() => {
		scanRef.current?.start()
	}, [scanRef])

	const formatBeamioName = (): string => {
		setErrorTag('')
		const trimmed = normalizeBeamioTagInput(username)
		if (!trimmed) {
			setErrorTag('Please enter a username')
			return ''
		}
		if (!BEAMIO_TAG_ALLOWED_RE.test(trimmed)) {
			setErrorTag(BEAMIO_TAG_RULE_HINT)
			return ''
		}
		return trimmed
	}

	const handleTagSubmit = async (e: FormEvent) => {
		e.preventDefault()
		if (busy) return

		const trimmed = formatBeamioName()
		if (!trimmed) return

		const password = pin.trim()
		if (password.length < 6) {
			setErrorTag('Password must be at least 6 characters')
			return
		}

		setLoadingTag(true)
		setErrorTag('')
		onWorkspaceCreatingChange?.(true)
		await awaitWorkspaceCreatingPaint()
		try {
			const canRestore = await restoreWithUserPin(trimmed, password)
			if (!canRestore || typeof canRestore === 'boolean') {
				setErrorTag('Something went wrong while restoring your wallet.')
				onWorkspaceCreatingChange?.(false)
				return
			}
			await onRestore(canRestore)
		} catch {
			onWorkspaceCreatingChange?.(false)
		} finally {
			setLoadingTag(false)
		}
	}

	const handleKeySubmit = async (e: FormEvent) => {
		e.preventDefault()
		if (busy) return

		setErrorKey('')
		if (!recoveryCode.trim()) {
			setErrorKey('Please enter your recovery code.')
			return
		}

		setLoadingKey(true)
		onWorkspaceCreatingChange?.(true)
		await awaitWorkspaceCreatingPaint()
		try {
			const canRestore = await restoreWithRedeem(recoveryCode, '')
			if (!canRestore) {
				setErrorKey('Invalid recovery code')
				onWorkspaceCreatingChange?.(false)
				return
			}
			await onRestore(canRestore)
		} catch {
			onWorkspaceCreatingChange?.(false)
		} finally {
			setLoadingKey(false)
		}
	}

	if (loadingTag || loadingKey) {
		return <WorkspaceCreatingOverlay />
	}

	return (
		<div
			className="min-h-full flex flex-col relative overflow-x-hidden bg-[#f5f7f9] text-[#2c2f31] antialiased font-[Inter,ui-sans-serif,system-ui,sans-serif]"
			style={{
				backgroundImage: 'radial-gradient(#dfe3e6 0.5px, transparent 0.5px)',
				backgroundSize: '24px 24px',
			}}
		>
			<div className="hidden" aria-hidden>
				<ScanBtn />
			</div>

			{/* Top bar — Beamio Studio + help (matches newOnloading.html) */}
			<nav className="sticky top-0 z-50 flex h-16 w-full max-w-full shrink-0 items-center justify-between border-b border-[#abadaf]/10 bg-white/70 px-6 shadow-[0_20px_40px_rgba(21,98,240,0.06)] backdrop-blur-xl md:px-8">
				<div className="flex min-w-0 items-center gap-3">
					<button
						type="button"
						onClick={() => {
							onWorkspaceCreatingChange?.(false)
							onClose()
						}}
						className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#595c5e] transition hover:bg-black/5 ${bizBrandFocusRingClass}`}
						aria-label="Back"
					>
						<ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
					</button>
					<IpfsImg
						src={BIZ_PUBLIC_LOGO512}
						alt=""
						className="h-8 w-8 shrink-0 rounded-lg object-contain"
					/>
					<div className="truncate text-xl font-bold tracking-tight text-[#2c2f31] md:text-2xl" style={HEADLINE}>
						Beamio Studio
					</div>
				</div>
				<a
					href="mailto:support@beamio.app?subject=Beamio%20Business%20help"
					className={`flex h-10 w-10 items-center justify-center rounded-full text-[#747779] transition hover:text-[#1562f0] ${bizBrandFocusRingClass}`}
					aria-label="Help"
				>
					<HelpCircle className="h-6 w-6" strokeWidth={2} aria-hidden />
				</a>
			</nav>

			<main className="flex flex-1 flex-col items-center px-6 pb-12 pt-8 md:pt-10">
				<header className="mb-10 max-w-2xl text-center">
					<h1 className="mb-4 text-4xl font-extrabold tracking-tight text-[#2c2f31] md:text-5xl" style={HEADLINE}>
						Account Recovery
					</h1>
					<p className="text-lg leading-relaxed text-[#595c5e]">
						Restore access to your secure business OS and non-custodial wallet on this device.
					</p>
				</header>

				<div className="grid w-full max-w-6xl grid-cols-1 items-stretch gap-8 md:grid-cols-2">
					{/* Option 1: @BeamioTag */}
					<section className="flex flex-col rounded-2xl border border-[#abadaf]/10 bg-white p-8 shadow-[0_20px_40px_rgba(21,98,240,0.04)] md:p-10">
						<div className="mb-8 flex items-center gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d8e3fb] text-[#475266]">
								<User className="h-5 w-5" strokeWidth={2} aria-hidden />
							</div>
							<h2 className="text-xl font-bold text-[#2c2f31]" style={HEADLINE}>
								Option 1: Log in with @BeamioTag
							</h2>
						</div>
						<form onSubmit={handleTagSubmit} className="flex flex-1 flex-col space-y-6">
							<div className="space-y-2">
								<label className="block px-1 text-xs font-bold uppercase tracking-widest text-[#595c5e]" htmlFor="restore-merchant-tag">
									Merchant Tag
								</label>
								<div className="relative">
									<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium text-[#595c5e]">
										@
									</span>
									<input
										id="restore-merchant-tag"
										type="text"
										autoCapitalize="none"
										autoCorrect="off"
										spellCheck={false}
										autoComplete="username"
										value={username}
										onChange={(e) => {
											setUsername(normalizeBeamioTagInput(e.target.value))
											setErrorTag('')
										}}
										placeholder="e.g., YourBrand"
										disabled={busy}
										className={`
											w-full rounded-2xl border-0 bg-[#eef1f3] py-4 pl-8 pr-4 text-base text-[#2c2f31] placeholder:text-[#747779]/50
											transition-all focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
											disabled:opacity-60
											${errorTag && !username ? 'ring-2 ring-red-200' : ''} ${bizBrandFocusRingClass}
										`}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<label className="block px-1 text-xs font-bold uppercase tracking-widest text-[#595c5e]" htmlFor="restore-password">
									Password
								</label>
								<div className="relative">
									<input
										id="restore-password"
										type={peekPin ? 'text' : 'password'}
										autoComplete="current-password"
										autoCapitalize="none"
										autoCorrect="off"
										spellCheck={false}
										value={pin}
										onChange={(e) => {
											setPin(e.target.value)
											setErrorTag('')
										}}
										placeholder="Enter your password"
										disabled={busy}
										className={`
											w-full rounded-2xl border-0 bg-[#eef1f3] py-4 pl-4 pr-14 text-base text-[#2c2f31] placeholder:text-[#747779]/50
											transition-all focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
											disabled:opacity-60
											${errorTag && !pin ? 'ring-2 ring-red-200' : ''} ${bizBrandFocusRingClass}
										`}
									/>
									<button
										type="button"
										className={`absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[#747779]/60 transition hover:text-[#1562f0] ${bizBrandFocusRingClass}`}
										onPointerDown={(e) => {
											e.preventDefault()
											setPeekPin(true)
										}}
										onPointerUp={() => setPeekPin(false)}
										onPointerLeave={() => setPeekPin(false)}
										onClick={() => {
											if (typeof window !== 'undefined' && 'ontouchstart' in window) {
												setPeekPin((p) => !p)
											}
										}}
										aria-label={peekPin ? 'Hide password' : 'Show password'}
									>
										{peekPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
									</button>
								</div>
								<div className="text-right">
									<a
										href="mailto:support@beamio.app?subject=Beamio%20Business%20password%20help"
										className="text-sm font-semibold text-[#1562f0] transition-colors hover:text-[#0047b8]"
									>
										Forgot Password?
									</a>
								</div>
							</div>
							{errorTag && (
								<div className="flex items-center gap-2 text-red-600">
									<AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
									<span className="text-sm font-semibold leading-snug">{errorTag}</span>
								</div>
							)}
							<div className="mt-auto pt-4">
								<button
									type="submit"
									disabled={busy}
									className={`
										flex w-full items-center justify-center gap-2 rounded-full bg-[#1562f0] px-6 py-4 text-base font-bold text-white
										shadow-lg shadow-[#1562f0]/20 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60
										${bizBrandFocusRingClass}
									`}
								>
									{loadingTag ? 'Signing in…' : 'Login & Restore Account'}
									<ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
								</button>
							</div>
						</form>
					</section>

					{/* Option 2: Backup key */}
					<section className="flex flex-col rounded-2xl border border-[#abadaf]/10 bg-white p-8 shadow-[0_20px_40px_rgba(21,98,240,0.04)] md:p-10">
						<div className="mb-8 flex items-center gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f797ef]/30 text-[#610e62]">
								<KeyRound className="h-5 w-5" strokeWidth={2} aria-hidden />
							</div>
							<h2 className="text-xl font-bold text-[#2c2f31]" style={HEADLINE}>
								Option 2: Use Backup Key
							</h2>
						</div>
						<form onSubmit={handleKeySubmit} className="flex flex-1 flex-col space-y-6">
							<button
								type="button"
								onClick={onOpenScanner}
								disabled={busy}
								className={`
									group cursor-pointer rounded-2xl border-2 border-dashed border-[#abadaf]/30 bg-[#eef1f3]/30 p-6 text-center transition-colors
									hover:border-[#1562f0]/40 disabled:cursor-not-allowed disabled:opacity-60
									${bizBrandFocusRingClass}
								`}
							>
								<QrCode className="mx-auto mb-3 h-10 w-10 text-[#abadaf] transition group-hover:text-[#1562f0]" strokeWidth={1.5} aria-hidden />
								<p className="mb-4 text-sm text-[#595c5e]">Upload or scan your Restore QR Image</p>
								<span
									className="inline-block rounded-full border-2 border-[#1562f0] px-6 py-2 text-sm font-bold text-[#1562f0] transition group-hover:bg-[#1562f0] group-hover:text-white"
									tabIndex={-1}
								>
									Upload QR Code
								</span>
							</button>

							<div className="flex items-center gap-4 py-2">
								<div className="h-px flex-1 bg-[#abadaf]/20" aria-hidden />
								<span className="text-xs font-bold uppercase tracking-widest text-[#abadaf]">- OR -</span>
								<div className="h-px flex-1 bg-[#abadaf]/20" aria-hidden />
							</div>

							<div className="space-y-2">
								<label className="block px-1 text-xs font-bold uppercase tracking-widest text-[#595c5e]" htmlFor="restore-backup-key">
									Enter Backup Key String
								</label>
								<textarea
									id="restore-backup-key"
									rows={3}
									value={recoveryCode}
									onChange={(e) => {
										setRecoveryCode(e.target.value)
										setErrorKey('')
									}}
									disabled={busy}
									placeholder="Paste your alphanumeric restore key here… (e.g., vR_aBcDeF...)"
									className={`
										w-full resize-none rounded-2xl border-0 bg-[#eef1f3] px-4 py-4 font-mono text-sm text-[#2c2f31] placeholder:text-[#747779]/50
										transition-all focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
										disabled:opacity-60
										${errorKey ? 'ring-2 ring-red-200' : ''} ${bizBrandFocusRingClass}
									`}
								/>
							</div>
							{errorKey && (
								<div className="flex items-center gap-2 text-red-600">
									<AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
									<span className="text-sm font-semibold">{errorKey}</span>
								</div>
							)}
							<div className="mt-auto pt-4">
								<button
									type="submit"
									disabled={busy || !recoveryCode.trim()}
									className={`
										flex w-full items-center justify-center gap-2 rounded-full bg-[#1562f0] px-6 py-4 text-base font-bold text-white
										shadow-lg shadow-[#1562f0]/20 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60
										${bizBrandFocusRingClass}
									`}
								>
									{loadingKey ? 'Validating…' : 'Validate Key & Restore'}
									<ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
								</button>
							</div>
						</form>
					</section>
				</div>

				{/* Trust row */}
				<div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-[#595c5e] opacity-80 transition hover:opacity-100">
					<div className="flex items-center gap-2">
						<Shield className="h-5 w-5 text-[#747779]" aria-hidden />
						<span className="text-xs font-bold uppercase tracking-widest">Zero Knowledge</span>
					</div>
					<div className="flex items-center gap-2">
						<Lock className="h-5 w-5 text-[#747779]" aria-hidden />
						<span className="text-xs font-bold uppercase tracking-widest">AES-256 Armed</span>
					</div>
					<div className="flex items-center gap-2">
						<BadgeCheck className="h-5 w-5 text-[#747779]" aria-hidden />
						<span className="text-xs font-bold uppercase tracking-widest">Non-Custodial</span>
					</div>
				</div>
			</main>

			<footer className="mt-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-8 py-10 md:flex-row md:px-12">
				<div className="flex items-center gap-2 md:mb-0">
					<IpfsImg src={BIZ_PUBLIC_LOGO512} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
					<div className="text-lg font-bold text-[#2c2f31]" style={HEADLINE}>
						Beamio Studio
					</div>
				</div>
				<div className="mb-4 flex flex-wrap justify-center gap-8 md:mb-0">
					<a
						href="https://beamio.app/privacy"
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs uppercase tracking-widest text-slate-400 transition-colors hover:text-[#1562f0]"
					>
						Privacy Policy
					</a>
					<a
						href="https://beamio.app/terms"
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs uppercase tracking-widest text-slate-400 transition-colors hover:text-[#1562f0]"
					>
						Terms of Service
					</a>
					<a
						href="mailto:support@beamio.app?subject=Beamio%20Business%20security"
						className="text-xs uppercase tracking-widest text-slate-400 transition-colors hover:text-[#1562f0]"
					>
						Security Architecture
					</a>
					<a
						href="mailto:support@beamio.app?subject=Beamio%20Business%20support"
						className="text-xs uppercase tracking-widest text-slate-400 transition-colors hover:text-[#1562f0]"
					>
						Contact Support
					</a>
				</div>
				<div className="text-xs uppercase tracking-widest text-slate-400">
					© 2026 Beamio Studio. Secure B2B Infrastructure.
				</div>
			</footer>

			<div
				className="pointer-events-none fixed top-0 right-0 -z-10 h-[600px] w-[600px] translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1562f0]/5 blur-[120px]"
				aria-hidden
			/>
			<div
				className="pointer-events-none fixed bottom-0 left-0 -z-10 h-[600px] w-[600px] -translate-x-1/2 translate-y-1/2 rounded-full bg-[#8d3a8b]/5 blur-[120px]"
				aria-hidden
			/>
		</div>
	)
}

export default RestoreEntryScreen
