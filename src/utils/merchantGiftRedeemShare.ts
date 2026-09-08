import { ethers } from 'ethers'
import { appendAppDownloadShareCacheBust } from './appDownloadShareCacheBust'

/**
 * Gift redeem claim URL for social share + QR — aligned with x402sdk
 * `buildCouponRedeemAppDownloadUrl`.
 * Inner: `/app/?beamiocard=…&redeemcode=…`
 * Outer: `/app-download?target=…&v=…` (`v` busts WhatsApp/Meta OG cache).
 */
export function buildMerchantGiftRedeemShareUrl(
	cardAddress: string,
	redeemCode: string,
	cacheBustV?: string,
): string {
	const addr = cardAddress?.trim() ?? ''
	const code = redeemCode?.trim() ?? ''
	if (!addr || !code || !ethers.isAddress(addr)) return ''
	const redeemUrl = `https://beamio.app/app/?beamiocard=${encodeURIComponent(
		ethers.getAddress(addr),
	)}&redeemcode=${encodeURIComponent(code)}`
	const base = `https://beamio.app/app-download?target=${encodeURIComponent(redeemUrl)}`
	return appendAppDownloadShareCacheBust(base, cacheBustV)
}
