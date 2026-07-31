import {
	collectDeepLinkSearchParams,
	parseCouponOpenClaimFromParams,
	parseRedeemClaimFromParams,
} from '@/utils/beamioDeepLinkParams'
import { parseDiscoverMerchantFromParams } from '@/utils/discoverMerchantShare'

/** Share meta from `GET /api/share/coupon-claim-meta` (homepage OG / app-download). */
export type ChatShareLinkMeta = {
	cardAddress: string
	couponId: string
	merchantName?: string
	shareHeadline?: string
	shareKind?: 'open_claim' | 'redeem' | 'discover_merchant'
	distributionKind?: 'coupon' | 'catalog' | 'merchant'
	title: string
	subtitle: string
	iconUrl: string
	backgroundImage: string
	backgroundColorHex: string
	expiresLabel: string
	shareUrl: string
	ogImageUrl: string
	tokenId?: string
	supplySummary?: string | null
}

export type ChatShareLinkKind = 'open_claim' | 'redeem' | 'discover_merchant' | 'app_share'

const BEAMIO_API = 'https://beamio.app/api'

const URL_IN_TEXT_RE =
	/https?:\/\/(?:www\.)?beamio\.app\/(?:app-download(?:\?[^\s]*)?|app\/?(?:\?[^\s]*)?)/gi

const metaCache = new Map<string, { at: number; meta: ChatShareLinkMeta | null }>()
const metaInflight = new Map<string, Promise<ChatShareLinkMeta | null>>()
const META_TTL_MS = 60_000

/** Normalize a pasted Beamio share / deep-link URL (trim trailing punctuation). */
export function normalizeBeamioShareUrlCandidate(raw: string): string {
	let s = (raw || '').trim()
	if (!s) return ''
	// Strip common trailing punctuation from chat paste
	s = s.replace(/[),.;!?]+$/g, '')
	try {
		const u = new URL(s)
		if (u.hostname.replace(/^www\./, '') !== 'beamio.app') return ''
		return u.toString()
	} catch {
		return ''
	}
}

export function extractBeamioShareUrlsFromText(text: string): string[] {
	const input = text?.trim() ?? ''
	if (!input) return []
	const found: string[] = []
	const seen = new Set<string>()
	const re = new RegExp(URL_IN_TEXT_RE.source, 'gi')
	let m: RegExpExecArray | null
	while ((m = re.exec(input))) {
		const norm = normalizeBeamioShareUrlCandidate(m[0])
		if (!norm || seen.has(norm)) continue
		seen.add(norm)
		found.push(norm)
	}
	// Whole message is a bare URL (no scheme match edge cases)
	if (!found.length) {
		const whole = normalizeBeamioShareUrlCandidate(input)
		if (whole) found.push(whole)
	}
	return found
}

export function classifyBeamioShareUrl(url: string): ChatShareLinkKind | null {
	const norm = normalizeBeamioShareUrlCandidate(url)
	if (!norm) return null
	try {
		const u = new URL(norm)
		const hostOk = u.hostname.replace(/^www\./, '') === 'beamio.app'
		if (!hostOk) return null
		const path = u.pathname.replace(/\/+$/, '') || '/'
		const isAppDownload = path === '/app-download'
		const isApp = path === '/app' || path.startsWith('/app/')
		if (!isAppDownload && !isApp) return null

		const sp = collectDeepLinkSearchParams(norm)
		if (parseRedeemClaimFromParams(sp)) return 'redeem'
		if (parseCouponOpenClaimFromParams(sp)) return 'open_claim'
		if (parseDiscoverMerchantFromParams(sp)) return 'discover_merchant'
		if (isAppDownload && (u.searchParams.get('target') || '').trim()) return 'app_share'
		if (isApp && (sp.get('beamiocard') || '').trim()) return 'app_share'
		return null
	} catch {
		return null
	}
}

/** First Beamio share URL in message text, if any. */
export function findBeamioShareUrlInText(text: string): string | null {
	for (const url of extractBeamioShareUrlsFromText(text)) {
		if (classifyBeamioShareUrl(url)) return url
	}
	return null
}

/** True when the message is (mostly) a Beamio share link — show image card instead of raw URL bubble. */
export function isPrimarilyBeamioShareLinkMessage(text: string): boolean {
	const t = text?.trim() ?? ''
	if (!t) return false
	const url = findBeamioShareUrlInText(t)
	if (!url) return false
	const withoutUrl = t.replace(url, '').trim()
	// Allow short surrounding whitespace / punctuation only
	return withoutUrl.length === 0 || /^[\s"'<>]+$/.test(withoutUrl)
}

export function chatShareLinkListPreview(text: string): string | null {
	const url = findBeamioShareUrlInText(text)
	if (!url) return null
	const kind = classifyBeamioShareUrl(url)
	switch (kind) {
		case 'open_claim':
			return 'Coupon'
		case 'redeem':
			return 'Redeem'
		case 'discover_merchant':
			return 'Merchant'
		case 'app_share':
			return 'Beamio link'
		default:
			return null
	}
}

export function shareKindLabel(meta: ChatShareLinkMeta | null, kind: ChatShareLinkKind | null): string {
	if (meta?.distributionKind === 'catalog') return 'Catalog'
	if (meta?.shareKind === 'discover_merchant' || meta?.distributionKind === 'merchant') return 'Merchant'
	if (meta?.shareKind === 'redeem' || kind === 'redeem') return 'Redeem'
	if (meta?.shareKind === 'open_claim' || kind === 'open_claim') return 'Coupon'
	return 'Beamio'
}

/**
 * Unwrap app-download `target` to in-app HashRouter location (`/` + search).
 * Falls back to opening the share URL externally when unwrap fails.
 */
export function resolveBeamioShareInAppNavigation(shareUrl: string): { pathname: string; search: string } | null {
	const norm = normalizeBeamioShareUrlCandidate(shareUrl)
	if (!norm) return null
	try {
		const u = new URL(norm)
		if (u.pathname.replace(/\/+$/, '') === '/app-download') {
			const target = (u.searchParams.get('target') || '').trim()
			if (!target) return null
			const t = new URL(target)
			if (t.origin !== 'https://beamio.app') return null
			if (t.pathname !== '/app/' && t.pathname !== '/app' && !t.pathname.startsWith('/app/')) return null
			return { pathname: '/', search: t.search || '' }
		}
		if (u.pathname === '/app/' || u.pathname === '/app' || u.pathname.startsWith('/app/')) {
			return { pathname: '/', search: u.search || '' }
		}
		return null
	} catch {
		return null
	}
}

export async function fetchChatShareLinkMeta(shareUrl: string): Promise<ChatShareLinkMeta | null> {
	const url = normalizeBeamioShareUrlCandidate(shareUrl)
	if (!url) return null

	const cached = metaCache.get(url)
	if (cached && Date.now() - cached.at < META_TTL_MS) return cached.meta

	const inflight = metaInflight.get(url)
	if (inflight) return inflight

	const p = (async () => {
		try {
			const res = await fetch(
				`${BEAMIO_API}/share/coupon-claim-meta?target=${encodeURIComponent(url)}`,
			)
			if (!res.ok) {
				metaCache.set(url, { at: Date.now(), meta: null })
				return null
			}
			const json = (await res.json()) as { ok?: boolean; meta?: ChatShareLinkMeta }
			const meta = json?.ok && json.meta ? json.meta : null
			metaCache.set(url, { at: Date.now(), meta })
			return meta
		} catch {
			// Untrusted failure — do not cache as permanent empty
			return null
		} finally {
			metaInflight.delete(url)
		}
	})()

	metaInflight.set(url, p)
	return p
}
