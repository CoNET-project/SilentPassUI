import { ethers } from 'ethers'

/**
 * Discover merchant share URL — aligned with x402sdk `buildDiscoverMerchantAppDownloadUrl`.
 * Inner: `/app/?beamiocard=…&discover=open`
 * Outer: `/app-download?target=…`
 */
export function buildDiscoverMerchantShareUrl(cardAddress: string): string {
	const addr = cardAddress?.trim() ?? ''
	if (!addr || !ethers.isAddress(addr)) return ''
	const discoverUrl = `https://beamio.app/app/?beamiocard=${encodeURIComponent(
		ethers.getAddress(addr)
	)}&discover=open`
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
): { cardAddress: string } | null {
	const redeemcode = (sp.get('redeemcode') ?? sp.get('Redeemcode') ?? '').trim()
	if (redeemcode) return null
	const couponId = decodeURIComponent((sp.get('couponId') ?? sp.get('couponid') ?? '').trim())
	if (couponId) return null
	const cardAddress = (sp.get('beamiocard') ?? sp.get('Beamiocard') ?? '').trim()
	const discover = (sp.get('discover') ?? '').trim().toLowerCase()
	if (!cardAddress || !ethers.isAddress(cardAddress)) return null
	if (discover !== 'open' && discover !== '1' && discover !== 'true') return null
	return { cardAddress: ethers.getAddress(cardAddress) }
}
