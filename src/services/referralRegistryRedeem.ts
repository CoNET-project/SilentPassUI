import { ethers } from 'ethers'
import { CONET_REFERRAL_REGISTRY_VAULT_V1 } from '@/config/chainAddresses'
import { beamioApi, conetDepinProvider } from '@/utils/constants'

const uuid62 = require('uuid62') as { v4: () => string }

export type ReferralRedeemKind = 'l0' | 'l1' | 'merchant' | 'adminPackage'
export type ReferralRedeemStatus = 'pending' | 'claimed' | 'cancelled'

export type ReferralRedeemCodeRecord = {
	hash: string
	secret?: string
	issuer: string
	rebateBps: string
	ratioBps: string
	validAfter: number
	validBefore: number
	active: boolean
	claimed: boolean
	cancelled: boolean
	status: ReferralRedeemStatus
}

export type IssuedReferralRedeem = {
	secret: string
	hash: string
	txHash: string
	record: ReferralRedeemCodeRecord
}

const ABI = [
	'function issueL0RedeemCode(bytes32 redeemHash,uint256 rebateBps)',
	'function issueL1RedeemCode(bytes32 redeemHash,uint256 l1RebateBps)',
	'function cancelL0RedeemCode(bytes32 redeemHash)',
	'function cancelL1RedeemCode(bytes32 redeemHash)',
	'function claimL0RedeemCode(bytes secret)',
	'function claimL1RedeemCode(bytes secret)',
	'function referralClaimNonces(address) view returns (uint256)',
	'function redeemActionNonces(address) view returns (uint256)',
	'function l0RedeemCodeCount() view returns (uint256)',
	'function l1RedeemCodeCount() view returns (uint256)',
	'function l0RedeemCodeHashAt(uint256 index) view returns (bytes32)',
	'function l1RedeemCodeHashAt(uint256 index) view returns (bytes32)',
	'function l0RedeemCodes(bytes32) view returns (address issuerAdmin,uint256 rebateBps,uint64 validAfter,uint64 validBefore,bool active,bool claimed,bool cancelled)',
	'function l1RedeemCodes(bytes32) view returns (address issuerL0,uint256 rebateBps,uint256 ratioBps,uint64 validAfter,uint64 validBefore,bool active,bool claimed,bool cancelled)',
	'function merchantCodeCount() view returns (uint256)',
	'function merchantCodeHashAt(uint256) view returns (bytes32)',
	'function merchantCodes(bytes32) view returns (address issuerL0,uint256 paidBunitAmount,uint64 validAfter,uint64 validBefore,bool active,bool claimed)',
	'function merchantRedeemBunitAirdrop() view returns (uint256)',
	'function adminMerchantPackageCodeCount() view returns (uint256)',
	'function adminMerchantPackageCodeHashAt(uint256 index) view returns (bytes32)',
	'function adminMerchantPackageCodes(bytes32) view returns (address issuerAdmin,address optionalL0,uint256 bunitAmount,bool isPaid,bool includeStartKet,uint8 paymentMethod,string description,uint64 validAfter,uint64 validBefore,bool active,bool claimed,bool cancelled)',
	'function claimAdminMerchantPackageCode(bytes secret)',
] as const

export type PackagePaymentMethod = 0 | 1 | 2 | 3

export const PACKAGE_PAYMENT_METHOD_LABELS: Record<PackagePaymentMethod, string> = {
	0: 'Cash',
	1: 'Credit card',
	2: 'Gift',
	3: 'Compensation',
}

export type AdminMerchantPackageRecord = {
	hash: string
	secret?: string
	issuer: string
	optionalL0: string
	bunitAmount: string
	bunitDisplay: string
	isPaid: boolean
	includeStartKet: boolean
	paymentMethod: PackagePaymentMethod
	paymentLabel: string
	description: string
	active: boolean
	claimed: boolean
	cancelled: boolean
	status: ReferralRedeemStatus
}

const registryRead = new ethers.Contract(CONET_REFERRAL_REGISTRY_VAULT_V1, ABI, conetDepinProvider)
const RPC_TTL_MS = 30_000
const LOCAL_LIST_CACHE_PREFIX = 'beamio:referral:redeem-list:v1:'
const LOCAL_AMOUNT_CACHE_KEY = 'beamio:referral:start-kit-airdrop:v1'
const listCache = new Map<string, { fetchedAt: number; records: ReferralRedeemCodeRecord[] }>()
const listInFlight = new Map<string, Promise<ReferralRedeemCodeRecord[]>>()
const amountCache: { fetchedAt: number; value: string } = { fetchedAt: 0, value: '' }
let amountInFlight: Promise<string> | undefined
let rpcQueue: Promise<void> = Promise.resolve()
let writeQueue: Promise<void> = Promise.resolve()
const LOCAL_SECRET_STORAGE_KEY = 'beamio:referral-redeem-secrets:v1'

