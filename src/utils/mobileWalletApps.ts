/**
 * Mobile wallet “installed” hints for verra-home USDC pages.
 *
 * Web cannot enumerate installed native apps. We combine:
 * - Injected EIP-1193 flags when page runs inside a wallet in-app browser
 * - Short custom-scheme probes (iframe + visibility/blur) on capable mobile browsers
 * - sessionStorage cache (per tab) to avoid re-probing on every navigation
 */

const CACHE_PREFIX = 'beamio.walletInstalled.'

export type MobileWalletId = 'metamask' | 'okx' | 'base' | 'tp'

export type MobileWalletProbeResult = Record<MobileWalletId, boolean>

const PROBE_SCHEMES: Record<MobileWalletId, readonly string[]> = {
	metamask: ['metamask://'],
	okx: ['okx://wallet/', 'okx://'],
	base: ['base://', 'cbwallet://', 'coinbase://'],
	tp: ['tpdapp://', 'tpoutside://'],
}

function readCache(id: MobileWalletId): boolean | null {
	try {
		const v = sessionStorage.getItem(CACHE_PREFIX + id)
		if (v === '1') return true
		if (v === '0') return false
	} catch {
		/* private mode */
	}
	return null
}

function writeCache(id: MobileWalletId, installed: boolean) {
	try {
		sessionStorage.setItem(CACHE_PREFIX + id, installed ? '1' : '0')
	} catch {
		/* ignore */
	}
}

/** Minimal EIP-1193 provider used by usdc-topup / wallet picker. */
export type Eip1193Provider = {
	request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
	on?: (eventName: string, listener: (...args: unknown[]) => void) => void
	removeListener?: (eventName: string, listener: (...args: unknown[]) => void) => void
	isMetaMask?: boolean
	isCoinbaseWallet?: boolean
	isOkxWallet?: boolean
	isOKExWallet?: boolean
	isTokenPocket?: boolean
	isTP?: boolean
	isTokenPocketProvider?: boolean
	isPhantom?: boolean
	isRabby?: boolean
	isBraveWallet?: boolean
	providers?: Eip1193Provider[]
}

export type InjectedWalletChoiceId = MobileWalletId | 'phantom' | 'other'

export type InjectedWalletChoice = {
	id: InjectedWalletChoiceId
	label: string
	provider: Eip1193Provider
	/** Optional EIP-6963 icon (data URL / https). */
	iconUrl?: string
	/** Stable dedupe key (rdns / namespace). */
	rdns?: string
}

type Eip6963ProviderInfo = {
	uuid: string
	name: string
	icon: string
	rdns: string
}

type Eip6963AnnounceDetail = {
	info: Eip6963ProviderInfo
	provider: Eip1193Provider
}

type WindowWithWalletNamespaces = Window & {
	ethereum?: Eip1193Provider
	okxwallet?: Eip1193Provider & { ethereum?: Eip1193Provider }
	coinbaseWalletExtension?: Eip1193Provider
	phantom?: { ethereum?: Eip1193Provider; solana?: unknown }
	tokenpocket?: Eip1193Provider
	tp?: Eip1193Provider
}

function asProvider(raw: unknown): Eip1193Provider | null {
	if (!raw || typeof raw !== 'object') return null
	const p = raw as Eip1193Provider
	if (typeof p.request !== 'function') return null
	return p
}

function classifyByFlags(p: Eip1193Provider): InjectedWalletChoice {
	if (p.isPhantom) return { id: 'phantom', label: 'Phantom', provider: p }
	if (p.isCoinbaseWallet) return { id: 'base', label: 'Base / Coinbase Wallet', provider: p }
	if (p.isOkxWallet || p.isOKExWallet) return { id: 'okx', label: 'OKX Wallet', provider: p }
	if (p.isTokenPocket || p.isTP || p.isTokenPocketProvider) {
		return { id: 'tp', label: 'TokenPocket', provider: p }
	}
	if (p.isRabby) return { id: 'other', label: 'Rabby Wallet', provider: p }
	if (p.isBraveWallet) return { id: 'other', label: 'Brave Wallet', provider: p }
	if (p.isMetaMask) return { id: 'metamask', label: 'MetaMask', provider: p }
	return { id: 'other', label: 'Browser wallet', provider: p }
}

