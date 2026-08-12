/**
 * Chat history mirror — bridges local `profile.chats[].messages` with the Beamio
 * Chat SDK encrypted IPFS fragments + ChatIndexRegistry on-chain head pointer.
 *
 * Recover / Lock wipes local chats[]; history restore must CREATE missing peer
 * sessions, not only merge into existing rows.
 *
 * Persist the FULL rendered `ChatMessage` JSON as history `body`. On restore,
 * dedup-merge directly (never re-run `makeMessage`, which would flip outbound
 * JSON-with-sendId to `from:'them'`).
 */
import type { HistoryEntry } from '../vendor/beamio-chat-sdk/types'
import { appendWorkerHistory } from './chatWorkerBridge'

const messageDedupKey = (m: ChatMessage): string =>
	(m?.sendId && String(m.sendId)) ||
	(m?.id && !m.id.startsWith('tmp_') ? String(m.id) : '') ||
	(m?.createdAt != null ? String(m.createdAt) : '')

export const extractInboundSendIdFromDisplayText = (displayText: string): string | undefined => {
	const raw = String(displayText || '').trim()
	if (!raw.startsWith('{')) return undefined
	try {
		let cur: unknown = JSON.parse(raw)
		for (let i = 0; i < 8; i++) {
			if (!cur || typeof cur !== 'object') break
			const o = cur as Record<string, unknown>
			const sid = o.sendId
			if (typeof sid === 'string' && sid.trim()) return sid.trim()
			if (typeof o.text === 'string' && o.text.trim().startsWith('{')) {
				try {
					cur = JSON.parse(o.text)
				} catch {
					break
				}
				continue
			}
			break
		}
	} catch {
		/* ignore */
	}
	return undefined
}

export const mirrorChatMessageToHistory = (
	peerEoa: string | undefined,
	msg: ChatMessage | undefined,
	dir: 'in' | 'out',
): void => {
	const peer = (peerEoa || '').toLowerCase()
	if (!peer || !msg) return
	if (msg.id && msg.id.startsWith('tmp_') && msg.status !== 'sent') return
	const ts = Number(msg.createdAt)
	let body = ''
	try {
		body = JSON.stringify(msg)
	} catch {
		return
	}
	if (!body) return
	void appendWorkerHistory({
		peer,
		dir,
		ts: Number.isFinite(ts) ? ts : Date.now(),
		sendId: msg.sendId,
		body,
	})
}

export const mergeHistoryEntriesIntoMessages = (
	existing: ChatMessage[] | undefined,
	entries: HistoryEntry[] | undefined,
): { messages: ChatMessage[]; added: number } => {
	const base = Array.isArray(existing) ? existing.slice() : []
	if (!entries || entries.length === 0) return { messages: base, added: 0 }

	const seen = new Set<string>()
	for (const m of base) {
		const key = messageDedupKey(m)
		if (key) seen.add(key)
	}

	let added = 0
	for (const entry of entries) {
		if (!entry || typeof entry.body !== 'string' || !entry.body) continue
		let parsed: ChatMessage | null = null
		try {
			parsed = JSON.parse(entry.body) as ChatMessage
		} catch {
			parsed = null
		}
		if (!parsed || typeof parsed !== 'object') continue

		if (parsed.from !== 'me' && parsed.from !== 'them') {
			parsed.from = entry.dir === 'out' ? 'me' : 'them'
		}
		if (parsed.createdAt == null && Number.isFinite(entry.ts)) parsed.createdAt = entry.ts
		if (!parsed.id) parsed.id = String(parsed.createdAt ?? entry.ts ?? Date.now())
		if (parsed.status == null) parsed.status = 'sent'

		const key = messageDedupKey(parsed)
		if (!key || seen.has(key)) continue
		seen.add(key)
		base.push(parsed)
		added += 1
	}

	if (added > 0) base.sort((a, b) => (a?.createdAt || 0) - (b?.createdAt || 0))
	return { messages: base, added }
}
