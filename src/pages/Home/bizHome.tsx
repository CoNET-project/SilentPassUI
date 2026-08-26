import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ArrowRight, Eye, EyeOff, Info, HelpCircle, Fingerprint, QrCode, Check } from 'lucide-react'
import { APP_VERSION } from '@/version'
import { ethers } from 'ethers'
import { restoreWithRedeem, restoreWithUserPin, getUserInfo, storeSystemData, bootstrapProfileLocaleCurrencyIfUnset, mergeLocalLocaleLanguageOntoChainProfile, checkStorageWithTimeout } from '@/services/beamio'
import { getCoNET_Data, setCoNET_Data } from '@/utils/globals'
import { initChat } from '@/services/chat'
import { fetchTrustedCanonicalAaFromRpc } from '@/services/BeamioCard'
import { ensureConetAaForProfileAndPersist } from '@/utils/ensureConetAa'
import { conetDepinProvider } from '@/utils/constants'
import { useDaemonContext } from '@/providers/DaemonProvider'
import NewMerchantOS from '@/pages/Vouchers/example/newBiz'
import { BIZ_BRAND_HEX, bizBrandFocusRingClass, bizBrandPrimarySolidClass } from '@/pages/Home/brandUi'
import { BEAMIO_TAG_ALLOWED_RE, normalizeBeamioTagInput } from '@/utils/beamioTagRules'
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