function listCacheKey(kind: ReferralRedeemKind, issuer: string): string {
	return `${LOCAL_LIST_CACHE_PREFIX}${kind}:${ethers.getAddress(issuer).toLowerCase()}`
}

function readPersistentList(key: string): { fetchedAt: number; records: ReferralRedeemCodeRecord[] } | null {
	try {
		const raw = localStorage.getItem(key)
		if (!raw) return null
		const parsed = JSON.parse(raw) as { fetchedAt?: number; records?: ReferralRedeemCodeRecord[] }
		if (!Number.isFinite(parsed.fetchedAt) || !Array.isArray(parsed.records)) return null
		return { fetchedAt: Number(parsed.fetchedAt), records: parsed.records }
	} catch {
		return null
	}
}

function savePersistentList(key: string, records: ReferralRedeemCodeRecord[]): void {
	try {
		localStorage.setItem(key, JSON.stringify({ fetchedAt: Date.now(), records }))
	} catch {
		// Cache failure must not affect the trusted RPC result.
	}
}

function readLocalSecrets(): Record<string, string> {
	if (typeof window === 'undefined') return {}
	try {
		const raw = window.localStorage.getItem(LOCAL_SECRET_STORAGE_KEY)
		const parsed = raw ? JSON.parse(raw) : {}
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {}
	} catch {
		return {}
	}
}

function saveLocalSecret(kind: string, issuer: string, hash: string, secret: string): void {
	if (typeof window === 'undefined') return
	try {
		const key = `${kind}:${ethers.getAddress(issuer).toLowerCase()}:${hash.toLowerCase()}`
		const next = { ...readLocalSecrets(), [key]: secret }
		window.localStorage.setItem(LOCAL_SECRET_STORAGE_KEY, JSON.stringify(next))
	} catch {
		// Local persistence is best-effort; the code is still shown immediately after creation.
	}
}

function localSecretFor(kind: string, issuer: string, hash: string): string | undefined {
	const key = `${kind}:${ethers.getAddress(issuer).toLowerCase()}:${hash.toLowerCase()}`
	return readLocalSecrets()[key]
}

/** Re-attach device-local secrets after RPC / list-cache loads (never trust list cache for secrets). */
function hydrateAdminPackageSecrets(
	issuer: string,
	records: AdminMerchantPackageRecord[],
): AdminMerchantPackageRecord[] {
	return records.map((record) => ({
		...record,
		secret: localSecretFor('adminPackage', issuer, record.hash) ?? record.secret,
	}))
}

function stripAdminPackageSecretsForCache(
	records: AdminMerchantPackageRecord[],
): AdminMerchantPackageRecord[] {
	return records.map(({ secret: _secret, ...rest }) => rest)
}

function enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
	const next = writeQueue.then(work, work)
	writeQueue = next.then(() => undefined, () => undefined)
	return next
}

function enqueueRpc<T>(work: () => Promise<T>): Promise<T> {
	const next = rpcQueue.then(work, work)
	rpcQueue = next.then(() => undefined, () => undefined)
	return next
}

function statusOf(value: { active: boolean; claimed: boolean; cancelled: boolean }): ReferralRedeemStatus {
	if (value.claimed) return 'claimed'
	if (value.cancelled) return 'cancelled'
	return 'pending'
}

function normalizeRecord(
	hash: string,
	issuer: string,
	rebateBps: bigint,
	ratioBps: bigint,
	validAfter: bigint,
	validBefore: bigint,
	active: boolean,
	claimed: boolean,
	cancelled: boolean,
): ReferralRedeemCodeRecord {
	return {
		hash,
		issuer: ethers.getAddress(issuer),
		rebateBps: rebateBps.toString(),
		ratioBps: ratioBps.toString(),
		validAfter: Number(validAfter),
		validBefore: Number(validBefore),
		active,
		claimed,
		cancelled,
		status: statusOf({ active, claimed, cancelled }),
	}
}

export function generateReferralRedeemSecret(kind: ReferralRedeemKind): string {
	const prefix = kind === 'l0' ? 'beamio-l0' : kind === 'l1' ? 'beamio-l1' : 'beamio-start-kit'
	return `${prefix}-${uuid62.v4()}`
}

export function generateAdminMerchantPackageSecret(): string {
	return `beamio-admin-pkg-${uuid62.v4()}`
}

export function referralRedeemHash(secret: string): string {
	const normalized = secret.trim()
	if (!normalized) throw new Error('Redeem code cannot be empty.')
	return ethers.keccak256(ethers.toUtf8Bytes(normalized))
}

export function referralRedeemKindFromSecret(secret: string): ReferralRedeemKind | 'adminPackage' {
	const normalized = secret.trim().toLowerCase()
	if (normalized.startsWith('beamio-l0-')) return 'l0'
	if (normalized.startsWith('beamio-l1-')) return 'l1'
	if (normalized.startsWith('beamio-start-kit-')) return 'merchant'
	if (normalized.startsWith('beamio-admin-pkg-')) return 'adminPackage'
	throw new Error('The code must start with beamio-l0-, beamio-l1-, beamio-start-kit-, or beamio-admin-pkg-.')
}

