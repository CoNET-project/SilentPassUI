/**
 * BeamioMyBrandsDashboard — one eth_call for N merchant cards (ownership + stats).
 * deployments/conet-BeamioMyBrandsDashboard.json
 */
import { ethers } from 'ethers'
import {
	CONET_MY_BRANDS_DASHBOARD,
	CONET_MY_BRANDS_DASHBOARD_IMPL,
} from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'
import { CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS } from '@/utils/cardLevelUserCumulStatTokenIds'
import { peekCardBasicMetadata } from '@/utils/cardBasicMetadataGlobalCache'

export { CONET_MY_BRANDS_DASHBOARD, CONET_MY_BRANDS_DASHBOARD_IMPL }

export const MY_BRANDS_DASHBOARD_MAX_CARDS = 32
export const MY_BRANDS_DASHBOARD_MAX_TOKEN_IDS = 64

const SNAPSHOT_CARDS_ABI = [
	`function snapshotCards(address[] cards, address eoa, address aaOptional, uint256 rewardTokenId) view returns (
		tuple(
			address card,
			bool ok,
			uint8 currency,
			address owner,
			uint256 points,
			uint256 rewardBalance,
			tuple(uint256 tokenId, uint256 attribute, uint256 tierIndexOrMax, uint256 expiry, bool isExpired)[] membershipNfts,
			uint256[28] statBalancesEoa,
			uint256[28] statBalancesAa,
			bool hasAnyProgramAsset
		)[] slices
	)`,
] as const

const BALANCE_BATCH_ABI = [
	'function balanceBatch(address card, address[] accounts, uint256[] tokenIds) view returns (uint256[] balances)',
] as const

function currencyFromUint8(n: number | bigint): ICurrency {
	const v = typeof n === 'bigint' ? n : BigInt(n)
	switch (v) {
		case 0n:
			return 'CAD'
		case 1n:
			return 'USD'
		case 2n:
			return 'JPY'
		case 3n:
			return 'CNY'
		case 4n:
			return 'USDC'
		case 5n:
			return 'HKD'
		case 6n:
			return 'EUR'
		case 7n:
			return 'SGD'
		case 8n:
			return 'TWD'
		default:
			return 'USDC'
	}
}

function formatMembershipExpiry(expiry: bigint): string {
	if (expiry === 0n) return 'Never'
	return new Date(Number(expiry) * 1000).toLocaleString()
}

function formatTier(tierIndexOrMax: bigint): string {
	return tierIndexOrMax === ethers.MaxUint256 ? 'Default/Max' : tierIndexOrMax.toString()
}

type RawCardSlice = {
	card: string
	ok: boolean
	currency: number | bigint
	owner: string
	points: bigint
	rewardBalance: bigint
	membershipNfts: Array<{
		tokenId: bigint
		attribute: bigint
		tierIndexOrMax: bigint
		expiry: bigint
		isExpired: boolean
	}>
	statBalancesEoa: readonly bigint[] | bigint[]
	statBalancesAa: readonly bigint[] | bigint[]
	hasAnyProgramAsset: boolean
}

function sliceToMyCardAssets(
	slice: RawCardSlice,
	aaAddress: string | null,
): MyCardAssets | null {
	if (!slice?.ok) return null
	let cardAddr: string
	try {
		cardAddr = ethers.getAddress(slice.card)
	} catch {
		return null
	}
	const aa =
		aaAddress && ethers.isAddress(aaAddress) ? ethers.getAddress(aaAddress) : ''
	const nfts: MyCardAssets['nfts'] = (slice.membershipNfts ?? []).map((nft) => ({
		tokenId: nft.tokenId.toString(),
		attribute: nft.attribute.toString(),
		tier: formatTier(nft.tierIndexOrMax),
		expiry: formatMembershipExpiry(nft.expiry),
		isExpired: Boolean(nft.isExpired),
	}))
	const existing = new Set(nfts.map((n) => n.tokenId))
	const eoaStats = slice.statBalancesEoa ?? []
	const aaStats = slice.statBalancesAa ?? []
	for (let i = 0; i < CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS.length; i++) {
		const tokenId = CARD_LEVEL_USER_CUMUL_STAT_TOKEN_IDS[i]!
		const balE = eoaStats[i] ?? 0n
		const balA = aaStats[i] ?? 0n
		if ((balE > 0n || balA > 0n) && !existing.has(String(tokenId))) {
			existing.add(String(tokenId))
			nfts.push({
				tokenId: String(tokenId),
				attribute: '0',
				tier: 'Stat',
				expiry: 'Never',
				isExpired: false,
			})
		}
	}
	return {
		address: aa,
		cardAddress: cardAddr,
		cardOwner: null,
		points: ethers.formatUnits(slice.points ?? 0n, 6),
		chargeRewardPoints: ethers.formatUnits(slice.rewardBalance ?? 0n, 6),
		chargeRewardPoints6: (slice.rewardBalance ?? 0n).toString(),
		cardCurrency: currencyFromUint8(slice.currency),
		nfts,
	}
}

function resolveRewardTokenId(cardAddress: string): number {
	const metaPeek = peekCardBasicMetadata(cardAddress)
	const rid = metaPeek?.pointSystem?.rewardTokenId
	if (typeof rid === 'number' && Number.isFinite(rid) && rid >= 0) return Math.trunc(rid)
	return 2
}