function classifyByRdns(rdns: string, name: string, provider: Eip1193Provider, icon?: string): InjectedWalletChoice {
	const r = rdns.trim().toLowerCase()
	const n = name.trim() || 'Browser wallet'
	const iconUrl = icon?.trim() || undefined
	if (r.includes('metamask')) return { id: 'metamask', label: n || 'MetaMask', provider, iconUrl, rdns: r }
	if (r.includes('coinbase')) return { id: 'base', label: n || 'Base / Coinbase Wallet', provider, iconUrl, rdns: r }
	if (r.includes('okx') || r.includes('okex')) return { id: 'okx', label: n || 'OKX Wallet', provider, iconUrl, rdns: r }
	if (r.includes('tokenpocket')) return { id: 'tp', label: n || 'TokenPocket', provider, iconUrl, rdns: r }
	if (r.includes('phantom')) return { id: 'phantom', label: n || 'Phantom', provider, iconUrl, rdns: r }
	return { id: 'other', label: n, provider, iconUrl, rdns: r }
}

function collectLegacyNamespaceProviders(win: WindowWithWalletNamespaces): InjectedWalletChoice[] {
	const out: InjectedWalletChoice[] = []
	const push = (choice: InjectedWalletChoice) => {
		out.push(choice)
	}

	const okx = asProvider(win.okxwallet?.ethereum) ?? asProvider(win.okxwallet)
	if (okx) push({ id: 'okx', label: 'OKX Wallet', provider: okx, rdns: 'com.okx.wallet' })

	const coinbase = asProvider(win.coinbaseWalletExtension)
	if (coinbase) {
		push({ id: 'base', label: 'Base / Coinbase Wallet', provider: coinbase, rdns: 'com.coinbase.wallet' })
	}

	const phantomEth = asProvider(win.phantom?.ethereum)
	if (phantomEth) push({ id: 'phantom', label: 'Phantom', provider: phantomEth, rdns: 'app.phantom' })

	const tp = asProvider(win.tokenpocket) ?? asProvider(win.tp)
	if (tp) push({ id: 'tp', label: 'TokenPocket', provider: tp, rdns: 'pro.tokenpocket' })

	const eth = asProvider(win.ethereum)
	if (eth) {
		const multi = Array.isArray(eth.providers) ? eth.providers.map(asProvider).filter(Boolean) : []
		const list = (multi.length > 0 ? multi : [eth]) as Eip1193Provider[]
		for (const p of list) {
			const c = classifyByFlags(p)
			push(c)
		}
	}
	return out
}

function preferWalletChoice(a: InjectedWalletChoice, b: InjectedWalletChoice): InjectedWalletChoice {
	// Prefer EIP-6963 (icon / rdns) over bare legacy flags.
	if (!a.iconUrl && b.iconUrl) return b
	if (!a.rdns && b.rdns) return b
	if (b.label.length > a.label.length && b.label !== 'Browser wallet') return b
	return a
}

function mergeWalletChoices(parts: InjectedWalletChoice[]): InjectedWalletChoice[] {
	/** One slot per known brand; multiple anonymous "other" by rdns/label. */
	const byBrand = new Map<Exclude<InjectedWalletChoiceId, 'other'>, InjectedWalletChoice>()
	const others = new Map<string, InjectedWalletChoice>()

	for (const c of parts) {
		if (c.id === 'other') {
			const key = (c.rdns || c.label).toLowerCase()
			const prev = others.get(key)
			others.set(key, prev ? preferWalletChoice(prev, c) : c)
			continue
		}
		const prev = byBrand.get(c.id)
		byBrand.set(c.id, prev ? preferWalletChoice(prev, c) : c)
	}

	const order: InjectedWalletChoiceId[] = ['metamask', 'base', 'okx', 'tp', 'phantom', 'other']
	const out: InjectedWalletChoice[] = []
	for (const id of order) {
		if (id === 'other') {
			out.push(...others.values())
			continue
		}
		const hit = byBrand.get(id)
		if (hit) out.push(hit)
	}
	return out
}

/**
 * True when this page already runs inside a wallet in-app browser (UA only).
 * Never reads `window.ethereum` / `window.phantom` — those getters can open login.
 */
export function isLikelyWalletInAppBrowser(): boolean {
	if (typeof navigator === 'undefined') return false
	const ua = navigator.userAgent || ''
	return /MetaMask|Phantom|CoinbaseWallet|CBWallet|OKApp|OKX|TokenPocket|TrustWallet|Rainbow/i.test(ua)
}