function normalizeReferralRedeemSecret(secret: string): string {
	return secret.replace(/[\s\u200B-\u200D\uFEFF]+/g, '').trim()
}

export function referralPercentToBps(value: string): bigint {
	const normalized = value.trim()
	if (!/^(?:\d{1,3})(?:\.\d{1,2})?$/.test(normalized)) {
		throw new Error('Enter a rebate rate from 0% to 100%.')
	}
	const bps = ethers.parseUnits(normalized, 2)
	if (bps < 0n || bps > 10_000n) throw new Error('Enter a rebate rate from 0% to 100%.')
	return bps
}

export function referralBpsToPercent(value: string): string {
	return (Number(value) / 100).toLocaleString(undefined, {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	})
}

export async function fetchMerchantRedeemBunitAirdrop(): Promise<string> {
	if (amountCache.value && Date.now() - amountCache.fetchedAt < RPC_TTL_MS) return amountCache.value
	if (amountInFlight) return amountInFlight
	let persistedValue: string | undefined
	try {
		const raw = localStorage.getItem(LOCAL_AMOUNT_CACHE_KEY)
		if (raw) {
			const parsed = JSON.parse(raw) as { fetchedAt?: number; value?: string }
			if (typeof parsed.value === 'string') persistedValue = parsed.value
			if (Number.isFinite(parsed.fetchedAt) && typeof parsed.value === 'string' && Date.now() - Number(parsed.fetchedAt) < RPC_TTL_MS) {
				amountCache.value = parsed.value
				amountCache.fetchedAt = Number(parsed.fetchedAt)
				return parsed.value
			}
		}
	} catch {
		// Ignore malformed local cache and continue with a trusted RPC read.
	}
	amountInFlight = enqueueRpc(async () => {
		const amount = await registryRead.merchantRedeemBunitAirdrop()
		const value = ethers.formatUnits(amount, 6)
		amountCache.value = value
		amountCache.fetchedAt = Date.now()
		try {
			localStorage.setItem(LOCAL_AMOUNT_CACHE_KEY, JSON.stringify({ fetchedAt: amountCache.fetchedAt, value }))
		} catch {
			// Cache failure must not affect the trusted RPC result.
		}
		return value
	})
	try {
		return await amountInFlight
	} catch (error) {
		if (amountCache.value) return amountCache.value
		if (persistedValue) return persistedValue
		throw error
	} finally {
		amountInFlight = undefined
	}
}

async function readRecords(kind: ReferralRedeemKind, issuer: string): Promise<ReferralRedeemCodeRecord[]> {
	const normalizedIssuer = ethers.getAddress(issuer).toLowerCase()
	const count = BigInt(await registryRead[kind === 'l0' ? 'l0RedeemCodeCount' : kind === 'l1' ? 'l1RedeemCodeCount' : 'merchantCodeCount']())
	const records: ReferralRedeemCodeRecord[] = []
	for (let index = 0n; index < count; index += 1n) {
		const hash = await registryRead[kind === 'l0' ? 'l0RedeemCodeHashAt' : kind === 'l1' ? 'l1RedeemCodeHashAt' : 'merchantCodeHashAt'](index)
		const raw = await registryRead[kind === 'l0' ? 'l0RedeemCodes' : kind === 'l1' ? 'l1RedeemCodes' : 'merchantCodes'](hash)
		const record =
			kind === 'l0'
				? normalizeRecord(hash, raw.issuerAdmin, raw.rebateBps, 0n, raw.validAfter, raw.validBefore, raw.active, raw.claimed, raw.cancelled)
			: kind === 'l1'
				? normalizeRecord(hash, raw.issuerL0, raw.rebateBps, raw.ratioBps, raw.validAfter, raw.validBefore, raw.active, raw.claimed, raw.cancelled)
				: normalizeRecord(hash, raw.issuerL0, 0n, 0n, raw.validAfter, raw.validBefore, raw.active, raw.claimed, false)
		if (record.issuer.toLowerCase() === normalizedIssuer) {
			record.secret = localSecretFor(kind, issuer, hash)
			records.push(record)
		}
	}
	return records.reverse()
}

