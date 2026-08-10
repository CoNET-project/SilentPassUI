/**
 * BeamioTag Worker bridge — global serverDB facade for @beamioTag profiles
 * + merchant program card metadata (parallel IDB store).
 */

import { BeamioTagWorkerClient } from '@/workers/beamioTag/client'
import type { BeamioAddressProfileRecord, MerchantCardRecord } from '@/workers/beamioTag/protocol'
import { loadAddressProfileMap } from '@/utils/beamioAddressProfileRegistry'
import { buildMerchantLegacyImportMap, normalizeCardAddressKey } from '@/utils/merchantCardRegistry'
import { rememberCardBasicMetadataTrusted } from '@/utils/cardBasicMetadataGlobalCache'

type ProfilesUpdatedListener = (ev: {
	partition: string
	patch: Record<string, BeamioAddressProfileRecord>
	snapshot: Record<string, BeamioAddressProfileRecord>
}) => void

type MerchantCardsUpdatedListener = (ev: {
	patch: Record<string, MerchantCardRecord>
	snapshot: Record<string, MerchantCardRecord>
}) => void

let client: BeamioTagWorkerClient | null = null
let activePartition: string | null = null
let mirrorMap: Record<string, BeamioAddressProfileRecord> = {}
let merchantMirrorMap: Record<string, MerchantCardRecord> = {}
const profilesUpdatedListeners = new Set<ProfilesUpdatedListener>()
const merchantCardsUpdatedListeners = new Set<MerchantCardsUpdatedListener>()

let initPromise: Promise<void> | null = null
let merchantInitPromise: Promise<void> | null = null
let merchantStoreBooted = false

function collectCardOwners(recs: Iterable<MerchantCardRecord | null | undefined>): string[] {
	const out: string[] = []
	const seen = new Set<string>()
	for (const rec of recs) {
		const owner = String(rec?.meta?.cardOwner ?? '').trim()
		if (!owner) continue
		const key = normalizeCardAddressKey(owner)
		if (!key || seen.has(key)) continue
		seen.add(key)
		out.push(key)
	}
	return out
}

/** Trusted cardOwner on merchant rows → ensure Tag profiles (do not replace Tag warm set). */
function warmTagOwnersFromMerchantPatch(patch: Record<string, MerchantCardRecord>): void {
	const owners = collectCardOwners(Object.values(patch))
	if (owners.length === 0) return
	void ensureBeamioTagProfiles(owners, { maxPerTick: 8 }).catch(() => undefined)
}

function mirrorMerchantPatchToBasicCache(patch: Record<string, MerchantCardRecord>): void {
	for (const rec of Object.values(patch)) {
		if (rec?.meta && typeof rec.meta === 'object') {
			rememberCardBasicMetadataTrusted(rec.addressLower, rec.meta)
		}
	}
}

function getClient(): BeamioTagWorkerClient {
	if (!client) {
		client = new BeamioTagWorkerClient({
			onProfilesUpdated: (ev) => {
				if (activePartition && ev.partition.toLowerCase() !== activePartition.toLowerCase()) return
				mirrorMap = { ...ev.snapshot }
				for (const cb of profilesUpdatedListeners) {
					try {
						cb(ev)
					} catch {
						/* listener error */
					}
				}
			},
			onMerchantCardsUpdated: (ev) => {
				merchantMirrorMap = { ...ev.snapshot }
				mirrorMerchantPatchToBasicCache(ev.patch)
				warmTagOwnersFromMerchantPatch(ev.patch)
				for (const cb of merchantCardsUpdatedListeners) {
					try {
						cb(ev)
					} catch {
						/* listener error */
					}
				}
			},
			onLog: (level, message) => {
				if (level === 'error') console.error('[beamioTagWorker]', message)
				else if (level === 'warn') console.warn('[beamioTagWorker]', message)
			},
		})
		client.start()
	}
	return client
}

export function onBeamioTagProfilesUpdated(cb: ProfilesUpdatedListener): () => void {
	profilesUpdatedListeners.add(cb)
	return () => {
		profilesUpdatedListeners.delete(cb)
	}
}

