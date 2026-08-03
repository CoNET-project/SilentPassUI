/**
 * Deferred deep link for Consumer App Store / Play install (mirrored from homepage).
 * Same localStorage key so Safari landing → later `/app/` in the same browser restores `ref=`.
 */

import {
	collectDeepLinkSearchParams,
	isCouponOpenClaimDeepLink,
	isRedeemDeepLink,
	parseCouponOpenClaimFromParams,
} from '@/utils/beamioDeepLinkParams'
import { parseDiscoverMerchantFromParams } from '@/utils/discoverMerchantShare'

const STORAGE_KEY = 'beamio:pendingConsumerDeepLink:v1'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type StoredPending = {
	url: string
	savedAt: number
}

function isBeamioAppPath(pathname: string): boolean {
	return pathname === '/app' || pathname === '/app/' || pathname.startsWith('/app/')
}

export function isMeaningfulConsumerAppDeepLink(raw: string): boolean {
	const input = raw?.trim() ?? ''
	if (!input) return false
	try {
		const u = new URL(input)
		const host = u.host.toLowerCase()
		const okHost =
			host === 'beamio.app' ||
			host === 'www.beamio.app' ||
			host === 'localhost' ||
			u.protocol === 'cashtrees-local:'
		if (!okHost && u.protocol !== 'http:' && u.protocol !== 'https:') return false
		if (u.protocol.startsWith('http') && !isBeamioAppPath(u.pathname) && u.pathname !== '/') {
			// Embedded local often uses `/` with query only.
			if (!(u.pathname === '/' || u.pathname === '')) return false
		}
		const sp = collectDeepLinkSearchParams(u.toString())
		if (parseDiscoverMerchantFromParams(sp)) return true
		if (parseCouponOpenClaimFromParams(sp)) return true
		if (isRedeemDeepLink(u.toString())) return true
		return false
	} catch {
		return isCouponOpenClaimDeepLink(input) || isRedeemDeepLink(input)
	}
}

function readStored(): StoredPending | null {
	if (typeof localStorage === 'undefined') return null
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as StoredPending
		if (!parsed?.url || typeof parsed.savedAt !== 'number') return null
		if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
			localStorage.removeItem(STORAGE_KEY)
			return null
		}
		if (!isMeaningfulConsumerAppDeepLink(parsed.url)) {
			localStorage.removeItem(STORAGE_KEY)
			return null
		}
		return parsed
	} catch {
		return null
	}
}

export function takePendingConsumerDeepLink(): string | null {
	const stored = readStored()
	if (!stored) return null
	try {
		localStorage.removeItem(STORAGE_KEY)
	} catch {
		/* ignore */
	}
	return stored.url
}

function hrefAlreadyHasDeepLink(): boolean {
	if (typeof window === 'undefined') return false
	return isMeaningfulConsumerAppDeepLink(window.location.href)
}

/**
 * If the current `/app/` load has no merchant/coupon params, apply a pending deep link
 * (from app-download stash) so Discover / open-claim effects see `ref=` referrer.
 * Returns true when the page URL was rewritten.
 */
export function applyPendingConsumerDeepLinkIfNeeded(): boolean {
	if (typeof window === 'undefined') return false
	if (hrefAlreadyHasDeepLink()) {
		takePendingConsumerDeepLink()
		return false
	}
	const pending = takePendingConsumerDeepLink()
	if (!pending) return false
	try {
		const pendingUrl = new URL(pending)
		const next = new URL(window.location.href)
		// Prefer search params on the document URL (Beamio share links use ?beamiocard= on /app/).
		pendingUrl.searchParams.forEach((value, key) => {
			if (key === 'v') return
			next.searchParams.set(key, value)
		})
		window.history.replaceState(window.history.state, '', next.toString())
		return true
	} catch {
		return false
	}
}
