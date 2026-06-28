import { useCallback, useEffect, useRef, useState } from 'react'
import {
	fetchUnifiedIncomeStats,
	type UnifiedIncomeStats,
} from '@/services/validatorWalletNodeProfile'

const INCOME_CACHE_TTL_MS = 30_000

type CacheEntry = {
	stats: UnifiedIncomeStats
	fetchedAt: number
}

const incomeCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<CacheEntry | null>>()

async function fetchIncomeTrusted(walletLower: string): Promise<CacheEntry | null> {
	const cached = incomeCache.get(walletLower)
	if (cached && Date.now() - cached.fetchedAt < INCOME_CACHE_TTL_MS) {
		return cached
	}
	const existing = inflight.get(walletLower)
	if (existing) return existing

	const task = (async (): Promise<CacheEntry | null> => {
		const res = await fetchUnifiedIncomeStats(walletLower, 0)
		if (!res.ok) return null
		const entry: CacheEntry = { stats: res.stats, fetchedAt: Date.now() }
		incomeCache.set(walletLower, entry)
		return entry
	})().finally(() => {
		inflight.delete(walletLower)
	})

	inflight.set(walletLower, task)
	return task
}

export function invalidateUnifiedIncomeStatsCache(walletLower?: string): void {
	if (walletLower) {
		incomeCache.delete(walletLower.toLowerCase())
		inflight.delete(walletLower.toLowerCase())
		return
	}
	incomeCache.clear()
	inflight.clear()
}

export type UseUnifiedIncomeStatsState = {
	stats: UnifiedIncomeStats | null
	loading: boolean
	stale: boolean
	refresh: () => void
}

/** 受益人 GB/CNET 收入（resolveUnifiedIncomeStats）；失败不覆写上次可信值。 */
export function useUnifiedIncomeStats(wallet: string | undefined): UseUnifiedIncomeStatsState {
	const walletLower = wallet?.trim().toLowerCase() ?? ''
	const [stats, setStats] = useState<UnifiedIncomeStats | null>(() => {
		if (!walletLower) return null
		const hit = incomeCache.get(walletLower)
		return hit ? hit.stats : null
	})
	const [loading, setLoading] = useState(false)
	const [stale, setStale] = useState(false)
	const requestIdRef = useRef(0)
	const lastTrustedRef = useRef<UnifiedIncomeStats | null>(stats)

	const run = useCallback(async () => {
		if (!walletLower) {
			setStats(null)
			lastTrustedRef.current = null
			setLoading(false)
			setStale(false)
			return
		}
		const reqId = ++requestIdRef.current
		setLoading(true)
		const entry = await fetchIncomeTrusted(walletLower)
		if (reqId !== requestIdRef.current) return
		setLoading(false)
		if (entry) {
			lastTrustedRef.current = entry.stats
			setStats(entry.stats)
			setStale(false)
		} else {
			setStale(lastTrustedRef.current !== null)
		}
	}, [walletLower])

	useEffect(() => {
		void run()
	}, [run])

	const refresh = useCallback(() => {
		if (walletLower) {
			incomeCache.delete(walletLower)
		}
		void run()
	}, [walletLower, run])

	return { stats, loading, stale, refresh }
}