export function onMerchantCardsUpdated(cb: MerchantCardsUpdatedListener): () => void {
	merchantCardsUpdatedListeners.add(cb)
	return () => {
		merchantCardsUpdatedListeners.delete(cb)
	}
}

export function getBeamioTagMirrorMap(): Record<string, BeamioAddressProfileRecord> {
	return mirrorMap
}

export function getMerchantCardMirrorMap(): Record<string, MerchantCardRecord> {
	return merchantMirrorMap
}

export function getBeamioTagActivePartition(): string | null {
	return activePartition
}

/**
 * Init / re-init for an EOA partition. Reads legacy localStorage once and passes to Worker IDB.
 * Also seeds merchant global store from legacy LS (one-time inside Worker).
 */
export async function initBeamioTagWorker(partition: string): Promise<void> {
	const part = String(partition || '')
		.trim()
		.toLowerCase()
	if (!part) return

	const run = async () => {
		const c = getClient()
		const legacyMap = loadAddressProfileMap(part)
		const merchantLegacyMap = buildMerchantLegacyImportMap()
		if (activePartition === part && c.isReady) {
			await c.setPartition(part, Object.keys(legacyMap).length ? legacyMap : undefined)
			if (!merchantStoreBooted) {
				await c.merchantInit(
					Object.keys(merchantLegacyMap).length ? merchantLegacyMap : undefined,
				)
			}
		} else {
			activePartition = part
			await c.init({
				partition: part,
				legacyMap: Object.keys(legacyMap).length ? legacyMap : undefined,
				merchantLegacyMap: Object.keys(merchantLegacyMap).length ? merchantLegacyMap : undefined,
			})
		}
		try {
			mirrorMap = (await c.getSnapshot()) || {}
		} catch {
			mirrorMap = { ...legacyMap }
		}
		try {
			merchantMirrorMap = (await c.merchantGetSnapshot()) || {}
		} catch {
			merchantMirrorMap = { ...merchantLegacyMap }
		}
		merchantStoreBooted = true
	}

	initPromise = run()
	try {
		await initPromise
	} finally {
		initPromise = null
	}
}

/** Standalone merchant init when Tag partition not yet ready (e.g. Discover before wallet). */
export async function initMerchantCards(legacyMap?: Record<string, MerchantCardRecord>): Promise<void> {
	const run = async () => {
		const c = getClient()
		const legacy = legacyMap ?? buildMerchantLegacyImportMap()
		await c.merchantInit(Object.keys(legacy).length ? legacy : undefined)
		try {
			merchantMirrorMap = (await c.merchantGetSnapshot()) || merchantMirrorMap
		} catch {
			if (Object.keys(legacy).length) merchantMirrorMap = { ...merchantMirrorMap, ...legacy }
		}
		merchantStoreBooted = true
	}
	merchantInitPromise = run()
	try {
		await merchantInitPromise
	} finally {
		merchantInitPromise = null
	}
}

async function awaitMerchantReady(): Promise<BeamioTagWorkerClient> {
	const c = getClient()
	if (initPromise) {
		try {
			await initPromise
		} catch {
			/* continue */
		}
	}
	if (merchantInitPromise) {
		try {
			await merchantInitPromise
		} catch {
			/* continue */
		}
	}
	if (!merchantStoreBooted) {
		await initMerchantCards()
	}
	return c
}

export async function setBeamioTagWarmTargets(addresses: string[]): Promise<void> {
	const c = getClient()
	if (!activePartition) return
	await c.setWarmTargets(addresses)
}

export async function ensureBeamioTagProfiles(
	addresses: string[],
	opts?: { maxPerTick?: number },
): Promise<Record<string, BeamioAddressProfileRecord>> {
	const c = getClient()
	if (initPromise) {
		try {
			await initPromise
		} catch {
			/* continue */
		}
	}
	if (!activePartition || !c.isReady) {
		return { ...mirrorMap }
	}
	const r = (await c.ensure(addresses, opts?.maxPerTick)) as {
		patch?: Record<string, BeamioAddressProfileRecord>
	}
	return { ...mirrorMap, ...(r?.patch || {}) }
}

