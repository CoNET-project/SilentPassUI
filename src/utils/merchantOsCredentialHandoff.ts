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

function readOnce(): MerchantOsCredentialHandoff | null {
	const params = readHashQuery()
	if (!params) return null
	const tag = normalizeBeamioTagInput(params.get(TAG_KEY) || '')
	const pin = (params.get(PIN_KEY) || '').trim()
	const openBusinessDetails = params.get(FLOW_KEY) === FLOW_BUSINESS
	stripHashCredentials()
	if (!BEAMIO_TAG_ALLOWED_RE.test(tag) || !pin || pin.length > PIN_MAX) return null
	return { tag, pin, openBusinessDetails }
}

// Capture before HashRouter's layout effect rewrites `location.hash`.
if (typeof window !== 'undefined') {
	held = readOnce()
}

/** Tag + access password captured from the hash, already removed from the address bar. */
export function takeMerchantOsCredentialHandoff(): MerchantOsCredentialHandoff | null {
	return held ?? null
}

export function hasMerchantOsCredentialHandoff(): boolean {
	return takeMerchantOsCredentialHandoff() != null
}

/** Create merchant card: business details first, then unlock from the handed tag and password. */
export function merchantOsHandoffOpensBusinessDetails(): boolean {
	return takeMerchantOsCredentialHandoff()?.openBusinessDetails === true
}

let pinFlight: Promise<unknown> | null = null

/** One in-flight unlock shared across a StrictMode remount. */
export function beginMerchantOsHandoffRestore(
	restore: (creds: MerchantOsCredentialHandoff) => Promise<unknown>,
): Promise<unknown> | null {
	const creds = takeMerchantOsCredentialHandoff()
	if (!creds) return null
	if (!pinFlight) {
		pinFlight = Promise.resolve()
			.then(() => restore(creds))
			.catch(() => null)
	}
	return pinFlight
}
