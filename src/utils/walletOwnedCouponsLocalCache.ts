/**
 * /wallet Active Vouchers 列表本地缓存（EOA 隔离）。
 * 仅在可信成功合并后写入；首屏从本地恢复，后台刷新不闪 loading。
 */

import { ethers } from 'ethers'

export type WalletOwnedCouponCacheRow = {
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

type StoredPayload = {
	v: 1
	eoa: string
	savedAt: number
	items: WalletOwnedCouponCacheRow[]
}

const PREFIX = 'beamio:walletOwnedCoupons:v1:'
const MAX_STORE_CHARS = 1_500_000

function key(eoaLower: string): string {
	return `${PREFIX}${eoaLower}`
}

export function loadWalletOwnedCouponsLocalCache(eoaLower: string): WalletOwnedCouponCacheRow[] | null {
	if (typeof window === 'undefined' || !eoaLower) return null
	try {
		const raw = localStorage.getItem(key(eoaLower))
		if (!raw || raw.length > MAX_STORE_CHARS) return null
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1 || typeof p.eoa !== 'string' || p.eoa.toLowerCase() !== eoaLower) return null
		if (!Array.isArray(p.items)) return null
		return p.items as WalletOwnedCouponCacheRow[]
	} catch {
		return null
	}
}

export function saveWalletOwnedCouponsLocalCache(
	eoaLower: string,
	items: WalletOwnedCouponCacheRow[]
): void {
	if (typeof window === 'undefined' || !eoaLower || !ethers.isAddress(eoaLower)) return
	try {
		const payload: StoredPayload = {
			v: 1,
			eoa: eoaLower,
			savedAt: Date.now(),
			items,
		}
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(key(eoaLower), raw)
	} catch {
		/* quota / private mode */
	}
}

export function walletOwnedCouponsSignature(items: WalletOwnedCouponCacheRow[]): string {
	return items
		.map((i) => `${i.id}:${i.validBeforeSec ?? ''}:${i.title}`)
		.join('|')
}
