/**
 * PWA → Native debug log (bypasses production console stripping in embedded shell).
 */

import { getCashTreesNativeNfcHost, isCashTreesNativeWebView } from './cashTreesNativeNfc'

export type NativePwaLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export function publishNativePwaLog(level: NativePwaLogLevel, message: string): void {
	const text = String(message ?? '')
	try {
		const fn = console[level]
		if (typeof fn === 'function') fn.call(console, text)
	} catch {
		// ignore
	}
	if (!isCashTreesNativeWebView()) return
	const host = getCashTreesNativeNfcHost()
	try {
		if (host === 'ios' && typeof window.CashTreesIOS?.debugLog === 'function') {
			window.CashTreesIOS.debugLog(level, text)
			return
		}
		if (host === 'android' && typeof window.CashTreesAndroid?.debugLog === 'function') {
			window.CashTreesAndroid.debugLog(level, text)
		}
	} catch {
		// ignore
	}
}
