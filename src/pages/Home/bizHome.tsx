import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ArrowRight, Eye, EyeOff, Network, Briefcase, Info, HelpCircle, Fingerprint } from 'lucide-react'
import { APP_VERSION } from '@/version'
import { ethers } from 'ethers'
import { restoreWithRedeem, restoreWithUserPin, getUserInfo, storeSystemData, bootstrapProfileLocaleCurrencyIfUnset } from '@/services/beamio'
import { setCoNET_Data } from '@/utils/globals'
import { initChat } from '@/services/chat'
import { fetchTrustedCanonicalAaFromRpc } from '@/services/BeamioCard'
import { ensureConetAaForProfileAndPersist } from '@/utils/ensureConetAa'
import { conetDepinProvider } from '@/utils/constants'
import { useDaemonContext } from '@/providers/DaemonProvider'
import NewMerchantOS from '@/pages/Vouchers/example/newBiz'
import { BIZ_BRAND_HEX, bizBrandFocusRingClass } from '@/pages/Home/brandUi'
import { BEAMIO_TAG_ALLOWED_RE, BEAMIO_TAG_RULE_HINT, normalizeBeamioTagInput } from '@/utils/beamioTagRules'
import RestoreAccessPage from '@/pages/Home/RestoreAccessPage'
import { BizOnboardingLocalePicker } from '@/pages/Home/BizOnboardingLocalePicker'
import { markWorkspaceSessionUnlocked } from '@/utils/beamioWorkspaceLock'
import { useTu } from '@/locale/beamioLocale'
import {
	hydrateProfilesWithSessionSecrets,
	ingestSessionPrivateKeyFromProfiles,
	hasSessionPrivateKeyArmor,
	getSessionPrivateKeyArmor,
} from '@/utils/beamioSessionSecrets'
import { isWorkspaceAccessGranted } from '@/utils/beamioWorkspaceLock'

/** Data attribute + selection tint — matches `biz.tsx` Merchant OS */
const BIZ_UI_PRIMARY = BIZ_BRAND_HEX

/** Login shell (Access your business workspace) */
const headlineFont = "font-['Manrope',ui-sans-serif,system-ui,sans-serif]"

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
): Promise<boolean> => {
	const profiles = temp?.profiles
	if (!temp || !profiles?.length) return false

	if (!ingestSessionPrivateKeyFromProfiles(profiles)) return false
	// Unlock workspace as soon as password restore succeeds — before slow getUserInfo/initChat.
	markWorkspaceSessionUnlocked()
	const hydratedProfiles = hydrateProfilesWithSessionSecrets(profiles)
	temp.profiles = hydratedProfiles

	const USERINFO_POLL_MS = 1000
	const USERINFO_MAX_POLLS = 60
	const fallbackBeamio = temp.beamio?.accountName?.trim() ? temp.beamio : null

	const loadUserInfo = async (): Promise<beamio | null> => {
		if (fallbackBeamio) {
			const fresh = await getUserInfo(profiles[0].keyID).catch(() => null)
			if (fresh?.accountName?.trim()) return fresh
			return fallbackBeamio
		}
		for (let attempt = 0; attempt < USERINFO_MAX_POLLS; attempt++) {
			const userInfo = await getUserInfo(profiles[0].keyID).catch(() => null)
			if (userInfo?.accountName?.trim()) return userInfo
			if (attempt < USERINFO_MAX_POLLS - 1) {
				await new Promise((resolve) => setTimeout(resolve, USERINFO_POLL_MS))
			}
		}
		return null
	}

	const userInfo = await loadUserInfo()
	if (!userInfo?.accountName?.trim()) return false

	let bo: beamio = userInfo
	bo.initialLoading = false
	temp.beamio = bo

	const pk = getSessionPrivateKeyArmor()?.trim() ?? profiles[0]?.privateKeyArmor?.trim()
	if (pk) {
		bo = await bootstrapProfileLocaleCurrencyIfUnset(bo, pk)
		temp.beamio = bo
	}

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
						const code = await conetDepinProvider.getCode(cached)
						if (!code || code === '0x' || code.length <= 2) {
							nextProfiles = profiles.map((p, i) => (i === 0 ? { ...p, aaAccount: undefined } : p))
							changed = true
						}
					}
				}
				if (changed) {
					temp.profiles = hydrateProfilesWithSessionSecrets(nextProfiles)
					setProfiles(temp.profiles)
				}
			}
		}
	} catch {
		// Keep last trusted; RPC failure does not overwrite
	}

	try {
		const ensuredAa = await ensureConetAaForProfileAndPersist(temp.profiles[0], setProfiles)
		if (ensuredAa) {
			temp.profiles = hydrateProfilesWithSessionSecrets(
				(temp.profiles ?? []).map((p, i) => (i === 0 ? { ...p, aaAccount: ensuredAa } : p))
			)
		}
	} catch {
		/* non-fatal */
	}

	setCoNET_Data(temp)
	setBeamio(bo)
	onProgress?.(2) // Securing done, starting sync

	await initChat(setProfiles, setAllNodes, setGossip, gossip, (message) => {
		setCharts((prev) => [...prev, message])
	})

	await storeSystemData()
	const finalProfiles = hydrateProfilesWithSessionSecrets(temp.profiles)
	temp.profiles = finalProfiles
	setCoNET_Data(temp)
	const eoa = finalProfiles[0]?.keyID?.trim()
	if (eoa && ethers.isAddress(eoa)) {
		setMyAddress(eoa)
	}
	setProfiles(finalProfiles)
	return true
}

