/**
 * Generic http(s) link detection for chat preview cards.
 * Beamio special share URLs (app-download / open-claim / redeem / discover) stay on
 * `chatShareLinkPreview.ts` + `ChatShareLinkPreviewCard` — do not route them here.
 */

const GENERIC_URL_RE = /https?:\/\/[^\s<>"']+/gi

export function normalizeHttpUrlCandidate(raw: string): string {
	let s = (raw || '').trim()
	if (!s) return ''
	s = s.replace(/[),.;!?]+$/g, '')
	try {
		const u = new URL(s)
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
		return u.toString()
	} catch {
		return ''
	}
}

export function extractHttpUrlsFromText(text: string): string[] {
	const input = text?.trim() ?? ''
	if (!input) return []
	const found: string[] = []
	const seen = new Set<string>()
	const re = new RegExp(GENERIC_URL_RE.source, 'gi')
	let m: RegExpExecArray | null
	while ((m = re.exec(input))) {
		const norm = normalizeHttpUrlCandidate(m[0])
		if (!norm || seen.has(norm)) continue
		seen.add(norm)
		found.push(norm)
	}
	if (!found.length) {
		const whole = normalizeHttpUrlCandidate(input)
		if (whole) found.push(whole)
	}
	return found
}

export function findHttpUrlInText(text: string): string | null {
	const urls = extractHttpUrlsFromText(text)
	return urls[0] ?? null
}

/** Message is (mostly) a single http(s) URL. */
export function isPrimarilyHttpUrlMessage(text: string): boolean {
	const t = text?.trim() ?? ''
	if (!t) return false
	const url = findHttpUrlInText(t)
	if (!url) return false
	const withoutUrl = t.replace(url, '').trim()
	return withoutUrl.length === 0 || /^[\s"'<>]+$/.test(withoutUrl)
}

export function genericLinkHostLabel(url: string): string {
	try {
		const u = new URL(url)
		return u.hostname.replace(/^www\./, '')
	} catch {
		return 'Link'
	}
}

export function genericLinkTitleFromUrl(url: string): string {
	try {
		const u = new URL(url)
		const path = u.pathname.replace(/\/+$/, '') || '/'
		if (path === '/') return u.hostname.replace(/^www\./, '')
		const parts = path.split('/').filter(Boolean)
		const last = parts[parts.length - 1] || path
		try {
			return decodeURIComponent(last).replace(/[-_]+/g, ' ')
		} catch {
			return last
		}
	} catch {
		return 'Link'
	}
}

export function genericLinkFaviconUrl(url: string): string {
	try {
		const u = new URL(url)
		return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=128`
	} catch {
		return ''
	}
}

export function chatGenericLinkListPreview(text: string): string | null {
	if (!isPrimarilyHttpUrlMessage(text)) return null
	const url = findHttpUrlInText(text)
	if (!url) return null
	return genericLinkHostLabel(url)
}
