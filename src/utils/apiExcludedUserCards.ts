import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'

/** Populated by `GET /api/excludedUserCards`; clients do not maintain a static address table. */
let cachedExcluded: ReadonlySet<string> | null = null
let loadInFlight: Promise<ReadonlySet<string>> | null = null

export function normalizeUserCardAddressLower(raw: unknown): string | null {
	if (raw == null || typeof raw !== 'string') return null
	const t = raw.trim()
	if (!t || !ethers.isAddress(t)) return null
	return ethers.getAddress(t).toLowerCase()
}

/**
 * Fetch server filter list. Trusted success writes the set (including empty).
 * On failure keep last trusted cache; do not treat failure as “no exclusions”.
 */
export async function loadApiExcludedUserCards(force = false): Promise<ReadonlySet<string>> {
	if (!force && cachedExcluded) return cachedExcluded
	if (!force && loadInFlight) return loadInFlight

	loadInFlight = (async () => {
		try {
			const res = await fetch(`${beamioApi}/api/excludedUserCards`, {
				method: 'GET',
				headers: { Accept: 'application/json' },
			})
			if (!res.ok) throw new Error(`excludedUserCards HTTP ${res.status}`)
			const json = (await res.json().catch(() => null)) as { ok?: boolean; addresses?: unknown } | null
			if (!json || json.ok !== true || !Array.isArray(json.addresses)) {
				throw new Error('excludedUserCards invalid body')
			}
			const next = new Set<string>()
			for (const raw of json.addresses) {
				const lower = normalizeUserCardAddressLower(raw)
				if (lower) next.add(lower)
			}
			/** Trusted success writes even empty — distinguish "loaded, none excluded" from "not loaded yet". */
			cachedExcluded = next
		} catch {
			/* untrusted: do not overwrite cachedExcluded */
		} finally {
			loadInFlight = null
		}
		return cachedExcluded ?? new Set<string>()
	})()

	return loadInFlight
}

export function peekApiExcludedUserCards(): ReadonlySet<string> | null {
	return cachedExcluded
}

/** After successful excludeUserCard, hide card immediately before next GET /excludedUserCards. */
export function registerLocalApiExcludedUserCard(raw: unknown): void {
	const lower = normalizeUserCardAddressLower(raw)
	if (!lower) return
	const next = new Set(cachedExcluded ?? [])
	next.add(lower)
	cachedExcluded = next
}

/** Before filter list loads, returns false (lists rely on server-filtered APIs first). */
export function isApiExcludedUserCard(raw: unknown): boolean {
	const lower = normalizeUserCardAddressLower(raw)
	if (!lower || !cachedExcluded) return false
	return cachedExcluded.has(lower)
}
