import {
	fetchReferrerDashboard,
	type ReferrerDashboardSummary,
} from '@/services/validatorWalletNodeProfile'

const REFERRER_CACHE_TTL_MS = 30_000

type CacheEntry = {
	summary: ReferrerDashboardSummary
	fetchedAt: number
}

const referrerCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<CacheEntry | null>>()

async function fetchReferrerTrusted(walletLower: string): Promise<CacheEntry | null> {
	const cached = referrerCache.get(walletLower)
	if (cached && Date.now() - cached.fetchedAt < REFERRER_CACHE_TTL_MS) {
		return cached
	}
	const existing = inflight.get(walletLower)
	if (existing) return existing

	const task = (async (): Promise<CacheEntry | null> => {
		const res = await fetchReferrerDashboard(walletLower, { offset: 0, limit: 1 })
		if (!res.ok) return null
		const entry: CacheEntry = { summary: res.summary, fetchedAt: Date.now() }
		referrerCache.set(walletLower, entry)
		return entry
	})().finally(() => {
		inflight.delete(walletLower)
	})

	inflight.set(walletLower, task)
	return task
}

export function invalidateReferrerSummaryCache(walletLower?: string): void {
	if (walletLower) {
		referrerCache.delete(walletLower.toLowerCase())
		inflight.delete(walletLower.toLowerCase())
		return
	}
	referrerCache.clear()
	inflight.clear()
}

/** Daemon / EOA 切换：读取模块内可信缓存（不发起 RPC）。 */
export function peekReferrerSummaryCache(walletLower: string): ReferrerDashboardSummary | null {
	const hit = referrerCache.get(walletLower.trim().toLowerCase())
	return hit?.summary ?? null
}

/** Daemon 喂料成功后写入模块缓存。 */
export function seedReferrerSummaryCache(walletLower: string, summary: ReferrerDashboardSummary): void {
	referrerCache.set(walletLower.trim().toLowerCase(), { summary, fetchedAt: Date.now() })
}

/** Daemon 后台喂料用：拉取受益人推荐进度（trusted-only），供 DaemonProvider 调用。 */
export async function fetchReferrerSummaryForDaemon(
	walletLower: string,
): Promise<ReferrerDashboardSummary | null> {
	const entry = await fetchReferrerTrusted(walletLower).catch(() => null)
	return entry?.summary ?? null
}
