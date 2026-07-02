import { ethers } from 'ethers'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'
import { DISCOVER_MERCHANT_CARD_LIKE_TOKEN_ID } from '@/utils/discoverMerchantLikeCount'
import {
	loadDiscoverUserLikeLocalCache,
	saveDiscoverUserLikeLocalCache,
} from '@/utils/discoverUserLikeLocalCache'

/** UserCumulativeStatLib.TARGET_* — merchant card vs issued coupon like scope. */
export const DISCOVER_USER_LIKE_TARGET = {
	MERCHANT_CARD: 1,
	ISSUED_COUPON: 2,
} as const

export const METRIC_USER_LIKE = 5

/** UserCumulativeStatLib.COUPON_USER_LIKE_OFFSET */
export const COUPON_USER_LIKE_OFFSET = 620_000_000_000n

const SCOPED_READ_ABI = [
	'function balanceOf(address account, uint256 id) view returns (uint256)',
	'function resolveUserCumulativeStatTokenId(uint8 metricKind, uint8 targetKind, uint256 issuedParentId) view returns (uint256 globalTokenId, uint256 scopedTokenId)',
] as const

const CACHE_TTL_MS = 30_000
const balanceCache = new Map<string, { liked: boolean; fetchedAt: number }>()
const balanceInflight = new Map<string, Promise<boolean | null>>()
let readQueue: Promise<unknown> = Promise.resolve()

function balanceCacheKey(
	eoaLower: string,
	cardLower: string,
	targetKind: number,
	issuedParentId: string,
): string {
	return `${eoaLower}:${cardLower}:${targetKind}:${issuedParentId}`
}

function enqueueRead<T>(fn: () => Promise<T>): Promise<T> {
	const run = readQueue.then(fn, fn)
	readQueue = run.catch(() => undefined)
	return run
}

/** Resolve scoped like-stat token id (19 for L1 merchant card; parent+offset for coupon). */
export async function resolveDiscoverUserLikeScopedTokenId(
	cardAddress: string,
	targetKind: number,
	issuedParentId: bigint | string | number = 0,
): Promise<bigint | null> {
	try {
		const card = ethers.getAddress(cardAddress)
		const parentId = BigInt(issuedParentId ?? 0)
		if (targetKind === DISCOVER_USER_LIKE_TARGET.MERCHANT_CARD && parentId === 0n) {
			return DISCOVER_MERCHANT_CARD_LIKE_TOKEN_ID
		}
		const { provider } = await providerForBeamioUserCard(card)
		const reader = new ethers.Contract(card, SCOPED_READ_ABI, provider)
		const [, scopedTokenId] = (await reader.resolveUserCumulativeStatTokenId(
			METRIC_USER_LIKE,
			targetKind,
			parentId,
		)) as [bigint, bigint]
		return scopedTokenId
	} catch {
		return null
	}
}

/**
 * Trusted on-chain read: user holds scoped like stat token ⇒ already liked.
 * Unlike burns that token (ERC1155 transfer to address(0) semantics).
 */
export async function fetchUserHasLikedOnChain(
	cardAddress: string,
	userEOA: string,
	targetKind: number = DISCOVER_USER_LIKE_TARGET.MERCHANT_CARD,
	issuedParentId: bigint | string | number = 0,
): Promise<boolean | null> {
	let card: string
	let user: string
	try {
		card = ethers.getAddress(String(cardAddress ?? '').trim())
		user = ethers.getAddress(String(userEOA ?? '').trim())
	} catch {
		return null
	}
	const parentId = String(issuedParentId ?? 0)
	const key = balanceCacheKey(user.toLowerCase(), card.toLowerCase(), targetKind, parentId)
	const hit = balanceCache.get(key)
	if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.liked

	const pending = balanceInflight.get(key)
	if (pending) return pending

	const task = enqueueRead(async () => {
		try {
			const scopedTokenId = await resolveDiscoverUserLikeScopedTokenId(card, targetKind, parentId)
			if (scopedTokenId == null) return null
			if (scopedTokenId === 0n) {
				balanceCache.set(key, { liked: false, fetchedAt: Date.now() })
				return false
			}
			const { provider } = await providerForBeamioUserCard(card)
			const reader = new ethers.Contract(card, SCOPED_READ_ABI, provider)
			const bal = (await reader.balanceOf(user, scopedTokenId)) as bigint
			const liked = bal > 0n
			balanceCache.set(key, { liked, fetchedAt: Date.now() })
			return liked
		} catch {
			return null
		} finally {
			balanceInflight.delete(key)
		}
	})

	balanceInflight.set(key, task)
	return task
}

