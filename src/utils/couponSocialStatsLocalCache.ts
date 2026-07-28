/**
 * Coupon social + supply stats — card:tokenId keyed local store (not EOA-scoped).
 * Aggregate likes / share clicks / TOTAL·LEFT are the same for all viewers.
 * Daemon hydrates from here and refreshes via chain; UI must read DaemonProvider map.
 */

export type CouponSocialStatEntry = {
	likeCount?: number
	shareClickCount?: number
	/** Issued max supply as decimal string; omit/undefined when unknown; null = unlimited (max=0). */
	maxSupply?: string | null
	/** Remaining supply as decimal string; omit when unknown. */
	remainingSupply?: string | null
	savedAt: number
}

export type CouponSocialStatsMap = Record<string, CouponSocialStatEntry>

type StoredPayload = {
	v: 1
	savedAt: number
	byKey: CouponSocialStatsMap
}

const STORAGE_KEY = 'beamio:couponSocialStats:v1'
const MAX_STORE_CHARS = 800_000
const MAX_ENTRIES = 3_000

/** Same key shape as open-claim: `{cardLower}:{tokenId}` */
export function buildCouponSocialStatKey(
	cardAddress: string | null | undefined,
	tokenId: string | number | bigint | null | undefined,
): string | null {
	try {
		const card = String(cardAddress ?? '')
			.trim()
			.toLowerCase()
		if (!card || !/^0x[a-f0-9]{40}$/.test(card)) return null
		const tid = BigInt(String(tokenId ?? '').trim()).toString()
		return `${card}:${tid}`
	} catch {
		return null
	}
}

export function loadCouponSocialStatsLocalCache(): CouponSocialStatsMap {
	if (typeof window === 'undefined') return {}
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw || raw.length > MAX_STORE_CHARS) return {}
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1 || typeof p.byKey !== 'object' || p.byKey === null) return {}
		return p.byKey
	} catch {
		return {}
	}
}

function persistMap(byKey: CouponSocialStatsMap): void {
	if (typeof window === 'undefined') return
	try {
		let next = byKey
		const keys = Object.keys(next)
		if (keys.length > MAX_ENTRIES) {
			const sorted = keys
				.map((k) => ({ k, t: next[k]?.savedAt ?? 0 }))
				.sort((a, b) => b.t - a.t)
				.slice(0, MAX_ENTRIES)
			next = {}
			for (const { k } of sorted) {
				const e = byKey[k]
				if (e) next[k] = e
			}
		}
		const payload: StoredPayload = { v: 1, savedAt: Date.now(), byKey: next }
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(STORAGE_KEY, raw)
	} catch {
		/* quota */
	}
}

/** Merge trusted fields only; never clear existing dims with missing patch fields. */
export function saveCouponSocialStatEntry(
	cardAddress: string,
	tokenId: string | number | bigint,
	patch: {
		likeCount?: number
		shareClickCount?: number
		maxSupply?: string | null
		remainingSupply?: string | null
	},
): CouponSocialStatEntry | null {
	const k = buildCouponSocialStatKey(cardAddress, tokenId)
	if (!k) return null
	const prev = loadCouponSocialStatsLocalCache()
	const existing = prev[k] ?? { savedAt: 0 }
	const next: CouponSocialStatEntry = {
		...existing,
		...(patch.likeCount != null ? { likeCount: Math.trunc(patch.likeCount) } : {}),
		...(patch.shareClickCount != null ? { shareClickCount: Math.trunc(patch.shareClickCount) } : {}),
		...(patch.maxSupply !== undefined ? { maxSupply: patch.maxSupply } : {}),
		...(patch.remainingSupply !== undefined ? { remainingSupply: patch.remainingSupply } : {}),
		savedAt: Date.now(),
	}
	persistMap({ ...prev, [k]: next })
	return next
}

export function pickCouponSocialStatFromMap(
	map: CouponSocialStatsMap,
	cardAddress: string | null | undefined,
	tokenId: string | number | bigint | null | undefined,
): CouponSocialStatEntry | null {
	const k = buildCouponSocialStatKey(cardAddress, tokenId)
	if (!k) return null
	return map[k] ?? null
}

export function formatCouponSupplySummaryFromStat(
	entry: CouponSocialStatEntry | null | undefined,
): string | null {
	if (!entry) return null
	const total =
		entry.maxSupply === null
			? null
			: typeof entry.maxSupply === 'string'
				? entry.maxSupply.replace(/,/g, '').trim()
				: ''
	const remaining =
		typeof entry.remainingSupply === 'string' ? entry.remainingSupply.replace(/,/g, '').trim() : ''
	if (entry.maxSupply === null) {
		// Unlimited mint
		return remaining ? `LEFT ${remaining}` : null
	}
	if (total && remaining) return `TOTAL ${total} · LEFT ${remaining}`
	if (total) return `TOTAL ${total} · LEFT --`
	if (remaining) return `LEFT ${remaining}`
	return null
}

/** After like API success, chain totalSupply may lag; keep optimistic bump briefly. */
export const COUPON_SOCIAL_LIKE_OPTIMISTIC_MS = 120_000

export function mergeCouponSocialLikeCount(
	chain: number | null | undefined,
	previous: number | null | undefined,
	previousSavedAt?: number,
): number | null {
	if (typeof chain === 'number' && Number.isFinite(chain) && chain >= 0) {
		const c = Math.trunc(chain)
		if (
			typeof previous === 'number' &&
			previous > c &&
			typeof previousSavedAt === 'number' &&
			Date.now() - previousSavedAt < COUPON_SOCIAL_LIKE_OPTIMISTIC_MS
		) {
			return previous
		}
		return c
	}
	return typeof previous === 'number' && Number.isFinite(previous) ? Math.trunc(previous) : null
}
