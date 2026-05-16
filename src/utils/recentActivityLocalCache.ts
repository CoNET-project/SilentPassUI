/**
 * Recent Activity indexer 列表本地缓存（EOA 隔离）。
 * 仅在可信成功拉取后写入；首屏从本地恢复，后台刷新不闪 loading。
 */

import { ethers } from 'ethers'
import type { TxView } from '@/pages/History/recentActivityIndexerMerge'

/** 持久化不含 rawTransaction（避免 bigint / 体积）；列表展示足够，详情页再链上补全 */
export type RecentActivityCacheRow = Omit<TxView, 'rawTransaction'>

type StoredPayload = {
	v: 1
	eoa: string
	savedAt: number
	items: RecentActivityCacheRow[]
}

const PREFIX = 'beamio:recentActivity:v1:'
const MAX_STORE_CHARS = 2_000_000

function key(eoaLower: string): string {
	return `${PREFIX}${eoaLower}`
}

function stripForCache(items: TxView[]): RecentActivityCacheRow[] {
	return items.map(({ rawTransaction: _r, ...rest }) => rest)
}

export function loadRecentActivityLocalCache(eoaLower: string): RecentActivityCacheRow[] | null {
	if (typeof window === 'undefined' || !eoaLower) return null
	try {
		const raw = localStorage.getItem(key(eoaLower))
		if (!raw || raw.length > MAX_STORE_CHARS) return null
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1 || typeof p.eoa !== 'string' || p.eoa.toLowerCase() !== eoaLower) return null
		if (!Array.isArray(p.items)) return null
		return p.items as RecentActivityCacheRow[]
	} catch {
		return null
	}
}

export function saveRecentActivityLocalCache(eoaLower: string, items: TxView[]): void {
	if (typeof window === 'undefined' || !eoaLower || !ethers.isAddress(eoaLower)) return
	try {
		const payload: StoredPayload = {
			v: 1,
			eoa: eoaLower,
			savedAt: Date.now(),
			items: stripForCache(items),
		}
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(key(eoaLower), raw)
	} catch {
		/* quota / private mode */
	}
}

/** 从本地缓存行恢复为 TxView（无 rawTransaction） */
export function txViewsFromLocalCache(rows: RecentActivityCacheRow[]): TxView[] {
	return rows.map((row) => ({ ...row }))
}
