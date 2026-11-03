/**
 * Browser (TS Worker) mailbox ACK for inbound lines the page has stored.
 *
 * Native shells hand the armor hashes to their SDK (`ackInbound`). In the
 * browser the page ACKs itself: every frame the worker decrypted gets a
 * `gossip_delivery_ack` to the own mailbox once the page has stored (or
 * deliberately dropped) its line. That covers voice control lines, expired
 * signals, duplicates and lines already in history, which the page's per-message
 * ACK never reached, so the mailbox kept them and replayed them on every listen.
 * Frames the worker could not decrypt never reach the page and are not ACKed.
 */

export type BrowserInboundAckDeps = {
	/** Own wallet address (the mailbox checks it against its route record). */
	eoa: string
	/** Posts one `gossip_delivery_ack` command to the own mailbox; true when accepted. */
	post: (command: Record<string, unknown>) => Promise<boolean>
	/** Hash already ACKed by this page (shared with the page's other ACK paths). */
	isSent: (hash: string) => boolean
	/** Remember an accepted ACK. */
	noteSent: (hash: string) => void
	/** Parallel posts; default 4. */
	concurrency?: number
	/** Seconds; default now. */
	nowSeconds?: () => number
	/** Tries per hash (a refused post is retried through another random entry); default 2. */
	attempts?: number
	/** Pause before a retry, ms; default 1000. */
	retryDelayMs?: number
}

const ARMOR_HASH = /^0x[0-9a-f]{64}$/

/** ACK each distinct, well-formed hash once. Resolves to the number accepted. */
export async function ackInboundHashesInBrowser(
	hashes: readonly string[],
	deps: BrowserInboundAckDeps,
): Promise<number> {
	const eoa = String(deps.eoa || '').trim()
	if (!eoa) return 0
	const queue: string[] = []
	const seen = new Set<string>()
	for (const raw of hashes) {
		const hash = String(raw || '').trim().toLowerCase()
		if (!ARMOR_HASH.test(hash) || seen.has(hash) || deps.isSent(hash)) continue
		seen.add(hash)
		queue.push(hash)
	}
	if (!queue.length) return 0
	const now = deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000))
	const tries = Math.max(1, deps.attempts ?? 2)
	const retryDelayMs = Math.max(0, deps.retryDelayMs ?? 1000)
	let accepted = 0
	const worker = async () => {
		for (let hash = queue.shift(); hash; hash = queue.shift()) {
			for (let attempt = 1; attempt <= tries; attempt++) {
				if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
				let ok = false
				try {
					ok = await deps.post({
						command: 'gossip_delivery_ack',
						walletAddress: eoa,
						armorHash: hash,
						timestamp: now(),
					})
				} catch {
					ok = false
				}
				if (ok) {
					deps.noteSent(hash)
					accepted += 1
					break
				}
				// Still refused after the last try: the mailbox keeps the line and redelivers it.
			}
		}
	}
	const lanes = Math.max(1, Math.min(deps.concurrency ?? 4, queue.length))
	await Promise.all(Array.from({ length: lanes }, worker))
	return accepted
}
