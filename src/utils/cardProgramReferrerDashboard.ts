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
] as const

const AA_FACTORY_ABI = [
	'function isBeamioAccount(address) view returns (bool)',
	'function beamioAccountOf(address) view returns (address)',
] as const

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

export function formatReferrerCountDisplay(n: number | null | undefined): string {
	if (n == null || !Number.isFinite(n) || n < 0) return '—'
	return Math.trunc(n).toLocaleString('en-US')
}
