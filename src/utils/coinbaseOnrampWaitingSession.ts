/**
 * Persist Fund → Coinbase waiting overlay across Coinbase app return.
 * Deep-link remount of Home used to drop React-only waiting state → bare /HOME.
 * UI preference / deposit watch only — not a wallet secret.
 */

import type { CoinbaseOnrampPayMethod } from './coinbaseOnrampLastAmountLocalCache'
import {
	COINBASE_ONRAMP_DEFAULT_AMOUNT,
	normalizeCoinbaseOnrampAmount,
	normalizeCoinbaseOnrampPayMethod,
} from './coinbaseOnrampLastAmountLocalCache'

/** Align with Base USDC arrival poll max (15 min). */
export const COINBASE_ONRAMP_WAITING_MAX_AGE_MS = 15 * 60 * 1000

/**
 * After in-shell WebView Back (`inAppBrowserClosed`, non-external), wait this long
 * for Base USDC arrival before treating the deposit wait as failed.
 */
export const COINBASE_WEBVIEW_CLOSE_GRACE_MS = 6_000

export type CoinbaseOnrampWaitingSession = {
	eoa: string
	amountHuman: string
	payMethod: CoinbaseOnrampPayMethod
	/** Baseline Base USDC balance (1e6) as decimal string. */
	baselineRaw: string
	/** URL to re-open Coinbase (Onramp checkout or Wallet home). */
	checkoutUrl: string
	startedAt: number
	status: 'waiting'
	/**
	 * Set when the native in-app WebView is dismissed (Back).
	 * After {@link COINBASE_WEBVIEW_CLOSE_GRACE_MS} with no USDC success, waiting fails.
	 */
	webviewClosedAt?: number
}

function storageKey(eoa: string): string {
	return `beamio:silentpass:eoa:${eoa.toLowerCase()}:coinbase-onramp-waiting:v1`
}

function parseBaselineRaw(raw: unknown): string | null {
	if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null
	return raw
}

export function saveCoinbaseOnrampWaitingSession(session: CoinbaseOnrampWaitingSession): void {
	const eoa = session.eoa?.trim()
	if (!eoa) return
	const amountHuman =
		normalizeCoinbaseOnrampAmount(session.amountHuman) ?? COINBASE_ONRAMP_DEFAULT_AMOUNT
	const baselineRaw = parseBaselineRaw(session.baselineRaw)
	if (!baselineRaw) return
	const webviewClosedAt =
		typeof session.webviewClosedAt === 'number' && Number.isFinite(session.webviewClosedAt)
			? session.webviewClosedAt
			: undefined
	const payload: CoinbaseOnrampWaitingSession = {
		eoa: eoa.toLowerCase(),
		amountHuman,
		payMethod: normalizeCoinbaseOnrampPayMethod(session.payMethod),
		baselineRaw,
		checkoutUrl: typeof session.checkoutUrl === 'string' ? session.checkoutUrl : '',
		startedAt: Number.isFinite(session.startedAt) ? session.startedAt : Date.now(),
		status: 'waiting',
		...(webviewClosedAt !== undefined ? { webviewClosedAt } : {}),
	}
	try {
		window.localStorage.setItem(storageKey(eoa), JSON.stringify(payload))
	} catch {
		/* quota / private mode */
	}
}

export function loadCoinbaseOnrampWaitingSession(eoa: string): CoinbaseOnrampWaitingSession | null {
	if (!eoa) return null
	try {
		const raw = window.localStorage.getItem(storageKey(eoa))
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<CoinbaseOnrampWaitingSession>
		const amountHuman = normalizeCoinbaseOnrampAmount(String(parsed.amountHuman ?? ''))
		const baselineRaw = parseBaselineRaw(parsed.baselineRaw)
		const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : 0
		if (!amountHuman || !baselineRaw || !startedAt) {
			clearCoinbaseOnrampWaitingSession(eoa)
			return null
		}
		if (Date.now() - startedAt > COINBASE_ONRAMP_WAITING_MAX_AGE_MS) {
			clearCoinbaseOnrampWaitingSession(eoa)
			return null
		}
		if (parsed.status !== 'waiting') {
			clearCoinbaseOnrampWaitingSession(eoa)
			return null
		}
		const webviewClosedAt =
			typeof parsed.webviewClosedAt === 'number' && Number.isFinite(parsed.webviewClosedAt)
				? parsed.webviewClosedAt
				: undefined
		return {
			eoa: eoa.toLowerCase(),
			amountHuman,
			payMethod: normalizeCoinbaseOnrampPayMethod(parsed.payMethod),
			baselineRaw,
			checkoutUrl: typeof parsed.checkoutUrl === 'string' ? parsed.checkoutUrl : '',
			startedAt,
			status: 'waiting',
			...(webviewClosedAt !== undefined ? { webviewClosedAt } : {}),
		}
	} catch {
		return null
	}
}

/** Mark in-shell WebView dismiss so remount can enforce the post-close grace window. */
export function markCoinbaseOnrampWebViewClosed(eoa: string): CoinbaseOnrampWaitingSession | null {
	const session = loadCoinbaseOnrampWaitingSession(eoa)
	if (!session) return null
	const next: CoinbaseOnrampWaitingSession = {
		...session,
		webviewClosedAt: Date.now(),
	}
	saveCoinbaseOnrampWaitingSession(next)
	return next
}

export function clearCoinbaseOnrampWaitingSession(eoa: string): void {
	if (!eoa) return
	try {
		window.localStorage.removeItem(storageKey(eoa))
	} catch {
		/* ignore */
	}
}

const WAITING_KEY_RE = /^beamio:silentpass:eoa:([0-9a-fx]+):coinbase-onramp-waiting:v1$/i

/**
 * Find any fresh waiting session (EOA may not be hydrated yet on first paint).
 * Prefer {@link loadCoinbaseOnrampWaitingSession} when address is known.
 */
export function findActiveCoinbaseOnrampWaitingSession(): CoinbaseOnrampWaitingSession | null {
	try {
		let newest: CoinbaseOnrampWaitingSession | null = null
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i)
			if (!key || !WAITING_KEY_RE.test(key)) continue
			const m = key.match(WAITING_KEY_RE)
			const eoa = m?.[1]
			if (!eoa) continue
			const session = loadCoinbaseOnrampWaitingSession(eoa)
			if (!session) continue
			if (!newest || session.startedAt > newest.startedAt) newest = session
		}
		return newest
	} catch {
		return null
	}
}

/** Sync bootstrap for Home first paint (avoid /HOME flash before useEffect restore). */
export function resolveCoinbaseOnrampWaitingBootstrap(
	preferredEoa?: string | null,
): CoinbaseOnrampWaitingSession | null {
	const trimmed = preferredEoa?.trim()
	if (trimmed) {
		const byEoa = loadCoinbaseOnrampWaitingSession(trimmed)
		if (byEoa) return byEoa
	}
	return findActiveCoinbaseOnrampWaitingSession()
}

/** Coinbase Wallet home — user completes free USDC send inside Coinbase (no Beamio x402). */
export const COINBASE_WALLET_FREE_SEND_OPEN_URL = 'https://go.cb-w.com/'