/** Login shell (Initialize your commerce node) */
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

	let bo: beamio = mergeLocalLocaleLanguageOntoChainProfile(userInfo, temp.beamio)
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
	const [cachedAccountName, setCachedAccountName] = useState('')

	const {
		profiles,
		setProfiles,
		setAllNodes,
		setGossip,
		gossip,
		beamio,
		setBeamio,
		setCharts,
		setMyAddress,
	} = useDaemonContext()

	useEffect(() => {
		const fromDaemon = beamio?.accountName?.trim()
		const fromMem = getCoNET_Data()?.beamio?.accountName?.trim()
		const hit = fromDaemon || fromMem
		if (hit) {
			const norm = normalizeBeamioTagInput(hit)
			setCachedAccountName(norm)
			setMerchantTag((prev) => (prev.trim() ? prev : norm))
			return
		}
		let cancelled = false
		void checkStorageWithTimeout().then((data) => {
			if (cancelled) return
			const name = data?.beamio?.accountName?.trim()
			if (!name) return
			const norm = normalizeBeamioTagInput(name)
			setCachedAccountName(norm)
			setMerchantTag((prev) => (prev.trim() ? prev : norm))
		})
		return () => {
			cancelled = true
		}
	}, [beamio?.accountName])

	const normalizedMerchantTag = useMemo(
		() => normalizeBeamioTagInput(merchantTag),
		[merchantTag],
	)
	const tagLooksValid = BEAMIO_TAG_ALLOWED_RE.test(normalizedMerchantTag)
	const localCacheAuthenticated = Boolean(
		cachedAccountName &&
			normalizedMerchantTag &&
			cachedAccountName.toLowerCase() === normalizedMerchantTag.toLowerCase(),
	)

	useEffect(() => {
		// Mid-login `setProfiles` (AA hydrate) must not bounce to /native-pos before
		// assembleEncryptKeysObject finishes initChat — that race drops gossip listen.
		if (isLoading) return
		if (!isWorkspaceAccessGranted() || !hasSessionPrivateKeyArmor()) return
		const p0 = profiles?.[0]
		if (!p0?.keyID?.trim() || !ethers.isAddress(p0.keyID)) return
		navigate('/native-pos', { replace: true })
	}, [profiles, navigate, isLoading])

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setLoginError('')
		const username = normalizeBeamioTagInput(merchantTag)
		if (!username || !BEAMIO_TAG_ALLOWED_RE.test(username)) {
			setLoginError(tu('home_beamio_tag_rule_hint'))
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
				throw new Error(tu('home_restore_err_invalid_qr'))
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
				throw new Error(tu('home_restore_err_prepare_failed'))
			}
			navigate('/native-pos', { replace: true })
		} catch (err) {
			setShowRestoreAccess(true)
			throw new Error((err as Error)?.message ?? tu('home_restore_err_try_another'))
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
								{tu('gateway_verifying_access')}
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
									{tu('gateway_verifying_access')}
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
					radial-gradient(at 100% 10%, rgba(122, 157, 255, 0.05) 0px, transparent 50%)`,
			}}
		>
			<header
				className="z-50"
				style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
			>
				<div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-6 py-3">
					<div className="flex items-center gap-2.5">
						<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1562f0]/10">
							<Fingerprint className="h-5 w-5 text-[#1562f0]" strokeWidth={2} aria-hidden />
						</span>
						<span className={`${headlineFont} text-[17px] font-black tracking-tighter text-[#1562f0]`}>{tu('beamio_os')}</span>
					</div>
					<BizOnboardingLocalePicker />
				</div>
			</header>

			<main className="mx-auto flex w-full max-w-md flex-grow flex-col items-center px-6 pb-24 pt-10 text-center">
				<section className="mb-6 w-full">
					<h1 className={`${headlineFont} mb-4 text-[28px] font-extrabold leading-tight tracking-tight text-[#2c2f31] sm:text-3xl`}>
						{tu('initialize_your_commerce_node')}
					</h1>
					<p className="mb-3 text-3xl leading-none" aria-hidden>
						🚀
					</p>
					<p className="text-base font-medium leading-relaxed text-[#424655]">
						{tu('decrypt_your_local_eoa_aa_wallets_to_route_your_omnichannel_assets')}
					</p>
				</section>

				<div className="mb-10 h-1.5 w-16 shrink-0 rounded-full bg-[#1562f0]" aria-hidden />

				<section className="w-full rounded-2xl border border-[#e8eaed] bg-white p-8 text-left shadow-[0_20px_40px_rgba(21,98,240,0.06)]">
					<form onSubmit={handleLogin} className="space-y-6">
						<div className="space-y-2">
							<label
								htmlFor="biz-gateway-beamiotag"
								className={`${headlineFont} ml-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-[#1562f0]`}
							>
								{tu('home_beamiotag_label')}
							</label>
							<div className="relative">
								<input
									id="biz-gateway-beamiotag"
									type="text"
									tabIndex={1}
									autoCapitalize="none"
									autoCorrect="off"
									autoComplete="username"
									inputMode="text"
									enterKeyHint="next"
									placeholder={tu('gateway_beamiotag_ph')}
									value={merchantTag ? `@${merchantTag}` : ''}
									onChange={(e) => setMerchantTag(normalizeBeamioTagInput(e.target.value))}
									className={`w-full rounded-xl border border-[#e5e7eb] bg-[#f0f2f5] px-5 py-4 font-medium text-[#2c2f31] transition-all duration-200 placeholder:text-[#abadaf]/70 focus:border-[#1562f0]/30 focus:bg-white ${tagLooksValid ? 'pr-12' : ''} ${bizBrandFocusRingClass}`}
									required
									disabled={isLoading}
								/>
								{tagLooksValid ? (
									<span
										className="pointer-events-none absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[#1562f0]"
										aria-hidden
									>
										<Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
									</span>
								) : null}
							</div>
							{localCacheAuthenticated ? (
								<div className="mt-2 flex items-start gap-2 px-1">
									<Info className="mt-0.5 h-4 w-4 shrink-0 text-[#747779]" strokeWidth={2} aria-hidden />
									<p className="text-[11px] leading-normal text-[#595c5e]">{tu('local_cache_authenticated')}</p>
								</div>
							) : null}
						</div>

						<div className="space-y-2">
							<label
								htmlFor="biz-gateway-password"
								className={`${headlineFont} ml-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-[#1562f0]`}
							>
								{tu('master_decryption_key')}
							</label>
							<div className="relative">
								<input
									id="biz-gateway-password"
									type={showPassword ? 'text' : 'password'}
									tabIndex={2}
									autoComplete="current-password"
									enterKeyHint="done"
									placeholder="••••••••"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className={`w-full rounded-xl border border-[#e5e7eb] bg-[#f0f2f5] px-5 py-4 pr-12 font-medium text-[#2c2f31] transition-all duration-200 placeholder:text-[#abadaf]/70 focus:border-[#1562f0]/30 focus:bg-white ${bizBrandFocusRingClass}`}
									required
									disabled={isLoading}
								/>
								<button
									type="button"
									tabIndex={-1}
									className="absolute right-4 top-1/2 -translate-y-1/2 text-[#595c5e] transition-colors hover:text-[#1562f0]"
									onClick={() => setShowPassword((s) => !s)}
									aria-label={showPassword ? tu('hide_password') : tu('show_password')}
								>
									{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
								</button>
							</div>
						</div>

						{loginError ? (
							<div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-600">
								{loginError}
							</div>
						) : null}

						<div className="pt-2">
							<button
								type="submit"
								tabIndex={3}
								disabled={isLoading}
								className={`${headlineFont} ${bizBrandPrimarySolidClass} flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 sm:text-lg ${bizBrandFocusRingClass}`}
							>
								{isLoading ? (
									<>
										<span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
										{tu('signing_in')}
									</>
								) : (
									<>
										{tu('decrypt_and_enter_os')}
										<ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
									</>
								)}
							</button>
						</div>
					</form>
				</section>

				<footer className="mt-10 w-full text-center">
					<button
						type="button"
						tabIndex={4}
						onClick={() => setShowRestoreAccess(true)}
						className={`${headlineFont} mx-auto mb-5 inline-flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1562f0] transition-colors hover:text-[#0d4ec4]`}
					>
						<QrCode className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
						{tu('new_device_or_lost_keys_import_recovery_qr')}
					</button>
					<a
						href="mailto:support@beamio.app?subject=Beamio%20Business%20workspace"
						tabIndex={5}
						className={`${headlineFont} mx-auto inline-flex items-center justify-center gap-2 text-sm font-medium text-[#747779] transition-colors hover:text-[#2c2f31]`}
					>
						<HelpCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
						{tu('need_help_accessing_your_workspace')}
					</a>
					<div className="mt-6 flex flex-col items-center gap-2">
						<p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#595c5e]">
							{tu('securely_hosted_by_beamio_infrastructure_2026')}
						</p>
						<span className="text-[10px] font-medium text-[#abadaf]">v{APP_VERSION}</span>
					</div>
				</footer>
			</main>
		</div>
	)
}

export default BizHome
