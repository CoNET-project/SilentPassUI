import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ArrowRight, Eye, EyeOff, Info, HelpCircle, Fingerprint, QrCode, Check } from 'lucide-react'
import { APP_VERSION } from '@/version'
import { ethers } from 'ethers'
import { restoreWithRedeem, restoreWithUserPin, checkStorageWithTimeout } from '@/services/beamio'
import { getCoNET_Data } from '@/utils/globals'
import { useDaemonContext } from '@/providers/DaemonProvider'
import NewMerchantOS from '@/pages/Vouchers/example/newBiz'
import { BIZ_BRAND_HEX, bizBrandFocusRingClass, bizBrandPrimarySolidClass } from '@/pages/Home/brandUi'
import { BEAMIO_TAG_ALLOWED_RE, normalizeBeamioTagInput } from '@/utils/beamioTagRules'
import RestoreAccessPage from '@/pages/Home/RestoreAccessPage'
import { BizOnboardingLocalePicker } from '@/pages/Home/BizOnboardingLocalePicker'
import { useTu } from '@/locale/beamioLocale'
import { hasSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'
import { isWorkspaceAccessGranted } from '@/utils/beamioWorkspaceLock'
import { unlockMerchantWorkspaceSession } from '@/utils/unlockMerchantWorkspaceSession'
import {
	ensureAgentWorkspace,
	getBizWorkspaceRole,
	loadAgentWorkspace,
	setBizWorkspaceRole,
} from '@/utils/agentWorkspaceLocal'
import { setSessionAgentAccessPassword } from '@/utils/agentSessionSecrets'
import {
	fetchIsAgentOnChain,
	loadCachedIsAgent,
	registerAgentOnChain,
} from '@/utils/agentReferrerRegistryClient'

/** Data attribute + selection tint — matches `biz.tsx` Merchant OS */
const BIZ_UI_PRIMARY = BIZ_BRAND_HEX

/** Login shell (Initialize your commerce node) */
const headlineFont = "font-['Manrope',ui-sans-serif,system-ui,sans-serif]"

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
	return unlockMerchantWorkspaceSession(temp, {
		setProfiles,
		setAllNodes,
		setGossip,
		gossip,
		setBeamio,
		setCharts,
		setMyAddress,
		onProgress,
	})
}

/**
 * Route after login: prefer on-chain `isAgent(eoa)` (BeamioAgentReferrerRegistry).
 * Local role / agent workspace / trusted cache are agent-intent signals. When
 * intent exists but the registry still returns false, gasless `registerAgentOnChain`
 * retries so future logins resolve via `isAgent` alone.
 */
async function postLoginPathForWallet(
	temp: encrypt_keys_object | null | undefined,
	pin?: string,
): Promise<string> {
	const eoaRaw = temp?.profiles?.[0]?.keyID?.trim()
	if (!eoaRaw || !ethers.isAddress(eoaRaw)) return '/native-pos'
	const eoa = ethers.getAddress(eoaRaw)
	try {
		const chain = await fetchIsAgentOnChain(eoa)
		let isAgentOnChain = chain.ok
			? chain.isAgent === true
			: loadCachedIsAgent(eoa) === true
		const role = getBizWorkspaceRole(eoa)
		const agentWs = loadAgentWorkspace(eoa)
		const cachedAgent = loadCachedIsAgent(eoa) === true
		const localAgentIntent = role === 'agent' || Boolean(agentWs) || cachedAgent

		// Create-time registration is best-effort; retry on login when we know
		// this wallet is an agent but the registry still returns false.
		if (!isAgentOnChain && localAgentIntent) {
			try {
				const reg = await registerAgentOnChain(eoa)
				if (reg.success) isAgentOnChain = true
			} catch {
				/* still route to /agent on local intent; next login retries */
			}
		}

		if (isAgentOnChain || localAgentIntent) {
			setBizWorkspaceRole('agent', eoa)
			const tag =
				agentWs?.agentBeamioTag?.trim() ||
				temp?.beamio?.accountName?.trim() ||
				''
			ensureAgentWorkspace(eoa, tag)
			if (pin?.trim()) setSessionAgentAccessPassword(pin.trim())
			return '/agent'
		}
	} catch {
		/* fall through to merchant OS */
	}
	return '/native-pos'
}

/** Decrypt → Activating Node loading (Gateway submit). Status rotation: setTimeout chain only. */
const ACTIVATING_NODE_STATUS_MS = 4000
const ACTIVATING_NODE_STATUS_KEYS = [
	'gateway_status_syncing_base_conet',
	'gateway_status_verifying_zk',
	'gateway_status_establishing_tunnel',
	'gateway_status_routing_omnichannel',
] as const

const ACTIVATING_NODE_STYLE = `
@keyframes biz-activate-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}
@keyframes biz-activate-pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.7; }
}
@keyframes biz-activate-breathe {
	0%, 100% { transform: scale(1); opacity: 0.9; }
	50% { transform: scale(1.02); opacity: 1; }
}
@keyframes biz-activate-flicker {
	0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 0.9; }
	20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.4; }
}
.biz-activate-spin-slow {
	animation: biz-activate-spin 3s linear infinite;
}
.biz-activate-spin-conic {
	animation: biz-activate-spin 2s linear infinite;
}
.biz-activate-pulse {
	animation: biz-activate-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.biz-activate-breathe {
	animation: biz-activate-breathe 4s ease-in-out infinite;
	display: inline-block;
}
.biz-activate-flicker {
	animation: biz-activate-flicker 4s infinite;
}
.biz-activate-glow {
	box-shadow: 0 0 20px rgba(21, 98, 240, 0.2), inset 0 0 20px rgba(21, 98, 240, 0.1);
}
`

