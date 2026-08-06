import { ethers } from 'ethers'
import {
	collectDeepLinkSearchParams,
	parseDiscoverReferrerFromParams,
} from '@/utils/beamioDeepLinkParams'
import { appendAppDownloadShareCacheBust } from './appDownloadShareCacheBust'

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
): Promise<'shared' | 'copied' | 'failed'> {
	const url = shareUrl?.trim() ?? ''
	if (!url || typeof window === 'undefined') return 'failed'

	const title = opts?.title?.trim() || 'Discover this brand on Beamio'

	if (typeof navigator.share === 'function') {
		try {
			await navigator.share({ title, url })
			return 'shared'
		} catch (e: unknown) {
			if (e instanceof DOMException && e.name === 'AbortError') return 'failed'
		}
	}

	try {
		await navigator.clipboard.writeText(url)
		return 'copied'
	} catch {
		return 'failed'
	}
}

export function parseDiscoverMerchantFromParams(
	sp: URLSearchParams
): { cardAddress: string; referrerEoa: string | null } | null {
	const redeemcode = (sp.get('redeemcode') ?? sp.get('Redeemcode') ?? '').trim()
	if (redeemcode) return null
	const couponId = decodeURIComponent((sp.get('couponId') ?? sp.get('couponid') ?? '').trim())
	if (couponId) return null
	const cardAddress = (sp.get('beamiocard') ?? sp.get('Beamiocard') ?? '').trim()
	const discover = (sp.get('discover') ?? '').trim().toLowerCase()
	if (!cardAddress || !ethers.isAddress(cardAddress)) return null
	if (discover !== 'open' && discover !== '1' && discover !== 'true') return null
	return {
		cardAddress: ethers.getAddress(cardAddress),
		referrerEoa: parseDiscoverReferrerFromParams(sp),
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
