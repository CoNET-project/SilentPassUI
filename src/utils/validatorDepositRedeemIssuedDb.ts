/**
 * Local IndexedDB ledger for ValidatorDepositRedeem redeem codes issued by this admin EOA.
 * Secret codes stay on device only — never sent to the API (beamio-redeem-workflow).
 */

import { CONET_VALIDATOR_DEPOSIT_REDEEM } from '@/config/chainAddresses'

const DB_NAME = 'beamio_validator_deposit_redeem_issued_v1'
const DB_VERSION = 1
const STORE = 'issued'

export type ValidatorDepositRedeemIssuedStatus =
	| 'submitting'
	| 'pending'
	| 'claimed'
	| 'cancelled'
	| 'create_failed'
	| 'unknown'

export type ValidatorDepositRedeemIssuedRecord = {
	/** codeHash — primary key */
	id: string
	adminEoaLower: string
	contract: string
	secretCode: string
	codeHash: string
	validatorCount: string
	targetNodeIp: string
	gbMiningNodeCount: string
	allowedClaimer: string
	referrer: string
	validAfter: string
	validBefore: string
	/** When true, claiming accrues 100 CNET airdrop per validator node (claimable after the on-chain claimable date). */
	airdrop?: boolean
	localStatus: ValidatorDepositRedeemIssuedStatus
	createTxHash?: string
	cancelTxHash?: string
	chainActive?: boolean
	chainConsumed?: boolean
	chainValidatorCount?: string
	createdAt: string
	updatedAt: string
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION)
		req.onupgradeneeded = () => {
			const db = req.result
			if (!db.objectStoreNames.contains(STORE)) {
				const store = db.createObjectStore(STORE, { keyPath: 'id' })
				store.createIndex('adminEoaLower', 'adminEoaLower', { unique: false })
				store.createIndex('createdAt', 'createdAt', { unique: false })
			}
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

export async function listValidatorDepositRedeemIssuedForAdmin(
	adminEoaLower: string,
): Promise<ValidatorDepositRedeemIssuedRecord[]> {
	if (!adminEoaLower) return []
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly')
		const store = tx.objectStore(STORE)
		const idx = store.index('adminEoaLower')
		const req = idx.getAll(adminEoaLower)
		req.onsuccess = () => {
			const rows = (req.result as ValidatorDepositRedeemIssuedRecord[]) ?? []
			rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
			resolve(rows)
		}
		req.onerror = () => reject(req.error)
	})
}

export async function getValidatorDepositRedeemIssued(id: string): Promise<ValidatorDepositRedeemIssuedRecord | null> {
	if (!id) return null
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly')
		const req = tx.objectStore(STORE).get(id)
		req.onsuccess = () => resolve((req.result as ValidatorDepositRedeemIssuedRecord) ?? null)
		req.onerror = () => reject(req.error)
	})
}

export async function putValidatorDepositRedeemIssued(record: ValidatorDepositRedeemIssuedRecord): Promise<void> {
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite')
		tx.objectStore(STORE).put(record)
		tx.oncomplete = () => resolve()
		tx.onerror = () => reject(tx.error)
	})
}

export async function deleteValidatorDepositRedeemIssued(id: string): Promise<void> {
	if (!id) return
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite')
		tx.objectStore(STORE).delete(id)
		tx.oncomplete = () => resolve()
		tx.onerror = () => reject(tx.error)
	})
}

export async function mergeValidatorDepositRedeemIssued(
	id: string,
	patch: Partial<ValidatorDepositRedeemIssuedRecord>,
): Promise<ValidatorDepositRedeemIssuedRecord | null> {
	const prev = await getValidatorDepositRedeemIssued(id)
	if (!prev) return null
	const next: ValidatorDepositRedeemIssuedRecord = {
		...prev,
		...patch,
		id: prev.id,
		adminEoaLower: prev.adminEoaLower,
		secretCode: prev.secretCode,
		codeHash: prev.codeHash,
		updatedAt: patch.updatedAt ?? new Date().toISOString(),
	}
	await putValidatorDepositRedeemIssued(next)
	return next
}

export function newValidatorDepositRedeemIssuedDraft(params: {
	adminEoa: string
	secretCode: string
	codeHash: string
	validatorCount: string
	targetNodeIp: string
	gbMiningNodeCount: string
	allowedClaimer: string
	referrer: string
	validAfter: string
	validBefore: string
	airdrop?: boolean
}): ValidatorDepositRedeemIssuedRecord {
	const now = new Date().toISOString()
	return {
		id: params.codeHash,
		adminEoaLower: params.adminEoa.trim().toLowerCase(),
		contract: CONET_VALIDATOR_DEPOSIT_REDEEM,
		secretCode: params.secretCode,
		codeHash: params.codeHash,
		validatorCount: params.validatorCount,
		targetNodeIp: params.targetNodeIp,
		gbMiningNodeCount: params.gbMiningNodeCount,
		allowedClaimer: params.allowedClaimer,
		referrer: params.referrer,
		validAfter: params.validAfter,
		validBefore: params.validBefore,
		airdrop: Boolean(params.airdrop),
		localStatus: 'submitting',
		createdAt: now,
		updatedAt: now,
	}
}
