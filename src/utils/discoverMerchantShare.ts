import { ethers } from 'ethers'
import {
	collectDeepLinkSearchParams,
	parseDiscoverMerchantFromParams,
	parseDiscoverReferrerFromParams,
} from '@/utils/beamioDeepLinkParams'
import { appendAppDownloadShareCacheBust } from './appDownloadShareCacheBust'

export { parseDiscoverMerchantFromParams }

export const PENDING_DISCOVER_MERCHANT_INTENT_KEY =
	'beamio:silentpass:pending-discover-merchant:v1'

/**
 * Preserve a public merchant deep-link while onboarding rewrites the URL to
 * `beamioTag + MasterKey`. Only the merchant card address is stored.
 */
export function rememberPendingDiscoverMerchantIntent(rawHref?: string): string | null {
	if (typeof window === 'undefined') return null
	const parsed = parseDiscoverMerchantFromParams(
		collectDeepLinkSearchParams(rawHref?.trim() || window.location.href),
	)
	if (!parsed) return null
	try {
		window.sessionStorage.setItem(
			PENDING_DISCOVER_MERCHANT_INTENT_KEY,
			JSON.stringify({ cardAddress: parsed.cardAddress, referrerEoa: parsed.referrerEoa }),
		)
	} catch {
		/* ignore unavailable session storage */
	}
	return parsed.cardAddress
}

export function consumePendingDiscoverMerchantIntent(): string | null {
	if (typeof window === 'undefined') return null
	try {
		const raw = window.sessionStorage.getItem(PENDING_DISCOVER_MERCHANT_INTENT_KEY)
		window.sessionStorage.removeItem(PENDING_DISCOVER_MERCHANT_INTENT_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as { cardAddress?: unknown }
		const cardAddress = typeof parsed.cardAddress === 'string' ? parsed.cardAddress.trim() : ''
		return cardAddress && ethers.isAddress(cardAddress) ? ethers.getAddress(cardAddress) : null
	} catch {
		return null
	}
}

/** Pending merchant destination plus the sharer `ref=` (when the link carried one). */
export function peekPendingDiscoverMerchantIntentDetail():
	| { cardAddress: string; referrerEoa: string | null }
	| null {
	if (typeof window === 'undefined') return null
	try {
		const raw = window.sessionStorage.getItem(PENDING_DISCOVER_MERCHANT_INTENT_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as { cardAddress?: unknown; referrerEoa?: unknown }
		const cardAddress = typeof parsed.cardAddress === 'string' ? parsed.cardAddress.trim() : ''
		if (!cardAddress || !ethers.isAddress(cardAddress)) return null
		const ref = typeof parsed.referrerEoa === 'string' ? parsed.referrerEoa.trim() : ''
		return {
			cardAddress: ethers.getAddress(cardAddress),
			referrerEoa: ref && ethers.isAddress(ref) ? ethers.getAddress(ref) : null,
		}
	} catch {
		return null
	}
}

/** Read the pending merchant destination without consuming it. */
export function peekPendingDiscoverMerchantIntent(): string | null {
	if (typeof window === 'undefined') return null
	try {
		const raw = window.sessionStorage.getItem(PENDING_DISCOVER_MERCHANT_INTENT_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as { cardAddress?: unknown }
		const cardAddress = typeof parsed.cardAddress === 'string' ? parsed.cardAddress.trim() : ''
		return cardAddress && ethers.isAddress(cardAddress) ? ethers.getAddress(cardAddress) : null
	} catch {
		return null
	}
}

/**
 * Discover merchant share URL — aligned with x402sdk `buildDiscoverMerchantAppDownloadUrl`.
 * Inner: `/app/?beamiocard=…&discover=open[&ref=referrerEOA]`
 * Outer: `/app-download?target=…&v=…` (`v` busts WhatsApp/Meta OG cache).
 * When `referrerEoa` is set (sharer wallet), openers record that address as referrer.
 */
export function buildDiscoverMerchantShareUrl(
	cardAddress: string,
	referrerEoa?: string | null,
): string {
	const addr = cardAddress?.trim() ?? ''
	if (!addr || !ethers.isAddress(addr)) return ''
	const cardNorm = ethers.getAddress(addr)
	let discoverUrl = `https://beamio.app/app/?beamiocard=${encodeURIComponent(cardNorm)}&discover=open`
	const refRaw = referrerEoa?.trim() ?? ''
	if (refRaw && ethers.isAddress(refRaw)) {
		discoverUrl += `&ref=${encodeURIComponent(ethers.getAddress(refRaw))}`
	}
	const base = `https://beamio.app/app-download?target=${encodeURIComponent(discoverUrl)}`
	return appendAppDownloadShareCacheBust(base)
}

export async function shareDiscoverMerchantUrl(
	shareUrl: string,
	opts?: { title?: string }
): Promise<'shared' | 'copied' | 'failed' | 'aborted'> {
	const url = shareUrl?.trim() ?? ''
	if (!url || typeof window === 'undefined') return 'failed'

	const title = opts?.title?.trim() || 'Discover this brand on Beamio'

	if (typeof navigator.share === 'function') {
		try {
			await navigator.share({ title, url })
			return 'shared'
		} catch (e: unknown) {
			if (e instanceof DOMException && e.name === 'AbortError') return 'aborted'
		}
	}

	try {
		await navigator.clipboard.writeText(url)
		return 'copied'
	} catch {
		return 'failed'
	}
}

/** True when raw URL / query is a Discover merchant share (incl. `/app-download?target=…`). */
export function isDiscoverMerchantDeepLink(raw: string): boolean {
	try {
		return !!parseDiscoverMerchantFromParams(collectDeepLinkSearchParams(raw))
	} catch {
		return false
	}
}

const DISCOVER_MERCHANT_DEEP_LINK_KEYS = [
	'beamiocard',
	'Beamiocard',
	'discover',
	'ref',
	'referrer',
] as const

/**
 * Remove Discover merchant deep-link query from pathname search + hash query.
 * Call after consuming `?beamiocard=&discover=open` into router state / detail —
 * otherwise closing the detail leaves `hideDiscoverMainForDeepLink` true (invisible UI → black shell).
 * No-op for coupon / redeem links (parse fails).
 */
export function stripDiscoverMerchantDeepLinkParams(href?: string): void {
	if (typeof window === 'undefined') return
	try {
		const raw = href?.trim() || window.location.href
		const parsed = parseDiscoverMerchantFromParams(collectDeepLinkSearchParams(raw))
		if (!parsed) return

		const url = new URL(window.location.href)
		for (const key of DISCOVER_MERCHANT_DEEP_LINK_KEYS) {
			url.searchParams.delete(key)
		}
		const hash = url.hash || ''
		if (hash.includes('?')) {
			const qIndex = hash.indexOf('?')
			const hashPath = hash.slice(0, qIndex)
			const hashParams = new URLSearchParams(hash.slice(qIndex + 1))
			for (const key of DISCOVER_MERCHANT_DEEP_LINK_KEYS) {
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
