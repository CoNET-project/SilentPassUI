/**
 * Agent / invite → Merchant OS unlock handoff via hash query:
 * `#/?tag=@Merchant&pin=…` optionally `&flow=business` (open business-details after unlock).
 *
 * Captured as early as possible (module load + remount + hashchange). Hash is stripped after
 * capture so credentials are not left in the address bar; a sessionStorage copy survives
 * full-document reloads that clear module state (e.g. after HashRouter / splash remount).
 *
 * Only `tag`+`pin` trigger capture/strip — bare `flow=agentCardClaim` (card claim deep link)
 * must be left for `agentCardClaimHandoff` which loads after this module.
 */

import { BEAMIO_TAG_ALLOWED_RE, normalizeBeamioTagInput } from '@/utils/beamioTagRules'

const TAG_KEY = 'tag'
const PIN_KEY = 'pin'
const FLOW_KEY = 'flow'
const FLOW_BUSINESS = 'business'
const PIN_MAX = 128
const SESSION_HANDOFF_KEY = 'beamio:merchant-os:credential-handoff:v1'

export type MerchantOsCredentialHandoff = {
	tag: string
	pin: string
	/** When true, unlock then open `/business-details` instead of post-login home/native-pos. */
	openBusinessDetails: boolean
}

let held: MerchantOsCredentialHandoff | null = null
/** Single-flight PIN restore so remount does not start a second restoreWithUserPin. */
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
	if (!params.has(TAG_KEY) && !params.has(PIN_KEY)) return
	params.delete(TAG_KEY)
	params.delete(PIN_KEY)
	// Only strip business-details flow; never touch agentCardClaim.
	if (params.get(FLOW_KEY) === FLOW_BUSINESS) params.delete(FLOW_KEY)
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

function sameHandoff(a: MerchantOsCredentialHandoff | null, b: MerchantOsCredentialHandoff): boolean {
	return (
		!!a &&
		a.tag === b.tag &&
		a.pin === b.pin &&
		a.openBusinessDetails === b.openBusinessDetails
	)
}

function persistHandoff(next: MerchantOsCredentialHandoff): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		sessionStorage.setItem(SESSION_HANDOFF_KEY, JSON.stringify(next))
	} catch {
		/* private mode / quota */
	}
}

function readPersistedHandoff(): MerchantOsCredentialHandoff | null {
	if (typeof sessionStorage === 'undefined') return null
	try {
		const raw = sessionStorage.getItem(SESSION_HANDOFF_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<MerchantOsCredentialHandoff>
		const tag =
			typeof parsed.tag === 'string' ? normalizeBeamioTagInput(parsed.tag) : ''
		const pin = typeof parsed.pin === 'string' ? parsed.pin.trim() : ''
		if (!BEAMIO_TAG_ALLOWED_RE.test(tag) || !pin || pin.length > PIN_MAX) return null
		return {
			tag,
			pin,
			openBusinessDetails: parsed.openBusinessDetails === true,
		}
	} catch {
		return null
	}
}

function clearPersistedHandoff(): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		sessionStorage.removeItem(SESSION_HANDOFF_KEY)
	} catch {
		/* ignore */
	}
}

/**
 * Re-read hash into module state. Safe to call on every BizHome mount / hashchange.
 * Prefer hash when present; otherwise keep in-memory or sessionStorage handoff.
 */
export function captureMerchantOsCredentialHandoffIfPresent(): MerchantOsCredentialHandoff | null {
	const params = readHashQuery()
	// Require both tag and pin so we never strip an unrelated `flow=` (e.g. agentCardClaim).
	if (params && params.has(TAG_KEY) && params.has(PIN_KEY)) {
		const next = parseHandoffFromParams(params)
		stripHashCredentials()
		if (next) {
			if (!sameHandoff(held, next)) {
				held = next
				persistHandoff(next)
				pinFlight = null
			}
			return held
		}
		// Invalid tag/pin shape — still stripped; fall through to persisted.
	}
	if (held) return held
	const persisted = readPersistedHandoff()
	if (persisted) {
		held = persisted
		return held
	}
	return null
}

if (typeof window !== 'undefined') {
	captureMerchantOsCredentialHandoffIfPresent()
}

/** Peek without consuming — restore needs pin until navigate succeeds. */
export function peekMerchantOsCredentialHandoff(): MerchantOsCredentialHandoff | null {
	captureMerchantOsCredentialHandoffIfPresent()
	return held
}

/** Alias for callers that “take” into React state (does not clear held). */
export function takeMerchantOsCredentialHandoff(): MerchantOsCredentialHandoff | null {
	return peekMerchantOsCredentialHandoff()
}

export function hasMerchantOsCredentialHandoff(): boolean {
	return takeMerchantOsCredentialHandoff() != null
}

/** Create merchant card: business details first, then unlock from the handed tag and password. */
export function merchantOsHandoffOpensBusinessDetails(): boolean {
	return takeMerchantOsCredentialHandoff()?.openBusinessDetails === true
}

export function clearMerchantOsCredentialHandoff(): void {
	held = null
	pinFlight = null
	clearPersistedHandoff()
}

/**
 * Deduped PIN restore for handoff. Concurrent callers share one Promise.
 * Cleared on failure or when clearMerchantOsCredentialHandoff runs.
 * Callers that collect business details (`openBusinessDetails`) skip this path.
 */
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
				}
				// Keep pinFlight resolved on success so StrictMode remounts reuse it;
				// caller must clearMerchantOsCredentialHandoff after navigate.
				return result
			})
			.catch(() => {
				pinFlight = null
				return null
			})
	}
	return pinFlight
}
