/**
 * L0 Start Kit remaining quota — trusted RPC feed for DaemonProvider.
 * Local-first + EOA-isolated cache; only trusted success overwrites.
 */
import { ethers } from 'ethers'
import { CONET_REFERRAL_REGISTRY_VAULT_V1 } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

const ROLE_L0 = 1
const CACHE_PREFIX = 'beamio:referral:l0-start-kit-quota:v1:'
const MEM_TTL_MS = 30_000

const ABI = [
	'function members(address) view returns (uint8 role, address parentAdmin, address parentL0, uint256 rebateBps, uint256 ratioBps, bool active)',
	'function merchantQuotas(address) view returns (uint256 starterKetRemaining, uint256 paidBunitRemaining, uint256 issuedCodeCount, uint256 claimedCodeCount)',
] as const

export type ReferralL0StartKitQuota = {
	eoa: string
	starterKetRemaining: string
	paidBunitRemaining: string
	issuedCodeCount: string
	claimedCodeCount: string
	fetchedAt: number
}

export type ReferralL0StartKitQuotaFeedResult =
	| { ok: true; isL0: true; quota: ReferralL0StartKitQuota }
	| { ok: true; isL0: false }
	| { ok: false }

const memCache = new Map<string, { fetchedAt: number; result: ReferralL0StartKitQuotaFeedResult }>()
const inFlight = new Map<string, Promise<ReferralL0StartKitQuotaFeedResult>>()

function cacheKey(eoa: string): string {
	return `${CACHE_PREFIX}${ethers.getAddress(eoa).toLowerCase()}`
}

function isDigits(value: unknown): value is string {
	return typeof value === 'string' && /^\d+$/.test(value)
}

export function loadReferralL0StartKitQuotaLocalCache(rawEoa: string): ReferralL0StartKitQuota | null {
	if (typeof window === 'undefined') return null
	try {
		const eoa = ethers.getAddress(rawEoa.trim())
		const raw = localStorage.getItem(cacheKey(eoa))
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<ReferralL0StartKitQuota>
		if (
			!isDigits(parsed.starterKetRemaining) ||
			!isDigits(parsed.paidBunitRemaining) ||
			!isDigits(parsed.issuedCodeCount) ||
			!isDigits(parsed.claimedCodeCount)
		) {
			return null
		}
		return {
			eoa,
			starterKetRemaining: parsed.starterKetRemaining,
			paidBunitRemaining: parsed.paidBunitRemaining,
			issuedCodeCount: parsed.issuedCodeCount,
			claimedCodeCount: parsed.claimedCodeCount,
			fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : Date.now(),
		}
	} catch {
		return null
	}
}

export function saveReferralL0StartKitQuotaLocalCache(quota: ReferralL0StartKitQuota): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.setItem(cacheKey(quota.eoa), JSON.stringify(quota))
	} catch {
		/* ignore */
	}
}

export function clearReferralL0StartKitQuotaLocalCache(rawEoa: string): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.removeItem(cacheKey(ethers.getAddress(rawEoa.trim())))
	} catch {
		/* ignore */
	}
}

export async function fetchReferralL0StartKitQuotaFeed(
	rawEoa: string,
	options: { force?: boolean } = {},
): Promise<ReferralL0StartKitQuotaFeedResult> {
	let eoa: string
	try {
		eoa = ethers.getAddress(rawEoa.trim())
	} catch {
		return { ok: false }
	}
	const key = eoa.toLowerCase()
	if (!options.force) {
		const hit = memCache.get(key)
		if (hit && Date.now() - hit.fetchedAt < MEM_TTL_MS) return hit.result
	}
	const existing = inFlight.get(key)
	if (existing) return existing

	const request = (async (): Promise<ReferralL0StartKitQuotaFeedResult> => {
		try {
			const registry = new ethers.Contract(CONET_REFERRAL_REGISTRY_VAULT_V1, ABI, conetDepinProvider)
			const member = await registry.members(eoa)
			if (Number(member.role) !== ROLE_L0) {
				const result: ReferralL0StartKitQuotaFeedResult = { ok: true, isL0: false }
				memCache.set(key, { fetchedAt: Date.now(), result })
				clearReferralL0StartKitQuotaLocalCache(eoa)
				return result
			}
			const q = await registry.merchantQuotas(eoa)
			const quota: ReferralL0StartKitQuota = {
				eoa,
				starterKetRemaining: q.starterKetRemaining.toString(),
				paidBunitRemaining: q.paidBunitRemaining.toString(),
				issuedCodeCount: q.issuedCodeCount.toString(),
				claimedCodeCount: q.claimedCodeCount.toString(),
				fetchedAt: Date.now(),
			}
			const result: ReferralL0StartKitQuotaFeedResult = { ok: true, isL0: true, quota }
			memCache.set(key, { fetchedAt: Date.now(), result })
			saveReferralL0StartKitQuotaLocalCache(quota)
			return result
		} catch (error) {
			console.warn('[referralL0StartKitQuotaFeed] RPC failed', error)
			return { ok: false }
		}
	})()

	inFlight.set(key, request)
	try {
		return await request
	} finally {
		inFlight.delete(key)
	}
}
