import { ExternalLink } from 'lucide-react'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'

/** Match http(s) and www. URLs inside merchant description / About / welcome copy. */
const DISCOVER_DESCRIPTION_URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`\]})]+/gi

function stripDiscoverDescriptionUrlTrailingPunctuation(raw: string): string {
	return raw.replace(/[)\]}>,.;:!?'"”’。、）》]+$/u, '')
}

function formatDiscoverDescriptionUrlCapsuleLabel(u: URL): string {
	const host = u.host.replace(/^www\./i, '')
	let rest = `${u.pathname === '/' ? '' : u.pathname}${u.search}${u.hash}`
	if (rest.length > 1 && rest.endsWith('/')) rest = rest.slice(0, -1)
	const full = `${host}${rest}`
	if (full.length <= 40) return full
	return `${full.slice(0, 20)}…${full.slice(-12)}`
}

function resolveDiscoverDescriptionUrl(rawMatch: string): { href: string; label: string } | null {
	const cleaned = stripDiscoverDescriptionUrlTrailingPunctuation(rawMatch.trim())
	if (!cleaned) return null
	const candidate = /^www\./i.test(cleaned) ? `https://${cleaned}` : cleaned
	try {
		const u = new URL(candidate)
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
		return { href: u.href, label: formatDiscoverDescriptionUrlCapsuleLabel(u) }
	} catch {
		return null
	}
}

type DiscoverDescriptionTextSegment =
	| { kind: 'text'; value: string }
	| { kind: 'url'; href: string; label: string }

export function splitDiscoverDescriptionWithUrls(text: string): DiscoverDescriptionTextSegment[] {
	if (!text) return [{ kind: 'text', value: '' }]
	const segments: DiscoverDescriptionTextSegment[] = []
	const re = new RegExp(DISCOVER_DESCRIPTION_URL_RE.source, 'gi')
	let lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = re.exec(text)) != null) {
		const raw = match[0]
		const start = match.index
		if (start > lastIndex) {
			segments.push({ kind: 'text', value: text.slice(lastIndex, start) })
		}
		const cleaned = stripDiscoverDescriptionUrlTrailingPunctuation(raw)
		const trailing = raw.slice(cleaned.length)
		const resolved = resolveDiscoverDescriptionUrl(cleaned)
		if (resolved) {
			segments.push({ kind: 'url', href: resolved.href, label: resolved.label })
			if (trailing) segments.push({ kind: 'text', value: trailing })
		} else {
			segments.push({ kind: 'text', value: raw })
		}
		lastIndex = start + raw.length
	}
	if (lastIndex < text.length) {
		segments.push({ kind: 'text', value: text.slice(lastIndex) })
	}
	return segments.length > 0 ? segments : [{ kind: 'text', value: text }]
}

function DiscoverDescriptionUrlCapsule({
	href,
	label,
	tone = 'onLight',
}: {
	href: string
	label: string
	/** `onDark` = Exclusive Welcome / blue promo cards; `onLight` = About panel. */
	tone?: 'onLight' | 'onDark'
}) {
	const chrome =
		tone === 'onDark'
			? 'border-white/35 bg-white/20 text-white hover:bg-white/30'
			: 'border-[#dce2f7] bg-[#e9edff] text-[#0051d1] hover:bg-[#dce6ff] dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70'
	return (
		<button
			type="button"
			onClick={() => openExternalUrl(href)}
			className={`mx-0.5 inline-flex max-w-[min(100%,18rem)] items-center gap-1 rounded-full border px-2.5 py-0.5 align-baseline text-[12px] font-semibold transition active:scale-[0.98] ${chrome}`}
			aria-label={`Open link ${href}`}
			title={href}
		>
			<span className="min-w-0 truncate tabular-nums">{label}</span>
			<ExternalLink className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2.25} aria-hidden />
		</button>
	)
}

/**
 * Renders merchant copy with http(s)/www URLs as clickable capsules.
 * Opens via `openExternalUrl` (native shell bridge → system browser; else new tab).
 */
export function DiscoverDescriptionTextWithUrlCapsules({
	text,
	tone = 'onLight',
}: {
	text: string
	tone?: 'onLight' | 'onDark'
}) {
	const segments = splitDiscoverDescriptionWithUrls(text)
	const hasUrl = segments.some((s) => s.kind === 'url')
	if (!hasUrl) return <>{text}</>
	return (
		<>
			{segments.map((segment, index) =>
				segment.kind === 'url' ? (
					<DiscoverDescriptionUrlCapsule
						key={`desc-url-${index}-${segment.href}`}
						href={segment.href}
						label={segment.label}
						tone={tone}
					/>
				) : (
					<span key={`desc-text-${index}`}>{segment.value}</span>
				),
			)}
		</>
	)
}
