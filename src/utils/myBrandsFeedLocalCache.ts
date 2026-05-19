/**
 * My Brands 列表 + 每卡 meta/assets 的本地可信缓存（EOA 隔离）。
 * 仅在成功拉取后写入；首屏从本地恢复，与 beamio-ai-onchain-fetch / Trusted Cache 一致。
 */

import { ethers } from 'ethers'
import type { UserCardInfo } from '@/services/BeamioCard'
import type { CardMetadataFromUri } from '@/services/BeamioCard'

export type MyBrandsOwnedCouponSnapshot = {
	id: string
	cardAddress: string
	tokenId: string
	couponId: string
	title: string
	subtitle: string
	iconUrl: string
	backgroundImage: string
	backgroundColorHex: string
	validBeforeSec: number | null
}

export type MyBrandsFeedDetailsSnapshot = Record<
	string,
	{
		meta: CardMetadataFromUri | null
		assets: MyCardAssets | null
		claimableCoupons?: { count: number; firstTitle?: string; firstCoupon?: MyBrandsOwnedCouponSnapshot | null } | null
	}
>

type StoredPayload = {
	v: 2
	eoa: string
	savedAt: number
	ownerCards: UserCardInfo[]
	holderUnionCards: UserCardInfo[]
	details: MyBrandsFeedDetailsSnapshot
}

const PREFIX = 'beamio:myBrandsFeed:v1:'
const MAX_STORE_CHARS = 4_000_000

function key(eoaLower: string): string {
	return `${PREFIX}${eoaLower}`
}

function mergeUniqueCards(ownerCards: UserCardInfo[], holderUnionCards: UserCardInfo[]): UserCardInfo[] {
	const out: UserCardInfo[] = []
	const seen = new Set<string>()
	for (const card of [...ownerCards, ...holderUnionCards]) {
		const k = (card?.cardAddress || '').toLowerCase()
		if (!k || seen.has(k)) continue
		seen.add(k)
		out.push(card)
	}
	return out
}

export function loadMyBrandsFeedLocalCache(
	eoaLower: string
): { cards: UserCardInfo[]; ownerCards: UserCardInfo[]; holderUnionCards: UserCardInfo[]; details: MyBrandsFeedDetailsSnapshot } | null {
	if (typeof window === 'undefined' || !eoaLower) return null
	try {
		const raw = localStorage.getItem(key(eoaLower))
		if (!raw || raw.length > MAX_STORE_CHARS) return null
		const p = JSON.parse(raw) as StoredPayload | { v: 1; eoa: string; savedAt: number; cards: UserCardInfo[]; details: MyBrandsFeedDetailsSnapshot }
		if (typeof p?.eoa !== 'string' || p.eoa.toLowerCase() !== eoaLower) return null
		if (typeof p.details !== 'object' || p.details === null) return null
		if (p.v === 1) {
			const cards = Array.isArray(p.cards) ? (p.cards as UserCardInfo[]) : []
			return {
				cards,
				ownerCards: cards,
				holderUnionCards: [],
				details: p.details as MyBrandsFeedDetailsSnapshot,
			}
		}
		if (!Array.isArray(p.ownerCards) || !Array.isArray(p.holderUnionCards)) return null
		return {
			cards: mergeUniqueCards(p.ownerCards as UserCardInfo[], p.holderUnionCards as UserCardInfo[]),
			ownerCards: p.ownerCards as UserCardInfo[],
			holderUnionCards: p.holderUnionCards as UserCardInfo[],
			details: p.details as MyBrandsFeedDetailsSnapshot,
		}
	} catch {
		return null
	}
}

export function saveMyBrandsFeedLocalCache(
	eoaLower: string,
	ownerCards: UserCardInfo[],
	holderUnionCards: UserCardInfo[],
	details: MyBrandsFeedDetailsSnapshot
): void {
	if (typeof window === 'undefined' || !eoaLower || !ethers.isAddress(eoaLower)) return
	try {
		const payload: StoredPayload = {
			v: 2,
			eoa: eoaLower,
			savedAt: Date.now(),
			ownerCards,
			holderUnionCards,
			details,
		}
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(key(eoaLower), raw)
	} catch {
		/* quota / private mode */
	}
}
