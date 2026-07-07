import { ethers } from 'ethers'
import { parseDiscoverReferrerFromParams } from '@/utils/beamioDeepLinkParams'

/**
 * Discover merchant share URL — aligned with x402sdk `buildDiscoverMerchantAppDownloadUrl`.
 * Inner: `/app/?beamiocard=…&discover=open[&ref=referrerEOA]`
 * Outer: `/app-download?target=…`
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
	return `https://beamio.app/app-download?target=${encodeURIComponent(discoverUrl)}`
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
