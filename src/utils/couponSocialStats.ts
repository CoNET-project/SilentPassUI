/**
 * Coupon-level social + supply chain reads for DaemonProvider feeder.
 * Likes / share clicks = totalSupply(scoped stat token); supply = max − minted.
 */

import { ethers } from 'ethers'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'
import {
	DISCOVER_USER_LIKE_TARGET,
	fetchCouponLikeCount,
	resolveDiscoverUserLikeScopedTokenId,
} from '@/utils/discoverUserLike'

/** UserCumulativeStatLib.METRIC_REF_CLICK */
export const METRIC_REF_CLICK = 7
/** UserCumulativeStatLib.COUPON_REF_CLICK_OFFSET — parentId + 200e9 */
export const COUPON_REF_CLICK_OFFSET = 200_000_000_000n

const SUPPLY_ABI = [
	'function issuedNftMaxSupply(uint256 tokenId) view returns (uint256)',
	'function issuedNftMintedCount(uint256 tokenId) view returns (uint256)',
	'function totalSupply(uint256 id) view returns (uint256)',
	'function resolveUserCumulativeStatTokenId(uint8 metricKind, uint8 targetKind, uint256 issuedParentId) view returns (uint256 globalTokenId, uint256 scopedTokenId)',
] as const

const CACHE_TTL_MS = 30_000
const shareCache = new Map<string, { value: number; fetchedAt: number }>()
const shareInflight = new Map<string, Promise<number | null>>()
const supplyCache = new Map<
	string,
	{ maxSupply: string | null; remainingSupply: string | null; fetchedAt: number }
>()
const supplyInflight = new Map<
	string,
	Promise<{ maxSupply: string | null; remainingSupply: string | null } | null>
>()
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
	const run = queue.then(fn, fn)
	queue = run.catch(() => undefined)
	return run
}

function keyOf(cardLower: string, tokenId: string): string {
	return `${cardLower}:${tokenId}`
}

async function resolveCouponRefClickScopedTokenId(
	cardAddress: string,
	issuedParentId: string,
): Promise<bigint | null> {
	try {
		const card = ethers.getAddress(cardAddress)
		const parentId = BigInt(issuedParentId)
		const { provider } = await providerForBeamioUserCard(card)
		const reader = new ethers.Contract(card, SUPPLY_ABI, provider)
		try {
			const [, scoped] = (await reader.resolveUserCumulativeStatTokenId(
				METRIC_REF_CLICK,
				DISCOVER_USER_LIKE_TARGET.ISSUED_COUPON,
				parentId,
			)) as [bigint, bigint]
			if (scoped != null && scoped > 0n) return scoped
		} catch {
			/* fallback offset */
		}
		return parentId + COUPON_REF_CLICK_OFFSET
	} catch {
		return null
	}
}

/** Aggregate coupon share-link clicks = totalSupply(scoped REF_CLICK token). null = untrusted. */
export async function fetchCouponShareClickCount(
	cardAddress: string,
	tokenId: string,
): Promise<number | null> {
	let card: string
	let tid: string
	try {
		card = ethers.getAddress(String(cardAddress ?? '').trim())
		tid = String(tokenId ?? '').trim()
		if (!tid) return null
		BigInt(tid)
	} catch {
		return null
	}
	const cardLower = card.toLowerCase()
	const k = keyOf(cardLower, tid)
	const hit = shareCache.get(k)
	if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.value
	const pending = shareInflight.get(k)
	if (pending) return pending

	const task = enqueue(async () => {
		try {
			const scoped = await resolveCouponRefClickScopedTokenId(card, tid)
			if (scoped == null || scoped === 0n) return null
			const { provider } = await providerForBeamioUserCard(card)
			const reader = new ethers.Contract(card, SUPPLY_ABI, provider)
			const raw = (await reader.totalSupply(scoped)) as bigint
			const n = Number(raw)
			const value = Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
			shareCache.set(k, { value, fetchedAt: Date.now() })
			return value
		} catch {
			return null
		} finally {
			shareInflight.delete(k)
		}
	})
	shareInflight.set(k, task)
	return task
}

export function invalidateCouponShareClickCountCache(cardAddress: string, tokenId: string): void {
	try {
		const cardLower = ethers.getAddress(String(cardAddress ?? '').trim()).toLowerCase()
		const tid = String(tokenId ?? '').trim()
		shareCache.delete(keyOf(cardLower, tid))
	} catch {
		/* ignore */
	}
}

/**
 * Trusted supply snapshot. maxSupply null = unlimited (chain max == 0).
 * null return = RPC failure (do not overwrite UI).
 */
export async function fetchCouponSupplyStats(
	cardAddress: string,
	tokenId: string,
): Promise<{ maxSupply: string | null; remainingSupply: string | null } | null> {
	let card: string
	let tid: string
	try {
		card = ethers.getAddress(String(cardAddress ?? '').trim())
		tid = String(tokenId ?? '').trim()
		if (!tid) return null
		BigInt(tid)
	} catch {
		return null
	}
	const cardLower = card.toLowerCase()
	const k = keyOf(cardLower, tid)
	const hit = supplyCache.get(k)
	if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
		return { maxSupply: hit.maxSupply, remainingSupply: hit.remainingSupply }
	}
	const pending = supplyInflight.get(k)
	if (pending) return pending

	const task = enqueue(async () => {
		try {
			const tokenIdN = BigInt(tid)
			const { provider } = await providerForBeamioUserCard(card)
			const reader = new ethers.Contract(card, SUPPLY_ABI, provider)
			const [maxRaw, mintedRaw] = await Promise.all([
				reader.issuedNftMaxSupply(tokenIdN) as Promise<bigint>,
				reader.issuedNftMintedCount(tokenIdN) as Promise<bigint>,
			])
			if (maxRaw === 0n) {
				const value = { maxSupply: null as string | null, remainingSupply: null as string | null }
				supplyCache.set(k, { ...value, fetchedAt: Date.now() })
				return value
			}
			const remaining = maxRaw > mintedRaw ? maxRaw - mintedRaw : 0n
			const value = {
				maxSupply: maxRaw.toString(),
				remainingSupply: remaining.toString(),
			}
			supplyCache.set(k, { ...value, fetchedAt: Date.now() })
			return value
		} catch {
			return null
		} finally {
			supplyInflight.delete(k)
		}
	})
	supplyInflight.set(k, task)
	return task
}

/** One tick: like + share + supply (any trusted dim). */
export async function fetchCouponSocialStatsBundle(
	cardAddress: string,
	tokenId: string,
): Promise<{
	likeCount: number | null
	shareClickCount: number | null
	maxSupply?: string | null
	remainingSupply?: string | null
} | null> {
	const [likeCount, shareClickCount, supply] = await Promise.all([
		fetchCouponLikeCount(cardAddress, tokenId),
		fetchCouponShareClickCount(cardAddress, tokenId),
		fetchCouponSupplyStats(cardAddress, tokenId),
	])
	if (likeCount == null && shareClickCount == null && supply == null) return null
	return {
		likeCount,
		shareClickCount,
		...(supply
			? { maxSupply: supply.maxSupply, remainingSupply: supply.remainingSupply }
			: {}),
	}
}

/** Re-export like scoped resolve for optimistic UI if needed. */
export { fetchCouponLikeCount, resolveDiscoverUserLikeScopedTokenId }
