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
	/** PWA → Native 通用状态（Footer 角标、App 图标 badge 等） */
	publishAppState?: (state: Record<string, unknown>) => void
	/** Background chat local notification + badge (shell behind Home, PWA still running) */
	notifyBackgroundChat?: (payload: Record<string, unknown> | string) => void
}

/** Android bridge variant: `openURL(url: string)` + `publishAppState(json: string)` */
type CashTreesAndroidOpenUrlBridge = CashTreesNativeNfcBridge & {
	openURL?: ((url: string) => void) | ((payload: { url: string }) => void)
	publishAppState?: (json: string) => void
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
 * All user-initiated external http(s) / mailto / tel opens MUST go through this helper
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
