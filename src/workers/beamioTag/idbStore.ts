/**
 * IndexedDB row store for BeamioTag serverDB (worker-only).
 * - profiles: partition + addressLower (EOA-partitioned @beamioTag)
 * - merchantCards: cardLower (global merchant program card metadata)
 */

import type { BeamioAddressProfileRecord, MerchantCardRecord } from './protocol'

const DB_NAME = 'beamio-tag-db'
const DB_VERSION = 2
const STORE = 'profiles'
const MERCHANT_STORE = 'merchantCards'
const META_STORE = 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION)
		req.onupgradeneeded = (ev) => {
			const db = req.result
			const oldVersion = ev.oldVersion || 0
			if (oldVersion < 1) {
				if (!db.objectStoreNames.contains(STORE)) {
					const os = db.createObjectStore(STORE, { keyPath: 'id' })
					os.createIndex('partition', 'partition', { unique: false })
				}
				if (!db.objectStoreNames.contains(META_STORE)) {
					db.createObjectStore(META_STORE, { keyPath: 'key' })
				}
			}
			if (oldVersion < 2) {
				if (!db.objectStoreNames.contains(MERCHANT_STORE)) {
					db.createObjectStore(MERCHANT_STORE, { keyPath: 'cardLower' })
				}
			}
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
	return dbPromise
}

function rowId(partition: string, addressLower: string): string {
	return `${partition.toLowerCase()}:${addressLower.toLowerCase()}`
}

type ProfileRow = {
	id: string
	partition: string
	addressLower: string
	record: BeamioAddressProfileRecord
}

type MerchantCardRow = {
	cardLower: string
	record: MerchantCardRecord
}

async function withStore<T>(
	storeName: string,
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
	const db = await openDb()
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(storeName, mode)
		const store = tx.objectStore(storeName)
		const req = fn(store)
		req.onsuccess = () => resolve(req.result as T)
		req.onerror = () => reject(req.error)
	})
}

export async function idbGetProfile(
	partition: string,
	addressLower: string,
): Promise<BeamioAddressProfileRecord | undefined> {
	try {
		const row = await withStore<ProfileRow | undefined>(STORE, 'readonly', (s) =>
			s.get(rowId(partition, addressLower)),
		)
		return row?.record
	} catch {
		return undefined
	}
}

export async function idbPutProfile(partition: string, record: BeamioAddressProfileRecord): Promise<void> {
	const addressLower = record.addressLower.toLowerCase()
	const row: ProfileRow = {
		id: rowId(partition, addressLower),
		partition: partition.toLowerCase(),
		addressLower,
		record: { ...record, addressLower },
	}
	try {
		await withStore(STORE, 'readwrite', (s) => s.put(row))
	} catch {
		/* quota / private mode */
	}
}

export async function idbPutMany(
	partition: string,
	records: Record<string, BeamioAddressProfileRecord>,
): Promise<void> {
	const db = await openDb()
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite')
		const store = tx.objectStore(STORE)
		for (const rec of Object.values(records)) {
			if (!rec?.addressLower) continue
			const addressLower = rec.addressLower.toLowerCase()
			const row: ProfileRow = {
				id: rowId(partition, addressLower),
				partition: partition.toLowerCase(),
				addressLower,
				record: { ...rec, addressLower },
			}
			store.put(row)
		}
		tx.oncomplete = () => resolve()
		tx.onerror = () => reject(tx.error)
	}).catch(() => {
		/* ignore */
	})
}

export async function idbLoadPartitionMap(
	partition: string,
): Promise<Record<string, BeamioAddressProfileRecord>> {
	const out: Record<string, BeamioAddressProfileRecord> = {}
	try {
		const db = await openDb()
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, 'readonly')
			const store = tx.objectStore(STORE)
			const index = store.index('partition')
			const req = index.openCursor(IDBKeyRange.only(partition.toLowerCase()))
			req.onsuccess = () => {
				const cursor = req.result
				if (!cursor) return
				const row = cursor.value as ProfileRow
				if (row?.record?.addressLower) {
					out[row.addressLower.toLowerCase()] = row.record
				}
				cursor.continue()
			}
			tx.oncomplete = () => resolve()
			tx.onerror = () => reject(tx.error)
		})
	} catch {
		/* empty */
	}
	return out
}

export async function idbGetMerchantCard(cardLower: string): Promise<MerchantCardRecord | undefined> {
	try {
		const row = await withStore<MerchantCardRow | undefined>(MERCHANT_STORE, 'readonly', (s) =>
			s.get(cardLower.toLowerCase()),
		)
		return row?.record
	} catch {
		return undefined
	}
}

export async function idbPutMerchantCards(records: Record<string, MerchantCardRecord>): Promise<void> {
	const db = await openDb()
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(MERCHANT_STORE, 'readwrite')
		const store = tx.objectStore(MERCHANT_STORE)
		for (const rec of Object.values(records)) {
			if (!rec?.addressLower) continue
			const cardLower = rec.addressLower.toLowerCase()
			const row: MerchantCardRow = {
				cardLower,
				record: { ...rec, addressLower: cardLower },
			}
			store.put(row)
		}
		tx.oncomplete = () => resolve()
		tx.onerror = () => reject(tx.error)
	}).catch(() => {
		/* ignore */
	})
}

export async function idbLoadMerchantCardMap(): Promise<Record<string, MerchantCardRecord>> {
	const out: Record<string, MerchantCardRecord> = {}
	try {
		const db = await openDb()
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(MERCHANT_STORE, 'readonly')
			const store = tx.objectStore(MERCHANT_STORE)
			const req = store.openCursor()
			req.onsuccess = () => {
				const cursor = req.result
				if (!cursor) return
				const row = cursor.value as MerchantCardRow
				if (row?.record?.addressLower) {
					out[row.record.addressLower.toLowerCase()] = row.record
				}
				cursor.continue()
			}
			tx.oncomplete = () => resolve()
			tx.onerror = () => reject(tx.error)
		})
	} catch {
		/* empty */
	}
	return out
}

export async function idbGetMeta(key: string): Promise<unknown> {
	try {
		const row = await withStore<{ key: string; value: unknown } | undefined>(META_STORE, 'readonly', (s) =>
			s.get(key),
		)
		return row?.value
	} catch {
		return undefined
	}
}

export async function idbSetMeta(key: string, value: unknown): Promise<void> {
	try {
		await withStore(META_STORE, 'readwrite', (s) => s.put({ key, value }))
	} catch {
		/* ignore */
	}
}

export function legacyMigratedMetaKey(partition: string): string {
	return `legacy-ls-imported:${partition.toLowerCase()}`
}

export function merchantLegacyMigratedMetaKey(): string {
	return 'merchant-legacy-ls-imported:v1'
}
