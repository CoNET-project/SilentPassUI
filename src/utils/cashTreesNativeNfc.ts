/** Android：`JavascriptInterface` 注入 `window.CashTreesAndroid`。iOS：WK 注入 `window.CashTreesIOS`（方法签名对齐 Android）。 */

export type CashTreesNativeNfcBridge = {
	getNfcStatus: () => string
	startPhysicalCardBind: () => void
	cancelPhysicalCardBind?: () => void
	saveRecoveryQrToPhotos?: (payload: { dataUrl: string; filename?: string; requestId?: string }) => void
	scanRecoveryQr?: (payload: { requestId?: string }) => void
	scanQr?: (payload: { requestId?: string }) => void
	/** iOS WK bridge — object payload. Android `@JavascriptInterface` accepts a plain URL string (use `openExternalUrl`). */
	openURL?: (payload: { url: string }) => void
	/** PWA catalog → native install probe. iOS uses `{ requestId, queries }` + `cashtreesios`. */
	queryInstalledApps?: (payload?: { requestId: string; queries?: NativeInstalledAppQuery[] }) => void
	/** Legacy alias of `queryInstalledApps`. iOS uses `{ requestId, queries? }` + `cashtreesios`. */
	listInstalledWalletApps?: (payload?: { requestId: string; queries?: NativeInstalledAppQuery[] }) => void | string
	/** PWA → Native 通用状态（Footer 角标、App 图标 badge 等） */
	publishAppState?: (state: Record<string, unknown>) => void
	/** Enter Chat: clear offline tray only; badge stays unread via publishAppState */
	clearOfflineChatAlerts?: () => void
	/** @deprecated Shell may still expose; PWA must not call for inbound chat (SI push only). */
	notifyBackgroundChat?: (payload: Record<string, unknown> | string) => void
}

/** One catalog row the PWA asks native to probe. Native returns only installed `id`s. */
export type NativeInstalledAppQuery = {
	id: string
	schemes: string[]
	packages: string[]
}

/** Android bridge variant: `openURL(url: string)` + `publishAppState(json: string)` */
type CashTreesAndroidOpenUrlBridge = CashTreesNativeNfcBridge & {
	openURL?: ((url: string) => void) | ((payload: { url: string }) => void)
	publishAppState?: (json: string) => void
	queryInstalledApps?: (json: string) => string
	listInstalledWalletApps?: () => string
}

const LEGACY_RECEIVE_WALLET_NATIVE_IDS = new Set(['metamask', 'base'])

function allowedNativeAppIds(queries: NativeInstalledAppQuery[]): Set<string> {
	const ids = queries
		.map((q) => q.id.trim().toLowerCase())
		.filter(Boolean)
	return ids.length > 0 ? new Set(ids) : LEGACY_RECEIVE_WALLET_NATIVE_IDS
}

function parseNativeWalletIds(raw: unknown, allowed: Set<string>): string[] | null {
	if (raw == null) return null
	let ids: unknown = raw
	if (typeof raw === 'string') {
		const t = raw.trim()
		if (!t) return []
		try {
			ids = JSON.parse(t)
		} catch {
			return null
		}
	}
	if (!Array.isArray(ids)) return null
	return ids
		.filter((x): x is string => typeof x === 'string')
		.map((x) => x.trim().toLowerCase())
		.filter((id) => allowed.has(id))
}

function isNativeInstalledAppListAction(action: string | undefined): boolean {
	return action === 'queryInstalledApps' || action === 'listInstalledWalletApps'
}

/** True when this shell can answer an installed-app catalog query. */
export function hasNativeWalletListApi(): boolean {
	const w = cashTreesNativeWindow()
	if (!w) return false
	if (typeof w.CashTreesAndroid?.queryInstalledApps === 'function') return true
	if (typeof w.CashTreesAndroid?.listInstalledWalletApps === 'function') return true
	if (typeof w.CashTreesIOS?.queryInstalledApps === 'function') return true
	if (typeof w.CashTreesIOS?.listInstalledWalletApps === 'function') return true
	return false
}

/**
 * Shell-only install probe. PWA sends the catalog; native returns only installed ids.
 * `null` = old shell / no API (do not invent a list).
 * `[]` = shell confirmed none of the queried apps are installed.
 */
