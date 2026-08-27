/**
 * Merchant program card serverDB (Worker): global map + URI/API refresh.
 * Does not import BeamioCard (keeps worker bundle lean).
 */

import { ethers } from 'ethers'
import type { MerchantCardRecord } from './protocol'
import {
	MERCHANT_CARD_API_BASE,
	MERCHANT_CARD_FETCH_MAX_PER_TICK,
	MERCHANT_CARD_RPC_URL,
	MERCHANT_CARD_STALE_MS,
} from './protocol'
import {
	idbGetMeta,
	idbLoadMerchantCardMap,
	idbPutMerchantCards,
	idbSetMeta,
	merchantLegacyMigratedMetaKey,
} from './idbStore'
import { isGenericMerchantCardDisplayName } from '../../utils/isGenericMerchantCardDisplayName'
import { pickNonFactoryMerchantAssetUrl } from '../../utils/isFactoryDefaultMerchantAssetUrl'
import { mergeRicherMerchantCardMeta } from '../../utils/mergeRicherMerchantCardMeta'

type CardMeta = MerchantCardRecord['meta']

function normalizeCardKey(raw: string | null | undefined): string | null {
	const t = String(raw || '').trim()
	if (!t || !ethers.isAddress(t)) return null
	try {
		return ethers.getAddress(t).toLowerCase()
	} catch {
		return null
	}
}

function recordFromUnknown(v: unknown): Record<string, unknown> | null {
	return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
	if (!obj) return ''
	for (const k of keys) {
		const v = obj[k]
		if (typeof v === 'string' && v.trim()) return v.trim()
	}
	return ''
}

function iconFromRoot(metaJson: Record<string, unknown> | null | undefined): string | undefined {
	if (!metaJson) return undefined
	const share = recordFromUnknown(metaJson.shareTokenMetadata)
	return pickNonFactoryMerchantAssetUrl(
		pickString(share, ['icon', 'iconUrl', 'logoUrl', 'logo']),
		pickString(metaJson, ['icon', 'iconUrl', 'logoUrl', 'logo']),
		pickString(share, ['image']),
		pickString(metaJson, ['image']),
	)
}

function displayNameFromRoot(metadataRoot: Record<string, unknown>): string {
	const share = recordFromUnknown(metadataRoot.shareTokenMetadata)
	const business =
		pickString(recordFromUnknown(metadataRoot.businessMetadata), ['storeName', 'businessName']) ||
		pickString(recordFromUnknown(metadataRoot.businessProfile), ['storeName', 'businessName']) ||
		pickString(share, ['storeName', 'businessName', 'merchantName', 'brandName', 'displayName']) ||
		pickString(metadataRoot, ['storeName', 'businessName'])
	if (business && !isGenericMerchantCardDisplayName(business)) return business
	const shareName = pickString(share, ['name'])
	if (shareName && !isGenericMerchantCardDisplayName(shareName)) return shareName
	const top = pickString(metadataRoot, ['name'])
	if (top && !isGenericMerchantCardDisplayName(top)) return top
	return ''
}

function metaFromRoot(
	metadataRoot: Record<string, unknown> | null | undefined,
	cardOwner?: string,
): CardMeta | null {
	if (!metadataRoot || typeof metadataRoot !== 'object') return null
	const share = recordFromUnknown(metadataRoot.shareTokenMetadata)
	const icon = iconFromRoot(metadataRoot)
	const name = displayNameFromRoot(metadataRoot)
	const image = pickNonFactoryMerchantAssetUrl(
		pickString(share, ['image']),
		pickString(metadataRoot, ['image']),
	)
	return {
		...(name ? { name } : {}),
		...(icon ? { icon } : {}),
		...(image ? { image } : {}),
		...(Array.isArray(metadataRoot.tiers) &&
			metadataRoot.tiers.length > 0 && { tiers: metadataRoot.tiers as CardMeta['tiers'] }),
		...(cardOwner ? { cardOwner } : {}),
	}
}