/** Post-login signing-in screen — `marketExample.html` (Beamio Business OS - Signing In) */
const SIGNING_IN_STYLE = `
@keyframes biz-signing-spin {
	to { transform: rotate(360deg); }
}
.biz-signing-loader-ring {
	animation: biz-signing-spin 1.5s linear infinite;
	border-top-color: #0051d1;
}
@keyframes biz-signing-pulse-soft {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.6; }
}
.biz-signing-pulse-soft {
	animation: biz-signing-pulse-soft 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
`

const BizHome = () => {
	const { tu } = useTu()
	const navigate = useNavigate()
	const [merchantTag, setMerchantTag] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [loginError, setLoginError] = useState('')
	const [showNewBiz, setShowNewBiz] = useState(false)
	const [showRestoreAccess, setShowRestoreAccess] = useState(false)

	const {
		profiles,
		setProfiles,
		setAllNodes,
		setGossip,
		gossip,
		setBeamio,
		setCharts,
		setMyAddress,
	} = useDaemonContext()

	useEffect(() => {
		if (!isWorkspaceAccessGranted() || !hasSessionPrivateKeyArmor()) return
		const p0 = profiles?.[0]
		if (!p0?.keyID?.trim() || !ethers.isAddress(p0.keyID)) return
		navigate('/native-pos', { replace: true })
	}, [profiles, navigate])

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setLoginError('')
		const username = normalizeBeamioTagInput(merchantTag)
		if (!username || !BEAMIO_TAG_ALLOWED_RE.test(username)) {
			setLoginError(BEAMIO_TAG_RULE_HINT)
			return
		}
		setIsLoading(true)
		try {
			const result = await restoreWithUserPin(username, password, false)
			const temp = result && typeof result === 'object' && result.profiles ? result : null
			if (!temp) {
				setLoginError(tu('invalid_beamio_tag_or_recovery_password_please_try_again'))
				return
			}
			const ready = await assembleEncryptKeysObject(
				temp,
				setProfiles,
				setAllNodes,
				setGossip,
				gossip,
				setBeamio,
				setCharts,
				setMyAddress,
				undefined
			)
			if (!ready) {
				setLoginError(tu('login_failed_please_try_again_later'))
				return
			}
			navigate('/native-pos', { replace: true })
		} catch {
			setLoginError(tu('login_failed_please_try_again_later'))
		} finally {
			setIsLoading(false)
		}
	}

	const handleRestoreFromCode = async (recoveryCode: string) => {
		setLoginError('')
		setShowRestoreAccess(false)
		setIsLoading(true)
		try {
			const result = await restoreWithRedeem(recoveryCode.trim(), '')
			const temp = result && typeof result === 'object' && result.profiles ? result : null
			if (!temp) {
				throw new Error('Invalid recovery QR code')
			}
			const ready = await assembleEncryptKeysObject(
				temp,
				setProfiles,
				setAllNodes,
				setGossip,
				gossip,
				setBeamio,
				setCharts,
				setMyAddress,
				undefined
			)
			if (!ready) {
				throw new Error('Could not prepare workspace after restore')
			}
			navigate('/native-pos', { replace: true })
		} catch (err) {
			setShowRestoreAccess(true)
			throw new Error((err as Error)?.message ?? 'Restore failed, please try another recovery QR image.')
		} finally {
			setIsLoading(false)
		}
	}

	if (showNewBiz) {
		return <NewMerchantOS />
	}
	if (showRestoreAccess) {
		return (
			<RestoreAccessPage
				onBack={() => setShowRestoreAccess(false)}
				onRestoreCode={handleRestoreFromCode}
			/>
		)
	}
	if (isLoading) {
		return (
			<>
				<style>{SIGNING_IN_STYLE}</style>
				<div
					data-biz-ui-primary={BIZ_UI_PRIMARY}
					className={`relative flex min-h-[max(100dvh,884px)] flex-col items-center justify-center overflow-hidden bg-[#f5f7f9] p-8 pb-32 text-[#2c2f31] selection:bg-[#7a9dff]/30 ${headlineFont}`}
				>
					<div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
						<div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] rounded-full bg-[#7a9dff]/5 blur-[120px]" />
						<div className="absolute -bottom-[10%] -right-[10%] h-[50%] w-[50%] rounded-full bg-[#d8e3fb]/10 blur-[120px]" />
					</div>

					<main className="flex w-full max-w-md flex-col items-center text-center">
						<div className="relative mb-16">
							<div className="absolute inset-0 scale-150 rounded-full bg-[#0051d1]/10 blur-3xl" aria-hidden />
							<div className="relative flex h-24 w-24 items-center justify-center">
								<div className="absolute inset-0 rounded-full border-4 border-[#d9dde0]" aria-hidden />
								<div
									className="biz-signing-loader-ring absolute inset-0 rounded-full border-4 border-transparent"
									aria-hidden
								/>
								<Shield className="relative z-10 h-9 w-9 text-[#0051d1]" strokeWidth={1.75} aria-hidden />
							</div>
						</div>

						<div className="space-y-6">
							<h1 className="px-4 text-3xl font-extrabold leading-tight tracking-tight text-[#2c2f31]">{tu('preparing_your_business_workspace')}</h1>
							<p className="px-6 text-lg font-medium leading-relaxed text-[#595c5e]">
								We&apos;re verifying your business access and getting Beamio Business OS ready.
							</p>
							<div className="pt-8">
								<span className="biz-signing-pulse-soft inline-block rounded-full bg-[#eef1f3] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#515c70]">{tu('this_usually_takes_a_few_seconds')}</span>
							</div>
						</div>
					</main>

					<footer
						className="fixed left-0 right-0 z-10 flex justify-center px-4 text-center"
						style={{ bottom: 'calc(3rem + env(safe-area-inset-bottom, 0px))' }}
					>
						<div className="flex max-w-lg flex-col items-center gap-4">
							<div className="flex items-center gap-2">
								<span className={`${headlineFont} text-xl font-black tracking-tighter text-[#0051d1]`}>{tu('beamio_identity')}</span>
							</div>
							<div className="flex items-start gap-3 sm:items-center">
								<div className="relative mt-1 flex h-2 w-2 shrink-0 sm:mt-0">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0051d1] opacity-60" />
									<span className="relative inline-flex h-2 w-2 rounded-full bg-[#0051d1]" />
								</div>
								<p className="text-left text-xs font-semibold uppercase leading-snug tracking-wide text-[#595c5e] sm:text-center sm:text-sm">
									We&apos;re verifying your business access and getting Beamio Business OS ready.
								</p>
							</div>
						</div>
					</footer>
				</div>
			</>
		)
	}

	return (
		<div
			data-biz-ui-primary={BIZ_UI_PRIMARY}
			className={`flex min-h-[max(100dvh,884px)] flex-col overflow-x-hidden bg-[#f5f7f9] text-[#2c2f31] selection:bg-[#7a9dff]/30 ${headlineFont}`}
			style={{
				backgroundImage: `
					radial-gradient(at 0% 0%, rgba(21, 98, 240, 0.03) 0px, transparent 50%),
					radial-gradient(at 100% 100%, rgba(122, 157, 255, 0.05) 0px, transparent 50%)`,
			}}
		>
			<header
				className="sticky top-0 z-50 border-b border-[#747779]/20 shadow-[0_20px_40px_rgba(21,98,240,0.06)]"
				style={{
					background: 'rgba(255, 255, 255, 0.7)',
					backdropFilter: 'blur(20px)',
					WebkitBackdropFilter: 'blur(20px)',
					paddingTop: 'env(safe-area-inset-top)',
				}}
			>
				<div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-6 py-4">
					<div className="flex items-center gap-2">
						<Fingerprint className="h-5 w-5 text-[#0051d1]" strokeWidth={2} aria-hidden />
						<span className={`${headlineFont} text-lg font-black tracking-tighter text-[#0051d1]`}>{tu('beamio_gateway')}</span>
					</div>
					<BizOnboardingLocalePicker />
				</div>
			</header>

			<main className="mx-auto flex w-full max-w-md flex-grow flex-col px-6 pb-24 pt-12">
				<section className="mb-12">
					<h1 className={`${headlineFont} mb-3 text-2xl font-extrabold leading-tight tracking-tight text-[#2c2f31] sm:text-3xl`}>{tu('access_your_business_workspace')}</h1>
					<p className="text-base leading-relaxed text-[#595c5e]">{tu('use_your_beamiotag_and_password_to_continue_to_beamio_business_os')}</p>
				</section>

				<div className="mb-12 h-1 w-24 shrink-0 rounded-full bg-[#0051d1] opacity-20" aria-hidden />

				<section className="rounded-xl bg-white p-8 shadow-[0_20px_40px_rgba(21,98,240,0.04)]">
					<div className="mb-8">
						<h2 className={`${headlineFont} mb-2 text-xl font-bold text-[#2c2f31]`}>{tu('continue_with_your_business_identity')}</h2>
						<p className="text-sm leading-snug text-[#595c5e]">{tu('enter_the_business_identity_you_just_created_to_access_your_beamio_works')}</p>
					</div>

					<form onSubmit={handleLogin} className="space-y-6">
						<div className="space-y-2">
							<label
								htmlFor="biz-gateway-beamiotag"
								className={`${headlineFont} ml-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-[#0051d1]`}
							>
								@BEAMIOTAG
							</label>
							<input
								id="biz-gateway-beamiotag"
								type="text"
								autoCapitalize="none"
								autoCorrect="off"
								autoComplete="username"
								inputMode="text"
								placeholder="e.g. global_ventures"
								value={merchantTag}
								onChange={(e) => setMerchantTag(normalizeBeamioTagInput(e.target.value))}
								className={`w-full rounded-lg border-none bg-[#eef1f3] px-5 py-4 font-medium text-[#2c2f31] transition-all duration-200 placeholder:text-[#abadaf]/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0051d1]/20 ${bizBrandFocusRingClass}`}
								required
								disabled={isLoading}
							/>
							<div className="mt-2 flex items-start gap-2 px-1">
								<Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0051d1]" strokeWidth={2} aria-hidden />
								<p className="text-[11px] leading-normal text-[#595c5e]">{tu('your_beamiotag_is_your_business_identity_on_beamio')}</p>
							</div>
						</div>

						<div className="space-y-2">
							<label
								htmlFor="biz-gateway-password"
								className={`${headlineFont} ml-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-[#0051d1]`}
							>{tu('access_password')}</label>
							<div className="relative">
								<input
									id="biz-gateway-password"
									type={showPassword ? 'text' : 'password'}
									autoComplete="current-password"
									enterKeyHint="done"
									placeholder="••••••••"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className={`w-full rounded-lg border-none bg-[#eef1f3] px-5 py-4 pr-12 font-medium text-[#2c2f31] transition-all duration-200 placeholder:text-[#abadaf]/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0051d1]/20 ${bizBrandFocusRingClass}`}
									required
									disabled={isLoading}
								/>
								<button
									type="button"
									tabIndex={-1}
									className="absolute right-4 top-1/2 -translate-y-1/2 text-[#595c5e] transition-colors hover:text-[#0051d1]"
									onClick={() => setShowPassword((s) => !s)}
									aria-label={showPassword ? '隐藏密码' : '显示密码'}
								>
									{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
								</button>
							</div>
						</div>

						{loginError ? (
							<div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-600">
								{loginError}
							</div>
						) : null}

						<div className="pt-4">
							<button
								type="submit"
								disabled={isLoading}
								className={`${headlineFont} flex w-full items-center justify-center gap-2 rounded-full bg-[#0051d1] py-4 text-base font-bold text-white shadow-[0_10px_20px_rgba(0,81,209,0.15)] transition-all duration-200 hover:scale-[1.02] hover:opacity-95 active:scale-95 disabled:opacity-60 sm:text-lg ${bizBrandFocusRingClass}`}
							>
								{isLoading ? (
									<>
										<span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />{tu('signing_in')}</>
								) : (
									<>{tu('continue_to_beamio_business_os')}<ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
									</>
								)}
							</button>
						</div>

						<div className="pt-1 text-center">
							<button
								type="button"
								onClick={() => setShowRestoreAccess(true)}
								className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#0051d1] transition-colors hover:text-[#0047b8]"
							>
								<Briefcase className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />{tu('already_have_a_workspace_restore_account')}</button>
						</div>
					</form>
				</section>

				<footer className="mt-12 text-center">
					<a
						href="mailto:support@beamio.app?subject=Beamio%20Business%20workspace"
						className={`${headlineFont} mx-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#0051d1] transition-colors hover:text-[#0047b8]`}
					>
						<HelpCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />{tu('need_help_accessing_your_workspace')}</a>
					<div className="mt-4 flex flex-col items-center gap-2 border-t border-[#abadaf]/20 pt-4">
						<p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#747779]">{tu('securely_hosted_by_beamio_infrastructure_2026')}</p>
						<span className="text-[10px] font-medium text-[#abadaf]">v{APP_VERSION}</span>
					</div>
				</footer>
			</main>

			<div className="pointer-events-none fixed bottom-0 right-0 -z-10 p-12 opacity-10" aria-hidden>
				<Network className="rotate-12 text-[#0051d1]" strokeWidth={1} size={240} />
			</div>
		</div>
	)
}

export default BizHome
