import { ethers } from 'ethers'
import { CONET_MAINNET_CHAIN_ID, eip712ChainIdForBeamioUserCard } from '@/utils/beamioUserCardChain'

/**
 * Base ERC-1155 NFT explorer (issued coupon / catalog series tokenId).
 * @see https://base.blockscout.com/token/{contract}/instance/{tokenId}
 */
export const BEAMIO_BLOCKSCOUT_NFT_EXPLORER = 'https://base.blockscout.com/token' as const
export const BEAMIO_BASESCAN_NFT_EXPLORER_URL = 'https://basescan.org/nft' as const
export const BEAMIO_CONETSCAN_NFT_EXPLORER_URL = 'https://scan.conet.network/token' as const

/** @deprecated Use BEAMIO_BLOCKSCOUT_NFT_EXPLORER */
export const BEAMIO_BASESCAN_NFT_EXPLORER = BEAMIO_BLOCKSCOUT_NFT_EXPLORER

/** On-chain issued NFT tokenIds (not points #0 or membership #1–99). */
export const ISSUED_NFT_TOKEN_ID_MIN = 100_000_000_000n

/** Decimal tokenId for Blockscout `/token/{card}/instance/{tokenId}` (avoid Number() precision loss). */
export function normalizeNftTokenIdForBaseScan(
	tokenId: string | number | undefined
): string | null {
	const raw = String(tokenId ?? '')
		.trim()
		.replace(/,/g, '')
	if (!/^\d+$/.test(raw)) return null
	try {
		BigInt(raw)
	} catch {
		return null
	}
	return raw
}

/** Issued coupon/catalog series only (`tokenId >= 100000000000`). */
export function normalizeIssuedNftTokenIdForBaseScan(
	issuedTokenId: string | number | undefined
): string | null {
	const tid = normalizeNftTokenIdForBaseScan(issuedTokenId)
	if (!tid) return null
	try {
		if (BigInt(tid) < ISSUED_NFT_TOKEN_ID_MIN) return null
	} catch {
		return null
	}
	return tid
}

export function beamioBaseScanNftUrlForToken(
	cardAddress: string | undefined,
	tokenId: string | number | undefined
): string | null {
	const tid = normalizeNftTokenIdForBaseScan(tokenId)
	if (tid == null) return null
	const card = cardAddress?.trim() ?? ''
	if (!card || !/^0x[a-fA-F0-9]{40}$/i.test(card)) return null
	try {
		const cardNorm = ethers.getAddress(card)
		return `${BEAMIO_BLOCKSCOUT_NFT_EXPLORER}/${cardNorm}/instance/${tid}`
	} catch {
		return null
	}
}

export function beamioNftExplorerUrlForChain(
	cardAddress: string | undefined,
	tokenId: string | number | undefined,
	chainId: number
): string | null {
	const tid = normalizeNftTokenIdForBaseScan(tokenId)
	if (tid == null) return null
	const card = cardAddress?.trim() ?? ''
	if (!card || !/^0x[a-fA-F0-9]{40}$/i.test(card)) return null
	try {
		const cardNorm = ethers.getAddress(card)
		if (chainId === CONET_MAINNET_CHAIN_ID) {
			return `${BEAMIO_CONETSCAN_NFT_EXPLORER_URL}/${cardNorm}/instance/${tid}`
		}
		return `${BEAMIO_BASESCAN_NFT_EXPLORER_URL}/${cardNorm}/${tid}`
	} catch {
		return null
	}
}

export async function resolveBeamioNftExplorerUrlForToken(
	cardAddress: string | undefined,
	tokenId: string | number | undefined
): Promise<string | null> {
	const tid = normalizeNftTokenIdForBaseScan(tokenId)
	if (!tid) return null
	const card = cardAddress?.trim() ?? ''
	if (!card || !/^0x[a-fA-F0-9]{40}$/i.test(card)) return null
	try {
		const cardNorm = ethers.getAddress(card)
		const chainId = await eip712ChainIdForBeamioUserCard(cardNorm)
		return beamioNftExplorerUrlForChain(cardNorm, tid, chainId)
	} catch {
		return beamioNftExplorerUrlForChain(card, tid, 8453)
	}
}

export function beamioBaseScanNftLabelForToken(tokenId: string | number | undefined): string {
	const tid = normalizeNftTokenIdForBaseScan(tokenId)
	if (!tid) return 'NFT'
	return `NFT #${tid}`
}

/** ERC-1155 points balance token on Beamio program cards. */
export const BEAMIO_POINTS_ERC1155_TOKEN_ID = '0' as const

export function beamioBaseScanPointsNftUrl(cardAddress: string | undefined): string | null {
	return beamioBaseScanNftUrlForToken(cardAddress, BEAMIO_POINTS_ERC1155_TOKEN_ID)
}

export function resolveBeamioPointsNftExplorerUrl(cardAddress: string | undefined): Promise<string | null> {
	return resolveBeamioNftExplorerUrlForToken(cardAddress, BEAMIO_POINTS_ERC1155_TOKEN_ID)
}

export function beamioBaseScanNftUrl(
	cardAddress: string | undefined,
	issuedTokenId: string | number | undefined
): string | null {
	const tid = normalizeIssuedNftTokenIdForBaseScan(issuedTokenId)
	if (!tid) return null
	return beamioBaseScanNftUrlForToken(cardAddress, tid)
}

export function beamioBaseScanNftLabel(issuedTokenId: string | number | undefined): string {
	const tid = normalizeIssuedNftTokenIdForBaseScan(issuedTokenId)
	if (!tid) return 'NFT'
	/** Compact capsule: last 3 digits of issued tokenId (e.g. …001 → NFT #001). */
	const last3 = tid.length <= 3 ? tid : tid.slice(-3)
	return `NFT #${last3}`
}
