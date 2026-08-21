import { ethers } from 'ethers'

/**
 * Share-link `ref=` per merchant card.
 *
 * The deep-link params are stripped right after `/discover` opens and Discover also replaces
 * router state, so the referrer must survive both. Kept until the on-chain bind succeeds:
 * a first open may fail (wallet not ready / AA not deployed) and the bind is immutable, so
 * a later session must be able to retry with the original referrer.
 */

const STORAGE_KEY = 'beamio:discoverShareReferrer:v1'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Fired after a new share-link referrer is stashed (wallet bind may retry on this). */
export const DISCOVER_SHARE_REFERRER_STASHED_EVENT = 'beamio:discoverShareReferrerStashed'

function notifyDiscoverShareReferrerStashed(): void {
	if (typeof window === 'undefined') return
	try {
		window.dispatchEvent(new CustomEvent(DISCOVER_SHARE_REFERRER_STASHED_EVENT))
	} catch {
		/* ignore */
	}
}

type StoredEntry = { referrerEoa: string; savedAt: number }
type StoredMap = Record<string, StoredEntry>

function normalizeAddress(raw?: string | null): string | null {
	const value = raw?.trim() ?? ''
	if (!value || !ethers.isAddress(value)) return null
	try {
		return ethers.getAddress(value)
	} catch {
		return null
	}
}

function readAll(): StoredMap {
	if (typeof localStorage === 'undefined') return {}
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return {}
		const parsed = JSON.parse(raw) as StoredMap
		if (!parsed || typeof parsed !== 'object') return {}
		const now = Date.now()
		const kept: StoredMap = {}
		for (const [card, entry] of Object.entries(parsed)) {
			if (!entry?.referrerEoa || typeof entry.savedAt !== 'number') continue
			if (now - entry.savedAt > MAX_AGE_MS) continue
			kept[card] = entry
		}
		return kept
	} catch {
		return {}
	}
}

function writeAll(map: StoredMap): void {
	if (typeof localStorage === 'undefined') return
	try {
		if (Object.keys(map).length === 0) {
			localStorage.removeItem(STORAGE_KEY)
			return
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
	} catch {
		/* ignore quota / private mode */
	}
}

/** Remember the latest share-link referrer for this card until its bind is confirmed. */
export function stashDiscoverShareReferrer(cardAddress?: string | null, referrerEoa?: string | null): void {
	const card = normalizeAddress(cardAddress)
	const referrer = normalizeAddress(referrerEoa)
	if (!card || !referrer) return
	const map = readAll()
	const key = card.toLowerCase()
	map[key] = { referrerEoa: referrer, savedAt: Date.now() }
	writeAll(map)
	notifyDiscoverShareReferrerStashed()
}

/** All pending card → referrer pairs, for retrying binds once the wallet/AA is ready. */
export function listDiscoverShareReferrers(): { cardAddress: string; referrerEoa: string }[] {
	const out: { cardAddress: string; referrerEoa: string }[] = []
	for (const [card, entry] of Object.entries(readAll())) {
		const cardAddress = normalizeAddress(card)
		const referrerEoa = normalizeAddress(entry.referrerEoa)
		if (cardAddress && referrerEoa) out.push({ cardAddress, referrerEoa })
	}
	return out
}

export function readDiscoverShareReferrer(cardAddress?: string | null): string | null {
	const card = normalizeAddress(cardAddress)
	if (!card) return null
	return normalizeAddress(readAll()[card.toLowerCase()]?.referrerEoa)
}

/** Drop after the referee↔referrer relation is settled on chain (bound, already bound, or invalid). */
export function clearDiscoverShareReferrer(cardAddress?: string | null): void {
	const card = normalizeAddress(cardAddress)
	if (!card) return
	const map = readAll()
	const key = card.toLowerCase()
	if (!map[key]) return
	delete map[key]
	writeAll(map)
}
