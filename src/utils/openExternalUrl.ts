/** Open http(s) / mailto / tel outside the app (browser tab or native `openURL` bridge). */
import { resolveOutboundHref } from './legacyBeamioLinks'

type CashTreesNativeNfcBridge = {
	openURL?: (payload: { url: string }) => void
}

type CashTreesAndroidOpenUrlBridge = CashTreesNativeNfcBridge & {
	openURL?: ((url: string) => void) | ((payload: { url: string }) => void)
}

type CashTreesNativeWindow = Window & {
	CashTreesAndroid?: CashTreesAndroidOpenUrlBridge
	CashTreesIOS?: CashTreesNativeNfcBridge
}

function tryNativeOpenUrl(url: string): boolean {
	if (typeof window === 'undefined') return false
	const w = window as CashTreesNativeWindow

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

export function openExternalUrl(rawUrl: string): boolean {
	const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : ''
	if (!trimmed || typeof window === 'undefined') return false
	// 旧域链接先映射为 beamio.ca；不识别或被拒绝的旧域链接不打开（原生桥与 window.open 都不收到旧域）
	const url = resolveOutboundHref(trimmed)
	if (!url) return false
	if (tryNativeOpenUrl(url)) return true
	try {
		return window.open(url, '_blank', 'noopener,noreferrer') != null
	} catch {
		return false
	}
}
