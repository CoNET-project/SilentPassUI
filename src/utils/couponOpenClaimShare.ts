import { ethers } from 'ethers'

/**
 * Open Claim Distribution share URL — aligned with biz `buildProgramsCouponOpenClaimShareUrl`.
 * Inner: `/app/?beamiocard=…&couponId=…&claim=open`
 * Outer: `/app-download?target=…` (social / universal-link wrapper).
 */
export function buildCouponOpenClaimDistributionShareUrl(
	cardAddress: string,
	couponId: string
): string {
	const addr = cardAddress?.trim() ?? ''
	const cid = couponId?.trim() ?? ''
	if (!addr || !cid || !ethers.isAddress(addr)) return ''
	const claimUrl = `https://beamio.app/app/?beamiocard=${encodeURIComponent(
		ethers.getAddress(addr)
	)}&couponId=${encodeURIComponent(cid)}&claim=open`
	return `https://beamio.app/app-download?target=${encodeURIComponent(claimUrl)}`
}

export async function shareCouponOpenClaimDistributionUrl(
	shareUrl: string,
	opts?: { title?: string }
): Promise<'shared' | 'copied' | 'failed'> {
	const url = shareUrl?.trim() ?? ''
	if (!url || typeof window === 'undefined') return 'failed'

	const title = opts?.title?.trim() || 'Claim this coupon on Beamio'

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