export async function fetchReferralRedeemCodes(
	kind: ReferralRedeemKind,
	issuer: string,
	options: { force?: boolean } = {},
): Promise<ReferralRedeemCodeRecord[]> {
	const key = `${kind}:${ethers.getAddress(issuer).toLowerCase()}`
	const cached = listCache.get(key)
	if (!options.force && cached && Date.now() - cached.fetchedAt < RPC_TTL_MS) return cached.records
	if (!options.force) {
		const persisted = readPersistentList(`${LOCAL_LIST_CACHE_PREFIX}${key}`)
		if (persisted && Date.now() - persisted.fetchedAt < RPC_TTL_MS) {
			listCache.set(key, persisted)
			return persisted.records
		}
	}
	const existing = listInFlight.get(key)
	if (existing) return existing
	const request = enqueueRpc(() => readRecords(kind, issuer))
		.then((records) => {
			listCache.set(key, { fetchedAt: Date.now(), records })
			savePersistentList(`${LOCAL_LIST_CACHE_PREFIX}${key}`, records)
			return records
		})
		.catch((error) => {
			const previous = listCache.get(key) ?? readPersistentList(`${LOCAL_LIST_CACHE_PREFIX}${key}`)
			if (previous) return previous.records
			throw error
		})
	listInFlight.set(key, request)
	try {
		return await request
	} finally {
		listInFlight.delete(key)
	}
}

export async function issueReferralRedeemCode(params: {
	kind: ReferralRedeemKind
	issuerPrivateKeyArmor: string
	rebateBps: bigint
}): Promise<IssuedReferralRedeem> {
	const secret = generateReferralRedeemSecret(params.kind)
	const hash = referralRedeemHash(secret)
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.issuerPrivateKeyArmor)
		const nonceResponse = await fetch(`${beamioApi}/api/referralRegistryRedeemNonce?account=${encodeURIComponent(wallet.address)}`)
		const nonceJson = await nonceResponse.json() as { success?: boolean; nonce?: string; error?: string }
		if (!nonceResponse.ok || !nonceJson.success || nonceJson.nonce == null) throw new Error(nonceJson.error ?? 'Could not read referral redeem nonce.')
		const nonce = BigInt(nonceJson.nonce)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const action = params.kind === 'l0' ? 'issueL0' : params.kind === 'l1' ? 'issueL1' : 'issueMerchant'
		const typeName = params.kind === 'l0' ? 'IssueL0RedeemCode' : params.kind === 'l1' ? 'IssueL1RedeemCode' : 'IssueMerchantRedeemCode'
		const types = {
			[typeName]: [
				{ name: params.kind === 'l0' ? 'admin' : 'l0', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				...(params.kind === 'merchant' ? [] : [{ name: 'rebateBps', type: 'uint256' }]),
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const message = params.kind === 'l0'
			? { admin: wallet.address, redeemHash: hash, rebateBps: params.rebateBps, nonce, deadline }
			: params.kind === 'l1'
				? { l0: wallet.address, redeemHash: hash, rebateBps: params.rebateBps, nonce, deadline }
				: { l0: wallet.address, redeemHash: hash, nonce, deadline }
		const signature = await wallet.signTypedData(
			{ name: 'ReferralRegistryVaultV1', version: '1', chainId: 224422, verifyingContract: CONET_REFERRAL_REGISTRY_VAULT_V1 },
			types,
			message,
		)
		const response = await fetch(`${beamioApi}/api/referralRegistryRedeem`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action, account: wallet.address, redeemHash: hash, ...(params.kind === 'merchant' ? {} : { rebateBps: params.rebateBps.toString() }), nonce: nonce.toString(), deadline: deadline.toString(), signature }),
		})
		const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
		if (!response.ok || !json.success || !json.txHash) throw new Error(json.error ?? 'Referral redeem relay failed.')
		saveLocalSecret(params.kind, wallet.address, hash, secret)
		const records = await fetchReferralRedeemCodes(params.kind, wallet.address, { force: true })
		const record = records.find((item) => item.hash.toLowerCase() === hash.toLowerCase())
		if (!record) throw new Error('Redeem code was confirmed but could not be read back from CoNET.')
		return { secret, hash, txHash: json.txHash, record }
	})
}

export async function cancelReferralRedeemCode(params: {
	kind: ReferralRedeemKind
	issuerPrivateKeyArmor: string
	hash: string
}): Promise<string> {
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.issuerPrivateKeyArmor)
		const nonceResponse = await fetch(`${beamioApi}/api/referralRegistryRedeemNonce?account=${encodeURIComponent(wallet.address)}`)
		const nonceJson = await nonceResponse.json() as { success?: boolean; nonce?: string; error?: string }
		if (!nonceResponse.ok || !nonceJson.success || nonceJson.nonce == null) throw new Error(nonceJson.error ?? 'Could not read referral redeem nonce.')
		const nonce = BigInt(nonceJson.nonce)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const typeName = params.kind === 'l0' ? 'CancelL0RedeemCode' : params.kind === 'l1' ? 'CancelL1RedeemCode' : 'CancelMerchantRedeemCode'
		const types = {
			[typeName]: [
				{ name: params.kind === 'l0' ? 'admin' : 'l0', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const message = params.kind === 'l0'
			? { admin: wallet.address, redeemHash: params.hash, nonce, deadline }
			: { l0: wallet.address, redeemHash: params.hash, nonce, deadline }
		const signature = await wallet.signTypedData(
			{ name: 'ReferralRegistryVaultV1', version: '1', chainId: 224422, verifyingContract: CONET_REFERRAL_REGISTRY_VAULT_V1 },
			types,
			message,
		)
		const response = await fetch(`${beamioApi}/api/referralRegistryRedeem`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: params.kind === 'l0' ? 'cancelL0' : params.kind === 'l1' ? 'cancelL1' : 'cancelMerchant', account: wallet.address, redeemHash: params.hash, nonce: nonce.toString(), deadline: deadline.toString(), signature }),
		})
		const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
		if (!response.ok || !json.success || !json.txHash) throw new Error(json.error ?? 'Referral redeem cancellation relay failed.')
		return json.txHash
	})
}

