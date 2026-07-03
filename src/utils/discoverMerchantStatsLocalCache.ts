/**
 * Discover Featured Brands 链上社交统计（点赞 / 转发点击）本地可信缓存。
 * 非 EOA 隔离 —— 同一商户卡对所有用户一致；首屏 local-first，daemon 后台刷新。
 */

export type DiscoverMerchantStatEntry = {
	likeCount?: number
	refClickCount?: number
	savedAt: number
}

export type DiscoverMerchantStatsMap = Record<string, DiscoverMerchantStatEntry>

type StoredPayload = {
	v: 1
	savedAt: number
	byCard: DiscoverMerchantStatsMap
}

const STORAGE_KEY = 'beamio:discoverMerchantStats:v1'
const MAX_STORE_CHARS = 500_000

export function loadDiscoverMerchantStatsLocalCache(): DiscoverMerchantStatsMap {
	if (typeof window === 'undefined') return {}
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw || raw.length > MAX_STORE_CHARS) return {}
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1 || typeof p.byCard !== 'object' || p.byCard === null) return {}
		return p.byCard
	} catch {
		return {}
	}
}

/** 合并写入单卡条目（仅可信成功字段）；保留未 patch 的维度。 */
export function saveDiscoverMerchantStatEntry(
	cardLower: string,
	patch: { likeCount?: number; refClickCount?: number },
): void {
	if (typeof window === 'undefined' || !cardLower) return
	try {
		const prev = loadDiscoverMerchantStatsLocalCache()
		const existing = prev[cardLower] ?? {}
		const next: DiscoverMerchantStatEntry = {
			...existing,
			...(patch.likeCount != null ? { likeCount: patch.likeCount } : {}),
			...(patch.refClickCount != null ? { refClickCount: patch.refClickCount } : {}),
			savedAt: Date.now(),
		}
		const byCard: DiscoverMerchantStatsMap = { ...prev, [cardLower]: next }
		const payload: StoredPayload = { v: 1, savedAt: Date.now(), byCard }
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(STORAGE_KEY, raw)
	} catch {
		/* quota / private mode */
	}
}

export function pickDiscoverMerchantLikeCount(
	map: DiscoverMerchantStatsMap,
	cardAddress: string | null | undefined,
): number | null {
	if (!cardAddress) return null
	const n = map[cardAddress.toLowerCase()]?.likeCount
	return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : null
}

export function pickDiscoverMerchantRefClickCount(
	map: DiscoverMerchantStatsMap,
	cardAddress: string | null | undefined,
): number | null {
	if (!cardAddress) return null
	const n = map[cardAddress.toLowerCase()]?.refClickCount
	return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : null
}

/** After like API success, chain totalSupply may lag briefly; do not clobber with 0 in this window. */
export const DISCOVER_MERCHANT_LIKE_OPTIMISTIC_MS = 120_000

/** Chain totalSupply vs local cache; keep recent optimistic bump when chain still reads 0. */
export function mergeDiscoverMerchantLikeCount(
	chainLike: number | null,
	cachedLike: number | undefined,
	cachedSavedAt?: number,
): number | undefined {
	if (chainLike == null) return cachedLike
	const chain = Math.max(0, Math.trunc(chainLike))
	if (cachedLike == null || !Number.isFinite(cachedLike)) return chain
	const cached = Math.max(0, Math.trunc(cachedLike))
	if (
		cached > chain &&
		cachedSavedAt != null &&
		Date.now() - cachedSavedAt < DISCOVER_MERCHANT_LIKE_OPTIMISTIC_MS
	) {
		return cached
	}
	return chain
}

/** Optimistic like count after trusted API success (before chain totalSupply catches up). */
export function bumpDiscoverMerchantLikeCountLocal(
	cardAddress: string,
	delta: number,
): number | null {
	if (typeof window === 'undefined' || !cardAddress || !Number.isFinite(delta) || delta === 0) return null
	try {
		const cardLower = String(cardAddress).trim().toLowerCase()
		if (!cardLower) return null
		const prev = loadDiscoverMerchantStatsLocalCache()
		const base = prev[cardLower]?.likeCount
		const next = Math.max(0, (typeof base === 'number' && Number.isFinite(base) ? base : 0) + Math.trunc(delta))
		saveDiscoverMerchantStatEntry(cardLower, { likeCount: next })
		return next
	} catch {
		return null
	}
}

export function mergeDiscoverMerchantRefClickCount(
	chainRef: number | null,
	dbRef: number | null,
	cachedRef?: number,
): number | undefined {
	const parts: number[] = []
	if (chainRef != null && Number.isFinite(chainRef)) parts.push(Math.max(0, Math.trunc(chainRef)))
	if (dbRef != null && Number.isFinite(dbRef)) parts.push(Math.max(0, Math.trunc(dbRef)))
	if (parts.length === 0) return cachedRef
	return Math.max(...parts, cachedRef ?? 0)
}
