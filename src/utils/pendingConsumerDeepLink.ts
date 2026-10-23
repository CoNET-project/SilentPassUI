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

/** Embedded Android/iOS local shell entry (invite may land on `/index.html`). */
function isEmbeddedLocalShellPath(pathname: string): boolean {
	return (
		pathname === '/' ||
		pathname === '' ||
		pathname === '/index.html' ||
		pathname.endsWith('/index.html')
	)
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
			host === '127.0.0.1' ||
			host === 'appassets.androidplatform.net' ||
			u.protocol === 'cashtrees-local:'
		if (!okHost && u.protocol !== 'http:' && u.protocol !== 'https:') return false
		// Collect first so `invite=` / nested `target=` win even on `/index.html` shells.
		const sp = collectDeepLinkSearchParams(u.toString())
		const invite = (sp.get('invite') ?? sp.get('Invite') ?? '').trim()
		if (invite && /^0x[0-9a-fA-F]{40}$/.test(invite)) return true
		if (
			u.protocol.startsWith('http') &&
			!isBeamioAppPath(u.pathname) &&
			!isEmbeddedLocalShellPath(u.pathname)
		) {
			return false
		}
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
		const next = new URL(window.location.href)
		// Flatten nested app-download `target=` / hash query (incl. `invite=`) onto document URL.
		const flat = collectDeepLinkSearchParams(pending)
		flat.forEach((value, key) => {
			if (key === 'v' || key === 'target') return
			next.searchParams.set(key, value)
		})
		window.history.replaceState(window.history.state, '', next.toString())
		return true
	} catch {
		return false
	}
}
