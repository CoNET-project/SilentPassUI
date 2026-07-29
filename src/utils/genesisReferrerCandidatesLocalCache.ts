/**
 * Genesis Node Offers — Select from partners 候选列表本地可信缓存。
 * 链上全局名单（非 EOA 隔离）：首屏 seed / local-first，后台 RPC 成功才覆盖。
 */

import { ethers } from 'ethers'
import type { GenesisReferrerCandidate, GenesisReferrerRole } from '@/services/genesisNodeReferral'

const STORAGE_KEY = 'beamio:genesisReferrerCandidates:v1'
const MAX_STORE_CHARS = 200_000

/**
 * Built-in snapshot (2026-07-29 CoNET vault scan) so Select from partners
 * renders immediately without waiting for RPC. Background fetch may refresh.
 * Keep `accountName` aligned with @BeamioTag for first paint.
 */
export const GENESIS_REFERRER_CANDIDATES_SEED: ReadonlyArray<
	GenesisReferrerCandidate & { accountName: string }
> = [
	{
		address: '0x82DADaeC25bebB58D6FaD2B91f394Ad10A9b0eE1',
		role: 'admin',
		accountName: 'Beamio_Manager',
	},
	{
		address: '0x2D318c674F1716264c78B1D33e18E3F8cb02fCE8',
		role: 'l0',
		accountName: 'CoNET_Demo',
	},
	{
		address: '0x527A583892251a17b05110D326087a6Ae75A0644',
		role: 'l1',
		accountName: 'BeamioDemoP101',
	},
]

type StoredPayload = {
	v: 1
	savedAt: number
	items: GenesisReferrerCandidate[]
}

function normalizeRole(raw: unknown): GenesisReferrerRole | null {
	if (raw === 'admin' || raw === 'l0' || raw === 'l1') return raw
	return null
}

function normalizeAccountName(raw: unknown): string | undefined {
	if (typeof raw !== 'string') return undefined
	const t = raw.trim().replace(/^@+/, '')
	return t || undefined
}

function normalizeItems(raw: unknown): GenesisReferrerCandidate[] {
	if (!Array.isArray(raw)) return []
	const out: GenesisReferrerCandidate[] = []
	const seen = new Set<string>()
	for (const row of raw) {
		const r = row as { address?: unknown; role?: unknown; accountName?: unknown }
		if (typeof r?.address !== 'string' || !ethers.isAddress(r.address)) continue
		const role = normalizeRole(r.role)
		if (!role) continue
		const address = ethers.getAddress(r.address)
		const key = address.toLowerCase()
		if (seen.has(key)) continue
		seen.add(key)
		const accountName = normalizeAccountName(r.accountName)
		out.push(accountName ? { address, role, accountName } : { address, role })
	}
	return out
}

function cloneSeed(): GenesisReferrerCandidate[] {
	return GENESIS_REFERRER_CANDIDATES_SEED.map((c) => ({
		address: ethers.getAddress(c.address),
		role: c.role,
		accountName: c.accountName,
	}))
}

/** Prefer seed / previous @tags when chain refresh returns address+role only. */
export function mergeGenesisReferrerCandidateTags(
	fresh: GenesisReferrerCandidate[],
	previous?: GenesisReferrerCandidate[] | null,
): GenesisReferrerCandidate[] {
	const tagByAddr = new Map<string, string>()
	for (const s of GENESIS_REFERRER_CANDIDATES_SEED) {
		if (s.accountName) tagByAddr.set(s.address.toLowerCase(), s.accountName)
	}
	for (const p of previous ?? []) {
		const name = normalizeAccountName(p.accountName)
		if (name) tagByAddr.set(p.address.toLowerCase(), name)
	}
	return normalizeItems(fresh).map((c) => {
		const fromMap = tagByAddr.get(c.address.toLowerCase())
		const accountName = normalizeAccountName(c.accountName) ?? fromMap
		return accountName ? { ...c, accountName } : c
	})
}

/** Sync read for useState initializer — never throws; empty cache → built-in seed. */
export function loadGenesisReferrerCandidatesLocalCache(): GenesisReferrerCandidate[] {
	if (typeof window === 'undefined') return cloneSeed()
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw || raw.length > MAX_STORE_CHARS) return cloneSeed()
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1) return cloneSeed()
		const items = normalizeItems(p.items)
		if (items.length === 0) return cloneSeed()
		return mergeGenesisReferrerCandidateTags(items, cloneSeed())
	} catch {
		return cloneSeed()
	}
}

/** Trusted chain success only — do not call on RPC failure / empty-untrusted. */
export function saveGenesisReferrerCandidatesLocalCache(items: GenesisReferrerCandidate[]): void {
	if (typeof window === 'undefined') return
	try {
		const normalized = mergeGenesisReferrerCandidateTags(items, cloneSeed())
		const payload: StoredPayload = {
			v: 1,
			savedAt: Date.now(),
			items: normalized,
		}
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(STORAGE_KEY, raw)
	} catch {
		/* quota / private mode */
	}
}
