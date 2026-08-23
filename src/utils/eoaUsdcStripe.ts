import { ethers } from 'ethers'
import { collectDeepLinkSearchParams } from '@/utils/beamioDeepLinkParams'
import { beamioApi } from '@/utils/constants'

export const EOA_USDC_STRIPE_MIN_DOLLARS = 1
export const EOA_USDC_STRIPE_MAX_DOLLARS = 10_000
export const EOA_USDC_STRIPE_PRESETS = [10, 25, 50, 100] as const
export const EOA_USDC_STRIPE_SESSION_STORAGE_KEY = 'beamio:eoaUsdcStripe:sessionId'

const STRIPE_RETURN_KEYS = ['eoa_usdc_stripe', 'session_id'] as const

export type EoaUsdcStripeStatus = 'pending' | 'succeeded' | 'failed'

export type EoaUsdcStripeChainFulfillment = {
	usdcTxHash?: string
	recipientEoa?: string
	lastError?: string
}

export type EoaUsdcStripePollResult = {
	ok: true
	status: EoaUsdcStripeStatus
	walletAddress: string
	amountUsdc6: string
	lastEvent?: string
	chainFulfillment: EoaUsdcStripeChainFulfillment | null
}

export type EoaUsdcStripePollError = {
	ok: false
	error: string
	httpStatus?: number
}

export type EoaUsdcStripePollOutcome = EoaUsdcStripePollResult | EoaUsdcStripePollError

export function isEoaUsdcStripePollOk(out: EoaUsdcStripePollOutcome): out is EoaUsdcStripePollResult {
	return out.ok === true
}

export function isEoaUsdcStripeFulfillmentProcessing(lastEvent?: string): boolean {
	return (lastEvent ?? '').toLowerCase().includes('fulfillment_processing')
}

export type EoaUsdcStripeReturnKind = 'success' | 'cancel'

export function resolveStripeDepositEoa(profiles: Array<{ keyID?: string }> | undefined | null): string {
	const raw = profiles?.[0]?.keyID?.trim() ?? ''
	if (!raw || !ethers.isAddress(raw)) return ''
	return ethers.getAddress(raw)
}

export function dollarsToAmountUsdc6(dollars: number): string | null {
	if (!Number.isFinite(dollars)) return null
	const cents = Math.round(dollars * 100)
	if (cents < EOA_USDC_STRIPE_MIN_DOLLARS * 100) return null
	if (cents > EOA_USDC_STRIPE_MAX_DOLLARS * 100) return null
	return String(cents * 10_000)
}

export function parseStripeDollarInput(raw: string): number | null {
	const trimmed = raw.trim()
	if (!trimmed) return null
	if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null
	const n = Number(trimmed)
	if (!Number.isFinite(n)) return null
	return n
}

export function persistEoaUsdcStripeSessionId(sessionId: string): void {
	try {
		sessionStorage.setItem(EOA_USDC_STRIPE_SESSION_STORAGE_KEY, sessionId)
	} catch {
		/* ignore */
	}
}

export function readPersistedEoaUsdcStripeSessionId(): string {
	try {
		return sessionStorage.getItem(EOA_USDC_STRIPE_SESSION_STORAGE_KEY)?.trim() ?? ''
	} catch {
		return ''
	}
}

export function clearPersistedEoaUsdcStripeSessionId(): void {
	try {
		sessionStorage.removeItem(EOA_USDC_STRIPE_SESSION_STORAGE_KEY)
	} catch {
		/* ignore */
	}
}

export function parseEoaUsdcStripeReturn(href?: string): { kind: EoaUsdcStripeReturnKind; sessionId: string } | null {
	if (typeof window === 'undefined' && !href) return null
	const sp = collectDeepLinkSearchParams(href?.trim() || window.location.href)
	const kindRaw = (sp.get('eoa_usdc_stripe') ?? '').trim().toLowerCase()
	if (kindRaw !== 'success' && kindRaw !== 'cancel') return null
	const sessionId = (sp.get('session_id') ?? '').trim()
	return { kind: kindRaw, sessionId }
}

export function stripEoaUsdcStripeReturnParams(href?: string): void {
	if (typeof window === 'undefined') return
	try {
		const raw = href?.trim() || window.location.href
		if (!parseEoaUsdcStripeReturn(raw)) return
		const url = new URL(window.location.href)
		for (const key of STRIPE_RETURN_KEYS) {
			url.searchParams.delete(key)
		}
		const hash = url.hash || ''
		if (hash.includes('?')) {
			const qIndex = hash.indexOf('?')
			const hashPath = hash.slice(0, qIndex)
			const hashParams = new URLSearchParams(hash.slice(qIndex + 1))
			for (const key of STRIPE_RETURN_KEYS) {
				hashParams.delete(key)
			}
			const qs = hashParams.toString()
			url.hash = qs ? `${hashPath}?${qs}` : hashPath
		}
		const next = url.toString()
		if (next !== window.location.href) {
			window.history.replaceState(window.history.state, '', next)
		}
	} catch {
		/* ignore */
	}
}

export async function createEoaUsdcStripeSession(
	walletAddress: string,
	amountUsdc6: string
): Promise<{ sessionId: string; url: string } | { error: string }> {
	try {
		const res = await fetch(`${beamioApi}/api/eoaUsdcStripe/createSession`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ walletAddress, amountUsdc6 }),
		})
		const body = (await res.json().catch(() => ({}))) as { sessionId?: string; url?: string; error?: string }
		if (!res.ok || !body.sessionId || !body.url) {
			return { error: body.error?.trim() || 'Could not start Stripe USDC deposit' }
		}
		persistEoaUsdcStripeSessionId(body.sessionId)
		return { sessionId: body.sessionId, url: body.url }
	} catch {
		return { error: 'Could not start Stripe USDC deposit' }
	}
}

export async function pollEoaUsdcStripeSession(
	sessionId: string,
	userClosedCheckout = false
): Promise<EoaUsdcStripePollOutcome> {
	try {
		const res = await fetch(`${beamioApi}/api/eoaUsdcStripe/poll`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sessionId, userClosedCheckout }),
		})
		const body = (await res.json().catch(() => ({}))) as Partial<EoaUsdcStripePollResult> & { error?: string }
		if (!res.ok) {
			return { ok: false, error: body.error?.trim() || 'Could not check payment status', httpStatus: res.status }
		}
		if (body.status !== 'pending' && body.status !== 'succeeded' && body.status !== 'failed') {
			return { ok: false, error: body.error?.trim() || 'Could not check payment status', httpStatus: res.status }
		}
		return {
			ok: true,
			status: body.status,
			walletAddress: body.walletAddress ?? '',
			amountUsdc6: body.amountUsdc6 ?? '',
			lastEvent: body.lastEvent,
			chainFulfillment: body.chainFulfillment ?? null,
		}
	} catch {
		return { ok: false, error: 'Could not check payment status' }
	}
}
