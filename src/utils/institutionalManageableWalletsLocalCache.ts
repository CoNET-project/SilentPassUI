/**
 * Institutional Smart Wallet list — semi-permanent local cache (EOA-partitioned).
 * Created AAs cannot be deleted on-chain; local rows must not be wiped by a failed /
 * incomplete discover. Trusted network results only upsert / enrich; never remove.
 */

import { ethers } from 'ethers'
import type { InstitutionalManageableWallet } from '@/utils/aaMultisigTransferEligible'
import { readAaThresholdPolicy, type AaThresholdPolicy } from '@/utils/aaMultisigUserOp'

const PREFIX = 'beamio:silentpass:eoa:'
const SUFFIX = ':institutional-manageable-aas:v2'
const MAX_STORE_CHARS = 800_000

type StoredRow = {
	aaAccount: string
	kind: 'own_institutional' | 'comanaged'
	index?: number
	accountName?: string
	policy: AaThresholdPolicy
	lastActivityAt: number
	savedAt: number
}

type StoredPayload = {
	v: 1
	eoa: string
	savedAt: number
	items: StoredRow[]
}

function storageKey(eoaLower: string): string {
	return `${PREFIX}${eoaLower}${SUFFIX}`
}

function normalizePolicy(raw: unknown, fallbackEoa: string): AaThresholdPolicy {
	const eoa = ethers.isAddress(fallbackEoa) ? ethers.getAddress(fallbackEoa) : fallbackEoa
	const p = raw as Partial<AaThresholdPolicy> | null | undefined
	const managers = Array.isArray(p?.managers)
		? p!.managers.filter((m) => typeof m === 'string' && ethers.isAddress(m)).map((m) => ethers.getAddress(m))
		: []
	const owner =
		typeof p?.owner === 'string' && ethers.isAddress(p.owner) ? ethers.getAddress(p.owner) : eoa
	const threshold =
		typeof p?.threshold === 'number' && Number.isFinite(p.threshold) && p.threshold >= 1
			? Math.floor(p.threshold)
			: 1
	return {
		owner,
		managers: managers.length > 0 ? managers : eoa ? [eoa] : [],
		threshold: Math.min(Math.max(1, threshold), Math.max(1, managers.length || 1)),
	}
}

function rowFromStored(row: StoredRow, eoa: string): InstitutionalManageableWallet | null {
	if (!row?.aaAccount || !ethers.isAddress(row.aaAccount)) return null
	if (row.kind !== 'own_institutional' && row.kind !== 'comanaged') return null
	return {
		aaAccount: ethers.getAddress(row.aaAccount),
		kind: row.kind,
		index: typeof row.index === 'number' ? row.index : undefined,
		accountName: typeof row.accountName === 'string' && row.accountName.trim() ? row.accountName.trim() : undefined,
		policy: normalizePolicy(row.policy, eoa),
		lastActivityAt: typeof row.lastActivityAt === 'number' ? row.lastActivityAt : 0,
	}
}

function toStoredRow(w: InstitutionalManageableWallet): StoredRow {
	return {
		aaAccount: ethers.getAddress(w.aaAccount),
		kind: w.kind,
		index: w.index,
		accountName: w.accountName,
		policy: {
			owner: w.policy.owner,
			managers: [...w.policy.managers],
			threshold: w.policy.threshold,
		},
		lastActivityAt: w.lastActivityAt ?? 0,
		savedAt: Date.now(),
	}
}

function sortInstitutionalWallets(list: InstitutionalManageableWallet[]): InstitutionalManageableWallet[] {
	return [...list].sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === 'own_institutional' ? -1 : 1
		if (a.kind === 'own_institutional' && b.kind === 'own_institutional') {
			return (a.index ?? 0) - (b.index ?? 0)
		}
		return b.lastActivityAt - a.lastActivityAt
	})
}

function writePayload(eoaLower: string, items: InstitutionalManageableWallet[]): void {
	if (typeof window === 'undefined' || !eoaLower || !ethers.isAddress(eoaLower)) return
	try {
		const payload: StoredPayload = {
			v: 1,
			eoa: eoaLower,
			savedAt: Date.now(),
			items: items.map(toStoredRow),
		}
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(storageKey(eoaLower), raw)
	} catch {
		/* quota / private mode */
	}
}

