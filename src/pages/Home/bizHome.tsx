import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Shield, CheckCircle, ArrowRight, Eye, EyeOff, Lock, AtSign, Fingerprint, ScanFace, Network, Database, Share2 } from 'lucide-react'
import { APP_VERSION } from '@/version'
import { ethers } from 'ethers'
import { restoreWithUserPin, getUserInfo, storeSystemData } from '@/services/beamio'
import { setCoNET_Data } from '@/utils/globals'
import { initChat } from '@/services/chat'
import { fetchTrustedCanonicalAaFromRpc } from '@/services/BeamioCard'
import { baseEndpoint } from '@/utils/constants'
import { useDaemonContext } from '@/providers/DaemonProvider'
import MerchantOS from '@/pages/Vouchers/example/biz'
import NewMerchantOS from '@/pages/Vouchers/example/newBiz'
import { BIZ_BRAND_HEX, bizBrandFocusRingClass, bizBrandOnboardingPrimaryBtnClass } from '@/pages/Home/brandUi'

/** Data attribute + selection tint — matches `biz.tsx` Merchant OS */
const BIZ_UI_PRIMARY = BIZ_BRAND_HEX

/** Assemble encrypt_keys_object after login (mirror App.tsx init): load beamio, initChat, persist */
const assembleEncryptKeysObject = async (
	temp: encrypt_keys_object,
	setProfiles: (val: profile[]) => void,
	setAllNodes: (val: nodeInfo[]) => void,
	setGossip: (val: boolean) => void,
	gossip: boolean,
	setBeamio: (val: beamio) => void,
	setCharts: React.Dispatch<React.SetStateAction<string[]>>,
	setMyAddress: (val: string) => void,
	onProgress?: (step: number) => void
) => {
	const profiles = temp?.profiles
	if (!temp || !profiles?.length) return

	const loadUserInfo = (): Promise<beamio> =>
		new Promise((resolve) => {
			getUserInfo(profiles[0].keyID).then((userInfo) => {
				if (!userInfo) {
					setTimeout(() => resolve(loadUserInfo()), 1000)
				} else {
					resolve(userInfo)
				}
			})
		})

	const userInfo = await loadUserInfo()
	if (!userInfo) return

	const bo: beamio = userInfo
	bo.initialLoading = true
	temp.beamio = bo

	// Trusted RPC：与本地缓存比对，不一致则更新（含链上无 AA 时清除无 bytecode 的错误缓存）
	try {
		const eoa0 = profiles[0]?.keyID?.trim()
		if (eoa0 && ethers.isAddress(eoa0)) {
			const r = await fetchTrustedCanonicalAaFromRpc(eoa0)
			if (r.trusted) {
				let nextProfiles = profiles
				let changed = false
				if (r.aa) {
					const chainAa = ethers.getAddress(r.aa)
					const cached = profiles[0].aaAccount?.trim()
					if (
						!cached ||
						!ethers.isAddress(cached) ||
						ethers.getAddress(cached).toLowerCase() !== chainAa.toLowerCase()
					) {
						nextProfiles = profiles.map((p, i) => (i === 0 ? { ...p, aaAccount: chainAa } : p))
						changed = true
					}
				} else {
					const cached = profiles[0].aaAccount?.trim()
					if (cached && ethers.isAddress(cached)) {
						const code = await baseEndpoint.getCode(cached)
						if (!code || code === '0x' || code.length <= 2) {
							nextProfiles = profiles.map((p, i) => (i === 0 ? { ...p, aaAccount: undefined } : p))
							changed = true
						}
					}
				}
				if (changed) {
					temp.profiles = nextProfiles
					setProfiles(nextProfiles)
				}
			}
		}
	} catch {
		// Keep last trusted; RPC failure does not overwrite
	}

	setCoNET_Data(temp)
	setBeamio(bo)
	onProgress?.(2) // Securing done, starting sync

	await initChat(setProfiles, setAllNodes, setGossip, gossip, (message) => {
		setCharts((prev) => [...prev, message])
	})

	await storeSystemData()
	const eoa = profiles[0]?.keyID?.trim()
	if (eoa && ethers.isAddress(eoa)) {
		setMyAddress(eoa)
	}
}

/** Progress bar width % by login pipeline step (newOnloading.html). */
const LOGIN_PROGRESS_PCT: Record<number, number> = {
	0: 18,
	1: 42,
	2: 72,
	3: 94,
}