function GatewayActivatingNodeScreen() {
	const { tu } = useTu()
	const [statusIndex, setStatusIndex] = useState(0)

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined
		const schedule = () => {
			timer = setTimeout(() => {
				setStatusIndex((i) => (i + 1) % ACTIVATING_NODE_STATUS_KEYS.length)
				schedule()
			}, ACTIVATING_NODE_STATUS_MS)
		}
		schedule()
		return () => {
			if (timer !== undefined) clearTimeout(timer)
		}
	}, [])

	const statusKey = ACTIVATING_NODE_STATUS_KEYS[statusIndex]

	return (
		<>
			<style>{ACTIVATING_NODE_STYLE}</style>
			<div
				data-biz-ui-primary={BIZ_UI_PRIMARY}
				className={`flex min-h-[max(100dvh,884px)] flex-col items-center overflow-hidden bg-[#faf9fe] text-[#2c2f31] selection:bg-[#1562f0]/20 ${headlineFont}`}
				role="status"
				aria-live="polite"
				aria-busy="true"
			>
				<div className="w-full flex-1" />
				<main className="relative z-10 flex w-full max-w-[600px] flex-col items-center justify-center px-6 text-center">
					<div className="relative mb-10 flex h-32 w-32 items-center justify-center">
						<svg
							className="biz-activate-spin-slow absolute inset-0 h-full w-full text-[#1562f0] opacity-80"
							viewBox="0 0 100 100"
							aria-hidden
						>
							<circle
								cx="50"
								cy="50"
								fill="none"
								r="45"
								stroke="currentColor"
								strokeDasharray="70 200"
								strokeLinecap="round"
								strokeWidth="2"
							/>
							<circle
								cx="50"
								cy="50"
								fill="none"
								r="45"
								stroke="currentColor"
								strokeDasharray="20 200"
								strokeDashoffset="100"
								strokeLinecap="round"
								strokeWidth="1"
							/>
						</svg>
						<div className="biz-activate-glow absolute inset-2 overflow-hidden rounded-full">
							<div
								className="biz-activate-spin-conic absolute inset-[-100%]"
								style={{
									background:
										'conic-gradient(from 90deg, transparent 0 75%, rgba(21, 98, 240, 0.5) 100%)',
								}}
								aria-hidden
							/>
							<div className="absolute inset-[1.5px] rounded-full border border-[#1562f0]/20 bg-white/80 backdrop-blur-md" />
						</div>
						<Shield
							className="biz-activate-pulse relative z-10 h-9 w-9 text-[#1562f0]"
							strokeWidth={1.25}
							aria-hidden
						/>
					</div>
					<div className="space-y-2">
						<h1 className="biz-activate-breathe px-2 text-2xl font-semibold leading-8 tracking-tight text-[#111827] md:text-[32px] md:leading-10">
							{tu('activating_commerce_node')}
						</h1>
						<p className="mx-auto mt-2 max-w-md text-lg font-normal leading-7 text-[#4b5563]">
							{tu('decrypting_eoa_aa_routing_omnichannel')}
						</p>
					</div>
					<div className="mt-6">
						<span className="inline-flex items-center rounded-full border border-[#1562f0]/20 bg-[#1562f0]/10 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.05em] text-[#1562f0] backdrop-blur-sm">
							{tu('securing_your_keys_on_conet_l1')}
						</span>
					</div>
				</main>
				<div className="w-full flex-1" />
				<footer
					className="relative z-10 w-full px-6 py-10 text-center"
					style={{ paddingBottom: 'max(2.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}
				>
					<div className="inline-flex items-center justify-center gap-2 font-mono text-sm leading-5 text-[#6b7280]">
						<span
							className="biz-activate-pulse h-2 w-2 rounded-full bg-[#1562f0] shadow-[0_0_8px_rgba(21,98,240,0.4)]"
							aria-hidden
						/>
						<span
							key={statusKey}
							className="biz-activate-flicker uppercase tracking-widest"
						>
							{tu(statusKey)}
						</span>
					</div>
				</footer>
			</div>
		</>
	)
}

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
		// Mid-login `setProfiles` (AA hydrate) must not bounce before
		// assembleEncryptKeysObject finishes initChat — that race drops gossip listen.
		if (isLoading) return
		if (!isWorkspaceAccessGranted() || !hasSessionPrivateKeyArmor()) return
		const p0 = profiles?.[0]
		if (!p0?.keyID?.trim() || !ethers.isAddress(p0.keyID)) return
		let cancelled = false
		void (async () => {
			const path = await postLoginPathForWallet(getCoNET_Data() as encrypt_keys_object | null)
			if (!cancelled) navigate(path, { replace: true })
		})()
		return () => {
			cancelled = true
		}
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
			const path = await postLoginPathForWallet(temp, password)
			navigate(path, { replace: true })
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
			const path = await postLoginPathForWallet(temp)
			navigate(path, { replace: true })
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
		return <GatewayActivatingNodeScreen />
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