export async function setMerchantRedeemBunitAirdrop(params: {
	adminPrivateKeyArmor: string
	amountBunits: string
}): Promise<string> {
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.adminPrivateKeyArmor)
		const amount = ethers.parseUnits(params.amountBunits.trim(), 6)
		if (amount <= 0n) throw new Error('Start Kit airdrop must be greater than zero.')
		const nonceResponse = await fetch(`${beamioApi}/api/referralRegistryRedeemNonce?account=${encodeURIComponent(wallet.address)}`)
		const nonceJson = await nonceResponse.json() as { success?: boolean; nonce?: string; error?: string }
		if (!nonceResponse.ok || !nonceJson.success || nonceJson.nonce == null) throw new Error(nonceJson.error ?? 'Could not read referral redeem nonce.')
		const nonce = BigInt(nonceJson.nonce)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			SetMerchantRedeemBunitAirdrop: [
				{ name: 'admin', type: 'address' },
				{ name: 'amount', type: 'uint256' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const message = { admin: wallet.address, amount, nonce, deadline }
		const signature = await wallet.signTypedData(
			{ name: 'ReferralRegistryVaultV1', version: '1', chainId: 224422, verifyingContract: CONET_REFERRAL_REGISTRY_VAULT_V1 },
			types,
			message,
		)
		const response = await fetch(`${beamioApi}/api/referralRegistryRedeem`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				action: 'setMerchantAirdrop',
				account: wallet.address,
				amount: amount.toString(),
				nonce: nonce.toString(),
				deadline: deadline.toString(),
				signature,
			}),
		})
		const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
		if (!response.ok || !json.success || !json.txHash) throw new Error(json.error ?? 'Start Kit airdrop update relay failed.')
		return json.txHash
	})
}