/**
 * Snapshot of installed EVM wallets.
 * Desktop: EIP-6963 only (do not touch `window.ethereum` / `window.phantom` — Phantom login).
 * Wallet in-app UA: may include legacy namespaces for the host wallet.
 */
export function listInstalledInjectedWallets(): InjectedWalletChoice[] {
	if (typeof window === 'undefined') return []
	if (!isLikelyWalletInAppBrowser()) return []
	return mergeWalletChoices(collectLegacyNamespaceProviders(window as WindowWithWalletNamespaces))
}

/**
 * Live discovery via EIP-6963 only (desktop). Never auto-requests accounts.
 * Legacy `window.ethereum` / `window.phantom` are read only inside a wallet in-app browser.
 */
export function subscribeInstalledInjectedWallets(
	onChange: (wallets: InjectedWalletChoice[]) => void
): () => void {
	if (typeof window === 'undefined') {
		onChange([])
		return () => undefined
	}

	const win = window as WindowWithWalletNamespaces
	const from6963 = new Map<string, InjectedWalletChoice>()

	const publish = () => {
		const legacy = isLikelyWalletInAppBrowser() ? collectLegacyNamespaceProviders(win) : []
		onChange(mergeWalletChoices([...from6963.values(), ...legacy]))
	}

	const onAnnounce = (event: Event) => {
		const detail = (event as CustomEvent<Eip6963AnnounceDetail>).detail
		if (!detail?.info?.rdns || !detail.provider) return
		const choice = classifyByRdns(detail.info.rdns, detail.info.name, detail.provider, detail.info.icon)
		from6963.set(detail.info.rdns.toLowerCase(), choice)
		publish()
	}

	window.addEventListener('eip6963:announceProvider', onAnnounce as EventListener)
	// Ask already-injected wallets to re-announce (EIP-6963). Do not touch window.ethereum.
	try {
		window.dispatchEvent(new Event('eip6963:requestProvider'))
	} catch {
		/* ignore */
	}
	publish()

	const t1 = window.setTimeout(publish, 400)
	const t2 = window.setTimeout(() => {
		try {
			window.dispatchEvent(new Event('eip6963:requestProvider'))
		} catch {
			/* ignore */
		}
		publish()
	}, 1200)

	return () => {
		window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener)
		window.clearTimeout(t1)
		window.clearTimeout(t2)
	}
}

function getEthereumProvidersList(): Eip1193Provider[] {
	return listInstalledInjectedWallets().map((w) => w.provider)
}

export function isMobileDeviceForWalletApps(): boolean {
	if (typeof navigator === 'undefined') return false
	const ua = navigator.userAgent || ''
	let coarse = false
	try {
		coarse =
			typeof window !== 'undefined' &&
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(pointer: coarse)').matches
	} catch {
		coarse = false
	}
	if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true
	if (coarse && !/Windows NT|Macintosh|X11|Linux x86_64/i.test(ua)) return true
	return false
}

export function isIosLikeMobile(): boolean {
	if (typeof navigator === 'undefined') return false
	if (!isMobileDeviceForWalletApps()) return false
	return /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
}

/** True when UI runs inside that wallet’s in-app browser (treat as “this wallet is active”). */
export function injectedWalletFlags(): MobileWalletProbeResult {
	const list = getEthereumProvidersList()
	const metamask = list.some((p) => !!p?.isMetaMask)
	const base = list.some((p) => !!(p as { isCoinbaseWallet?: boolean }).isCoinbaseWallet)
	const okx = list.some(
		(p) =>
			!!(p as { isOkxWallet?: boolean }).isOkxWallet || !!(p as { isOKExWallet?: boolean }).isOKExWallet
	)
	const tp = list.some(
		(p) =>
			!!(p as { isTokenPocket?: boolean }).isTokenPocket ||
			!!(p as { isTP?: boolean }).isTP ||
			!!(p as { isTokenPocketProvider?: boolean }).isTokenPocketProvider
	)
	return { metamask, okx, base, tp }
}

