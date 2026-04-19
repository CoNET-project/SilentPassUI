/**
 * 卡级基础 metadata 全局表（不按 EOA 隔离）：name / image / tiers / cardOwner 等创建后基本不变。
 * 可信数据落盘后本地优先；后台再拉 API/URI 刷新同一表，供各页面共用。
 */

import { ethers } from 'ethers'
import type { CardMetadataFromUri } from '@/services/BeamioCard'

const ENTRY_PREFIX = 'beamio:cardBasicMeta:v1:'
const MAX_ENTRY_JSON_CHARS = 120_000
const MAX_TOTAL_KEYS_SOFT = 800

type StoredEntry = {
	v: 1
	savedAt: number
	meta: CardMetadataFromUri
}

const memory = new Map<string, CardMetadataFromUri>()

function entryKey(cardLower: string): string {
	return `${ENTRY_PREFIX}${cardLower}`
}

function parseEntry(raw: string): CardMetadataFromUri | null {
	try {
		const p = JSON.parse(raw) as StoredEntry
		if (p?.v !== 1 || !p.meta || typeof p.meta !== 'object') return null
		return p.meta
	} catch {
		return null
	}
}

/** 同步读取：先内存再 localStorage */
export function peekCardBasicMetadata(cardAddress: string): CardMetadataFromUri | null {
	const lower = (cardAddress || '').trim().toLowerCase()
	if (!lower || !ethers.isAddress(lower)) return null
	const hitMem = memory.get(lower)
	if (hitMem) return hitMem
	if (typeof window === 'undefined') return null
	try {
		const raw = localStorage.getItem(entryKey(lower))
		if (!raw || raw.length > MAX_ENTRY_JSON_CHARS) return null
		const meta = parseEntry(raw)
		if (meta) memory.set(lower, meta)
		return meta
	} catch {
		return null
	}
}

/** 一次可信拉取成功后写入（内存 + 磁盘） */
export function rememberCardBasicMetadataTrusted(cardAddress: string, meta: CardMetadataFromUri): void {
	const lower = (cardAddress || '').trim().toLowerCase()
	if (!lower || !ethers.isAddress(lower)) return
	memory.set(lower, meta)
	if (typeof window === 'undefined') return
	try {
		const payload: StoredEntry = { v: 1, savedAt: Date.now(), meta }
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_ENTRY_JSON_CHARS) return
		localStorage.setItem(entryKey(lower), raw)
		trimOldestEntriesIfNeeded()
	} catch {
		/* quota */
	}
}

function trimOldestEntriesIfNeeded(): void {
	if (typeof window === 'undefined') return
	try {
		const keys: { k: string; savedAt: number }[] = []
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i)
			if (!k || !k.startsWith(ENTRY_PREFIX)) continue
			const raw = localStorage.getItem(k)
			if (!raw) continue
			try {
				const p = JSON.parse(raw) as StoredEntry
				if (p?.v === 1 && typeof p.savedAt === 'number') keys.push({ k, savedAt: p.savedAt })
			} catch {
				/* ignore */
			}
		}
		if (keys.length <= MAX_TOTAL_KEYS_SOFT) return
		keys.sort((a, b) => a.savedAt - b.savedAt)
		const drop = keys.length - MAX_TOTAL_KEYS_SOFT
		for (let i = 0; i < drop; i++) {
			const addr = keys[i]!.k.slice(ENTRY_PREFIX.length)
			localStorage.removeItem(keys[i]!.k)
			memory.delete(addr)
		}
	} catch {
		/* ignore */
	}
}
