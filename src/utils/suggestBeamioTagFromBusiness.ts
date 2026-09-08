import {
	BEAMIO_TAG_MAX_LEN,
	BEAMIO_TAG_MIN_LEN,
	isValidBeamioTag,
	normalizeBeamioTagInput,
} from './beamioTagRules'

/** Marketplace / review hosts — never used as a BeamioTag source (copy of Cluster lookup skip set). */
const MARKETPLACE_APEX_HOSTS = new Set([
	'ubereats.com',
	'doordash.com',
	'yelp.com',
	'tripadvisor.com',
	'grubhub.com',
	'skipthedishes.com',
	'opentable.com',
	'google.com',
	'maps.google.com',
])

/** Venue / legal tokens stripped when the remaining slug stays ≥ min length. */
const GENERIC_TRAILING_TOKENS = new Set([
	'restaurant',
	'restro',
	'resto',
	'bar',
	'bistro',
	'diner',
	'pub',
	'kitchen',
	'grill',
	'eatery',
	'inc',
	'llc',
	'ltd',
	'corp',
	'company',
	'co',
	'the',
	'and',
	'of',
	'shop',
	'store',
	'market',
])

const MAX_AVAILABILITY_PROBES = 24

export type SuggestedBeamioTagAvailability = 'available' | 'taken' | 'unverified'

export type SuggestedBeamioTagResult = {
	tag: string
	availability: SuggestedBeamioTagAvailability
}

function decodeHtmlEntities(raw: string): string {
	return raw
		.replace(/&amp;/gi, '&')
		.replace(/&apos;/gi, "'")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/gi, '"')
		.replace(/&nbsp;/gi, ' ')
}

function hostFromWebsite(website: string | undefined): string {
	const raw = website?.trim() ?? ''
	if (!raw) return ''
	try {
		const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
		return new URL(href).hostname.toLowerCase().replace(/^www\./, '')
	} catch {
		return ''
	}
}

function isMarketplaceHost(host: string): boolean {
	if (!host) return false
	if (MARKETPLACE_APEX_HOSTS.has(host)) return true
	for (const apex of MARKETPLACE_APEX_HOSTS) {
		if (host.endsWith(`.${apex}`)) return true
	}
	return false
}

function tokenizeBusinessName(name: string): string[] {
	const decoded = decodeHtmlEntities(name)
	const spaced = decoded
		.replace(/(^|[^a-zA-Z0-9])([a-zA-Z])\s*&\s*([a-zA-Z])(?![a-zA-Z0-9])/g, '$1$2$3')
		.replace(/&/g, ' and ')
		.replace(/['’]/g, '')
		.replace(/[^a-zA-Z0-9_.]+/g, ' ')
	return spaced
		.split(/\s+/)
		.map((t) => t.toLowerCase())
		.filter((t) => t.length > 0)
}

function compactTokens(tokens: string[]): string {
	return tokens.join('').replace(/[^a-z0-9_.]/g, '')
}

function stripGenericTokens(tokens: string[]): string[] {
	if (tokens.length <= 1) return tokens
	const stripped = tokens.filter((t, i) => {
		if (i === 0 && t === 'the') return false
		if (i > 0 && GENERIC_TRAILING_TOKENS.has(t)) return false
		return true
	})
	if (compactTokens(stripped).length >= BEAMIO_TAG_MIN_LEN) return stripped
	return tokens
}

function clipTag(raw: string): string {
	const n = normalizeBeamioTagInput(raw).slice(0, BEAMIO_TAG_MAX_LEN)
	return n
}

function pushUnique(out: string[], tag: string): void {
	const clipped = clipTag(tag)
	if (!isValidBeamioTag(clipped)) return
	if (out.includes(clipped)) return
	out.push(clipped)
}

/**
 * Ranked handle candidates from a lookup business name (and optional own-site host).
 * Cluster `/addUser` allows `[a-zA-Z0-9_.]`, 3–26 chars — no hyphen.
 */
export function beamioTagCandidatesFromBusiness(
	name: string,
	website?: string,
): string[] {
	const out: string[] = []
	const tokens = tokenizeBusinessName(name)
	const stripped = stripGenericTokens(tokens)
	const compact = compactTokens(stripped)
	const full = compactTokens(tokens)

	pushUnique(out, compact)
	if (full !== compact) pushUnique(out, full)

	if (stripped.length >= 2) {
		pushUnique(out, compactTokens(stripped.slice(0, 2)))
		pushUnique(out, compactTokens([stripped[0], stripped[stripped.length - 1]]))
	}
	if (stripped[0]) pushUnique(out, stripped[0])

	const host = hostFromWebsite(website)
	if (host && !isMarketplaceHost(host)) {
		const labels = host.split('.').filter((p) => p && p !== 'www' && p !== 'com' && p !== 'net' && p !== 'org')
		const hostSlug = compactTokens(labels)
		pushUnique(out, hostSlug)
		if (labels[0]) pushUnique(out, labels[0])
	}

	const primary = out[0]
	if (primary) {
		for (let n = 2; n <= 99 && out.length < MAX_AVAILABILITY_PROBES; n++) {
			const suffix = String(n)
			const base = primary.slice(0, Math.max(BEAMIO_TAG_MIN_LEN, BEAMIO_TAG_MAX_LEN - suffix.length))
			pushUnique(out, `${base}${suffix}`)
		}
	}

	return out
}

export async function resolveRegistrableBeamioTagFromBusiness(opts: {
	name: string
	website?: string
	isAvailable: (tag: string) => Promise<boolean>
}): Promise<SuggestedBeamioTagResult> {
	const candidates = beamioTagCandidatesFromBusiness(opts.name, opts.website)
	if (candidates.length === 0) {
		return { tag: '', availability: 'taken' }
	}

	let lastTried = candidates[0]
	try {
		for (const tag of candidates) {
			lastTried = tag
			const available = await opts.isAvailable(tag)
			if (available) return { tag, availability: 'available' }
		}
		return { tag: lastTried, availability: 'taken' }
	} catch {
		return { tag: candidates[0], availability: 'unverified' }
	}
}
