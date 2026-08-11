import { ethers } from 'ethers'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'
import { CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS } from '@/utils/cardLevelUserCumulStatTokenIds'
import { fetchMyBrandsBalanceBatch } from '@/utils/myBrandsDashboard'

export { CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS }

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

function holdingsFromFlatBalances(accounts: string[], balances: bigint[]): CardLevelStatNftHolding[] {
	const n = CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS.length
	if (balances.length !== accounts.length * n) return []
	const heldIds = new Set<number>()
	for (let a = 0; a < accounts.length; a++) {
		for (let t = 0; t < n; t++) {
			const bal = balances[a * n + t] ?? 0n
			if (bal > 0n) heldIds.add(CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS[t]!)
		}
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
}

/** Any card-level stat token with balance > 0 on EOA and/or AA. Untrusted miss → false (caller must not treat as canonical empty). */
export async function userHasAnyCardLevelStatBalance(
	cardAddress: string,
	eoa: string,
	aa?: string | null
): Promise<boolean> {
	const held = await fetchCardLevelStatNftHoldings(cardAddress, eoa, aa)
	return held.length > 0
}

/**
 * Stat NFT rows for wallet / My Brands assets merge (tokenId 3–30).
 * One Dashboard `balanceBatch` eth_call — never serial `balanceOf` (batchMaxCount:1 would storm RPC).
 * Untrusted failure → [] (do not interpret as “no stats”; callers keep prior assets).
 */
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

	const batch = await fetchMyBrandsBalanceBatch(
		addr,
		accounts,
		CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS,
	)
	if (!batch) return []
	return holdingsFromFlatBalances(accounts, batch)
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