export function listInstalledWalletAppsFromNative(
	queries: NativeInstalledAppQuery[] = [],
): Promise<string[] | null> {
	const w = cashTreesNativeWindow()
	if (!w) return Promise.resolve(null)
	const allowed = allowedNativeAppIds(queries)

	if (typeof w.CashTreesAndroid?.queryInstalledApps === 'function') {
		try {
			const requestId =
				typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
					? crypto.randomUUID()
					: `wallets-${Date.now()}`
			return Promise.resolve(
				parseNativeWalletIds(
					w.CashTreesAndroid.queryInstalledApps(JSON.stringify({ requestId, queries })),
					allowed,
				),
			)
		} catch {
			return Promise.resolve(null)
		}
	}

	if (typeof w.CashTreesAndroid?.listInstalledWalletApps === 'function') {
		try {
			return Promise.resolve(parseNativeWalletIds(w.CashTreesAndroid.listInstalledWalletApps(), allowed))
		} catch {
			return Promise.resolve(null)
		}
	}

	const iosQuery = w.CashTreesIOS?.queryInstalledApps
	const iosList = w.CashTreesIOS?.listInstalledWalletApps
	const iosFn = typeof iosQuery === 'function' ? iosQuery : iosList
	if (typeof iosFn === 'function') {
		return new Promise((resolve) => {
			const requestId =
				typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
					? crypto.randomUUID()
					: `wallets-${Date.now()}`
			let done = false
			const finish = (v: string[] | null) => {
				if (done) return
				done = true
				window.removeEventListener('cashtreesios', onEvent as EventListener)
				window.clearTimeout(timer)
				resolve(v)
			}
			const onEvent = (e: Event) => {
				const d = (e as CustomEvent<{
					action?: string
					requestId?: string
					ids?: unknown
				}>).detail
				if (!isNativeInstalledAppListAction(d?.action) || d.requestId !== requestId) return
				finish(parseNativeWalletIds(d.ids, allowed) ?? [])
			}
			window.addEventListener('cashtreesios', onEvent as EventListener)
			const timer = window.setTimeout(() => finish(null), 2500)
			try {
				iosFn({ requestId, queries })
			} catch {
				finish(null)
			}
		})
	}

	return Promise.resolve(null)
}

type CashTreesNativeWindow = Window & {
	CashTreesAndroid?: CashTreesAndroidOpenUrlBridge
	CashTreesIOS?: CashTreesNativeNfcBridge
}

function cashTreesNativeWindow(): CashTreesNativeWindow | null {
	if (typeof window === 'undefined') return null
	return window as CashTreesNativeWindow
}

/** 当前原生壳：由宿主注入的全局决定，优于 UA 猜测。 */
export function getCashTreesNativeNfcHost(): 'android' | 'ios' | null {
	const w = cashTreesNativeWindow()
	if (!w) return null
	if (typeof w.CashTreesAndroid?.getNfcStatus === 'function') return 'android'
	if (typeof w.CashTreesIOS?.getNfcStatus === 'function') return 'ios'
	return null
}

/** PWA 是否运行在 iOS / Android 原生 WebView 壳内（CashTreesIOS / CashTreesAndroid 已注入）。 */
export function isCashTreesNativeWebView(): boolean {
	return getCashTreesNativeNfcHost() !== null
}

export function getCashTreesNativeNfcBridge(): CashTreesNativeNfcBridge | null {
	const w = cashTreesNativeWindow()
	if (!w) return null
	if (typeof w.CashTreesAndroid?.getNfcStatus === 'function') return w.CashTreesAndroid
	if (typeof w.CashTreesIOS?.getNfcStatus === 'function') return w.CashTreesIOS
	return null
}

function tryNativeOpenUrl(url: string): boolean {
	const w = cashTreesNativeWindow()
	if (!w) return false

	if (typeof w.CashTreesIOS?.openURL === 'function') {
		try {
			w.CashTreesIOS.openURL({ url })
			return true
		} catch {
			return false
		}
	}

	if (typeof w.CashTreesAndroid?.openURL === 'function') {
		try {
			;(w.CashTreesAndroid.openURL as (url: string) => void)(url)
			return true
		} catch {
			return false
		}
	}

	return false
}

/**
 * 设备是否具备可用的 NFC 能力（用于是否展示 NFC Keys 等入口）。
 * - 原生壳：以 `getNfcStatus()` 为准，`no_hardware` 为无硬件；`ready` / `disabled` / `nfc_permission_denied` 为有硬件。
 * - 浏览器：存在 Web NFC（`NDEFReader`，多见于 Android Chrome + HTTPS）。
 */
export function detectDeviceNfcCapability(): boolean {
	if (typeof window === 'undefined') return false
	try {
		const native = getCashTreesNativeNfcBridge()
		if (native?.getNfcStatus) {
			const s = native.getNfcStatus()
			if (s === 'no_hardware') return false
			if (s === 'ready' || s === 'disabled' || s === 'nfc_permission_denied') return true
		}
	} catch {
		/* PWA / 桌面 */
	}
	return 'NDEFReader' in window
}

/**
 * Open a URL externally — **single entry for browser + native shell**.
 * - Native WebView (`CashTreesIOS` / `CashTreesAndroid`): prefer `openURL` bridge → system browser.
 * - If shell is present but `openURL` is missing (older App build): fall back to `window.open`
 *   (still better than top-level `<a target="_blank">` navigation inside WKWebView).
 * - Plain browser / installable PWA: `window.open(..., '_blank', 'noopener,noreferrer')`.
 *
 * All user-initiated external http(s) / mailto / tel opens MUST go through this helper.
 * Known wallet custom schemes (`ethereum` EIP-681 / `metamask` / `cbwallet` /
 * `coinbase` / `base` / `okx` / `okex` / `tpdapp` / `tpoutside` / `phantom`) are
 * also allowed when the native `openURL` allowlist includes them
 * (see `.cursor/rules/beamio-native-external-url-bridge.mdc`).
 */
export function openExternalUrl(rawUrl: string): boolean {
	const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
	if (!url || typeof window === 'undefined') return false

	// Prefer bridge whenever openURL exists (even if getNfcStatus probe differs).
	if (tryNativeOpenUrl(url)) {
		return true
	}

	try {
		return window.open(url, '_blank', 'noopener,noreferrer') != null
	} catch {
		return false
	}
}
