/**
 * My Brands 列表 + 每卡 meta/assets 的本地可信缓存（EOA 隔离）。
 * 仅在成功拉取后写入；首屏从本地恢复，与 beamio-ai-onchain-fetch / Trusted Cache 一致。
 */

import { ethers } from 'ethers'
import type { UserCardInfo } from '@/services/BeamioCard'
import type { CardMetadataFromUri } from '@/services/BeamioCard'

export type MyBrandsFeedDetailsSnapshot = Record<
	string,
	{ meta: CardMetadataFromUri | null; assets: MyCardAssets | null }
>

type StoredPayload = {
	v: 1
	eoa: string
	savedAt: number
	cards: UserCardInfo[]
	details: MyBrandsFeedDetailsSnapshot
}

const PREFIX = 'beamio:myBrandsFeed:v1:'
const MAX_STORE_CHARS = 4_000_000

function key(eoaLower: string): string {
	return `${PREFIX}${eoaLower}`
}

export function loadMyBrandsFeedLocalCache(eoaLower: string): { cards: UserCardInfo[]; details: MyBrandsFeedDetailsSnapshot } | null {
	if (typeof window === 'undefined' || !eoaLower) return null
	try {
		const raw = localStorage.getItem(key(eoaLower))
		if (!raw || raw.length > MAX_STORE_CHARS) return null
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1 || typeof p.eoa !== 'string' || p.eoa.toLowerCase() !== eoaLower) return null
		if (!Array.isArray(p.cards) || typeof p.details !== 'object' || p.details === null) return null
		return { cards: p.cards as UserCardInfo[], details: p.details as MyBrandsFeedDetailsSnapshot }
	} catch {
		return null
	}
}

export function saveMyBrandsFeedLocalCache(
	eoaLower: string,
	cards: UserCardInfo[],
	details: MyBrandsFeedDetailsSnapshot
): void {
	if (typeof window === 'undefined' || !eoaLower || !ethers.isAddress(eoaLower)) return
	try {
		const payload: StoredPayload = {
			v: 1,
			eoa: eoaLower,
			savedAt: Date.now(),
			cards,
			details,
		}
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(key(eoaLower), raw)
	} catch {
		/* quota / private mode */
	}
}
