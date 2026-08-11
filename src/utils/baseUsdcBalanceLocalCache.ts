/**
 * Base USDC (EOA + AA) local cache — EOA-partitioned.
 * Local-first: hydrate on EOA switch; Worker 6s trusted success only overwrites.
 */

export type BaseUsdcBalanceCache = {
	eoaUsdc: string
	aaUsdc: string
}

type StoredPayload = {
	v: 1
	savedAt: number
	eoaUsdc: string
	aaUsdc: string
}

const storageKey = (eoaLower: string) => `beamio:baseUsdcBalances:v1:eoa:${eoaLower}`
const MAX_STORE_CHARS = 4_096

export function loadBaseUsdcBalanceLocalCache(eoaLower: string): BaseUsdcBalanceCache | null {
	if (typeof window === 'undefined') return null
	const key = eoaLower.trim().toLowerCase()
	if (!key) return null
	try {
		const raw = localStorage.getItem(storageKey(key))
		if (!raw || raw.length > MAX_STORE_CHARS) return null
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1) return null
		return {
			eoaUsdc: String(p.eoaUsdc ?? '0'),
			aaUsdc: String(p.aaUsdc ?? '0'),
		}
	} catch {
		return null
	}
}

export function saveBaseUsdcBalanceLocalCache(
	eoaLower: string,
	patch: { eoaUsdc: string; aaUsdc?: string },
): void {
	if (typeof window === 'undefined') return
	const key = eoaLower.trim().toLowerCase()
	if (!key) return
	try {
		const prev = loadBaseUsdcBalanceLocalCache(key)
		const payload: StoredPayload = {
			v: 1,
			savedAt: Date.now(),
			eoaUsdc: String(patch.eoaUsdc ?? prev?.eoaUsdc ?? '0'),
			aaUsdc: String(patch.aaUsdc ?? prev?.aaUsdc ?? '0'),
		}
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(storageKey(key), raw)
	} catch {
		/* quota / private mode */
	}
}
