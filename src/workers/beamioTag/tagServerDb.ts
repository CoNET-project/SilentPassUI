/**
 * BeamioTag serverDB core (runs inside Worker): local-first map + remote search-users.
 */

import { ethers } from 'ethers'
import type { BeamioAddressProfileRecord } from './protocol'
import {
	BEAMIO_TAG_FETCH_MAX_PER_TICK,
	BEAMIO_TAG_PROFILE_STALE_MS,
	BEAMIO_TAG_SEARCH_USERS_URL,
} from './protocol'
import {
	idbGetMeta,
	idbLoadPartitionMap,
	idbPutMany,
	idbSetMeta,
	legacyMigratedMetaKey,
} from './idbStore'

export type SearchUsersHit = {
	username?: string
	accountName?: string
	address?: string
	image?: string
	first_name?: string
	last_name?: string
	firstName?: string
	lastName?: string
}

function normalizeAddressKey(raw: string | null | undefined): string | null {
	const t = String(raw || '').trim()
	if (!t || !ethers.isAddress(t)) return null
	try {
		return ethers.getAddress(t).toLowerCase()
	} catch {
		return null
	}
}

function pickDisplayTag(hit: SearchUsersHit): string {
	const u = String(hit.username || hit.accountName || '').trim().replace(/^@+/, '')
	return u
}

export function profileFromSearchHit(hit: SearchUsersHit, now = Date.now()): BeamioAddressProfileRecord | null {
	const addressLower = normalizeAddressKey(hit.address)
	if (!addressLower) return null
	const accountName = pickDisplayTag(hit)
	return {
		addressLower,
		accountName,
		username: accountName,
		first_name: String(hit.first_name || hit.firstName || '').trim(),
		last_name: String(hit.last_name || hit.lastName || '').trim(),
		image: String(hit.image || '').trim(),
		updatedAt: now,
	}
}

export function isProfileStale(rec: BeamioAddressProfileRecord | undefined, now = Date.now()): boolean {
	if (!rec) return true
	const tag = String(rec.accountName || rec.username || '').trim()
	if (!tag) return true
	if (!Number.isFinite(rec.updatedAt) || rec.updatedAt <= 0) return true
	return now - rec.updatedAt > BEAMIO_TAG_PROFILE_STALE_MS
}

export function mergeTrustedProfiles(
	current: Record<string, BeamioAddressProfileRecord>,
	incoming: Record<string, BeamioAddressProfileRecord | null | undefined>,
): { next: Record<string, BeamioAddressProfileRecord>; patch: Record<string, BeamioAddressProfileRecord> } {
	const next = { ...current }
	const patch: Record<string, BeamioAddressProfileRecord> = {}
	for (const [k, v] of Object.entries(incoming)) {
		if (!v) continue
		const key = k.toLowerCase()
		const prev = next[key]
		if (prev && prev.updatedAt > v.updatedAt && String(prev.accountName || '').trim()) {
			continue
		}
		next[key] = { ...v, addressLower: key }
		patch[key] = next[key]
	}
	return { next, patch }
}

/**
 * Exact-address match only when contextAddress is set (never blind results[0]).
 */
export function ingestSearchUsersResponse(
	res: unknown,
	contextAddress?: string | null,
): Record<string, BeamioAddressProfileRecord> {
	const out: Record<string, BeamioAddressProfileRecord> = {}
	const results = Array.isArray((res as { results?: unknown })?.results)
		? ((res as { results: SearchUsersHit[] }).results)
		: Array.isArray(res)
			? (res as SearchUsersHit[])
			: []
	const want = contextAddress ? normalizeAddressKey(contextAddress) : null
	const now = Date.now()
	for (const hit of results) {
		const rec = profileFromSearchHit(hit, now)
		if (!rec) continue
		if (want && rec.addressLower !== want) continue
		out[rec.addressLower] = rec
	}
	if (want && !out[want] && results.length === 1) {
		const only = profileFromSearchHit(results[0], now)
		if (only && only.addressLower === want) out[want] = only
	}
	return out
}