function hasDisplayName(rec: MerchantCardRecord | undefined | null): boolean {
	if (!rec) return false
	if (rec.metadataRoot) {
		if (displayNameFromRoot(rec.metadataRoot)) return true
	}
	const name = String(rec.meta?.name ?? '').trim()
	return Boolean(name) && !isGenericMerchantCardDisplayName(name)
}

export function merchantCardNeedsRemoteRefresh(
	record: MerchantCardRecord | undefined | null,
	now = Date.now(),
): boolean {
	if (!record) return true
	if (!record.updatedAt || now - record.updatedAt > MERCHANT_CARD_STALE_MS) return true
	if (!hasDisplayName(record)) return true
	return false
}

export function mergeMerchantCardMap(
	prev: Record<string, MerchantCardRecord>,
	incoming: Record<string, MerchantCardRecord | null | undefined>,
): { next: Record<string, MerchantCardRecord>; patch: Record<string, MerchantCardRecord> } {
	const next = { ...prev }
	const patch: Record<string, MerchantCardRecord> = {}
	for (const [rawKey, rec] of Object.entries(incoming)) {
		const key = normalizeCardKey(rawKey) ?? normalizeCardKey(rec?.addressLower)
		if (!key || !rec) continue
		const prevRec = next[key]
		if (prevRec && rec.updatedAt <= prevRec.updatedAt && !rec.metadataRoot && prevRec.metadataRoot) {
			const merged: MerchantCardRecord = {
				...prevRec,
				meta: mergeRicherMerchantCardMeta(prevRec.meta, rec.meta) ?? rec.meta ?? prevRec.meta,
				updatedAt: Math.max(prevRec.updatedAt, rec.updatedAt),
			}
			next[key] = merged
			patch[key] = merged
			continue
		}
		const merged: MerchantCardRecord = {
			addressLower: key,
			meta: mergeRicherMerchantCardMeta(prevRec?.meta, rec.meta) ?? rec.meta ?? prevRec?.meta ?? {},
			metadataRoot: rec.metadataRoot ?? prevRec?.metadataRoot,
			updatedAt: Math.max(prevRec?.updatedAt ?? 0, rec.updatedAt),
		}
		next[key] = merged
		patch[key] = merged
	}
	return { next, patch }
}

function erc1155IdHex(tokenId: bigint | number = 0): string {
	return BigInt(tokenId).toString(16).padStart(64, '0').toLowerCase()
}

function resolveUriTemplate(baseUri: string, tokenId: bigint | number = 0): string {
	if (!baseUri.includes('{id}')) return baseUri
	return baseUri.replace(/{id}/gi, erc1155IdHex(tokenId))
}

async function fetchCardMetadataFromApi(cardChecksum: string): Promise<{
	meta: CardMeta | null
	metadataRoot: Record<string, unknown> | null
	cardOwner?: string
}> {
	try {
		const res = await fetch(
			`${MERCHANT_CARD_API_BASE}/api/cardMetadata?cardAddress=${encodeURIComponent(cardChecksum)}`,
			{ credentials: 'omit' },
		)
		if (!res.ok) return { meta: null, metadataRoot: null }
		const data = (await res.json()) as {
			cardOwner?: string
			metadata?: Record<string, unknown> | null
		}
		const metadataRoot =
			data?.metadata && typeof data.metadata === 'object' ? data.metadata : null
		const cardOwner =
			data?.cardOwner && typeof data.cardOwner === 'string' && ethers.isAddress(data.cardOwner)
				? ethers.getAddress(data.cardOwner)
				: undefined
		const meta = metaFromRoot(metadataRoot, cardOwner)
		return { meta, metadataRoot, cardOwner }
	} catch {
		return { meta: null, metadataRoot: null }
	}
}

