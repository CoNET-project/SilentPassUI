import { ethers } from 'ethers'
import { CONET_AA_FACTORY } from '@/config/chainAddresses'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'

/** Referrer reward ERC-1155 token (biz Referrer Reward / token #1). */
export const CARD_REFERRER_REWARD_TOKEN_ID = 1n

const CARD_REFERRER_READ_ABI = [
	'function referrerTotalCount() view returns (uint256)',
	'function registeredRefereeTotalCount() view returns (uint256)',
	'function refereeCountByReferrer(address referrer) view returns (uint256)',
	'function balanceOf(address account, uint256 id) view returns (uint256)',
	'function refereeReferrer(address referee) view returns (address)',
	'function referrerChargeAmountRatioE6() view returns (uint256)',
	'function referrerTopupAmountRatioE6() view returns (uint256)',
	'function getRefereesByReferrerPage(address referrerAA, uint256 offset, uint256 pageSize) view returns (address[] referees, uint256[] refereeChargeTotals6, uint256 total, uint256 nextOffset)',
] as const

const AA_FACTORY_ABI = [
	'function isBeamioAccount(address) view returns (bool)',
	'function beamioAccountOf(address) view returns (address)',
] as const

const AA_OWNER_ABI = ['function owner() view returns (address)'] as const

/** Max referees loaded for My referees downline page (paginated). */
const MY_REFEREES_PAGE_SIZE = 50
const MY_REFEREES_MAX_ROWS = 500

export type CardProgramReferrerDashboardSnapshot = {
	cardAddress: string
	userEoa: string
	/** Token #1 balance raw (6-decimals points). */
	rewardBalanceRaw: string | null
	myRefereeCount: number | null
	referrerTotalCount: number | null
	registeredRefereeTotalCount: number | null
	chargeRatioE6: string | null
	topupRatioE6: string | null
}

function bigintToCount(raw: bigint): number | null {
	const n = Number(raw)
	return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
}

function pickMaxCount(a: number | null, b: number | null): number | null {
	if (a == null && b == null) return null
	return Math.max(a ?? 0, b ?? 0)
}

function pickMaxRaw(a: bigint | null, b: bigint | null): string | null {
	if (a == null && b == null) return null
	const left = a ?? 0n
	const right = b ?? 0n
	return (left > right ? left : right).toString()
}

async function resolveUserAa(provider: ethers.Provider, eoa: string): Promise<string | null> {
	try {
		const fac = new ethers.Contract(CONET_AA_FACTORY, AA_FACTORY_ABI, provider)
		const aa = (await fac.beamioAccountOf(ethers.getAddress(eoa))) as string
		if (aa && aa !== ethers.ZeroAddress) return ethers.getAddress(aa)
	} catch {
		/* no AA */
	}
	return null
}

/** Chain referrer index may store EOA or AA; product UI shows EOA when resolvable. */
async function resolveReferrerAaToEoa(provider: ethers.Provider, aaOrEoa: string): Promise<string> {
	if (!ethers.isAddress(aaOrEoa) || aaOrEoa === ethers.ZeroAddress) return aaOrEoa
	const addr = ethers.getAddress(aaOrEoa)
	try {
		const fac = new ethers.Contract(CONET_AA_FACTORY, AA_FACTORY_ABI, provider)
		const isAa = Boolean(await fac.isBeamioAccount(addr))
		if (!isAa) return addr
		const acct = new ethers.Contract(addr, AA_OWNER_ABI, provider)
		const owner = (await acct.owner()) as string
		if (owner && owner !== ethers.ZeroAddress) return ethers.getAddress(owner)
	} catch {
		/* keep addr */
	}
	return addr
}

export type CardProgramMyRefereeRow = {
	/** Referee EOA when resolvable (for BeamioTag / capsule). */
	refereeEoa: string
	/** Charge points attributed under this referee (6-decimals raw) — drives referrer reward. */
	refereeChargePointsTotal6: string | null
}

export type CardProgramMyRefereesSnapshot = {
	cardAddress: string
	referrerEoa: string
	rows: CardProgramMyRefereeRow[]
	total: number
}

/**
 * Paginate `getRefereesByReferrerPage` for the current user.
 * Pass **EOA** — card module falls back EOA→AA; passing AA-only misses EOA-keyed index rows.
 * Returns null only on invalid input; empty `rows` is trusted empty.
 * Untrusted RPC failure → null (caller keeps last trusted).
 */