export function isMyBrandsDashboardConfigured(): boolean {
	return (
		Boolean(CONET_MY_BRANDS_DASHBOARD) &&
		CONET_MY_BRANDS_DASHBOARD !== ethers.ZeroAddress &&
		ethers.isAddress(CONET_MY_BRANDS_DASHBOARD)
	)
}

export type MyBrandsDashboardCardRow = {
	assets: MyCardAssets
	hasAnyProgramAsset: boolean
}

function uniqueCardAddresses(cardAddresses: string[]): string[] {
	const unique: string[] = []
	const seen = new Set<string>()
	for (const raw of cardAddresses) {
		try {
			const a = ethers.getAddress(String(raw ?? '').trim())
			const k = a.toLowerCase()
			if (seen.has(k)) continue
			seen.add(k)
			unique.push(a)
		} catch {
			/* skip */
		}
	}
	return unique
}

/**
 * Batch My Brands slices via aggregator (assets + hasAnyProgramAsset).
 * @returns Map cardLower → row for ok slices; **null** = untrusted failure (keep previous).
 */
export async function fetchMyBrandsDashboardCardRows(
	cardAddresses: string[],
	eoa: string,
	aaOptional?: string | null,
): Promise<Map<string, MyBrandsDashboardCardRow> | null> {
	if (!isMyBrandsDashboardConfigured()) return null
	if (!eoa || !ethers.isAddress(eoa)) return null
	const unique = uniqueCardAddresses(cardAddresses)
	if (!unique.length) return new Map()

	const aa =
		aaOptional && ethers.isAddress(aaOptional) ? ethers.getAddress(aaOptional) : ethers.ZeroAddress
	/** Prefer first card's rewardTokenId; default 2 (most cards share charge reward id). */
	const rewardTokenId = resolveRewardTokenId(unique[0]!)

	try {
		const code = await conetDepinProvider.getCode(CONET_MY_BRANDS_DASHBOARD)
		if (!code || code === '0x') return null
		const c = new ethers.Contract(
			CONET_MY_BRANDS_DASHBOARD,
			SNAPSHOT_CARDS_ABI,
			conetDepinProvider,
		)
		const out = new Map<string, MyBrandsDashboardCardRow>()
		for (let offset = 0; offset < unique.length; offset += MY_BRANDS_DASHBOARD_MAX_CARDS) {
			const chunk = unique.slice(offset, offset + MY_BRANDS_DASHBOARD_MAX_CARDS)
			const slices = (await c.snapshotCards(
				chunk,
				ethers.getAddress(eoa),
				aa,
				BigInt(rewardTokenId),
			)) as RawCardSlice[]
			if (!Array.isArray(slices)) return null
			for (const slice of slices) {
				const assets = sliceToMyCardAssets(slice, aa === ethers.ZeroAddress ? null : aa)
				if (!assets) continue
				out.set(assets.cardAddress.toLowerCase(), {
					assets,
					hasAnyProgramAsset: Boolean(slice.hasAnyProgramAsset),
				})
			}
		}
		return out
	} catch {
		return null
	}
}

/**
 * Batch My Brands card assets via aggregator.
 * @returns Map cardLower → MyCardAssets for ok slices; **null** = untrusted failure (keep previous).
 */
export async function fetchMyBrandsCardAssetsBatch(
	cardAddresses: string[],
	eoa: string,
	aaOptional?: string | null,
): Promise<Map<string, MyCardAssets> | null> {
	const rows = await fetchMyBrandsDashboardCardRows(cardAddresses, eoa, aaOptional)
	if (!rows) return null
	const out = new Map<string, MyCardAssets>()
	for (const [k, row] of rows) out.set(k, row.assets)
	return out
}

/**
 * Coupon/catalog balance filter: one eth_call for accounts × tokenIds on a single card.
 * Flat layout: balances[a * tokenIds.length + t].
 * @returns null on untrusted failure
 */
export async function fetchMyBrandsBalanceBatch(
	cardAddress: string,
	accounts: string[],
	tokenIds: ReadonlyArray<string | number | bigint>,
): Promise<bigint[] | null> {
	if (!isMyBrandsDashboardConfigured()) return null
	let card: string
	try {
		card = ethers.getAddress(cardAddress)
	} catch {
		return null
	}
	const accts: string[] = []
	for (const a of accounts) {
		if (!a || !ethers.isAddress(a)) continue
		const n = ethers.getAddress(a)
		if (!accts.some((x) => x.toLowerCase() === n.toLowerCase())) accts.push(n)
	}
	if (!accts.length || accts.length > 4) return null
	const ids = tokenIds.map((t) => BigInt(t)).filter((t) => t >= 0n)
	if (!ids.length || ids.length > MY_BRANDS_DASHBOARD_MAX_TOKEN_IDS) return null
	try {
		const c = new ethers.Contract(
			CONET_MY_BRANDS_DASHBOARD,
			BALANCE_BATCH_ABI,
			conetDepinProvider,
		)
		const balances = (await c.balanceBatch(card, accts, ids)) as bigint[]
		return Array.isArray(balances) ? balances.map((b) => BigInt(b)) : null
	} catch {
		return null
	}
}
