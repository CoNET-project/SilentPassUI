/**
 * Trusted CL skim totals — local-first, beneficiary-keyed.
 *
 * VDR `clRewardPaid` is private (no getter). UI recovers per-guardian CNET from
 * Cluster `GET /api/v2/conet/validators/:pubkey` (Blockscout validator page JSON).
 * Never genesis `eth_getLogs`. `toBlock` is unused for scans (API snapshot → 0).
 *
 * Works in window (localStorage) and App Daemon Worker (IndexedDB).
 */

export type NodeRewardSettledCursor = {
	toBlock: number
	byGuardian: Map<number, bigint>
}

type StoredPayload = {
	v: 1
	savedAt: number
	toBlock: number
	entries: Array<[number, string]>
}

const LS_PREFIX = 'beamio:vdrNodeRewardSettled:v1:'
const MAX_STORE_CHARS = 120_000
const IDB_NAME = 'beamio-vdr-node-reward-settled'
const IDB_STORE = 'cursors'
const IDB_VER = 1

const mem = new Map<string, NodeRewardSettledCursor>()

function storageKey(beneficiaryLower: string): string {
	return `${LS_PREFIX}${beneficiaryLower}`
}

function cloneCursor(c: NodeRewardSettledCursor): NodeRewardSettledCursor {
	return { toBlock: c.toBlock, byGuardian: new Map(c.byGuardian) }
}

function parsePayload(raw: unknown): NodeRewardSettledCursor | null {
	const p = raw as StoredPayload
	if (!p || p.v !== 1 || !Number.isFinite(p.toBlock) || p.toBlock < 0) return null
	if (!Array.isArray(p.entries)) return null
	const byGuardian = new Map<number, bigint>()
	for (const row of p.entries) {
		if (!Array.isArray(row) || row.length < 2) continue
		const id = Number(row[0])
		if (!Number.isFinite(id)) continue
		try {
			const wei = BigInt(String(row[1] ?? '0'))
			if (wei > 0n) byGuardian.set(id, wei)
		} catch {
			/* skip malformed */
		}
	}
	return { toBlock: Math.floor(p.toBlock), byGuardian }
}

function serialize(cursor: NodeRewardSettledCursor): StoredPayload {
	const entries: Array<[number, string]> = []
	for (const [id, wei] of cursor.byGuardian) {
		if (wei > 0n) entries.push([id, wei.toString()])
	}
	return {
		v: 1,
		savedAt: Date.now(),
		toBlock: cursor.toBlock,
		entries,
	}
}

function canUseLocalStorage(): boolean {
	try {
		return typeof localStorage !== 'undefined' && localStorage !== null
	} catch {
		return false
	}
}

function loadFromLocalStorage(key: string): NodeRewardSettledCursor | null {
	if (!canUseLocalStorage()) return null
	try {
		const raw = localStorage.getItem(storageKey(key))
		if (!raw || raw.length > MAX_STORE_CHARS) return null
		return parsePayload(JSON.parse(raw))
	} catch {
		return null
	}
}

function saveToLocalStorage(key: string, cursor: NodeRewardSettledCursor): void {
	if (!canUseLocalStorage()) return
	try {
		const raw = JSON.stringify(serialize(cursor))
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(storageKey(key), raw)
	} catch {
		/* quota / private mode */
	}
}

function canUseIdb(): boolean {
	try {
		return typeof indexedDB !== 'undefined'
	} catch {
		return false
	}
}

function openIdb(): Promise<IDBDatabase | null> {
	if (!canUseIdb()) return Promise.resolve(null)
	return new Promise((resolve) => {
		try {
			const req = indexedDB.open(IDB_NAME, IDB_VER)
			req.onupgradeneeded = () => {
				const db = req.result
				if (!db.objectStoreNames.contains(IDB_STORE)) {
					db.createObjectStore(IDB_STORE)
				}
			}
			req.onsuccess = () => resolve(req.result)
			req.onerror = () => resolve(null)
		} catch {
			resolve(null)
		}
	})
}

async function loadFromIdb(key: string): Promise<NodeRewardSettledCursor | null> {
	const db = await openIdb()
	if (!db) return null
	try {
		return await new Promise((resolve) => {
			const tx = db.transaction(IDB_STORE, 'readonly')
			const req = tx.objectStore(IDB_STORE).get(key)
			req.onsuccess = () => resolve(parsePayload(req.result))
			req.onerror = () => resolve(null)
			tx.oncomplete = () => {
				try {
					db.close()
				} catch {
					/* ignore */
				}
			}
		})
	} catch {
		try {
			db.close()
		} catch {
			/* ignore */
		}
		return null
	}
}

function saveToIdb(key: string, cursor: NodeRewardSettledCursor): void {
	void (async () => {
		const db = await openIdb()
		if (!db) return
		try {
			const payload = serialize(cursor)
			await new Promise<void>((resolve) => {
				const tx = db.transaction(IDB_STORE, 'readwrite')
				tx.objectStore(IDB_STORE).put(payload, key)
				tx.oncomplete = () => resolve()
				tx.onerror = () => resolve()
				tx.onabort = () => resolve()
			})
		} catch {
			/* ignore */
		} finally {
			try {
				db.close()
			} catch {
				/* ignore */
			}
		}
	})()
}

export function peekNodeRewardSettledCursor(beneficiaryLower: string): NodeRewardSettledCursor | null {
	const key = beneficiaryLower.trim().toLowerCase()
	if (!key) return null
	const hit = mem.get(key)
	return hit ? cloneCursor(hit) : null
}

export async function loadNodeRewardSettledCursor(
	beneficiaryLower: string,
): Promise<NodeRewardSettledCursor | null> {
	const key = beneficiaryLower.trim().toLowerCase()
	if (!key) return null
	const memHit = mem.get(key)
	if (memHit) return cloneCursor(memHit)
	const ls = loadFromLocalStorage(key)
	if (ls) {
		mem.set(key, cloneCursor(ls))
		return cloneCursor(ls)
	}
	const idb = await loadFromIdb(key)
	if (idb) {
		mem.set(key, cloneCursor(idb))
		saveToLocalStorage(key, idb)
		return cloneCursor(idb)
	}
	return null
}

/** Trusted success only — caller must have a completed scan window. */
export function saveNodeRewardSettledCursor(
	beneficiaryLower: string,
	cursor: NodeRewardSettledCursor,
): void {
	const key = beneficiaryLower.trim().toLowerCase()
	if (!key || !Number.isFinite(cursor.toBlock) || cursor.toBlock < 0) return
	const next = cloneCursor(cursor)
	mem.set(key, next)
	saveToLocalStorage(key, next)
	saveToIdb(key, next)
}
