/**
 * Institutional Smart Wallet Multisig — per-AA transfer-asset balances (local-first).
 * Keyed by viewer EOA + AA address; trusted success only writes.
 */

import type { AaMultisigTransferAssetOption } from '@/utils/aaMultisigConetTransferAssets'
import type { AaMultisigTransferAssetId } from '@/utils/aaMultisigProtocol'

export type InstitutionalAaAssetsByAa = Record<string, AaMultisigTransferAssetOption[]>

type StoredAsset = {
	id: AaMultisigTransferAssetId
	chain: 'conet' | 'base'
	label: string
	balanceDisplay: string
	balanceRaw: string
	decimals: number
	contractAddress?: string
}

type StoredPayload = {
	v: 1
	savedAt: number
	/** aaLower → assets */
	byAa: Record<string, StoredAsset[]>
}

const storageKey = (eoaLower: string) =>
	`beamio:silentpass:eoa:${eoaLower}:aa-multisig-institutional-assets:v1`

const MAX_STORE_CHARS = 256_000

function toStored(opt: AaMultisigTransferAssetOption): StoredAsset {
	return {
		id: opt.id,
		chain: opt.chain,
		label: opt.label,
		balanceDisplay: opt.balanceDisplay,
		balanceRaw: opt.balanceRaw.toString(),
		decimals: opt.decimals,
		...(opt.contractAddress ? { contractAddress: opt.contractAddress } : {}),
	}
}

function fromStored(row: StoredAsset): AaMultisigTransferAssetOption | null {
	if (!row?.id || !row.chain || !row.label) return null
	let balanceRaw: bigint
	try {
		balanceRaw = BigInt(row.balanceRaw ?? '0')
	} catch {
		return null
	}
	return {
		id: row.id,
		chain: row.chain,
		label: row.label,
		balanceDisplay: String(row.balanceDisplay ?? '0'),
		balanceRaw,
		decimals: Number(row.decimals) || 0,
		...(row.contractAddress ? { contractAddress: row.contractAddress } : {}),
	}
}

export function loadInstitutionalAaAssetsLocalCache(eoa: string): InstitutionalAaAssetsByAa {
	if (typeof window === 'undefined') return {}
	const eoaLower = eoa.trim().toLowerCase()
	if (!eoaLower.startsWith('0x') || eoaLower.length !== 42) return {}
	try {
		const raw = localStorage.getItem(storageKey(eoaLower))
		if (!raw || raw.length > MAX_STORE_CHARS) return {}
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1 || !p.byAa || typeof p.byAa !== 'object') return {}
		const out: InstitutionalAaAssetsByAa = {}
		for (const [aaLower, rows] of Object.entries(p.byAa)) {
			if (!Array.isArray(rows)) continue
			const opts: AaMultisigTransferAssetOption[] = []
			for (const row of rows) {
				const opt = fromStored(row)
				if (opt) opts.push(opt)
			}
			out[aaLower.toLowerCase()] = opts
		}
		return out
	} catch {
		return {}
	}
}

/** Trusted merge: only overwrite keys present in `patch` (partial success OK). */
export function mergeTrustedInstitutionalAaAssetsLocal(
	eoa: string,
	patch: InstitutionalAaAssetsByAa
): InstitutionalAaAssetsByAa {
	const eoaLower = eoa.trim().toLowerCase()
	if (!eoaLower.startsWith('0x') || eoaLower.length !== 42) return {}
	const prev = loadInstitutionalAaAssetsLocalCache(eoaLower)
	const next: InstitutionalAaAssetsByAa = { ...prev }
	for (const [aaLower, opts] of Object.entries(patch)) {
		if (!aaLower || !Array.isArray(opts)) continue
		next[aaLower.toLowerCase()] = opts
	}
	try {
		const byAa: Record<string, StoredAsset[]> = {}
		for (const [aaLower, opts] of Object.entries(next)) {
			byAa[aaLower] = opts.map(toStored)
		}
		const payload: StoredPayload = { v: 1, savedAt: Date.now(), byAa }
		const raw = JSON.stringify(payload)
		if (raw.length <= MAX_STORE_CHARS) {
			localStorage.setItem(storageKey(eoaLower), raw)
		}
	} catch {
		/* quota / private mode — memory still returned */
	}
	return next
}

export function peekInstitutionalAaAssetsFromCache(
	eoa: string,
	aaAccount: string
): AaMultisigTransferAssetOption[] | null {
	const map = loadInstitutionalAaAssetsLocalCache(eoa)
	const key = aaAccount.trim().toLowerCase()
	if (!key || !(key in map)) return null
	return map[key] ?? []
}
