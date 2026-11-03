import { ethers } from 'ethers'
import { createAvatar } from '@dicebear/core'
import { funEmoji } from '@dicebear/collection'
import { beamioTagFromRecord, recordFromSearchPeer } from './beamioAddressProfileRegistry'
import { localCallerAvatarDataUri } from './callerAvatar'

/**
 * BeamioTag of the invite referrer, for the welcome page before a wallet exists.
 *
 * The referrer is a stranger to this device, so the tag comes from the public
 * search API (same endpoint the tag worker uses). The request carries only the
 * referrer's address: no cookies, no referrer header, nothing about this device.
 * Any failure (not found, HTTP error, timeout, offline) resolves to '' so the
 * caller keeps showing the short address.
 */

export const REFERRER_TAG_SEARCH_URL = 'https://beamio.app/api/search-users'
export const REFERRER_TAG_TIMEOUT_MS = 4_000

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>

const found = new Map<string, string>()
const inFlight = new Map<string, Promise<string>>()

/** Only the row for exactly this address counts; never another account's tag. */
export function referrerTagFromSearchResponse(res: unknown, address: string): string {
	const want = address.trim().toLowerCase()
	const rows = (res as { results?: unknown } | null)?.results
	if (!want || !Array.isArray(rows)) return ''
	const row = rows.find(
		(r) => typeof (r as { address?: unknown })?.address === 'string' && (r as { address: string }).address.toLowerCase() === want,
	) as Record<string, unknown> | undefined
	if (!row) return ''
	const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
	const rec = recordFromSearchPeer(want, {
		accountName: str(row.accountName),
		username: str(row.username),
	})
	return beamioTagFromRecord(rec)
}

export async function lookupReferrerTag(
	address: string,
	opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<string> {
	const raw = String(address || '').trim()
	if (!ethers.isAddress(raw)) return ''
	const key = raw.toLowerCase()
	const cached = found.get(key)
	if (cached) return cached
	const pending = inFlight.get(key)
	if (pending) return pending

	const fetchImpl: FetchLike = opts.fetchImpl ?? ((input, init) => fetch(input, init))
	const timeoutMs = opts.timeoutMs ?? REFERRER_TAG_TIMEOUT_MS
	const task = (async () => {
		const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
		let timer: ReturnType<typeof setTimeout> | undefined
		try {
			const url = `${REFERRER_TAG_SEARCH_URL}?${new URLSearchParams({ keyward: ethers.getAddress(raw) })}`
			const request = fetchImpl(url, {
				method: 'GET',
				credentials: 'omit',
				referrerPolicy: 'no-referrer',
				cache: 'no-store',
				...(ctrl ? { signal: ctrl.signal } : {}),
			})
			const timeout = new Promise<null>((resolve) => {
				timer = setTimeout(() => {
					ctrl?.abort()
					resolve(null)
				}, timeoutMs)
			})
			const res = await Promise.race([request, timeout])
			if (!res || !res.ok) return ''
			const json = await Promise.race([res.json(), timeout])
			const tag = referrerTagFromSearchResponse(json, key)
			if (tag) found.set(key, tag)
			return tag
		} catch {
			return ''
		} finally {
			if (timer) clearTimeout(timer)
			inFlight.delete(key)
		}
	})()
	inFlight.set(key, task)
	return task
}

/** Seed of the chat list's default avatar (no tag). */
export const DEFAULT_AVATAR_SEED = '@Beamio'
let defaultAvatarUri = ''

/**
 * Referrer avatar, drawn on this device with the chat list's rule: fun-emoji
 * seeded by the tag without "@", or the default seed when there is no tag.
 * No avatar request goes out. '' only if drawing fails (caller shows an icon).
 */
export function referrerAvatarDataUri(tag: string | undefined): string {
	const fromTag = tag ? localCallerAvatarDataUri(tag) : ''
	if (fromTag) return fromTag
	if (defaultAvatarUri) return defaultAvatarUri
	try {
		defaultAvatarUri = createAvatar(funEmoji, { seed: DEFAULT_AVATAR_SEED, size: 96 }).toDataUri()
	} catch {
		defaultAvatarUri = ''
	}
	return defaultAvatarUri
}

/** Tests only. */
export function resetReferrerTagCacheForTests(): void {
	found.clear()
	inFlight.clear()
	defaultAvatarUri = ''
}