/** Sync local-first seed (no network); may be stale after on-chain unlike — refresh with resolveDiscoverUserHasLiked. */
export function readDiscoverUserLikedLocalSeed(
	userEOA: string,
	cardAddress: string,
	targetKind: number = DISCOVER_USER_LIKE_TARGET.MERCHANT_CARD,
	issuedParentId: string | number = '0',
): boolean | null {
	const cached = loadDiscoverUserLikeLocalCache(userEOA, cardAddress, targetKind, issuedParentId)
	return cached?.liked ?? null
}

/** Chain balanceOf(scoped like token) is source of truth when RPC succeeds. */
export async function resolveDiscoverUserHasLiked(
	cardAddress: string,
	userEOA: string,
	targetKind: number = DISCOVER_USER_LIKE_TARGET.MERCHANT_CARD,
	issuedParentId: string | number = '0',
): Promise<boolean | null> {
	invalidateDiscoverUserLikeBalanceCache(userEOA, cardAddress, targetKind, issuedParentId)
	const chain = await fetchUserHasLikedOnChain(cardAddress, userEOA, targetKind, issuedParentId)
	if (chain === true) {
		saveDiscoverUserLikeLocalCache(userEOA, cardAddress, targetKind, issuedParentId, true)
		return true
	}
	if (chain === false) {
		saveDiscoverUserLikeLocalCache(userEOA, cardAddress, targetKind, issuedParentId, false)
		return false
	}
	const cached = loadDiscoverUserLikeLocalCache(userEOA, cardAddress, targetKind, issuedParentId)
	return cached?.liked ?? null
}

export function invalidateDiscoverUserLikeBalanceCache(
	userEOA: string,
	cardAddress: string,
	targetKind: number,
	issuedParentId: string | number = '0',
): void {
	try {
		const eoaLower = ethers.getAddress(userEOA).toLowerCase()
		const cardLower = ethers.getAddress(cardAddress).toLowerCase()
		const parentId = String(issuedParentId ?? 0)
		balanceCache.delete(balanceCacheKey(eoaLower, cardLower, targetKind, parentId))
	} catch {
		// ignore
	}
}

const couponLikeCountCache = new Map<string, { value: number; fetchedAt: number }>()
const couponLikeCountInflight = new Map<string, Promise<number | null>>()
let couponLikeCountQueue: Promise<unknown> = Promise.resolve()

function couponLikeCountCacheKey(cardLower: string, tokenId: string): string {
	return `${cardLower}:coupon:${tokenId}`
}

function enqueueCouponLikeCount<T>(fn: () => Promise<T>): Promise<T> {
	const run = couponLikeCountQueue.then(fn, fn)
	couponLikeCountQueue = run.catch(() => undefined)
	return run
}

/** Aggregate coupon likes = totalSupply(scoped like stat token). */
export async function fetchCouponLikeCount(cardAddress: string, tokenId: string): Promise<number | null> {
	let card: string
	let tid: string
	try {
		card = ethers.getAddress(String(cardAddress ?? '').trim())
		tid = String(tokenId ?? '').trim()
		if (!tid) return null
	} catch {
		return null
	}
	const cardLower = card.toLowerCase()
	const key = couponLikeCountCacheKey(cardLower, tid)
	const hit = couponLikeCountCache.get(key)
	if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.value

	const pending = couponLikeCountInflight.get(key)
	if (pending) return pending

	const task = enqueueCouponLikeCount(async () => {
		try {
			const scopedTokenId = await resolveDiscoverUserLikeScopedTokenId(
				card,
				DISCOVER_USER_LIKE_TARGET.ISSUED_COUPON,
				tid,
			)
			if (scopedTokenId == null || scopedTokenId === 0n) return null
			const { provider } = await providerForBeamioUserCard(card)
			const reader = new ethers.Contract(card, ['function totalSupply(uint256 id) view returns (uint256)'], provider)
			const raw = (await reader.totalSupply(scopedTokenId)) as bigint
			const n = Number(raw)
			const value = Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
			couponLikeCountCache.set(key, { value, fetchedAt: Date.now() })
			return value
		} catch {
			return null
		} finally {
			couponLikeCountInflight.delete(key)
		}
	})

	couponLikeCountInflight.set(key, task)
	return task
}

export function invalidateCouponLikeCountCache(cardAddress: string, tokenId: string): void {
	try {
		const cardLower = ethers.getAddress(String(cardAddress ?? '').trim()).toLowerCase()
		const tid = String(tokenId ?? '').trim()
		if (!tid) return
		couponLikeCountCache.delete(couponLikeCountCacheKey(cardLower, tid))
	} catch {
		// ignore
	}
}