export async function fetchCardProgramMyReferees(
	cardAddress: string,
	userEoa: string,
): Promise<CardProgramMyRefereesSnapshot | null> {
	if (!cardAddress || !ethers.isAddress(cardAddress)) return null
	if (!userEoa || !ethers.isAddress(userEoa)) return null

	const cardAddr = ethers.getAddress(cardAddress)
	const eoa = ethers.getAddress(userEoa)

	try {
		const { provider } = await providerForBeamioUserCard(cardAddr)
		const card = new ethers.Contract(cardAddr, CARD_REFERRER_READ_ABI, provider)
		// Prefer EOA (matches on-chain getRefereesByReferrerPage EOA→AA fallback).
		// If EOA page is empty, also try AA (legacy indexes keyed only by AA).
		const aa = await resolveUserAa(provider, eoa)
		const lookupKeys = aa && aa.toLowerCase() !== eoa.toLowerCase() ? [eoa, aa] : [eoa]

		let rows: CardProgramMyRefereeRow[] = []
		let total = 0

		for (const lookup of lookupKeys) {
			const pageRows: CardProgramMyRefereeRow[] = []
			let offset = 0
			let pageTotal = 0
			let guard = 0

			while (guard < 32 && pageRows.length < MY_REFEREES_MAX_ROWS) {
				guard += 1
				const [referees, chargeTotals, totalRaw, nextOffsetRaw] = (await card.getRefereesByReferrerPage(
					lookup,
					BigInt(offset),
					BigInt(MY_REFEREES_PAGE_SIZE),
				)) as [string[], bigint[], bigint, bigint]

				pageTotal = bigintToCount(totalRaw) ?? pageTotal
				const pageLen = referees.length
				if (pageLen === 0) break

				const eoaBatch = await Promise.all(referees.map((a) => resolveReferrerAaToEoa(provider, a)))
				for (let i = 0; i < pageLen; i += 1) {
					if (pageRows.length >= MY_REFEREES_MAX_ROWS) break
					pageRows.push({
						refereeEoa: eoaBatch[i] ?? ethers.getAddress(referees[i]!),
						refereeChargePointsTotal6:
							chargeTotals[i] != null ? chargeTotals[i]!.toString() : null,
					})
				}

				const next = bigintToCount(nextOffsetRaw) ?? offset + pageLen
				if (next <= offset || pageRows.length >= pageTotal) break
				offset = next
			}

			if (pageRows.length > 0 || pageTotal > 0) {
				rows = pageRows
				total = Math.max(pageTotal, pageRows.length)
				break
			}
		}

		return {
			cardAddress: cardAddr,
			referrerEoa: eoa,
			rows,
			total: Math.max(total, rows.length),
		}
	} catch {
		return null
	}
}

/**
 * Discover merchant REFERRER dashboard — RPC-direct card program Referrer Reward reads
 * (aligned with bizSite Programs → Referrer registry / Referrer reward).
 * Returns null only when the card address / wallet is invalid (caller keeps last trusted).
 */
