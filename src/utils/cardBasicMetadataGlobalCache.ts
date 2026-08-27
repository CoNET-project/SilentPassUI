/**
 * 卡级基础 metadata 全局表（不按 EOA 隔离）：name / image / tiers / cardOwner 等创建后基本不变。
 * 可信数据落盘后本地优先；后台再拉 API/URI 刷新同一表，供各页面共用。
 */

import { ethers } from 'ethers'
import type { CardMetadataFromUri } from '@/services/BeamioCard'
import { mergeRicherMerchantCardMeta } from '@/utils/mergeRicherMerchantCardMeta'

const ENTRY_PREFIX = 'beamio:cardBasicMeta:v1:'
const MAX_ENTRY_JSON_CHARS = 120_000
const MAX_TOTAL_KEYS_SOFT = 800

type StoredEntry = {
	v: 1
	savedAt: number
	meta: CardMetadataFromUri
}

const memory = new Map<string, CardMetadataFromUri>()

type CardBasicMetadataListener = (cardAddressLower: string, meta: CardMetadataFromUri) => void
const listeners = new Set<CardBasicMetadataListener>()

/** Notify when trusted card metadata is rewritten (e.g. tier background image change). */
export function subscribeCardBasicMetadataUpdates(listener: CardBasicMetadataListener): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

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

function cardBasicMetaContentSig(meta: CardMetadataFromUri | null | undefined): string {
	if (!meta) return ''
	try {
		return JSON.stringify({
			n: meta.name ?? null,
			i: meta.icon ?? meta.image ?? null,
			tiers: meta.tiers ?? null,
			ps: meta.pointSystem ?? null,
			cat: meta.categoryId ?? null,
		})
	} catch {
		return ''
	}
}

/** 一次可信拉取成功后写入（内存 + 磁盘）。默认 card0 不得覆盖上次商户 branding。 */
export function rememberCardBasicMetadataTrusted(
	cardAddress: string,
	meta: CardMetadataFromUri,
): CardMetadataFromUri | null {
	const lower = (cardAddress || '').trim().toLowerCase()
	if (!lower || !ethers.isAddress(lower)) return null
	const prev = peekCardBasicMetadata(lower)
	const merged = mergeRicherMerchantCardMeta(prev, meta)
	if (!merged) return null
	const changed = cardBasicMetaContentSig(prev) !== cardBasicMetaContentSig(merged)
	memory.set(lower, merged)
	if (typeof window === 'undefined') return merged
	try {
		const payload: StoredEntry = { v: 1, savedAt: Date.now(), meta: merged }
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_ENTRY_JSON_CHARS) return merged
		localStorage.setItem(entryKey(lower), raw)
		trimOldestEntriesIfNeeded()
	} catch {
		/* quota */
	}
	if (changed) {
		for (const listener of listeners) {
			try {
				listener(lower, merged)
			} catch {
				/* ignore subscriber errors */
			}
		}
	}
	return merged
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
