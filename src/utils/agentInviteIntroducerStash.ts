import { ethers } from 'ethers'
import { collectDeepLinkSearchParams } from '@/utils/beamioDeepLinkParams'

/**
 * Invite deep-link `invite=0x…` (introducer EOA).
 *
 * Distinct from Discover merchant-card `ref=` (share bind / social points).
 * Survives URL strip / onboarding until RegisterReferrer succeeds.
 */

const STORAGE_KEY = 'beamio:agentInviteIntroducer:v1'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Fired after a new invite introducer is stashed (wallet bind may retry on this). */
export const AGENT_INVITE_INTRODUCER_STASHED_EVENT = 'beamio:agentInviteIntroducerStashed'

type StoredEntry = { introducerEoa: string; savedAt: number }

function notifyStashed(): void {
	if (typeof window === 'undefined') return
	try {
		window.dispatchEvent(new CustomEvent(AGENT_INVITE_INTRODUCER_STASHED_EVENT))
	} catch {
		/* ignore */
	}
}

function normalizeAddress(raw?: string | null): string | null {
	const value = raw?.trim() ?? ''
	if (!value || !ethers.isAddress(value)) return null
	try {
		return ethers.getAddress(value)
	} catch {
		return null
	}
}

function readStored(): StoredEntry | null {
	if (typeof localStorage === 'undefined') return null
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as StoredEntry
		if (!parsed?.introducerEoa || typeof parsed.savedAt !== 'number') return null
		if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
			localStorage.removeItem(STORAGE_KEY)
			return null
		}
		const introducerEoa = normalizeAddress(parsed.introducerEoa)
		if (!introducerEoa) {
			localStorage.removeItem(STORAGE_KEY)
			return null
		}
		return { introducerEoa, savedAt: parsed.savedAt }
	} catch {
		return null
	}
}

/** Parse `invite=` from URL search / hash params. */
export function parseAgentInviteIntroducerFromParams(sp: URLSearchParams): string | null {
	const raw = (sp.get('invite') ?? sp.get('Invite') ?? '').trim()
	return normalizeAddress(raw)
}

export function parseAgentInviteIntroducerFromHref(href?: string | null): string | null {
	const input =
		href?.trim() || (typeof window !== 'undefined' ? window.location.href : '')
	if (!input) return null
	return parseAgentInviteIntroducerFromParams(collectDeepLinkSearchParams(input))
}

export function stashAgentInviteIntroducer(introducerEoa?: string | null): void {
	const introducer = normalizeAddress(introducerEoa)
	if (!introducer) return
	if (typeof localStorage === 'undefined') return
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ introducerEoa: introducer, savedAt: Date.now() } satisfies StoredEntry),
		)
		notifyStashed()
	} catch {
		/* ignore quota / private mode */
	}
}

export function readAgentInviteIntroducer(): string | null {
	return readStored()?.introducerEoa ?? null
}

export function clearAgentInviteIntroducer(): void {
	if (typeof localStorage === 'undefined') return
	try {
		localStorage.removeItem(STORAGE_KEY)
	} catch {
		/* ignore */
	}
}

/** Stash from current href, then strip `invite` from the document URL. */
export function stashAgentInviteIntroducerFromCurrentUrl(): string | null {
	if (typeof window === 'undefined') return null
	const introducer = parseAgentInviteIntroducerFromHref(window.location.href)
	if (!introducer) return null
	stashAgentInviteIntroducer(introducer)
	try {
		const next = new URL(window.location.href)
		next.searchParams.delete('invite')
		next.searchParams.delete('Invite')
		// Also strip from hash query if present (#/?invite=…)
		if (next.hash.includes('invite=')) {
			const hash = next.hash.replace(/^#/, '')
			const qIdx = hash.indexOf('?')
			if (qIdx >= 0) {
				const path = hash.slice(0, qIdx)
				const hp = new URLSearchParams(hash.slice(qIdx + 1))
				hp.delete('invite')
				hp.delete('Invite')
				const qs = hp.toString()
				next.hash = qs ? `${path}?${qs}` : path
			}
		}
		window.history.replaceState(window.history.state, '', next.toString())
	} catch {
		/* ignore */
	}
	return introducer
}

/** Consumer invite URL for an introducer EOA (app-download friendly). */
export function buildAgentInviteAppUrl(introducerEoa: string): string {
	const addr = normalizeAddress(introducerEoa)
	if (!addr) return ''
	const app = `https://beamio.app/app/?invite=${addr}`
	return `https://beamio.app/app-download?target=${encodeURIComponent(app)}`
}