async function fetchCardMetadataFromUri(cardChecksum: string): Promise<CardMeta | null> {
	try {
		const provider = new ethers.JsonRpcProvider(MERCHANT_CARD_RPC_URL)
		const card = new ethers.Contract(
			cardChecksum,
			['function uri(uint256) view returns (string)'],
			provider,
		)
		const baseUri = await card.uri(0)
		if (!baseUri || typeof baseUri !== 'string') return null
		const primaryUrl = resolveUriTemplate(baseUri, 0)
		const hex40 = ethers.getAddress(cardChecksum).slice(2).toLowerCase()
		const canonicalUrl = `${MERCHANT_CARD_API_BASE}/api/metadata/0x${hex40}${erc1155IdHex(0)}.json`
		let res = await fetch(primaryUrl, { credentials: 'omit' })
		if (!res.ok && primaryUrl !== canonicalUrl) {
			res = await fetch(canonicalUrl, { credentials: 'omit' })
		}
		if (!res.ok) {
			res = await fetch(`${MERCHANT_CARD_API_BASE}/metadata/0x${hex40}0.json`, {
				credentials: 'omit',
			})
		}
		if (!res.ok) return null
		const json = (await res.json()) as Record<string, unknown>
		return metaFromRoot(json)
	} catch {
		return null
	}
}

let excludedCache: Set<string> | null = null
let excludedInFlight: Promise<Set<string>> | null = null

async function loadExcludedCards(): Promise<Set<string>> {
	if (excludedCache) return excludedCache
	if (excludedInFlight) return excludedInFlight
	excludedInFlight = (async () => {
		try {
			const res = await fetch(`${MERCHANT_CARD_API_BASE}/api/excludedUserCards`, {
				credentials: 'omit',
			})
			if (!res.ok) throw new Error(`excluded HTTP ${res.status}`)
			const json = (await res.json()) as { ok?: boolean; addresses?: unknown }
			if (json?.ok !== true || !Array.isArray(json.addresses)) throw new Error('invalid')
			const next = new Set<string>()
			for (const raw of json.addresses) {
				const k = normalizeCardKey(typeof raw === 'string' ? raw : '')
				if (k) next.add(k)
			}
			if (next.size > 0) excludedCache = next
		} catch {
			/* keep previous */
		} finally {
			excludedInFlight = null
		}
		return excludedCache ?? new Set()
	})()
	return excludedInFlight
}

function isExcluded(key: string): boolean {
	return excludedCache?.has(key) === true
}

export class MerchantCardServerDb {
	map: Record<string, MerchantCardRecord> = {}
	warmTargets: string[] = []
	private inflight = new Map<string, Promise<MerchantCardRecord | null>>()
	private emitUpdated: (
		patch: Record<string, MerchantCardRecord>,
		snapshot: Record<string, MerchantCardRecord>,
	) => void
	private ready = false

	constructor(
		emitUpdated: (
			patch: Record<string, MerchantCardRecord>,
			snapshot: Record<string, MerchantCardRecord>,
		) => void,
	) {
		this.emitUpdated = emitUpdated
	}

	get isReady(): boolean {
		return this.ready
	}

	async init(legacyMap?: Record<string, MerchantCardRecord>): Promise<void> {
		this.map = await idbLoadMerchantCardMap()
		void loadExcludedCards()

		if (legacyMap && Object.keys(legacyMap).length > 0) {
			const already = await idbGetMeta(merchantLegacyMigratedMetaKey())
			if (!already) {
				const { next, patch } = mergeMerchantCardMap(this.map, legacyMap)
				this.map = next
				if (Object.keys(patch).length > 0) {
					await idbPutMerchantCards(patch)
					this.emitUpdated(patch, { ...this.map })
				}
				await idbSetMeta(merchantLegacyMigratedMetaKey(), {
					importedAt: Date.now(),
					count: Object.keys(legacyMap).length,
				})
			}
		}
		this.ready = true
	}

	lookup(cardAddress: string): MerchantCardRecord | undefined {
		const key = normalizeCardKey(cardAddress)
		if (!key) return undefined
		return this.map[key]
	}

