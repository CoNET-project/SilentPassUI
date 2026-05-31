import { ethers } from 'ethers'

/** Base ERC-1155 NFT explorer (issued coupon / catalog series tokenId). */
export const BEAMIO_BASESCAN_NFT_EXPLORER = 'https://basescan.org/nft' as const

/** On-chain issued NFT tokenIds (not points #0 or membership #1–99). */
export const ISSUED_NFT_TOKEN_ID_MIN = 100_000_000_000n

/** Decimal tokenId for BaseScan `/nft/{card}/{tokenId}` (avoid Number() precision loss). */
export function normalizeIssuedNftTokenIdForBaseScan(
	issuedTokenId: string | number | undefined
): string | null {
	const raw = String(issuedTokenId ?? '')
		.trim()
		.replace(/,/g, '')
	if (!/^\d+$/.test(raw)) return null
	try {
		if (BigInt(raw) < ISSUED_NFT_TOKEN_ID_MIN) return null
	} catch {
		return null
	}
	return raw
}

export function beamioBaseScanNftUrl(
	cardAddress: string | undefined,
	issuedTokenId: string | number | undefined
): string | null {
	const tid = normalizeIssuedNftTokenIdForBaseScan(issuedTokenId)
	if (!tid) return null
	const card = cardAddress?.trim() ?? ''
	if (!card || !/^0x[a-fA-F0-9]{40}$/i.test(card)) return null
	try {
		const cardNorm = ethers.getAddress(card)
		return `${BEAMIO_BASESCAN_NFT_EXPLORER}/${cardNorm}/${tid}`
	} catch {
		return null
	}
}

export function beamioBaseScanNftLabel(issuedTokenId: string | number | undefined): string {
	const tid = normalizeIssuedNftTokenIdForBaseScan(issuedTokenId)
	if (!tid) return 'NFT'
	return `NFT #${tid}`
}
