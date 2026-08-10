/**
 * BeamioTag Worker bridge — global serverDB facade for @beamioTag profiles.
 * UI / searchUsername / Provider must go through this singleton (no parallel LS truth).
 */

import { BeamioTagWorkerClient } from '@/workers/beamioTag/client'
import type { BeamioAddressProfileRecord } from '@/workers/beamioTag/protocol'
import { loadAddressProfileMap } from '@/utils/beamioAddressProfileRegistry'

type ProfilesUpdatedListener = (ev: {
	partition: string
	patch: Record<string, BeamioAddressProfileRecord>
	snapshot: Record<string, BeamioAddressProfileRecord>
}) => void

let client: BeamioTagWorkerClient | null = null
let activePartition: string | null = null
let mirrorMap: Record<string, BeamioAddressProfileRecord> = {}
const profilesUpdatedListeners = new Set<ProfilesUpdatedListener>()

let initPromise: Promise<void> | null = null

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

export function getBeamioTagMirrorMap(): Record<string, BeamioAddressProfileRecord> {
	return mirrorMap
}

export function getBeamioTagActivePartition(): string | null {
	return activePartition
}

/**
 * Init / re-init for an EOA partition. Reads legacy localStorage once and passes to Worker IDB.
 */
export async function initBeamioTagWorker(partition: string): Promise<void> {
	const part = String(partition || '')
		.trim()
		.toLowerCase()
	if (!part) return

	const run = async () => {
		const c = getClient()
		const legacyMap = loadAddressProfileMap(part)
		if (activePartition === part && c.isReady) {
			await c.setPartition(part, Object.keys(legacyMap).length ? legacyMap : undefined)
		} else {
			activePartition = part
			await c.init({
				partition: part,
				legacyMap: Object.keys(legacyMap).length ? legacyMap : undefined,
			})
		}
		try {
			mirrorMap = (await c.getSnapshot()) || {}
		} catch {
			mirrorMap = { ...legacyMap }
		}
	}

	initPromise = run()
	try {
		await initPromise
	} finally {
		initPromise = null
	}
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
