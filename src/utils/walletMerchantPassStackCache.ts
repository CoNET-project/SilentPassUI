/**
 * /wallet Merchant Passes 叠卡顺序（EOA 隔离）。
 * 固定顺序，避免按余额排序导致每轮 daemon 刷新时卡片换位抖动。
 */

import { ethers } from 'ethers'

type StoredPayload = {
	v: 1
	eoa: string
	savedAt: number
	order: string[]
}

const PREFIX = 'beamio:walletMerchantPassStack:v1:'

function key(eoaLower: string): string {
	return `${PREFIX}${eoaLower}`
}

export function loadWalletMerchantPassStackOrder(eoaLower: string): string[] | null {
	if (typeof window === 'undefined' || !eoaLower) return null
	try {
		const raw = localStorage.getItem(key(eoaLower))
		if (!raw) return null
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1 || p.eoa?.toLowerCase() !== eoaLower || !Array.isArray(p.order)) return null
		return p.order.map((a) => String(a).toLowerCase()).filter((a) => ethers.isAddress(a))
	} catch {
		return null
	}
}

export function saveWalletMerchantPassStackOrder(eoaLower: string, order: string[]): void {
	if (typeof window === 'undefined' || !eoaLower || !ethers.isAddress(eoaLower)) return
	try {
		const payload: StoredPayload = {
			v: 1,
			eoa: eoaLower,
			savedAt: Date.now(),
			order: order.map((a) => a.toLowerCase()),
		}
		localStorage.setItem(key(eoaLower), JSON.stringify(payload))
	} catch {
		/* quota */
	}
}

/** 合并新卡到末尾，移除已不存在的地址，不改变既有相对顺序 */
export function mergeWalletMerchantPassStackOrder(prev: string[], cardAddresses: string[]): string[] {
	const live = new Set(cardAddresses.map((a) => a.toLowerCase()))
	const next = prev.filter((a) => live.has(a))
	for (const a of cardAddresses) {
		const lower = a.toLowerCase()
		if (!next.includes(lower)) next.push(lower)
	}
	return next
}