const BizHome = () => {
	const navigate = useNavigate()
	const [merchantTag, setMerchantTag] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [loadingStep, setLoadingStep] = useState(0)
	const [loginError, setLoginError] = useState('')
	const [isLoggedIn, setIsLoggedIn] = useState(false)
	const [showNewBiz, setShowNewBiz] = useState(false)

	const {
		setProfiles,
		setAllNodes,
		setGossip,
		gossip,
		setBeamio,
		setCharts,
		setMyAddress,
	} = useDaemonContext()

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setLoginError('')
		setIsLoading(true)
		setLoadingStep(0)
		let willTransitionToHome = false
		try {
			const username = merchantTag.startsWith('@') ? merchantTag.slice(1) : merchantTag
			const result = await restoreWithUserPin(username, password, false)
			const temp = result && typeof result === 'object' && result.profiles ? result : null
			if (!temp) {
				setLoginError('Invalid Beamio Tag or Recovery Password, please try again')
				setLoadingStep(0)
				return
			}
			setLoadingStep(1)
			await assembleEncryptKeysObject(
				temp,
				setProfiles,
				setAllNodes,
				setGossip,
				gossip,
				setBeamio,
				setCharts,
				setMyAddress,
				setLoadingStep
			)
			setLoadingStep(3)
			willTransitionToHome = true
			setTimeout(() => {
				setIsLoggedIn(true)
				setIsLoading(false)
			}, 400)
		} catch {
			setLoginError('Login failed, please try again later')
			setLoadingStep(0)
		} finally {
			if (!willTransitionToHome) {
				setIsLoading(false)
			}
		}
	}

	if (showNewBiz) {
		return <NewMerchantOS />
	}
	if (isLoggedIn) {
		return <MerchantOS />
	}

	if (isLoading) {
		const progressPct = LOGIN_PROGRESS_PCT[loadingStep] ?? LOGIN_PROGRESS_PCT[0]
		return (
			<div
				data-biz-ui-primary={BIZ_UI_PRIMARY}
				className="relative flex min-h-[max(100dvh,884px)] flex-col overflow-hidden bg-[#f5f7f9] text-[#2c2f31] selection:bg-[#7a9dff]/30"
			>
				<div
					className="pointer-events-none absolute inset-0 opacity-20"
					style={{
						background: `
              radial-gradient(at 0% 0%, #7a9dff 0%, transparent 50%),
              radial-gradient(at 100% 0%, #0051d1 0%, transparent 50%),
              radial-gradient(at 100% 100%, #f797ef 0%, transparent 50%),
              radial-gradient(at 0% 100%, #0047b8 0%, transparent 50%)`,
						backgroundColor: '#f5f7f9',
					}}
				/>
				<header className="relative z-10 flex items-center justify-center px-6 py-8">
					<div className="flex items-center gap-2">
						<Shield className="h-8 w-8 shrink-0 text-[#0051d1]" strokeWidth={2} aria-hidden />
						<span className="text-2xl font-black uppercase tracking-tighter text-[#0051d1]">Verra</span>
					</div>
				</header>
				<main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
					<div className="flex w-full max-w-2xl flex-col items-center">
						<div
							className="relative mb-12 flex h-64 w-64 items-center justify-center"
							style={{ perspective: '1000px' }}
						>
							<div className="pointer-events-none absolute inset-0 scale-110 rounded-full border border-[#0051d1]/10" />
							<div className="pointer-events-none absolute inset-4 rounded-full border border-[#0051d1]/20" />
							<div className="relative z-20 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_20px_40px_rgba(21,98,240,0.15)]">
								<div className="absolute inset-0 bg-gradient-to-br from-[#0051d1]/5 to-[#0051d1]/20" />
								<Share2 className="relative h-12 w-12 text-[#0051d1]" strokeWidth={1.5} aria-hidden />
							</div>
							<div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-4">
								<div className="rounded-full border border-[#0051d1]/10 bg-white p-2 shadow-lg">
									<Network className="h-4 w-4 text-[#0051d1]" strokeWidth={2} aria-hidden />
								</div>
							</div>
							<div className="absolute bottom-1/4 right-0 translate-x-4">
								<div className="rounded-full border border-[#0051d1]/10 bg-white p-2 shadow-lg">
									<Lock className="h-4 w-4 text-[#0051d1]" strokeWidth={2} aria-hidden />
								</div>
							</div>
							<div className="absolute bottom-1/4 left-0 -translate-x-4">
								<div className="rounded-full border border-[#0051d1]/10 bg-white p-2 shadow-lg">
									<Database className="h-4 w-4 text-[#0051d1]" strokeWidth={2} aria-hidden />
								</div>
							</div>
							<div
								className="pointer-events-none absolute inset-0 rounded-full border-t-4 border-[#0051d1] shadow-[0_-10px_20px_rgba(21,98,240,0.2)]"
								style={{ transform: 'rotateX(60deg)' }}
							/>
							<div
								className="pointer-events-none absolute left-[10%] top-[10%] h-[80%] w-[80%] rounded-full border-t-2 border-[#7a9dff] opacity-60"
								style={{ transform: 'rotate(45deg) rotateX(60deg)' }}
							/>
						</div>
						<div className="max-w-lg space-y-6 text-center">
							<h1 className="text-4xl font-extrabold tracking-tight text-[#2c2f31] md:text-5xl">
								Finalizing your terminal...
							</h1>
							<p className="text-lg leading-relaxed text-[#595c5e]">
								Synchronizing with the clearing layer and preparing your Merchant OS surface. Your secure business environment
								will be ready in a moment.
							</p>
						</div>
						<div className="mt-12 w-full max-w-xs">
							<div className="h-1.5 overflow-hidden rounded-full bg-[#e5e9eb]">
								<div
									className="h-full rounded-full bg-[#0051d1] shadow-[0_0_15px_rgba(0,81,209,0.4)] transition-[width] duration-700 ease-out"
									style={{ width: `${progressPct}%` }}
								/>
							</div>
						</div>
					</div>
				</main>
				<footer className="relative z-10 flex flex-col items-center pb-12 pt-6">
					<div className="flex items-center gap-3 rounded-full bg-[#eef1f3] px-4 py-2">
						<span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#0051d1]" />
						<span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#595c5e]">
							ESTABLISHING DETERMINISTIC SOLVENCY SYNC...
						</span>
					</div>
				</footer>
			</div>
		)
	}

	return (
		<div
			data-biz-ui-primary={BIZ_UI_PRIMARY}
			className="flex min-h-[max(100dvh,884px)] flex-col overflow-hidden bg-[#f5f7f9] text-[#2c2f31] selection:bg-[#7a9dff]/30"
		>
			<main className="flex min-h-0 flex-1 flex-col md:h-[100dvh] md:flex-row">
				{/* Left: editorial (tablet+) — mesh gradient per newOnloading.html */}
				<div
					className="relative hidden w-1/2 flex-col justify-between p-12 text-white md:flex"
					style={{
						background: `
							radial-gradient(at 0% 0%, #0051d1 0%, transparent 50%),
							radial-gradient(at 100% 100%, #7a9dff 0%, transparent 50%),
							radial-gradient(at 100% 0%, #f797ef 0%, transparent 50%)
						`,
					}}
				>
					<div className="relative z-10">
						<div className="flex items-center gap-3">
							<Shield className="h-8 w-8 shrink-0 text-white" strokeWidth={1.75} aria-hidden />
							<span className="text-2xl font-extrabold tracking-tighter text-white">Verra Business</span>
						</div>
					</div>
					<div className="relative z-10 space-y-6">
						<h1 className="text-5xl font-extrabold leading-tight tracking-tight lg:text-6xl">
							Identity <br />
							<span className="text-white/80">Verified.</span>
						</h1>
						<p className="max-w-md text-lg font-medium leading-relaxed text-white/80">
							Your business identity is now secured. Re-enter your credentials to unlock your business operating surface and start
							managing connected commerce.
						</p>
					</div>
					<div className="relative z-10 flex flex-col gap-4">
						<div className="flex max-w-xs items-center gap-4 rounded-lg border border-white/25 bg-slate-950/15 px-6 py-4 shadow-xl backdrop-blur-xl">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/25 ring-1 ring-emerald-400/30">
								<CheckCircle className="h-6 w-6 text-emerald-200" strokeWidth={2} aria-hidden />
							</div>
							<div>
								<p className="font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">Account Ready</p>
								<p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100/90">Verification success</p>
							</div>
						</div>
						<div className="flex max-w-xs items-center gap-4 rounded-lg border border-white/25 bg-slate-950/15 px-6 py-4 shadow-xl backdrop-blur-xl">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/25 ring-1 ring-emerald-400/30">
								<CheckCircle className="h-6 w-6 text-emerald-200" strokeWidth={2} aria-hidden />
							</div>
							<div>
								<p className="font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">Recovery Saved</p>
								<p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100/90">Backups enabled</p>
							</div>
						</div>
					</div>
					<div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
						<div className="absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-white blur-[120px]" />
						<div className="absolute -bottom-20 -left-20 h-[600px] w-[600px] rounded-full bg-[#7a9dff] blur-[150px]" />
					</div>
				</div>

				{/* Right: unlock form */}
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[#f5f7f9] px-6 py-12 md:px-16 lg:px-24">
					<div className="mb-12 flex w-full max-w-sm flex-col items-center text-center md:hidden">
						<div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-[#0051d1] shadow-lg shadow-[#0051d1]/20">
							<Shield className="h-9 w-9 text-white" strokeWidth={1.75} aria-hidden />
						</div>
						<h2 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Verra Business</h2>
					</div>

					<div className="flex w-full max-w-sm flex-1 flex-col justify-center space-y-10 md:flex-none">
						<div className="space-y-2">
							<span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0051d1]">Security layer</span>
							<h3 className="text-3xl font-extrabold tracking-tighter text-[#2c2f31] md:text-4xl">Unlock Business OS</h3>
							<p className="text-sm font-medium text-[#595c5e]">Enter your @BeamioTag and Password to continue.</p>
						</div>

						<form onSubmit={handleLogin} className="space-y-6">
							<div className="space-y-4">
								<div>
									<label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
										Business handle
									</label>
									<div className="relative">
										<AtSign className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#747779]" strokeWidth={2} aria-hidden />
										<input
											type="text"
											autoCapitalize="none"
											autoCorrect="off"
											autoComplete="username"
											inputMode="text"
											placeholder="@yourbusiness"
											value={merchantTag.startsWith('@') ? `@${merchantTag.replace(/^@+/, '')}` : merchantTag ? `@${merchantTag}` : ''}
											onChange={(e) => {
												const v = e.target.value.replace(/^@+/, '')
												setMerchantTag(v ? `@${v}` : '')
											}}
											className={`w-full rounded-2xl border-none bg-[#eef1f3] py-4 pl-14 pr-6 font-medium text-[#2c2f31] placeholder:text-[#abadaf]/50 transition-all focus:bg-white focus:ring-2 focus:ring-[#0051d1]/20 ${bizBrandFocusRingClass}`}
											required
											disabled={isLoading}
										/>
									</div>
								</div>
								<div>
									<label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
										Account password
									</label>
									<div className="relative">
										<Lock className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#747779]" strokeWidth={2} aria-hidden />
										<input
											type={showPassword ? 'text' : 'password'}
											autoComplete="current-password"
											placeholder="••••••••••••"
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											className={`w-full rounded-2xl border-none bg-[#eef1f3] py-4 pl-14 pr-14 font-medium text-[#2c2f31] placeholder:text-[#abadaf]/50 transition-all focus:bg-white focus:ring-2 focus:ring-[#0051d1]/20 ${bizBrandFocusRingClass}`}
											required
											disabled={isLoading}
										/>
										<button
											type="button"
											tabIndex={-1}
											className="absolute right-5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#747779] transition-colors hover:text-[#0051d1]"
											onClick={() => setShowPassword((s) => !s)}
											aria-label={showPassword ? 'Hide password' : 'Show password'}
										>
											{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
										</button>
									</div>
								</div>
							</div>

							<div className="flex justify-center px-2">
								<button
									type="button"
									onClick={() => navigate('/Onboarding')}
									className="text-xs font-bold text-[#0051d1] transition-colors hover:text-[#0047b8]"
								>
									Forgot your password? Use recovery key
								</button>
							</div>

							{loginError ? (
								<div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-600">{loginError}</div>
							) : null}

							<button
								type="submit"
								disabled={isLoading}
								className={`group flex w-full items-center justify-center gap-3 rounded-full py-5 text-lg font-bold text-white shadow-xl shadow-[#0051d1]/20 transition-all active:scale-[0.98] disabled:opacity-60 ${
									isLoading
										? 'bg-[#1562f0]'
										: `${bizBrandOnboardingPrimaryBtnClass} ${bizBrandFocusRingClass}`
								}`}
							>
								{isLoading ? (
									<>
										<span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
										Unlocking…
									</>
								) : (
									<>
										Unlock &amp; Enter Merchant Portal
										<ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
									</>
								)}
							</button>
						</form>

						<div className="border-t border-[#abadaf]/20 pt-6">
							<div className="flex items-center justify-center gap-6">
								<button
									type="button"
									tabIndex={-1}
									title="Coming soon"
									className="flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-full bg-[#eef1f3] text-[#2c2f31] opacity-50"
									onClick={(e) => e.preventDefault()}
								>
									<Fingerprint className="h-6 w-6" strokeWidth={1.75} aria-hidden />
								</button>
								<button
									type="button"
									tabIndex={-1}
									title="Coming soon"
									className="flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-full bg-[#eef1f3] text-[#2c2f31] opacity-50"
									onClick={(e) => e.preventDefault()}
								>
									<ScanFace className="h-6 w-6" strokeWidth={1.75} aria-hidden />
								</button>
							</div>
						</div>
					</div>

					<footer className="mt-auto w-full max-w-sm pt-12 text-center">
						<p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#747779]">Securely hosted by Verra Infrastructure © 2026</p>
						<div className="mt-4 flex flex-col items-center gap-2">
							<button
								type="button"
								onClick={() => setShowNewBiz(true)}
								className="flex items-center gap-2 text-[11px] font-bold text-[#595c5e] transition-colors hover:text-[#0051d1]"
							>
								<ShieldCheck size={14} className="text-[#0051d1]" aria-hidden />
								<span>Preview new Merchant OS</span>
							</button>
							<span className="text-[10px] font-medium text-[#abadaf]">v{APP_VERSION}</span>
						</div>
					</footer>
				</div>
			</main>
		</div>
	)
}

export default BizHome