function probeCustomSchemeOnceDeep(schemeUrl: string, timeoutMs: number): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false
		const finish = (v: boolean) => {
			if (settled) return
			settled = true
			window.clearTimeout(timer)
			document.removeEventListener('visibilitychange', onVis)
			window.removeEventListener('pagehide', onPh)
			window.removeEventListener('blur', onBlur)
			resolve(v)
		}
		const onVis = () => {
			if (document.visibilityState === 'hidden') finish(true)
		}
		const onPh = () => finish(true)
		const onBlur = () => finish(true)
		const timer = window.setTimeout(() => finish(false), timeoutMs)
		document.addEventListener('visibilitychange', onVis)
		window.addEventListener('pagehide', onPh)
		window.addEventListener('blur', onBlur)

		const iframe = document.createElement('iframe')
		iframe.style.cssText =
			'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;opacity:0;pointer-events:none'
		iframe.src = schemeUrl
		document.body.appendChild(iframe)
		window.setTimeout(() => {
			try {
				iframe.remove()
			} catch {
				/* ignore */
			}
		}, Math.min(timeoutMs, 750))
	})
}

/** Sequential probes to reduce parallel iframe noise. */
export async function probeMobileWalletInstallations(
	order: readonly MobileWalletId[] = ['metamask', 'okx', 'base', 'tp']
): Promise<MobileWalletProbeResult> {
	const out: MobileWalletProbeResult = { metamask: false, okx: false, base: false, tp: false }
	if (typeof document === 'undefined' || typeof window === 'undefined') return out
	for (const id of order) {
		const cached = readCache(id)
		if (cached === true) {
			out[id] = true
			continue
		}
		if (cached === false) continue
		let ok = false
		for (const scheme of PROBE_SCHEMES[id]) {
			ok = await probeCustomSchemeOnceDeep(scheme, 950)
			if (ok) break
		}
		out[id] = ok
		writeCache(id, ok)
		await new Promise((r) => setTimeout(r, 120))
	}

	/**
	 * iOS Safari frequently blocks passive custom-scheme probes without user gesture.
	 * Avoid false-negative hiding on iPhone/iPad by keeping expected choices visible.
	 */
	if (isIosLikeMobile() && !out.metamask && !out.okx && !out.base && !out.tp) {
		out.metamask = true
		out.okx = true
		out.base = true
		out.tp = true
	}
	return out
}

/** Universal / app links to open this exact page inside each wallet. */
export function buildMobileWalletDappLinks(): Record<MobileWalletId, string> {
	const host = typeof window !== 'undefined' ? window.location.host : ''
	const path = typeof window !== 'undefined' ? window.location.pathname : ''
	const search = typeof window !== 'undefined' ? window.location.search : ''
	const httpsUrl = `https://${host}${path}${search}`
	const mmTail = `${host}${path}${search}`
	const okxDeeplink = `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(httpsUrl)}`
	const tpParams = encodeURIComponent(JSON.stringify({ url: httpsUrl, chain: 'ETH', source: 'beamio' }))

	return {
		metamask: `https://metamask.app.link/dapp/${mmTail}`,
		// iOS Safari compatibility: prefer OKX universal link wrapping official deeplink.
		okx: `https://web3.okx.com/download?deeplink=${encodeURIComponent(okxDeeplink)}`,
		base: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(httpsUrl)}`,
		tp: `tpdapp://open?params=${tpParams}`,
	}
}

/**
 * iOS Safari: Base Wallet universal link may only wake app (stay on Home) on some versions/devices.
 * This actively tries deep-link into wallet browser first, then falls back to universal link.
 * Must be called from a direct user click/tap handler.
 */
export function openBaseWalletDappWithFallback(): void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return
	const host = window.location.host
	const path = window.location.pathname
	const search = window.location.search
	const httpsUrl = `https://${host}${path}${search}`
	const deep = `cbwallet://dapp?url=${encodeURIComponent(httpsUrl)}`
	const fallback = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(httpsUrl)}`

	let leftPage = false
	const onVis = () => {
		if (document.visibilityState === 'hidden') leftPage = true
	}
	const onPh = () => {
		leftPage = true
	}
	const onBlur = () => {
		leftPage = true
	}
	document.addEventListener('visibilitychange', onVis)
	window.addEventListener('pagehide', onPh)
	window.addEventListener('blur', onBlur)

	window.location.href = deep
	window.setTimeout(() => {
		document.removeEventListener('visibilitychange', onVis)
		window.removeEventListener('pagehide', onPh)
		window.removeEventListener('blur', onBlur)
		if (!leftPage) {
			window.location.href = fallback
		}
	}, 900)
}
