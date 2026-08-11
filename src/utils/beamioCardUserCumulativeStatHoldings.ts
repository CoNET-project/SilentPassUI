import { ethers } from 'ethers'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'
import {
	decodeMulticallUint256,
	multicallAggregate3ConetMain,
} from '@/utils/conetMulticall3'

/**
 * UserCumulativeStatLib.cardLevelStatTokenIds() — L0/L1 program stat ERC-1155 ids (3–30, plus #13).
 * Minted to user EOA (social like/click/etc.); excluded from getOwnership / getOwnershipByEOA inventory.
 */
export const CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS: readonly number[] = [
	3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
	17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
]

const BALANCE_OF_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'] as const
const BALANCE_OF_IFACE = new ethers.Interface(BALANCE_OF_ABI)

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
		const heldIds = new Set<number>()
		/** One Multicall3 eth_call for all (account × tokenId) balanceOf — not N×M RPC. */
		const calls = accounts.flatMap((account) =>
			CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS.map((tokenId) => ({
				target: addr,
				allowFailure: true,
				callData: BALANCE_OF_IFACE.encodeFunctionData('balanceOf', [account, BigInt(tokenId)]),
				tokenId,
			})),
		)
		const results = await multicallAggregate3ConetMain(
			calls.map(({ target, allowFailure, callData }) => ({ target, allowFailure, callData })),
			provider,
		)
		for (let i = 0; i < results.length; i++) {
			const r = results[i]
			const tokenId = calls[i]?.tokenId
			if (tokenId == null || !r?.success) continue
			const bal = decodeMulticallUint256(r.returnData)
			if (bal != null && bal > 0n) heldIds.add(tokenId)
		}

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