export async function claimReferralRedeemCode(params: {
	kind?: ReferralRedeemKind | 'adminPackage'
	secret: string
	privateKeyArmor: string
}): Promise<string> {
	const secret = normalizeReferralRedeemSecret(params.secret)
	if (!secret) throw new Error('Enter a redeem code.')
	const kind = params.kind ?? referralRedeemKindFromSecret(secret)
	if (kind === 'merchant') {
		return enqueueWrite(async () => {
			const wallet = new ethers.Wallet(params.privateKeyArmor)
			const hash = referralRedeemHash(secret)
			const raw = await registryRead.merchantCodes(hash)
			if (!raw.active || raw.claimed) {
				throw new Error('This Start Kit code is not active on CoNET. Copy the complete code from the issuer.')
			}
			const nonceResponse = await fetch(`${beamioApi}/api/referralRegistryClaimNonce?account=${encodeURIComponent(wallet.address)}`)
			const nonceJson = await nonceResponse.json() as { success?: boolean; nonce?: string; error?: string }
			if (!nonceResponse.ok || !nonceJson.success || nonceJson.nonce == null) throw new Error(nonceJson.error ?? 'Could not read referral claim nonce.')
			const nonce = BigInt(nonceJson.nonce)
			const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
			const types = {
				ClaimMerchantRedeemCode: [
					{ name: 'claimer', type: 'address' },
					{ name: 'redeemHash', type: 'bytes32' },
					{ name: 'nonce', type: 'uint256' },
					{ name: 'deadline', type: 'uint256' },
				],
			}
			const message = { claimer: wallet.address, redeemHash: hash, nonce, deadline }
			const signature = await wallet.signTypedData(
				{ name: 'ReferralRegistryVaultV1', version: '1', chainId: 224422, verifyingContract: CONET_REFERRAL_REGISTRY_VAULT_V1 },
				types,
				message,
			)
			const response = await fetch(`${beamioApi}/api/referralRegistryClaim`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					kind: 'merchant',
					account: wallet.address,
					secret,
					redeemHash: hash,
					nonce: nonce.toString(),
					deadline: deadline.toString(),
					signature,
				}),
			})
			const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
			if (!response.ok || !json.success || !json.txHash) throw new Error(json.error ?? 'Start Kit claim relay failed.')
			return json.txHash
		})
	}
	if (kind === 'adminPackage') {
		return enqueueWrite(async () => {
			const wallet = new ethers.Wallet(params.privateKeyArmor)
			const hash = referralRedeemHash(secret)
			const raw = await registryRead.adminMerchantPackageCodes(hash)
			if (!raw.active || raw.claimed || raw.cancelled) {
				throw new Error('This package code is not active on CoNET. Copy the complete code from the issuer.')
			}
			const nonceResponse = await fetch(`${beamioApi}/api/referralRegistryClaimNonce?account=${encodeURIComponent(wallet.address)}`)
			const nonceJson = await nonceResponse.json() as { success?: boolean; nonce?: string; error?: string }
			if (!nonceResponse.ok || !nonceJson.success || nonceJson.nonce == null) throw new Error(nonceJson.error ?? 'Could not read referral claim nonce.')
			const nonce = BigInt(nonceJson.nonce)
			const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
			const types = {
				ClaimAdminMerchantPackageCode: [
					{ name: 'claimer', type: 'address' },
					{ name: 'redeemHash', type: 'bytes32' },
					{ name: 'nonce', type: 'uint256' },
					{ name: 'deadline', type: 'uint256' },
				],
			}
			const message = { claimer: wallet.address, redeemHash: hash, nonce, deadline }
			const signature = await wallet.signTypedData(
				{ name: 'ReferralRegistryVaultV1', version: '1', chainId: 224422, verifyingContract: CONET_REFERRAL_REGISTRY_VAULT_V1 },
				types,
				message,
			)
			const response = await fetch(`${beamioApi}/api/referralRegistryClaim`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					kind: 'adminPackage',
					account: wallet.address,
					secret,
					redeemHash: hash,
					nonce: nonce.toString(),
					deadline: deadline.toString(),
					signature,
				}),
			})
			const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
			if (!response.ok || !json.success || !json.txHash) throw new Error(json.error ?? 'Admin package claim relay failed.')
			return json.txHash
		})
	}
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.privateKeyArmor)
		const hash = referralRedeemHash(secret)
		const raw = kind === 'l0' ? await registryRead.l0RedeemCodes(hash) : await registryRead.l1RedeemCodes(hash)
		if (!raw.active || raw.claimed || raw.cancelled) {
			throw new Error('This redeem code is not active on CoNET. Copy the complete code from the issuer.')
		}
		const nonceResponse = await fetch(`${beamioApi}/api/referralRegistryClaimNonce?account=${encodeURIComponent(wallet.address)}`)
		const nonceJson = await nonceResponse.json() as { success?: boolean; nonce?: string; error?: string }
		if (!nonceResponse.ok || !nonceJson.success || nonceJson.nonce == null) throw new Error(nonceJson.error ?? 'Could not read referral claim nonce.')
		const nonce = BigInt(nonceJson.nonce)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const typeName = kind === 'l0' ? 'ClaimL0RedeemCode' : 'ClaimL1RedeemCode'
		const types = {
			[typeName]: [
				{ name: 'claimer', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const message = { claimer: wallet.address, redeemHash: hash, nonce, deadline }
		const signature = await wallet.signTypedData(
			{ name: 'ReferralRegistryVaultV1', version: '1', chainId: 224422, verifyingContract: CONET_REFERRAL_REGISTRY_VAULT_V1 },
			types,
			message,
		)
		const response = await fetch(`${beamioApi}/api/referralRegistryClaim`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				kind,
				account: wallet.address,
				secret,
				redeemHash: hash,
				nonce: nonce.toString(),
				deadline: deadline.toString(),
				signature,
			}),
		})
		const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
		if (!response.ok || !json.success || !json.txHash) throw new Error(json.error ?? 'Referral redeem claim relay failed.')
		return json.txHash
	})
}

const ADMIN_PACKAGE_LIST_CACHE_PREFIX = 'beamio:referral:admin-pkg-list:v1:'
const adminPackageListCache = new Map<string, { fetchedAt: number; records: AdminMerchantPackageRecord[] }>()
const adminPackageListInFlight = new Map<string, Promise<AdminMerchantPackageRecord[]>>()