/** Sync read — local-first first paint. */
export function loadInstitutionalManageableWalletsLocal(
	eoa: string
): InstitutionalManageableWallet[] {
	if (typeof window === 'undefined' || !eoa || !ethers.isAddress(eoa)) return []
	const eoaLower = eoa.trim().toLowerCase()
	try {
		const raw = localStorage.getItem(storageKey(eoaLower))
		if (!raw || raw.length > MAX_STORE_CHARS) return []
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1 || typeof p.eoa !== 'string' || p.eoa.toLowerCase() !== eoaLower) return []
		if (!Array.isArray(p.items)) return []
		const out: InstitutionalManageableWallet[] = []
		for (const row of p.items) {
			const parsed = rowFromStored(row, eoa)
			if (parsed) out.push(parsed)
		}
		return sortInstitutionalWallets(out)
	} catch {
		return []
	}
}

/**
 * Merge trusted discover results into local cache.
 * Existing local rows are never removed (created AAs are permanent).
 * Same-aa rows are enriched from `trusted` (policy / tag / index / kind).
 */
export function mergeTrustedInstitutionalManageableWalletsLocal(
	eoa: string,
	trusted: InstitutionalManageableWallet[]
): InstitutionalManageableWallet[] {
	if (!eoa || !ethers.isAddress(eoa)) return trusted
	const eoaLower = eoa.trim().toLowerCase()
	const byAa = new Map<string, InstitutionalManageableWallet>()
	for (const row of loadInstitutionalManageableWalletsLocal(eoa)) {
		byAa.set(row.aaAccount.toLowerCase(), row)
	}
	for (const row of trusted) {
		if (!row?.aaAccount || !ethers.isAddress(row.aaAccount)) continue
		const key = row.aaAccount.toLowerCase()
		const prev = byAa.get(key)
		byAa.set(key, {
			aaAccount: ethers.getAddress(row.aaAccount),
			kind: row.kind,
			index: row.index ?? prev?.index,
			accountName: row.accountName || prev?.accountName,
			policy: row.policy ?? prev?.policy ?? normalizePolicy(null, eoa),
			lastActivityAt: Math.max(row.lastActivityAt ?? 0, prev?.lastActivityAt ?? 0),
		})
	}
	const merged = sortInstitutionalWallets([...byAa.values()])
	writePayload(eoaLower, merged)
	return merged
}

/** Upsert one wallet (e.g. right after createInstitutionalAa success). */
export function upsertInstitutionalManageableWalletLocal(
	eoa: string,
	wallet: InstitutionalManageableWallet
): InstitutionalManageableWallet[] {
	return mergeTrustedInstitutionalManageableWalletsLocal(eoa, [wallet])
}

/**
 * Re-read on-chain M-of-N for every local list row and merge trusted policies.
 *
 * Discover only refreshes V2 Factory AAs; legacy V1 institutional AAs stay in local
 * cache forever. Without this pass, list badges stay stuck at create-time `1/1`
 * after a successful set_policy (e.g. chain already `2/2`).
 */
export async function refreshInstitutionalManageablePoliciesFromChain(
	provider: ethers.Provider,
	eoa: string,
	wallets: InstitutionalManageableWallet[]
): Promise<InstitutionalManageableWallet[]> {
	if (!eoa || !ethers.isAddress(eoa) || wallets.length === 0) return wallets
	const enriched: InstitutionalManageableWallet[] = []
	for (const w of wallets) {
		if (!w?.aaAccount || !ethers.isAddress(w.aaAccount)) continue
		try {
			const policy = await readAaThresholdPolicy(provider, w.aaAccount, { fallbackEoa: eoa })
			enriched.push({
				...w,
				aaAccount: ethers.getAddress(w.aaAccount),
				policy,
			})
		} catch {
			/* untrusted — keep prior row; do not drop */
		}
	}
	if (enriched.length === 0) return wallets
	return mergeTrustedInstitutionalManageableWalletsLocal(eoa, enriched)
}

/** Replace the entire institutional list (e.g. drop legacy V1 rows). */
export function replaceInstitutionalManageableWalletsLocal(
	eoa: string,
	wallets: InstitutionalManageableWallet[]
): InstitutionalManageableWallet[] {
	if (!eoa || !ethers.isAddress(eoa)) return wallets
	const eoaLower = eoa.trim().toLowerCase()
	const sorted = sortInstitutionalWallets(
		wallets.filter((w) => w?.aaAccount && ethers.isAddress(w.aaAccount))
	)
	writePayload(eoaLower, sorted)
	return sorted
}
