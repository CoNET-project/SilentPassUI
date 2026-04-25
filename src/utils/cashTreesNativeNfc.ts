/** Android：`JavascriptInterface` 注入 `window.CashTreesAndroid`。iOS：WK 注入 `window.CashTreesIOS`（方法签名对齐 Android）。 */

export type CashTreesNativeNfcBridge = {
	getNfcStatus: () => string
	startPhysicalCardBind: () => void
	cancelPhysicalCardBind?: () => void
	saveRecoveryQrToPhotos?: (payload: { dataUrl: string; filename?: string; requestId?: string }) => void
	scanRecoveryQr?: (payload: { requestId?: string }) => void
}

/** 当前原生壳：由宿主注入的全局决定，优于 UA 猜测。 */
export function getCashTreesNativeNfcHost(): 'android' | 'ios' | null {
	if (typeof window === 'undefined') return null
	const w = window as Window & { CashTreesAndroid?: CashTreesNativeNfcBridge; CashTreesIOS?: CashTreesNativeNfcBridge }
	if (typeof w.CashTreesAndroid?.getNfcStatus === 'function') return 'android'
	if (typeof w.CashTreesIOS?.getNfcStatus === 'function') return 'ios'
	return null
}

export function getCashTreesNativeNfcBridge(): CashTreesNativeNfcBridge | null {
	if (typeof window === 'undefined') return null
	const w = window as Window & { CashTreesAndroid?: CashTreesNativeNfcBridge; CashTreesIOS?: CashTreesNativeNfcBridge }
	if (typeof w.CashTreesAndroid?.getNfcStatus === 'function') return w.CashTreesAndroid
	if (typeof w.CashTreesIOS?.getNfcStatus === 'function') return w.CashTreesIOS
	return null
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