export function searchLocalByTagPrefix(
	map: Record<string, BeamioAddressProfileRecord>,
	query: string,
	limit = 20,
): BeamioAddressProfileRecord[] {
	const q = String(query || '')
		.trim()
		.replace(/^@+/, '')
		.toLowerCase()
	if (!q) return []
	const hits: BeamioAddressProfileRecord[] = []
	for (const rec of Object.values(map)) {
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

export class TagServerDb {
	partition = ''
	map: Record<string, BeamioAddressProfileRecord> = {}
	warmTargets: string[] = []
	searchUsersUrl = BEAMIO_TAG_SEARCH_USERS_URL
	private inflightByKey = new Map<string, Promise<BeamioAddressProfileRecord | null>>()
	private emitUpdated: (
		patch: Record<string, BeamioAddressProfileRecord>,
		snapshot: Record<string, BeamioAddressProfileRecord>,
	) => void

	constructor(
		emitUpdated: (
			patch: Record<string, BeamioAddressProfileRecord>,
			snapshot: Record<string, BeamioAddressProfileRecord>,
		) => void,
	) {
		this.emitUpdated = emitUpdated
	}

	async loadPartition(
		partition: string,
		legacyMap?: Record<string, BeamioAddressProfileRecord>,
	): Promise<void> {
		this.partition = String(partition || '').toLowerCase()
		this.map = await idbLoadPartitionMap(this.partition)

		if (legacyMap && Object.keys(legacyMap).length > 0) {
			const metaKey = legacyMigratedMetaKey(this.partition)
			const already = await idbGetMeta(metaKey)
			if (!already) {
				const { next, patch } = mergeTrustedProfiles(this.map, legacyMap)
				this.map = next
				if (Object.keys(patch).length > 0) {
					await idbPutMany(this.partition, patch)
					this.emitUpdated(patch, { ...this.map })
				}
				await idbSetMeta(metaKey, { importedAt: Date.now(), count: Object.keys(legacyMap).length })
			}
		}
	}

	lookup(address: string): BeamioAddressProfileRecord | undefined {
		const key = normalizeAddressKey(address)
		if (!key) return undefined
		return this.map[key]
	}

	lookupMany(addresses: string[]): Record<string, BeamioAddressProfileRecord> {
		const out: Record<string, BeamioAddressProfileRecord> = {}
		for (const a of addresses) {
			const rec = this.lookup(a)
			if (rec) out[rec.addressLower] = rec
		}
		return out
	}

	applyTrusted(
		incoming: Record<string, BeamioAddressProfileRecord | null | undefined>,
	): Record<string, BeamioAddressProfileRecord> {
		const { next, patch } = mergeTrustedProfiles(this.map, incoming)
		this.map = next
		if (Object.keys(patch).length > 0) {
			void idbPutMany(this.partition, patch)
			this.emitUpdated(patch, { ...this.map })
		}
		return patch
	}

	ingest(res: unknown, contextAddress?: string): Record<string, BeamioAddressProfileRecord> {
		const incoming = ingestSearchUsersResponse(res, contextAddress)
		return this.applyTrusted(incoming)
	}

	setWarmTargets(addresses: string[]): void {
		const next: string[] = []
		const seen = new Set<string>()
		for (const a of addresses) {
			const key = normalizeAddressKey(a)
			if (!key || seen.has(key)) continue
			seen.add(key)
			next.push(key)
		}
		this.warmTargets = next
	}

	async fetchSearchUsers(query: string): Promise<unknown> {
		const keyward = String(query || '').trim()
		if (!keyward) return { results: [] }
		// Cluster API uses `keyward` (same as services/beamio.searchUsernameNetworkOnly).
		const url = `${this.searchUsersUrl}?${new URLSearchParams({ keyward })}`
		const res = await fetch(url, { method: 'GET', credentials: 'omit' })
		if (!res.ok) throw new Error(`search-users HTTP ${res.status}`)
		return res.json()
	}

	async searchRemote(query: string): Promise<{
		results: SearchUsersHit[]
		ingested: Record<string, BeamioAddressProfileRecord>
	}> {
		const q = String(query || '').trim()
		if (!q) return { results: [], ingested: {} }

		const asAddr = normalizeAddressKey(q)
		if (asAddr) {
			const local = this.map[asAddr]
			if (local && !isProfileStale(local)) {
				return {
					results: [
						{
							username: local.accountName || local.username,
							accountName: local.accountName || local.username,
							address: local.addressLower,
							image: local.image,
							first_name: local.first_name,
							last_name: local.last_name,
						},
					],
					ingested: { [asAddr]: local },
				}
			}
		} else {
			const localHits = searchLocalByTagPrefix(this.map, q, 20)
			const fresh = localHits.filter((r) => !isProfileStale(r))
			if (fresh.length > 0) {
				return {
					results: fresh.map((local) => ({
						username: local.accountName || local.username,
						accountName: local.accountName || local.username,
						address: local.addressLower,
						image: local.image,
						first_name: local.first_name,
						last_name: local.last_name,
					})),
					ingested: Object.fromEntries(fresh.map((r) => [r.addressLower, r])),
				}
			}
		}

		const json = await this.fetchSearchUsers(q)
		const results = Array.isArray((json as { results?: unknown })?.results)
			? ((json as { results: SearchUsersHit[] }).results)
			: []
		const ingested = this.ingest(json, asAddr || undefined)
		return { results, ingested }
	}

	private async fetchOneAddress(addressLower: string): Promise<BeamioAddressProfileRecord | null> {
		const existing = this.inflightByKey.get(addressLower)
		if (existing) return existing

		const p = (async () => {
			try {
				const json = await this.fetchSearchUsers(addressLower)
				const patch = this.ingest(json, addressLower)
				return patch[addressLower] || null
			} catch {
				return null
			} finally {
				this.inflightByKey.delete(addressLower)
			}
		})()
		this.inflightByKey.set(addressLower, p)
		return p
	}

	async ensureAddresses(
		addresses: string[],
		maxPerTick = BEAMIO_TAG_FETCH_MAX_PER_TICK,
	): Promise<{ fetched: number; remainingNeed: number; patch: Record<string, BeamioAddressProfileRecord> }> {
		const now = Date.now()
		const need: string[] = []
		const seen = new Set<string>()
		for (const a of addresses) {
			const key = normalizeAddressKey(a)
			if (!key || seen.has(key)) continue
			seen.add(key)
			if (isProfileStale(this.map[key], now)) need.push(key)
		}
		const batch = need.slice(0, Math.max(0, maxPerTick))
		const patch: Record<string, BeamioAddressProfileRecord> = {}
		for (const key of batch) {
			const rec = await this.fetchOneAddress(key)
			if (rec) patch[key] = rec
		}
		return { fetched: Object.keys(patch).length, remainingNeed: Math.max(0, need.length - batch.length), patch }
	}

	async tickWarm(): Promise<{ fetched: number; remainingNeed: number }> {
		const r = await this.ensureAddresses(this.warmTargets, BEAMIO_TAG_FETCH_MAX_PER_TICK)
		return { fetched: r.fetched, remainingNeed: r.remainingNeed }
	}
}

export { normalizeAddressKey }