export async function fetchCardProgramReferrerDashboard(
	cardAddress: string,
	userEoa: string,
): Promise<CardProgramReferrerDashboardSnapshot | null> {
	if (!cardAddress || !ethers.isAddress(cardAddress)) return null
	if (!userEoa || !ethers.isAddress(userEoa)) return null

	const cardAddr = ethers.getAddress(cardAddress)
	const eoa = ethers.getAddress(userEoa)
	const { provider } = await providerForBeamioUserCard(cardAddr)
	const card = new ethers.Contract(cardAddr, CARD_REFERRER_READ_ABI, provider)
	const aa = await resolveUserAa(provider, eoa)

	const safeCount = async (addr: string): Promise<number | null> => {
		try {
			return bigintToCount((await card.refereeCountByReferrer(addr)) as bigint)
		} catch {
			return null
		}
	}
	const safeBal = async (addr: string): Promise<bigint | null> => {
		try {
			return (await card.balanceOf(addr, CARD_REFERRER_REWARD_TOKEN_ID)) as bigint
		} catch {
			return null
		}
	}

	const [
		referrerTotalRaw,
		registeredTotalRaw,
		chargeRatioRaw,
		topupRatioRaw,
		countEoa,
		countAa,
		balEoa,
		balAa,
	] = await Promise.all([
		card.referrerTotalCount().catch(() => null) as Promise<bigint | null>,
		card.registeredRefereeTotalCount().catch(() => null) as Promise<bigint | null>,
		card.referrerChargeAmountRatioE6().catch(() => null) as Promise<bigint | null>,
		card.referrerTopupAmountRatioE6().catch(() => null) as Promise<bigint | null>,
		safeCount(eoa),
		aa ? safeCount(aa) : Promise.resolve(null),
		safeBal(eoa),
		aa ? safeBal(aa) : Promise.resolve(null),
	])

	return {
		cardAddress: cardAddr,
		userEoa: eoa,
		rewardBalanceRaw: pickMaxRaw(balEoa, balAa),
		myRefereeCount: pickMaxCount(countEoa, countAa),
		referrerTotalCount: referrerTotalRaw != null ? bigintToCount(referrerTotalRaw) : null,
		registeredRefereeTotalCount:
			registeredTotalRaw != null ? bigintToCount(registeredTotalRaw) : null,
		chargeRatioE6: chargeRatioRaw != null ? chargeRatioRaw.toString() : null,
		topupRatioE6: topupRatioRaw != null ? topupRatioRaw.toString() : null,
	}
}

/** Display token #1 points (6 decimals → 2 dp), same as biz `formatReferrerPoints6Display`. */
export function formatReferrerRewardPointsDisplay(raw: string | null | undefined): string {
	if (raw == null || String(raw).trim() === '') return '—'
	const v = Number(raw) / 1_000_000
	if (!Number.isFinite(v) || v < 0) return '—'
	return v.toFixed(2)
}

export function formatReferrerRewardPercent(ratioE6: string | null | undefined): string {
	if (ratioE6 == null || String(ratioE6).trim() === '') return '—'
	try {
		const n = Number(BigInt(ratioE6)) / 1_000_000
		if (!Number.isFinite(n) || n < 0) return '—'
		if (n <= 0) return 'Off'
		return `${Math.min(100, Math.round(n * 100))}%`
	} catch {
		return '—'
	}
}

/** E6 ratio → whole percent 0–100 (100% = 1_000_000). Invalid / missing → 0. */
export function referrerRatioE6ToWholePercent(ratioE6: string | null | undefined): number {
	if (ratioE6 == null || String(ratioE6).trim() === '') return 0
	try {
		const v = Math.round(Number(BigInt(ratioE6)) / 10_000)
		if (!Number.isFinite(v)) return 0
		return Math.min(100, Math.max(0, v))
	} catch {
		return 0
	}
}

export type CardReferrerAmountRatioPercents = {
	chargePercent: number
	topupPercent: number
}

/**
 * Card-level referrer Top-up / Charge % (no wallet). RPC failure → null (caller keeps last trusted).
 */
export async function fetchCardReferrerAmountRatioPercents(
	cardAddress: string,
): Promise<CardReferrerAmountRatioPercents | null> {
	if (!cardAddress || !ethers.isAddress(cardAddress)) return null
	try {
		const cardAddr = ethers.getAddress(cardAddress)
		const { provider } = await providerForBeamioUserCard(cardAddr)
		const card = new ethers.Contract(cardAddr, CARD_REFERRER_READ_ABI, provider)
		const [chargeRatioRaw, topupRatioRaw] = await Promise.all([
			card.referrerChargeAmountRatioE6().catch(() => null) as Promise<bigint | null>,
			card.referrerTopupAmountRatioE6().catch(() => null) as Promise<bigint | null>,
		])
		if (chargeRatioRaw == null && topupRatioRaw == null) return null
		return {
			chargePercent: referrerRatioE6ToWholePercent(
				chargeRatioRaw != null ? chargeRatioRaw.toString() : null,
			),
			topupPercent: referrerRatioE6ToWholePercent(
				topupRatioRaw != null ? topupRatioRaw.toString() : null,
			),
		}
	} catch {
		return null
	}
}

export function formatReferrerCountDisplay(n: number | null | undefined): string {
	if (n == null || !Number.isFinite(n) || n < 0) return '—'
	return Math.trunc(n).toLocaleString('en-US')
}
