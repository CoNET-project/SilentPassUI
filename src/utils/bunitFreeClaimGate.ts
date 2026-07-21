import { ethers } from 'ethers'
import {
	CONET_BUNIT_AIRDROP_ADDRESS,
	CONET_BUNIT_AIRDROP_PREVIOUS_ADDRESS,
} from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

/** 与 deployments/conet-addresses.json 最旧 BUnitAirdropLegacy 同步 */
const CONET_BUNIT_AIRDROP_LEGACY_ADDRESS = '0xb9cf45AF87b16853c8F48a16b0495F030309e70f'

const DB_NAME = 'beamio_bunit_free_claim_gate_v1'
const DB_VERSION = 1
const STORE = 'wallets'

const FREE_CLAIM_VIEW_ABI = [
	'function hasClaimed(address) view returns (bool)',
	'function alreadyClaimedFree(address) view returns (bool)',
] as const

type BunitFreeClaimSkipRecord = {
	address: string
	skippedAt: number
	source: 'chain' | 'api'
}

function normalizeWalletKey(eoa: string): string {
	return ethers.getAddress(eoa).toLowerCase()
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION)
		req.onupgradeneeded = () => {
			const db = req.result
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: 'address' })
			}
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

/** IndexedDB：该 EOA 已确认无需再申领（链上或 API 已判定） */
export async function isBUnitFreeClaimSkippedInIdb(eoa: string): Promise<boolean> {
	if (typeof indexedDB === 'undefined' || !eoa) return false
	try {
		const key = normalizeWalletKey(eoa)
		const db = await openDb()
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE, 'readonly')
			const req = tx.objectStore(STORE).get(key)
			req.onsuccess = () => resolve(!!req.result)
			req.onerror = () => reject(req.error)
			tx.oncomplete = () => db.close()
		})
	} catch {
		return false
	}
}

export async function markBUnitFreeClaimSkippedInIdb(
	eoa: string,
	source: 'chain' | 'api',
): Promise<void> {
	if (typeof indexedDB === 'undefined' || !eoa) return
	try {
		const key = normalizeWalletKey(eoa)
		const db = await openDb()
		const record: BunitFreeClaimSkipRecord = {
			address: key,
			skippedAt: Date.now(),
			source,
		}
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, 'readwrite')
			tx.objectStore(STORE).put(record)
			tx.oncomplete = () => {
				db.close()
				resolve()
			}
			tx.onerror = () => reject(tx.error)
		})
	} catch {
		// ignore quota / private mode
	}
}

/**
 * RPC：是否已领过免费 B-Unit（V2 alreadyClaimedFree + previous/oldest hasClaimed）。
 * null = 不可信，不得写入 skip。
 */
export async function readBUnitFreeClaimHasClaimedOnChain(
	eoa: string,
	provider: ethers.Provider = conetDepinProvider,
): Promise<boolean | null> {
	if (!eoa || !ethers.isAddress(eoa)) return null
	const claimant = ethers.getAddress(eoa)
	let anyTrustedRead = false
	try {
		const canonical = new ethers.Contract(CONET_BUNIT_AIRDROP_ADDRESS, FREE_CLAIM_VIEW_ABI, provider)
		anyTrustedRead = true
		if (await canonical.alreadyClaimedFree(claimant)) return true
	} catch {
		// Fall through to hasClaimed probes.
	}
	for (const addr of [
		CONET_BUNIT_AIRDROP_ADDRESS,
		CONET_BUNIT_AIRDROP_PREVIOUS_ADDRESS,
		CONET_BUNIT_AIRDROP_LEGACY_ADDRESS,
	]) {
		try {
			const c = new ethers.Contract(addr, FREE_CLAIM_VIEW_ABI, provider)
			anyTrustedRead = true
			if (await c.hasClaimed(claimant)) return true
		} catch {
			// 单合约读失败继续；全无成功则 null
		}
	}
	return anyTrustedRead ? false : null
}

export function isBUnitClaimAlreadyClaimedError(message?: string, code?: string): boolean {
	if (code === 'already_claimed') return true
	if (!message) return false
	const m = message.toLowerCase()
	return (
		m.includes('already claimed') ||
		m.includes('claimnotavailable') ||
		m.includes('not available') ||
		m.includes('invalidamount')
	)
}

/** 提交 API 前：IDB 命中或链上已领 → 静默跳过并持久化 */
export async function gateBUnitFreeClaimBeforeSubmit(eoa: string): Promise<'proceed' | 'skip_silent'> {
	if (await isBUnitFreeClaimSkippedInIdb(eoa)) return 'skip_silent'
	const onChain = await readBUnitFreeClaimHasClaimedOnChain(eoa)
	if (onChain === true) {
		await markBUnitFreeClaimSkippedInIdb(eoa, 'chain')
		return 'skip_silent'
	}
	return 'proceed'
}