	lookupMany(cardAddresses: string[]): Record<string, MerchantCardRecord> {
		const out: Record<string, MerchantCardRecord> = {}
		for (const a of cardAddresses) {
			const rec = this.lookup(a)
			if (rec) out[rec.addressLower] = rec
		}
		return out
	}

	applyTrusted(
		incoming: Record<string, MerchantCardRecord | null | undefined>,
	): Record<string, MerchantCardRecord> {
		const { next, patch } = mergeMerchantCardMap(this.map, incoming)
		this.map = next
		if (Object.keys(patch).length > 0) {
			void idbPutMerchantCards(patch)
			this.emitUpdated(patch, { ...this.map })
		}
		return patch
	}

	setWarmTargets(cardAddresses: string[]): void {
		const next: string[] = []
		const seen = new Set<string>()
		for (const a of cardAddresses) {
			const key = normalizeCardKey(a)
			if (!key || seen.has(key) || isExcluded(key)) continue
			seen.add(key)
			next.push(key)
		}
		this.warmTargets = next
	}

	async fetchRemote(cardAddress: string): Promise<MerchantCardRecord | null> {
		const key = normalizeCardKey(cardAddress)
		if (!key) return null
		await loadExcludedCards()
		if (isExcluded(key)) return null

		const existing = this.inflight.get(key)
		if (existing) return existing

		const task = (async () => {
			const checksum = ethers.getAddress(key)
			const [fromUri, fromApi] = await Promise.all([
				fetchCardMetadataFromUri(checksum),
				fetchCardMetadataFromApi(checksum),
			])
			const mergedRemote =
				mergeRicherMerchantCardMeta(fromUri, fromApi.meta) ?? fromApi.meta ?? fromUri
			const meta =
				mergeRicherMerchantCardMeta(this.map[key]?.meta, mergedRemote) ?? mergedRemote
			const metadataRoot = fromApi.metadataRoot ?? this.map[key]?.metadataRoot
			if (!meta?.name && !meta?.image && !meta?.icon && !metadataRoot && !fromUri && !fromApi.meta) {
				return null
			}
			return {
				addressLower: key,
				meta: meta ?? {},
				metadataRoot,
				updatedAt: Date.now(),
			} satisfies MerchantCardRecord
		})()

		this.inflight.set(key, task)
		try {
			return await task
		} finally {
			this.inflight.delete(key)
		}
	}

	async ensureCards(
		cardAddresses: string[],
		opts?: { maxPerTick?: number; forceRefresh?: boolean },
	): Promise<{
		fetched: number
		remainingNeed: number
		patch: Record<string, MerchantCardRecord>
	}> {
		const maxPerTick = opts?.maxPerTick ?? MERCHANT_CARD_FETCH_MAX_PER_TICK
		const now = Date.now()
		await loadExcludedCards()

		const need: string[] = []
		const seen = new Set<string>()
		for (const a of cardAddresses) {
			const key = normalizeCardKey(a)
			if (!key || seen.has(key) || isExcluded(key)) continue
			seen.add(key)
			if (opts?.forceRefresh || merchantCardNeedsRemoteRefresh(this.map[key], now)) {
				need.push(key)
			}
		}

		const batch = need.slice(0, Math.max(0, maxPerTick))
		const incoming: Record<string, MerchantCardRecord> = {}
		for (const key of batch) {
			const rec = await this.fetchRemote(key)
			if (rec) incoming[key] = rec
		}
		const patch = this.applyTrusted(incoming)
		return {
			fetched: Object.keys(patch).length,
			remainingNeed: Math.max(0, need.length - batch.length),
			patch,
		}
	}

	async tickWarm(): Promise<{ fetched: number; remainingNeed: number }> {
		const r = await this.ensureCards(this.warmTargets, {
			maxPerTick: MERCHANT_CARD_FETCH_MAX_PER_TICK,
		})
		return { fetched: r.fetched, remainingNeed: r.remainingNeed }
	}
}

export { normalizeCardKey as normalizeMerchantCardKey }
