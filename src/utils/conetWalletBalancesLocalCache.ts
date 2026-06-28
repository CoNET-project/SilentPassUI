/**
 * CoNET 链钱包余额（USDC / CNET / GB）本地缓存 — 按 EOA 隔离。
 * 本地优先：首屏同步读 localStorage；全局 daemon 每 6s 可信成功才覆盖。
 */

import type { ConetWalletBalances } from '@/services/conetUsdcBalance'

export const EMPTY_CONET_WALLET_BALANCES: ConetWalletBalances = {
	usdc: '0',
	cnet: '0',
	gb: '0',
}

type StoredPayload = {
	v: 1
	savedAt: number
	balances: ConetWalletBalances
}

const storageKey = (eoaLower: string) => `beamio:conetWalletBalances:v1:eoa:${eoaLower}`
const MAX_STORE_CHARS = 8_192

export function loadConetWalletBalancesLocalCache(eoaLower: string): ConetWalletBalances | null {
	if (typeof window === 'undefined') return null
	const key = eoaLower.trim().toLowerCase()
	if (!key) return null
	try {
		const raw = localStorage.getItem(storageKey(key))
		if (!raw || raw.length > MAX_STORE_CHARS) return null
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1 || !p.balances) return null
		return {
			usdc: String(p.balances.usdc ?? '0'),
			cnet: String(p.balances.cnet ?? '0'),
			gb: String(p.balances.gb ?? '0'),
		}
	} catch {
		return null
	}
}

export function saveConetWalletBalancesLocalCache(eoaLower: string, balances: ConetWalletBalances): void {
	if (typeof window === 'undefined') return
	const key = eoaLower.trim().toLowerCase()
	if (!key) return
	try {
		const payload: StoredPayload = {
		v: 1,
		 savedAt: Date.now(),
		 balances: {
			 usdc: String(balances.usdc ?? '0'),
			 cnet: String(balances.cnet ?? '0'),
			 gb: String(balances.gb ?? '0'),
		 },
		}
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(storageKey(key), raw)
	} catch {
		/* quota / private mode */
	}
}
