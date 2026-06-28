import { useCallback, useEffect, useRef, useState } from 'react'
import { probeValidatorDepositRedeemAdmin } from '@/services/validatorDepositRedeemAdmin'

const ADMIN_CACHE_TTL_MS = 30_000

type CacheEntry = {
	isRedeemAdmin: boolean
	isContractAdmin: boolean
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
		let probe = await probeValidatorDepositRedeemAdmin(eoaLower)
		if (!probe.ok) {
			await new Promise((r) => setTimeout(r, 800))
			probe = await probeValidatorDepositRedeemAdmin(eoaLower)
		}
		if (!probe.ok) return null
		const entry: CacheEntry = {
			isRedeemAdmin: probe.isRedeemAdmin,
			isContractAdmin: probe.isContractAdmin,
			fetchedAt: Date.now(),
		}
		if (entry.isRedeemAdmin || entry.isContractAdmin) {
			adminCache.set(eoaLower, entry)
		} else {
			adminCache.delete(eoaLower)
		}
		return entry
	})().finally(() => {
		inflight.delete(eoaLower)
	})

	inflight.set(eoaLower, task)
	return task
}

export function invalidateValidatorDepositRedeemAdminCache(eoaLower?: string): void {
	if (eoaLower) {
		adminCache.delete(eoaLower.toLowerCase())
		inflight.delete(eoaLower.toLowerCase())
		return
	}
	adminCache.clear()
	inflight.clear()
}

export type UseValidatorDepositRedeemAdminState = {
	isRedeemAdmin: boolean | null
	isContractAdmin: boolean | null
	/** Show redeem admin tools when redeem admin (create/cancel) or contract admin. */
	canManageRedeems: boolean | null
	loading: boolean
	stale: boolean
	refresh: () => void
}

export function useValidatorDepositRedeemAdmin(eoa: string | undefined): UseValidatorDepositRedeemAdminState {
	const eoaLower = eoa?.trim().toLowerCase() ?? ''
	const eoaLowerRef = useRef(eoaLower)
	eoaLowerRef.current = eoaLower

	const [isRedeemAdmin, setIsRedeemAdmin] = useState<boolean | null>(() => {
		if (!eoaLower) return null
		const hit = adminCache.get(eoaLower)
		return hit ? hit.isRedeemAdmin : null
	})
	const [isContractAdmin, setIsContractAdmin] = useState<boolean | null>(() => {
		if (!eoaLower) return null
		const hit = adminCache.get(eoaLower)
		return hit ? hit.isContractAdmin : null
	})
	const [loading, setLoading] = useState(false)
	const [stale, setStale] = useState(false)
	const lastTrustedRef = useRef<{ redeem: boolean | null; contract: boolean | null }>({
		redeem: isRedeemAdmin,
		contract: isContractAdmin,
	})

	const run = useCallback(async () => {
		const probeEoa = eoaLowerRef.current
		if (!probeEoa) {
			setIsRedeemAdmin(null)
			setIsContractAdmin(null)
			lastTrustedRef.current = { redeem: null, contract: null }
			setLoading(false)
			setStale(false)
			return
		}
		setLoading(true)
		const entry = await fetchAdminTrusted(probeEoa)
		if (probeEoa !== eoaLowerRef.current) return
		setLoading(false)
		if (entry) {
			lastTrustedRef.current = { redeem: entry.isRedeemAdmin, contract: entry.isContractAdmin }
			setIsRedeemAdmin(entry.isRedeemAdmin)
			setIsContractAdmin(entry.isContractAdmin)
			setStale(false)
		} else {
			setStale(lastTrustedRef.current.redeem !== null || lastTrustedRef.current.contract !== null)
		}
	}, [])

	useEffect(() => {
		void run()
	}, [eoaLower, run])

	const refresh = useCallback(() => {
		const probeEoa = eoaLowerRef.current
		if (probeEoa) {
			adminCache.delete(probeEoa)
			inflight.delete(probeEoa)
		}
		void run()
	}, [run])

	const canManageRedeems =
		isRedeemAdmin === null && isContractAdmin === null
			? null
			: Boolean(isRedeemAdmin || isContractAdmin)

	return { isRedeemAdmin, isContractAdmin, canManageRedeems, loading, stale, refresh }
}
