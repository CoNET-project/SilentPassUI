/**
 * Keep the Recovery Code (`MasterKey`) out of URLs.
 *
 * Older builds wrote `?beamioTag=…&MasterKey=…` into the address bar and the PWA
 * manifest `start_url`. Such links still exist (history, home-screen icons,
 * shared screenshots). On load we take the code out of the URL straight away,
 * keep it only in memory for the one-time restore, and never write it back.
 *
 * `public/index.html` runs the same scrub inline before any other script, and
 * leaves what it found on `window.__beamioLegacyRestoreLink`. This module is
 * the fallback when that inline script did not run.
 */

/** Lower-case names of query params that must never appear in a URL. */
const SECRET_PARAM_NAMES = new Set(['masterkey'])

/** Params removed together with a secret one (the restore link pairs them). */
const LEGACY_RESTORE_COMPANION_PARAMS = new Set(['beamiotag'])

export type LegacyRestoreLink = { beamioTag: string; masterKey: string }

type WindowWithStash = Window & { __beamioLegacyRestoreLink?: LegacyRestoreLink | null }

let pendingLegacyRestore: LegacyRestoreLink | null = null

export function isSecretUrlParamName(name: string): boolean {
	return SECRET_PARAM_NAMES.has(name.toLowerCase())
}

/** Remove every secret param from `params`. Returns true when something was removed. */
function deleteSecretParams(params: URLSearchParams, alsoCompanions: boolean): boolean {
	let removed = false
	for (const key of Array.from(params.keys())) {
		const lower = key.toLowerCase()
		if (SECRET_PARAM_NAMES.has(lower) || (alsoCompanions && LEGACY_RESTORE_COMPANION_PARAMS.has(lower))) {
			params.delete(key)
			removed = true
		}
	}
	return removed
}

function readParam(params: URLSearchParams, lowerName: string): string {
	for (const [key, value] of Array.from(params.entries())) {
		if (key.toLowerCase() === lowerName && value.trim()) return value.trim()
	}
	return ''
}

/** Split `#/path?query` into its parts. */
function splitHash(hash: string): { path: string; query: string } {
	const raw = hash.startsWith('#') ? hash.slice(1) : hash
	const q = raw.indexOf('?')
	return q < 0 ? { path: raw, query: '' } : { path: raw.slice(0, q), query: raw.slice(q + 1) }
}

function joinHash(path: string, params: URLSearchParams): string {
	const query = params.toString()
	if (!path && !query) return ''
	return `#${path}${query ? `?${query}` : ''}`
}

/**
 * Return `href` without secret params, in both the query and a HashRouter
 * `#/…?…` query. Other params are kept. Invalid input returns ''.
 */
export function stripSecretParamsFromUrl(href: string, opts?: { alsoCompanions?: boolean }): string {
	try {
		const url = new URL(href)
		const companions = !!opts?.alsoCompanions
		deleteSecretParams(url.searchParams, companions)
		if (url.hash) {
			const { path, query } = splitHash(url.hash)
			if (query) {
				const hashParams = new URLSearchParams(query)
				if (deleteSecretParams(hashParams, companions)) url.hash = joinHash(path, hashParams)
			}
		}
		return url.toString()
	} catch {
		return ''
	}
}

/** True when `href` carries a secret param in its query or hash query. */
export function urlHasSecretParams(href: string): boolean {
	try {
		const url = new URL(href)
		if (Array.from(url.searchParams.keys()).some(isSecretUrlParamName)) return true
		const { query } = splitHash(url.hash)
		return !!query && Array.from(new URLSearchParams(query).keys()).some(isSecretUrlParamName)
	} catch {
		return false
	}
}

/**
 * Run once at startup, before anything reads or copies the URL. Moves a legacy
 * `beamioTag` + `MasterKey` pair into memory and rewrites the current history
 * entry without them.
 */
export function captureLegacyRestoreLink(): void {
	if (typeof window === 'undefined') return
	watchHashForSecrets()
	const w = window as WindowWithStash
	const stashed = w.__beamioLegacyRestoreLink
	if (stashed && typeof stashed.masterKey === 'string' && stashed.masterKey) {
		pendingLegacyRestore = { beamioTag: stashed.beamioTag || '', masterKey: stashed.masterKey }
	}
	try {
		delete w.__beamioLegacyRestoreLink
	} catch {
		w.__beamioLegacyRestoreLink = null
	}

	const href = window.location.href
	if (!urlHasSecretParams(href)) return
	try {
		const url = new URL(href)
		const { query } = splitHash(url.hash)
		const hashParams = new URLSearchParams(query)
		const masterKey = readParam(url.searchParams, 'masterkey') || readParam(hashParams, 'masterkey')
		const beamioTag = readParam(url.searchParams, 'beamiotag') || readParam(hashParams, 'beamiotag')
		if (masterKey && !pendingLegacyRestore) {
			pendingLegacyRestore = { beamioTag: beamioTag.replace(/^@+/, ''), masterKey }
		}
	} catch {
		/* still scrub below */
	}
	const clean = stripSecretParamsFromUrl(href, { alsoCompanions: true })
	try {
		window.history.replaceState(window.history.state, '', clean || window.location.pathname)
	} catch {
		/* ignore */
	}
}

let hashWatchInstalled = false

/**
 * A link opened in a tab that is already on the app only changes the hash, so
 * the page does not reload. Scrub secret params on every hash change too. This
 * listener is added before the router's, so the router sees the clean URL.
 */
function watchHashForSecrets(): void {
	if (hashWatchInstalled) return
	hashWatchInstalled = true
	window.addEventListener('hashchange', () => {
		const href = window.location.href
		if (!urlHasSecretParams(href)) return
		const clean = stripSecretParamsFromUrl(href, { alsoCompanions: true })
		try {
			window.history.replaceState(window.history.state, '', clean || window.location.pathname)
		} catch {
			/* ignore */
		}
	})
}

/** One-time read of the legacy restore pair captured at startup. */
export function takeLegacyRestoreLink(): LegacyRestoreLink | null {
	const value = pendingLegacyRestore
	pendingLegacyRestore = null
	return value
}

/** True while a captured legacy restore pair is waiting to be used. */
export function hasPendingLegacyRestoreLink(): boolean {
	return !!pendingLegacyRestore
}