function normalizeAdminPackageRecord(
	hash: string,
	raw: {
		issuerAdmin: string
		optionalL0: string
		bunitAmount: bigint
		isPaid: boolean
		includeStartKet: boolean
		paymentMethod: number | bigint
		description: string
		active: boolean
		claimed: boolean
		cancelled: boolean
	},
	issuer: string,
): AdminMerchantPackageRecord {
	const paymentMethod = Number(raw.paymentMethod) as PackagePaymentMethod
	const status = statusOf({ active: raw.active, claimed: raw.claimed, cancelled: raw.cancelled })
	return {
		hash,
		secret: localSecretFor('adminPackage', issuer, hash),
		issuer: ethers.getAddress(raw.issuerAdmin),
		optionalL0: raw.optionalL0 && raw.optionalL0 !== ethers.ZeroAddress ? ethers.getAddress(raw.optionalL0) : ethers.ZeroAddress,
		bunitAmount: raw.bunitAmount.toString(),
		bunitDisplay: ethers.formatUnits(raw.bunitAmount, 6),
		isPaid: Boolean(raw.isPaid),
		includeStartKet: Boolean(raw.includeStartKet),
		paymentMethod: paymentMethod >= 0 && paymentMethod <= 3 ? paymentMethod : 0,
		paymentLabel: PACKAGE_PAYMENT_METHOD_LABELS[paymentMethod >= 0 && paymentMethod <= 3 ? paymentMethod : 0],
		description: String(raw.description ?? ''),
		active: Boolean(raw.active),
		claimed: Boolean(raw.claimed),
		cancelled: Boolean(raw.cancelled),
		status,
	}
}

async function readAdminPackageRecords(issuer: string): Promise<AdminMerchantPackageRecord[]> {
	const normalizedIssuer = ethers.getAddress(issuer).toLowerCase()
	const count = Number(await registryRead.adminMerchantPackageCodeCount())
	const records: AdminMerchantPackageRecord[] = []
	for (let i = 0; i < count; i += 1) {
		const hash = await registryRead.adminMerchantPackageCodeHashAt(i)
		const raw = await registryRead.adminMerchantPackageCodes(hash)
		const record = normalizeAdminPackageRecord(hash, raw, issuer)
		if (record.issuer.toLowerCase() === normalizedIssuer) records.push(record)
	}
	return records.reverse()
}

export async function fetchAdminMerchantPackageCodes(
	issuer: string,
	options: { force?: boolean } = {},
): Promise<AdminMerchantPackageRecord[]> {
	const key = ethers.getAddress(issuer).toLowerCase()
	const cached = adminPackageListCache.get(key)
	if (!options.force && cached && Date.now() - cached.fetchedAt < RPC_TTL_MS) {
		return hydrateAdminPackageSecrets(issuer, cached.records)
	}
	if (!options.force) {
		try {
			const raw = localStorage.getItem(`${ADMIN_PACKAGE_LIST_CACHE_PREFIX}${key}`)
			if (raw) {
				const parsed = JSON.parse(raw) as { fetchedAt?: number; records?: AdminMerchantPackageRecord[] }
				if (Number.isFinite(parsed.fetchedAt) && Array.isArray(parsed.records) && Date.now() - Number(parsed.fetchedAt) < RPC_TTL_MS) {
					const records = hydrateAdminPackageSecrets(issuer, parsed.records)
					adminPackageListCache.set(key, { fetchedAt: Number(parsed.fetchedAt), records: stripAdminPackageSecretsForCache(records) })
					return records
				}
			}
		} catch {
			// ignore
		}
	}
	const existing = adminPackageListInFlight.get(key)
	if (existing) return existing.then((records) => hydrateAdminPackageSecrets(issuer, records))
	const request = enqueueRpc(() => readAdminPackageRecords(issuer))
		.then((records) => {
			const hydrated = hydrateAdminPackageSecrets(issuer, records)
			adminPackageListCache.set(key, {
				fetchedAt: Date.now(),
				records: stripAdminPackageSecretsForCache(hydrated),
			})
			try {
				localStorage.setItem(
					`${ADMIN_PACKAGE_LIST_CACHE_PREFIX}${key}`,
					JSON.stringify({
						fetchedAt: Date.now(),
						records: stripAdminPackageSecretsForCache(hydrated),
					}),
				)
			} catch {
				// ignore
			}
			return hydrated
		})
		.catch((error) => {
			const previous = adminPackageListCache.get(key)
			if (previous) return hydrateAdminPackageSecrets(issuer, previous.records)
			try {
				const raw = localStorage.getItem(`${ADMIN_PACKAGE_LIST_CACHE_PREFIX}${key}`)
				if (raw) {
					const parsed = JSON.parse(raw) as { records?: AdminMerchantPackageRecord[] }
					if (Array.isArray(parsed.records)) return hydrateAdminPackageSecrets(issuer, parsed.records)
				}
			} catch {
				// ignore
			}
			throw error
		})
	adminPackageListInFlight.set(key, request)
	try {
		return await request
	} finally {
		adminPackageListInFlight.delete(key)
	}
}

export type IssuedAdminMerchantPackage = {
	secret: string
	hash: string
	txHash: string
	record: AdminMerchantPackageRecord
}