export async function searchBeamioTagRemote(query: string): Promise<{
	results?: Array<Record<string, unknown>>
	ingested?: Record<string, BeamioAddressProfileRecord>
} | null> {
	const q = String(query || '').trim()
	if (!q) return { results: [] }

	const c = getClient()
	const run = async () => {
		const r = await c.searchRemote(q)
		return { results: r.results, ingested: r.ingested }
	}

	if (initPromise) {
		try {
			await initPromise
			return await run()
		} catch {
			/* fall through */
		}
	}

	if (activePartition && c.isReady) {
		try {
			return await run()
		} catch {
			return null
		}
	}

	/** Pre-wallet / worker not ready: network-only; no hang on pending queue. */
	try {
		const params = new URLSearchParams({ keyward: q }).toString()
		const res = await fetch(`https://beamio.app/api/search-users?${params}`, { method: 'GET' })
		if (!res.ok) return null
		const json = (await res.json()) as { results?: Array<Record<string, unknown>> }
		return { results: json?.results ?? [], ingested: {} }
	} catch {
		return null
	}
}

export async function lookupBeamioTagProfile(
	address: string,
): Promise<BeamioAddressProfileRecord | null> {
	const key = String(address || '')
		.trim()
		.toLowerCase()
	if (key && mirrorMap[key]) return mirrorMap[key]
	const c = getClient()
	if (!c.isReady) return mirrorMap[key] ?? null
	try {
		return await c.lookup(address)
	} catch {
		return mirrorMap[key] ?? null
	}
}

export async function mergeBeamioTagTrusted(
	incoming: Record<string, BeamioAddressProfileRecord | null | undefined>,
): Promise<void> {
	const c = getClient()
	if (!activePartition || !c.isReady) {
		for (const [k, v] of Object.entries(incoming)) {
			if (v) mirrorMap[k.toLowerCase()] = v
		}
		return
	}
	await c.mergeTrusted(incoming)
}

export async function ingestBeamioTagSearchResponse(
	res: unknown,
	contextAddress?: string,
): Promise<void> {
	const c = getClient()
	if (!activePartition || !c.isReady) return
	await c.ingest(res, contextAddress)
}

export function searchBeamioTagLocalSync(query: string, limit = 20): BeamioAddressProfileRecord[] {
	const q = String(query || '')
		.trim()
		.replace(/^@+/, '')
		.toLowerCase()
	if (!q) return []
	const hits: BeamioAddressProfileRecord[] = []
	for (const rec of Object.values(mirrorMap)) {
		const tag = String(rec.accountName || rec.username || '')
			.trim()
			.replace(/^@+/, '')
			.toLowerCase()
		if (!tag) continue
		if (tag.startsWith(q) || tag.includes(q)) {
			hits.push(rec)
			if (hits.length >= limit) break
		}
	}
	return hits
}

export async function setMerchantWarmTargets(cardAddresses: string[]): Promise<void> {
	const c = await awaitMerchantReady()
	await c.merchantSetWarmTargets(cardAddresses)
}

export async function ensureMerchantCards(
	cardAddresses: string[],
	opts?: { maxPerTick?: number; forceRefresh?: boolean },
): Promise<Record<string, MerchantCardRecord>> {
	const c = await awaitMerchantReady()
	const r = await c.merchantEnsure(cardAddresses, opts)
	return { ...merchantMirrorMap, ...(r?.patch || {}) }
}

export async function mergeTrustedMerchantCards(
	incoming: Record<string, MerchantCardRecord | null | undefined>,
): Promise<void> {
	const c = await awaitMerchantReady()
	const patch = await c.merchantMergeTrusted(incoming)
	warmTagOwnersFromMerchantPatch(patch)
}

export async function lookupMerchantCard(
	cardAddress: string,
): Promise<MerchantCardRecord | null> {
	const key = normalizeCardAddressKey(cardAddress)
	if (key && merchantMirrorMap[key]) return merchantMirrorMap[key]
	const c = await awaitMerchantReady()
	try {
		return await c.merchantLookup(cardAddress)
	} catch {
		return key ? merchantMirrorMap[key] ?? null : null
	}
}
