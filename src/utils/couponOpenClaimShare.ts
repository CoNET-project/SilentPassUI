import { ethers } from 'ethers'
import { appendAppDownloadShareCacheBust } from '@/utils/appDownloadShareCacheBust'

/**
 * Open Claim Distribution share URL — aligned with biz `buildProgramsCouponOpenClaimShareUrl`.
 * Inner: `/app/?beamiocard=…&couponId=…&claim=open`
 * Outer: `/app-download?target=…&v=…` (`v` busts WhatsApp/Meta OG cache).
 */
export function buildCouponOpenClaimDistributionShareUrl(
	cardAddress: string,
	couponId: string,
	referrerEoa?: string | null,
): string {
	const addr = cardAddress?.trim() ?? ''
	const cid = couponId?.trim() ?? ''
	if (!addr || !cid || !ethers.isAddress(addr)) return ''
	let claimUrl = `https://beamio.app/app/?beamiocard=${encodeURIComponent(
		ethers.getAddress(addr),
	)}&couponId=${encodeURIComponent(cid)}&claim=open`
	const refRaw = referrerEoa?.trim() ?? ''
	if (refRaw && ethers.isAddress(refRaw)) {
		claimUrl += `&ref=${encodeURIComponent(ethers.getAddress(refRaw))}`
	}
	const base = `https://beamio.app/app-download?target=${encodeURIComponent(claimUrl)}`
	return appendAppDownloadShareCacheBust(base)
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
