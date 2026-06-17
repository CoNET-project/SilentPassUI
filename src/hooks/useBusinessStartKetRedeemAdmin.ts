import { useCallback, useEffect, useRef, useState } from 'react'
import { probeBusinessStartKetRedeemAdmin } from '@/services/businessStartKetRedeem'

const ADMIN_CACHE_TTL_MS = 30_000

type CacheEntry = {
	isAdmin: boolean
	fetchedAt: number
}

const adminCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<CacheEntry | null>>()

async function fetchAdminTrusted(eoaLower: string): Promise<CacheEntry | null> {
	const cached = adminCache.get(eoaLower)
	if (cached && Date.now() - cached.fetchedAt < ADMIN_CACHE_TTL_MS) {
		return cached
	}
	const existing = inflight.get(eoaLower)
	if (existing) return existing

	const task = (async (): Promise<CacheEntry | null> => {
		const probe = await probeBusinessStartKetRedeemAdmin(eoaLower)
		if (!probe.ok) return null
		const entry: CacheEntry = { isAdmin: probe.isAdmin, fetchedAt: Date.now() }
		adminCache.set(eoaLower, entry)
		return entry
	})().finally(() => {
		inflight.delete(eoaLower)
	})

	inflight.set(eoaLower, task)
	return task
}

export function invalidateBusinessStartKetRedeemAdminCache(eoaLower?: string): void {
	if (eoaLower) {
		adminCache.delete(eoaLower.toLowerCase())
		inflight.delete(eoaLower.toLowerCase())
		return
	}
	adminCache.clear()
	inflight.clear()
}

export type UseBusinessStartKetRedeemAdminState = {
	/** 可信链上结论；null = 尚未成功拉取且无缓存 */
	isRedeemAdmin: boolean | null
	loading: boolean
	stale: boolean
	refresh: () => void
}

/**
 * 仅当 CoNET BusinessStartKetRedeem.redeemAdmins(EOA) 为 true 时 isRedeemAdmin === true。
 * RPC 失败不覆写上次可信值（见 beamio-trusted-vs-untrusted-fetch）。
 */
export function useBusinessStartKetRedeemAdmin(eoa: string | undefined): UseBusinessStartKetRedeemAdminState {
	const eoaLower = eoa?.trim().toLowerCase() ?? ''
	const [isRedeemAdmin, setIsRedeemAdmin] = useState<boolean | null>(() => {
		if (!eoaLower) return null
		const hit = adminCache.get(eoaLower)
		return hit ? hit.isAdmin : null
	})
	const [loading, setLoading] = useState(false)
	const [stale, setStale] = useState(false)
	const requestIdRef = useRef(0)
	const lastTrustedRef = useRef<boolean | null>(isRedeemAdmin)

	const run = useCallback(async () => {
		if (!eoaLower) {
			setIsRedeemAdmin(null)
			lastTrustedRef.current = null
			setLoading(false)
			setStale(false)
			return
		}
		const reqId = ++requestIdRef.current
		setLoading(true)
		const entry = await fetchAdminTrusted(eoaLower)
		if (reqId !== requestIdRef.current) return
		setLoading(false)
		if (entry) {
			lastTrustedRef.current = entry.isAdmin
			setIsRedeemAdmin(entry.isAdmin)
			setStale(false)
		} else {
			setStale(lastTrustedRef.current !== null)
		}
	}, [eoaLower])

	useEffect(() => {
		void run()
	}, [run])

	const refresh = useCallback(() => {
		if (eoaLower) {
			adminCache.delete(eoaLower)
		}
		void run()
	}, [eoaLower, run])

	return { isRedeemAdmin, loading, stale, refresh }
}
