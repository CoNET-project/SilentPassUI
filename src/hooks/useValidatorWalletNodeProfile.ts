import { useCallback, useEffect, useRef, useState } from 'react'
import {
	fetchValidatorWalletNodeProfile,
	type ValidatorWalletNodeProfile,
} from '@/services/validatorWalletNodeProfile'

const PROFILE_CACHE_TTL_MS = 30_000

type CacheEntry = {
	profile: ValidatorWalletNodeProfile
	fetchedAt: number
}

const profileCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<CacheEntry | null>>()

async function fetchProfileTrusted(walletLower: string): Promise<CacheEntry | null> {
	const cached = profileCache.get(walletLower)
	if (cached && Date.now() - cached.fetchedAt < PROFILE_CACHE_TTL_MS) {
		return cached
	}
	const existing = inflight.get(walletLower)
	if (existing) return existing

	const task = (async (): Promise<CacheEntry | null> => {
		const res = await fetchValidatorWalletNodeProfile(walletLower)
		if (!res.ok) return null
		const entry: CacheEntry = { profile: res.profile, fetchedAt: Date.now() }
		profileCache.set(walletLower, entry)
		return entry
	})().finally(() => {
		inflight.delete(walletLower)
	})

	inflight.set(walletLower, task)
	return task
}

export function invalidateValidatorWalletNodeProfileCache(walletLower?: string): void {
	if (walletLower) {
		profileCache.delete(walletLower.toLowerCase())
		inflight.delete(walletLower.toLowerCase())
		return
	}
	profileCache.clear()
	inflight.clear()
}

/** Daemon / EOA 切换：读取模块内可信缓存（不发起 RPC）。 */
export function peekValidatorWalletNodeProfileCache(
	walletLower: string
): ValidatorWalletNodeProfile | null {
	const hit = profileCache.get(walletLower.trim().toLowerCase())
	return hit?.profile ?? null
}

/** Daemon 喂料成功后写入模块缓存，供 hook 与详情页 refresh 共用。 */
export function seedValidatorWalletNodeProfileCache(
	walletLower: string,
	profile: ValidatorWalletNodeProfile
): void {
	profileCache.set(walletLower.trim().toLowerCase(), { profile, fetchedAt: Date.now() })
}

export type UseValidatorWalletNodeProfileState = {
	/** 可信链上档案；null = 尚未成功拉取且无缓存 */
	profile: ValidatorWalletNodeProfile | null
	loading: boolean
	/** 本轮拉取失败但展示的是上次可信值 */
	stale: boolean
	refresh: () => void
}

/**
 * 读取 EOA 的 CoNET 节点档案（验证节点数 / GB 挖矿节点数 / DePIN IP 一览 / GB·USDC·CNET 余额）。
 * RPC 失败不覆写上次可信值（见 beamio-trusted-vs-untrusted-fetch / onchain-kpi-chain-first）。
 */
export function useValidatorWalletNodeProfile(
	wallet: string | undefined
): UseValidatorWalletNodeProfileState {
	const walletLower = wallet?.trim().toLowerCase() ?? ''
	const [profile, setProfile] = useState<ValidatorWalletNodeProfile | null>(() => {
		if (!walletLower) return null
		const hit = profileCache.get(walletLower)
		return hit ? hit.profile : null
	})
	const [loading, setLoading] = useState(false)
	const [stale, setStale] = useState(false)
	const requestIdRef = useRef(0)
	const lastTrustedRef = useRef<ValidatorWalletNodeProfile | null>(profile)

	const run = useCallback(async () => {
		if (!walletLower) {
			setProfile(null)
			lastTrustedRef.current = null
			setLoading(false)
			setStale(false)
			return
		}
		const reqId = ++requestIdRef.current
		setLoading(true)
		const entry = await fetchProfileTrusted(walletLower)
		if (reqId !== requestIdRef.current) return
		setLoading(false)
		if (entry) {
			lastTrustedRef.current = entry.profile
			setProfile(entry.profile)
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
			profileCache.delete(walletLower)
		}
		void run()
	}, [walletLower, run])

	return { profile, loading, stale, refresh }
}
