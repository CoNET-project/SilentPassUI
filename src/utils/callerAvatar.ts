import { createAvatar } from '@dicebear/core'
import { funEmoji } from '@dicebear/collection'
import { dispatchNativeSystemCallAction, getCashTreesNativeNfcHost } from './cashTreesNativeNfc'

/**
 * Incoming-call avatar drawn on this device. The caller is known only after
 * the offer is decrypted and its signature checked; loading an avatar from a
 * server at that moment would tell that server (DiceBear, Beamio API, an IPFS
 * gateway) that this IP is being called by that tag. So the call windows never
 * fetch: the fun-emoji avatar is generated locally from the verified
 * BeamioTag, with the same seed the chat list uses (the tag without "@").
 * No verified tag: '' (the window shows its default mark).
 */
const avatarByTag = new Map<string, string>()

export function callerAvatarSeed(verifiedTag: string | undefined): string {
	const plain = String(verifiedTag || '').trim().replace(/^@+/, '')
	const lower = plain.toLowerCase()
	if (!plain || lower === 'beamio' || lower === 'unknown' || lower === 'unknow' || /^0x[0-9a-f]{40}$/i.test(plain)) return ''
	return plain
}

export function localCallerAvatarDataUri(verifiedTag: string | undefined): string {
	const seed = callerAvatarSeed(verifiedTag)
	if (!seed) return ''
	const cached = avatarByTag.get(seed)
	if (cached) return cached
	try {
		const uri = createAvatar(funEmoji, { seed, size: 96 }).toDataUri()
		if (avatarByTag.size > 100) avatarByTag.clear()
		avatarByTag.set(seed, uri)
		return uri
	} catch {
		return ''
	}
}

/** The avatar as PNG base64 (no data: prefix), for the native shell. '' on failure. */
export function renderCallerAvatarPngBase64(verifiedTag: string, size = 128): Promise<string> {
	const uri = localCallerAvatarDataUri(verifiedTag)
	if (!uri || typeof document === 'undefined') return Promise.resolve('')
	return new Promise((resolve) => {
		const img = new Image()
		img.onload = () => {
			try {
				const canvas = document.createElement('canvas')
				canvas.width = size
				canvas.height = size
				const ctx = canvas.getContext('2d')
				if (!ctx) return resolve('')
				ctx.drawImage(img, 0, 0, size, size)
				resolve(canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''))
			} catch {
				resolve('')
			}
		}
		img.onerror = () => resolve('')
		img.src = uri
	})
}

const SHELL_AVATARS_KEY = 'beamio_shell_caller_avatars_v1'

const shellAvatarKeys = (): Set<string> => {
	try {
		const raw = window.localStorage.getItem(SHELL_AVATARS_KEY)
		const list = raw ? JSON.parse(raw) : []
		return new Set(Array.isArray(list) ? list.filter((v: unknown) => typeof v === 'string') : [])
	} catch {
		return new Set()
	}
}

/** Rows not yet handed to the shell: wallet + verified tag (deduped, at most `limit`). */
export function callerAvatarRowsToSync(
	contacts: ReadonlyArray<{ address?: string; tag?: string }>,
	already: ReadonlySet<string>,
	limit = 40,
): Array<{ address: string; tag: string; key: string }> {
	const out: Array<{ address: string; tag: string; key: string }> = []
	const seen = new Set<string>()
	for (const c of contacts) {
		const address = String(c.address || '').trim().toLowerCase()
		const seed = callerAvatarSeed(c.tag)
		if (!/^0x[0-9a-f]{40}$/.test(address) || !seed) continue
		const key = `${address}:${seed.toLowerCase()}`
		if (already.has(key) || seen.has(key)) continue
		seen.add(key)
		out.push({ address, tag: seed, key })
		if (out.length >= limit) break
	}
	return out
}

/**
 * Android shell only: hand contacts' verified tags and avatars to the shell,
 * so its call windows (CallStyle notification, full-screen page) show them
 * without looking anything up during a call. Sends each wallet+tag once.
 */
export async function syncCallerAvatarsToShell(contacts: ReadonlyArray<{ address?: string; tag?: string }>): Promise<number> {
	if (typeof window === 'undefined' || getCashTreesNativeNfcHost() !== 'android') return 0
	const already = shellAvatarKeys()
	const rows = callerAvatarRowsToSync(contacts, already)
	if (!rows.length) return 0
	const payload: Array<{ address: string; tag: string; png: string }> = []
	for (const row of rows) {
		payload.push({ address: row.address, tag: row.tag, png: await renderCallerAvatarPngBase64(row.tag) })
	}
	if (!dispatchNativeSystemCallAction('cacheCallerAvatars', { rows: payload })) return 0
	rows.forEach(row => already.add(row.key))
	try {
		window.localStorage.setItem(SHELL_AVATARS_KEY, JSON.stringify(Array.from(already).slice(-500)))
	} catch {
		/* best effort: the shell keeps what it got */
	}
	return rows.length
}
