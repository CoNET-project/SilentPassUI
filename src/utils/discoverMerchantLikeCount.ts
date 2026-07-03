import { ethers } from 'ethers'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'

/**
 * UserCumulativeStatLib L1 merchant-card stats (TARGET_MERCHANT_CARD_COUPON).
 * Aggregate = ERC-1155 totalSupply(tokenId) after recordUserCumulativeStat.
 */
export const DISCOVER_MERCHANT_CARD_LIKE_TOKEN_ID = 19n
/** Referral / share link click metric (METRIC_REF_CLICK @ L1). */
export const DISCOVER_MERCHANT_CARD_REF_CLICK_TOKEN_ID = 21n

const READ_ABI = ['function totalSupply(uint256 id) view returns (uint256)'] as const

const CACHE_TTL_MS = 30_000
const cache = new Map<string, { value: number; fetchedAt: number }>()
const inflight = new Map<string, Promise<number | null>>()
let queue: Promise<unknown> = Promise.resolve()

function cacheKey(cardLower: string, tokenId: bigint): string {
	return `${cardLower}:${tokenId.toString()}`
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
	const run = queue.then(fn, fn)
	queue = run.catch(() => undefined)
	return run
}

/** Trusted success → number (incl. 0); RPC/parse failure → null (do not overwrite UI with 0). */
export async function fetchDiscoverMerchantStatCount(
	cardAddress: string,
	tokenId: bigint,
): Promise<number | null> {
	let addr: string
	try {
		addr = ethers.getAddress(String(cardAddress ?? '').trim())
	} catch {
		return null
	}
	const cardLower = addr.toLowerCase()
	const key = cacheKey(cardLower, tokenId)
	const hit = cache.get(key)
	if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.value

	const pending = inflight.get(key)
	if (pending) return pending

	const task = enqueue(async () => {
		try {
			const { provider } = await providerForBeamioUserCard(addr)
			const c = new ethers.Contract(addr, READ_ABI, provider)
			const raw = (await c.totalSupply(tokenId)) as bigint
			const n = Number(raw)
			const value = Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
			cache.set(key, { value, fetchedAt: Date.now() })
			return value
		} catch {
			return null
		} finally {
			inflight.delete(key)
		}
	})

	inflight.set(key, task)
	return task
}

export function fetchDiscoverMerchantLikeCount(cardAddress: string): Promise<number | null> {
	return fetchDiscoverMerchantStatCount(cardAddress, DISCOVER_MERCHANT_CARD_LIKE_TOKEN_ID)
}

export function fetchDiscoverMerchantRefClickCount(cardAddress: string): Promise<number | null> {
	return fetchDiscoverMerchantStatCount(cardAddress, DISCOVER_MERCHANT_CARD_REF_CLICK_TOKEN_ID)
}

const BEAMIO_CARD_PROGRAM_SOCIAL_API = 'https://beamio.app/api/cardProgramSocial'

/** Trusted API success → dbShareClickTotal (recorded going forward list); failure → null. */
export async function fetchDiscoverMerchantDbShareClickTotal(cardAddress: string): Promise<number | null> {
	let addr: string
	try {
		addr = ethers.getAddress(String(cardAddress ?? '').trim())
	} catch {
		return null
	}
	try {
		const url = `${BEAMIO_CARD_PROGRAM_SOCIAL_API}?${new URLSearchParams({
			cardAddress: addr,
			mode: 'summary',
			limit: '1',
		})}`
		const res = await fetch(url)
		if (!res.ok) return null
		const json = (await res.json()) as { dbShareClickTotal?: unknown; shareClickCount?: unknown }
		const raw = json.dbShareClickTotal ?? json.shareClickCount
		const n = Number(raw)
		return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
	} catch {
		return null
	}
}

/** Drop cached aggregate stat after like/unlike so the next feed tick refetches. */
export function invalidateDiscoverMerchantStatCache(cardAddress: string, tokenId: bigint = DISCOVER_MERCHANT_CARD_LIKE_TOKEN_ID): void {
	try {
		const cardLower = ethers.getAddress(String(cardAddress ?? '').trim()).toLowerCase()
		cache.delete(cacheKey(cardLower, tokenId))
	} catch {
		// ignore invalid address
	}
}

export function formatDiscoverLikeCount(n: number): string {
	return formatDiscoverStatCount(n)
}

export function formatDiscoverStatCount(n: number): string {
	if (!Number.isFinite(n) || n < 0) return '0'
	if (n >= 1_000_000) {
		const v = n / 1_000_000
		return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')}M`
	}
	if (n >= 10_000) return `${Math.round(n / 1000)}k`
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
	return String(Math.trunc(n))
}
