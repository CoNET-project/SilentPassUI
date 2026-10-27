import { BEAMIO_TAG_ALLOWED_RE, normalizeBeamioTagInput } from '@/utils/beamioTagRules'

/** Hash query only. Never the server-visible search string. */
const TAG_KEY = 'tag'
const PIN_KEY = 'pin'
const FLOW_KEY = 'flow'
const FLOW_BUSINESS = 'business'
const PIN_MAX = 128

export type MerchantOsCredentialHandoff = {
	tag: string
	pin: string
	/** Create merchant card: collect business details before unlocking this wallet. */
	openBusinessDetails: boolean
}

let held: MerchantOsCredentialHandoff | null | undefined
let pinFlight: Promise<unknown> | null = null

function readHashQuery(): URLSearchParams | null {
	if (typeof window === 'undefined') return null
	const hash = window.location.hash || ''
	const q = hash.indexOf('?')
	if (q < 0) return null
	return new URLSearchParams(hash.slice(q + 1))
}

function stripHashCredentials(): void {
	if (typeof window === 'undefined') return
	const hash = window.location.hash || ''
	const q = hash.indexOf('?')
	if (q < 0) return
	const params = new URLSearchParams(hash.slice(q + 1))
	if (!params.has(TAG_KEY) && !params.has(PIN_KEY) && !params.has(FLOW_KEY)) return
	params.delete(TAG_KEY)
	params.delete(PIN_KEY)
	params.delete(FLOW_KEY)
	const path = hash.slice(1, q) || '/'
	const rest = params.toString()
	const nextHash = `#${path.startsWith('/') ? path : `/${path}`}${rest ? `?${rest}` : ''}`
	const url = `${window.location.pathname}${window.location.search}${nextHash === '#/' ? '' : nextHash}`
	window.history.replaceState(window.history.state, '', url)
}

function parseHandoffFromParams(params: URLSearchParams): MerchantOsCredentialHandoff | null {
	const tag = normalizeBeamioTagInput(params.get(TAG_KEY) || '')
	const pin = (params.get(PIN_KEY) || '').trim()
	const openBusinessDetails = params.get(FLOW_KEY) === FLOW_BUSINESS
	if (!BEAMIO_TAG_ALLOWED_RE.test(tag) || !pin || pin.length > PIN_MAX) return null
	return { tag, pin, openBusinessDetails }
}

function sameHandoff(
	a: MerchantOsCredentialHandoff | null | undefined,
	b: MerchantOsCredentialHandoff | null,
): boolean {
	if (!a || !b) return false
	return a.tag === b.tag && a.pin === b.pin && a.openBusinessDetails === b.openBusinessDetails
}

/**
 * Capture tag+pin from the current hash (and strip them).
 * Safe to call on every mount / hashchange: Agent may open Merchant OS while the SPA
 * is already loaded (held=null from a prior visit) — module-level readOnce alone misses that.
 */
export function captureMerchantOsCredentialHandoffIfPresent(): MerchantOsCredentialHandoff | null {
	const params = readHashQuery()
	if (!params) return held ?? null
	if (!params.has(TAG_KEY) && !params.has(PIN_KEY) && !params.has(FLOW_KEY)) {
		return held ?? null
	}
	const next = parseHandoffFromParams(params)
	stripHashCredentials()
	if (!next) return held ?? null
	if (sameHandoff(held, next)) return held ?? null
	held = next
	// New credentials must allow a fresh unlock attempt.
	pinFlight = null
	return held
}

// Capture before HashRouter's layout effect rewrites `location.hash`.
if (typeof window !== 'undefined') {
	held = captureMerchantOsCredentialHandoffIfPresent()
}

/** Tag + access password captured from the hash, already removed from the address bar. */
export function takeMerchantOsCredentialHandoff(): MerchantOsCredentialHandoff | null {
	return held ?? null
}

/** Drop held handoff after unlock succeeds (or when already unlocked). */
export function clearMerchantOsCredentialHandoff(): void {
	held = null
	pinFlight = null
}

export function hasMerchantOsCredentialHandoff(): boolean {
	return takeMerchantOsCredentialHandoff() != null
}

/** Create merchant card: business details first, then unlock from the handed tag and password. */
export function merchantOsHandoffOpensBusinessDetails(): boolean {
	return takeMerchantOsCredentialHandoff()?.openBusinessDetails === true
}

/** One in-flight unlock shared across a StrictMode remount. Clears on failure so a later retry can run. */
export function beginMerchantOsHandoffRestore(
	restore: (creds: MerchantOsCredentialHandoff) => Promise<unknown>,
): Promise<unknown> | null {
	const creds = takeMerchantOsCredentialHandoff()
	if (!creds) return null
	if (!pinFlight) {
		pinFlight = Promise.resolve()
			.then(() => restore(creds))
			.then((result) => {
				const ok =
					result != null &&
					result !== false &&
					typeof result === 'object' &&
					Array.isArray((result as { profiles?: unknown }).profiles) &&
					((result as { profiles: unknown[] }).profiles.length > 0)
				if (!ok) {
					pinFlight = null
				} else {
					// Keep pinFlight resolved so StrictMode remounts reuse success;
					// caller must clearMerchantOsCredentialHandoff after navigate.
				}
				return result
			})
			.catch(() => {
				pinFlight = null
				return null
			})
	}
	return pinFlight
}