export async function issueAdminMerchantPackageCode(params: {
	adminPrivateKeyArmor: string
	optionalL0?: string
	bunitAmount: string
	isPaid: boolean
	includeStartKet: boolean
	paymentMethod: PackagePaymentMethod
	description: string
}): Promise<IssuedAdminMerchantPackage> {
	const secret = generateAdminMerchantPackageSecret()
	const hash = referralRedeemHash(secret)
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.adminPrivateKeyArmor)
		const amount = ethers.parseUnits(params.bunitAmount.trim(), 6)
		if (amount <= 0n) throw new Error('B-Unit amount must be greater than zero.')
		const description = params.description.trim()
		if (description.length > 512) throw new Error('Description cannot exceed 512 characters.')
		const optionalL0 = params.optionalL0 && ethers.isAddress(params.optionalL0)
			? ethers.getAddress(params.optionalL0)
			: ethers.ZeroAddress
		const nonceResponse = await fetch(`${beamioApi}/api/referralRegistryRedeemNonce?account=${encodeURIComponent(wallet.address)}`)
		const nonceJson = await nonceResponse.json() as { success?: boolean; nonce?: string; error?: string }
		if (!nonceResponse.ok || !nonceJson.success || nonceJson.nonce == null) throw new Error(nonceJson.error ?? 'Could not read referral redeem nonce.')
		const nonce = BigInt(nonceJson.nonce)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			IssueAdminMerchantPackageCode: [
				{ name: 'admin', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'optionalL0', type: 'address' },
				{ name: 'bunitAmount', type: 'uint256' },
				{ name: 'isPaid', type: 'bool' },
				{ name: 'includeStartKet', type: 'bool' },
				{ name: 'paymentMethod', type: 'uint8' },
				{ name: 'description', type: 'string' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const message = {
			admin: wallet.address,
			redeemHash: hash,
			optionalL0,
			bunitAmount: amount,
			isPaid: params.isPaid,
			includeStartKet: params.includeStartKet,
			paymentMethod: params.paymentMethod,
			description,
			nonce,
			deadline,
		}
		const signature = await wallet.signTypedData(
			{ name: 'ReferralRegistryVaultV1', version: '1', chainId: 224422, verifyingContract: CONET_REFERRAL_REGISTRY_VAULT_V1 },
			types,
			message,
		)
		const response = await fetch(`${beamioApi}/api/referralRegistryRedeem`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				action: 'issueAdminMerchantPackage',
				account: wallet.address,
				redeemHash: hash,
				optionalL0,
				bunitAmount: amount.toString(),
				isPaid: params.isPaid,
				includeStartKet: params.includeStartKet,
				paymentMethod: String(params.paymentMethod),
				description,
				nonce: nonce.toString(),
				deadline: deadline.toString(),
				signature,
			}),
		})
		const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
		if (!response.ok || !json.success || !json.txHash) {
			const raw = json.error ?? 'Admin package issue relay failed.'
			if (/execution reverted \(no data present/i.test(raw) || /CALL_EXCEPTION/i.test(raw)) {
				throw new Error(
					'Package create failed on CoNET (contract rejected the call). Confirm you are a registry admin and the vault supports Admin Merchant Package codes, then try again.',
				)
			}
			throw new Error(raw)
		}
		saveLocalSecret('adminPackage', wallet.address, hash, secret)
		const records = await fetchAdminMerchantPackageCodes(wallet.address, { force: true })
		const found = records.find((item) => item.hash.toLowerCase() === hash.toLowerCase())
		if (!found) throw new Error('Package code was confirmed but could not be read back from CoNET.')
		const record: AdminMerchantPackageRecord = {
			...found,
			secret: found.secret ?? secret,
		}
		return { secret, hash, txHash: json.txHash, record }
	})
}

export async function cancelAdminMerchantPackageCode(params: {
	adminPrivateKeyArmor: string
	hash: string
}): Promise<string> {
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.adminPrivateKeyArmor)
		const nonceResponse = await fetch(`${beamioApi}/api/referralRegistryRedeemNonce?account=${encodeURIComponent(wallet.address)}`)
		const nonceJson = await nonceResponse.json() as { success?: boolean; nonce?: string; error?: string }
		if (!nonceResponse.ok || !nonceJson.success || nonceJson.nonce == null) throw new Error(nonceJson.error ?? 'Could not read referral redeem nonce.')
		const nonce = BigInt(nonceJson.nonce)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			CancelAdminMerchantPackageCode: [
				{ name: 'admin', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const message = { admin: wallet.address, redeemHash: params.hash, nonce, deadline }
		const signature = await wallet.signTypedData(
			{ name: 'ReferralRegistryVaultV1', version: '1', chainId: 224422, verifyingContract: CONET_REFERRAL_REGISTRY_VAULT_V1 },
			types,
			message,
		)
		const response = await fetch(`${beamioApi}/api/referralRegistryRedeem`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				action: 'cancelAdminMerchantPackage',
				account: wallet.address,
				redeemHash: params.hash,
				nonce: nonce.toString(),
				deadline: deadline.toString(),
				signature,
			}),
		})
		const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
		if (!response.ok || !json.success || !json.txHash) throw new Error(json.error ?? 'Admin package cancellation relay failed.')
		return json.txHash
	})
}
