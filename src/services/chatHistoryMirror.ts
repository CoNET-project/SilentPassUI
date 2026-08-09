/**
 * Chat history mirror — bridges the app's local `profile.chats[].messages` model with the
 * Beamio Chat SDK's encrypted fragmented IPFS history + on-chain head pointer
 * (ChatIndexRegistry). This lets a fresh device (after account delete/restore) rebuild the
 * conversation timeline by reading the on-chain pointer → decrypting the IPFS index.
 *
 * Design: we persist the FULL rendered `ChatMessage` JSON as the history `body` and, on
 * restore, dedup-merge it back directly (never re-running `makeMessage`, which would flip a
 * JSON-with-sendId outbound message to `from:'them'`). `ChatMessage.from` already encodes the
 * direction, so restore is fully symmetric for both inbound and outbound.
 */
import type { HistoryEntry } from '../vendor/beamio-chat-sdk/types'
import { appendWorkerHistory } from './chatWorkerBridge'

/** Stable dedup key for a rendered chat message (mirrors `makeMessage` semantics). */
const messageDedupKey = (m: ChatMessage): string =>
	(m?.sendId && String(m.sendId)) ||
	(m?.id && !m.id.startsWith('tmp_') ? String(m.id) : '') ||
	(m?.createdAt != null ? String(m.createdAt) : '')

/**
 * Persist a single rendered `ChatMessage` (already merged into the local timeline) to the
 * encrypted history + on-chain pointer. Best-effort: failures never surface into the UI path.
 */
export const mirrorChatMessageToHistory = (
	peerEoa: string | undefined,
	msg: ChatMessage | undefined,
	dir: 'in' | 'out',
): void => {
	const peer = (peerEoa || '').toLowerCase()
	if (!peer || !msg) return
	// Skip local optimistic placeholders — the "sent" copy is mirrored once it settles.
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

/**
 * Merge decrypted history entries (from a `historyBuffer` batch) into an existing message
 * list, deduping by sendId/id/createdAt and preserving each entry's own `from` direction.
 * Returns a new sorted array; entries already present are ignored (local copy wins).
 */
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

		// Backfill direction/timestamp from the history envelope when the body omits them.
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
