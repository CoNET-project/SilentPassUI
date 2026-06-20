import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'

/** 由 `GET /api/excludedUserCards` 填充；客户端不维护静态地址表。 */
let cachedExcluded: ReadonlySet<string> | null = null
let loadInFlight: Promise<ReadonlySet<string>> | null = null

export function normalizeUserCardAddressLower(raw: unknown): string | null {
	if (raw == null || typeof raw !== 'string') return null
	const t = raw.trim()
	if (!t || !ethers.isAddress(t)) return null
	return ethers.getAddress(t).toLowerCase()
}

/**
 * 拉取服务端 filter list。失败时保留上次可信缓存，不写入空集（trusted-fetch 守则）。
 */
export async function loadApiExcludedUserCards(force = false): Promise<ReadonlySet<string>> {
	if (!force && cachedExcluded) return cachedExcluded
	if (!force && loadInFlight) return loadInFlight

	loadInFlight = (async () => {
		try {
			const res = await fetch(`${beamioApi}/api/excludedUserCards`, {
				method: 'GET',
				headers: { Accept: 'application/json' },
			})
			if (!res.ok) throw new Error(`excludedUserCards HTTP ${res.status}`)
			const json = (await res.json().catch(() => null)) as { ok?: boolean; addresses?: unknown } | null
			if (!json || json.ok !== true || !Array.isArray(json.addresses)) {
				throw new Error('excludedUserCards invalid body')
			}
			const next = new Set<string>()
			for (const raw of json.addresses) {
				const lower = normalizeUserCardAddressLower(raw)
				if (lower) next.add(lower)
			}
			if (next.size > 0) cachedExcluded = next
		} catch {
			/* 不可信：不覆盖 cachedExcluded */
		} finally {
			loadInFlight = null
		}
		return cachedExcluded ?? new Set<string>()
	})()

	return loadInFlight
}

export function peekApiExcludedUserCards(): ReadonlySet<string> | null {
	return cachedExcluded
}

/** filter list 未加载前返回 false（展示依赖各业务 API 已过滤的列表）。 */
export function isApiExcludedUserCard(raw: unknown): boolean {
	const lower = normalizeUserCardAddressLower(raw)
	if (!lower || !cachedExcluded) return false
	return cachedExcluded.has(lower)
}

/** 从按 cardAddress key 索引的 map 中移除 blacklist 卡（My Brands details / Wallet 资产表）。 */
export function filterExcludedCardDetailKeys<T extends Record<string, unknown>>(details: T): T {
	if (!cachedExcluded || cachedExcluded.size === 0) return details
	const next = {} as T
	for (const [k, v] of Object.entries(details)) {
		const lower = normalizeUserCardAddressLower(k) ?? k.toLowerCase()
		if (cachedExcluded.has(lower)) continue
		;(next as Record<string, unknown>)[k] = v
	}
	return next
}

export function filterExcludedCardAddresses(addresses: string[]): string[] {
	return addresses.filter((a) => !isApiExcludedUserCard(a))
}
