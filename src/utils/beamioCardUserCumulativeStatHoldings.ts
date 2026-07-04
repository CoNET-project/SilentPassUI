import { ethers } from 'ethers'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'

/**
 * UserCumulativeStatLib.cardLevelStatTokenIds() — L0/L1 program stat ERC-1155 ids (3–30, plus #13).
 * Minted to user EOA (social like/click/etc.); excluded from getOwnership / getOwnershipByEOA inventory.
 */
export const CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS: readonly number[] = [
	3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
	17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
]

const BALANCE_OF_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'] as const

const USER_HAS_ANY_PROGRAM_ASSET_ABI = [
	'function userHasAnyProgramAsset(address userEOA) view returns (bool)',
] as const

export type CardLevelStatNftHolding = {
	tokenId: string
	attribute: string
	tier: string
	expiry: string
	isExpired: boolean
}

function uniqueHolderAccounts(eoa: string, aa?: string | null): string[] {
	const out: string[] = []
	const push = (raw: string | null | undefined) => {
		if (!raw || !ethers.isAddress(raw)) return
		const a = ethers.getAddress(raw)
		if (!out.some((x) => x.toLowerCase() === a.toLowerCase())) out.push(a)
	}
	push(eoa)
	push(aa ?? null)
	return out
}

/** Any card-level stat token with balance > 0 on EOA and/or AA. */
export async function userHasAnyCardLevelStatBalance(
	cardAddress: string,
	eoa: string,
	aa?: string | null
): Promise<boolean> {
	const held = await fetchCardLevelStatNftHoldings(cardAddress, eoa, aa)
	return held.length > 0
}

/** Stat NFT rows for wallet / My Brands assets merge (tokenId 3–30). */
export async function fetchCardLevelStatNftHoldings(
	cardAddress: string,
	eoa: string,
	aa?: string | null
): Promise<CardLevelStatNftHolding[]> {
	let addr: string
	try {
		addr = ethers.getAddress(String(cardAddress ?? '').trim())
	} catch {
		return []
	}
	if (!eoa || !ethers.isAddress(eoa)) return []

	const accounts = uniqueHolderAccounts(eoa, aa)
	if (!accounts.length) return []

	try {
		const { provider } = await providerForBeamioUserCard(addr)
		const card = new ethers.Contract(addr, BALANCE_OF_ABI, provider)
		const heldIds = new Set<number>()

		await Promise.all(
			CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS.map(async (tokenId) => {
				for (const account of accounts) {
					try {
						const bal = (await card.balanceOf(account, BigInt(tokenId))) as bigint
						if (bal > 0n) {
							heldIds.add(tokenId)
							return
						}
					} catch {
						/* keep scanning */
					}
				}
			})
		)

		return [...heldIds]
			.sort((a, b) => a - b)
			.map((tokenId) => ({
				tokenId: String(tokenId),
				attribute: '0',
				tier: 'Stat',
				expiry: 'Never',
				isExpired: false,
			}))
	} catch {
		return []
	}
}

/** Chain view via AdminStatsQueryModuleV3 fallback; null = RPC/ABI unavailable (not false). */
export async function userHasAnyProgramAssetOnCard(
	cardAddress: string,
	eoa: string
): Promise<boolean | null> {
	let addr: string
	try {
		addr = ethers.getAddress(String(cardAddress ?? '').trim())
	} catch {
		return null
	}
	if (!eoa || !ethers.isAddress(eoa)) return null
	try {
		const { provider } = await providerForBeamioUserCard(addr)
		const card = new ethers.Contract(addr, USER_HAS_ANY_PROGRAM_ASSET_ABI, provider)
		return (await card.userHasAnyProgramAsset(eoa)) as boolean
	} catch {
		return null
	}
}
