import { ethers } from 'ethers'
import { CONET_REFERRAL_REGISTRY_VAULT_V1 } from '@/config/chainAddresses'
import { beamioApi, conetDepinProvider } from '@/utils/constants'

export type ReferralRedeemKind = 'l0' | 'l1'
export type ReferralRedeemStatus = 'pending' | 'claimed' | 'cancelled'

export type ReferralRedeemCodeRecord = {
	hash: string
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
	'function redeemActionNonces(address) view returns (uint256)',
	'function l0RedeemCodeCount() view returns (uint256)',
	'function l1RedeemCodeCount() view returns (uint256)',
	'function l0RedeemCodeHashAt(uint256 index) view returns (bytes32)',
	'function l1RedeemCodeHashAt(uint256 index) view returns (bytes32)',
	'function l0RedeemCodes(bytes32) view returns (address issuerAdmin,uint256 rebateBps,uint64 validAfter,uint64 validBefore,bool active,bool claimed,bool cancelled)',
	'function l1RedeemCodes(bytes32) view returns (address issuerL0,uint256 rebateBps,uint256 ratioBps,uint64 validAfter,uint64 validBefore,bool active,bool claimed,bool cancelled)',
] as const

const registryRead = new ethers.Contract(CONET_REFERRAL_REGISTRY_VAULT_V1, ABI, conetDepinProvider)
const RPC_TTL_MS = 30_000
const listCache = new Map<string, { fetchedAt: number; records: ReferralRedeemCodeRecord[] }>()
const listInFlight = new Map<string, Promise<ReferralRedeemCodeRecord[]>>()
let writeQueue: Promise<void> = Promise.resolve()

function enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
	const next = writeQueue.then(work, work)
	writeQueue = next.then(() => undefined, () => undefined)
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
	const prefix = kind === 'l0' ? 'beamio-l0' : 'beamio-l1'
	return `${prefix}-${ethers.hexlify(ethers.randomBytes(24)).slice(2)}`
}

export function referralRedeemHash(secret: string): string {
	const normalized = secret.trim()
	if (!normalized) throw new Error('Redeem code cannot be empty.')
	return ethers.keccak256(ethers.toUtf8Bytes(normalized))
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

async function readRecords(kind: ReferralRedeemKind, issuer: string): Promise<ReferralRedeemCodeRecord[]> {
	const normalizedIssuer = ethers.getAddress(issuer).toLowerCase()
	const count = BigInt(await registryRead[kind === 'l0' ? 'l0RedeemCodeCount' : 'l1RedeemCodeCount']())
	const records: ReferralRedeemCodeRecord[] = []
	for (let index = 0n; index < count; index += 1n) {
		const hash = await registryRead[kind === 'l0' ? 'l0RedeemCodeHashAt' : 'l1RedeemCodeHashAt'](index)
		const raw = await registryRead[kind === 'l0' ? 'l0RedeemCodes' : 'l1RedeemCodes'](hash)
		const record =
			kind === 'l0'
				? normalizeRecord(hash, raw.issuerAdmin, raw.rebateBps, 0n, raw.validAfter, raw.validBefore, raw.active, raw.claimed, raw.cancelled)
				: normalizeRecord(hash, raw.issuerL0, raw.rebateBps, raw.ratioBps, raw.validAfter, raw.validBefore, raw.active, raw.claimed, raw.cancelled)
		if (record.issuer.toLowerCase() === normalizedIssuer) records.push(record)
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
	const existing = listInFlight.get(key)
	if (existing) return existing
	const request = readRecords(kind, issuer).then((records) => {
		listCache.set(key, { fetchedAt: Date.now(), records })
		return records
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
		const action = params.kind === 'l0' ? 'issueL0' : 'issueL1'
		const typeName = params.kind === 'l0' ? 'IssueL0RedeemCode' : 'IssueL1RedeemCode'
		const types = {
			[typeName]: [
				{ name: params.kind === 'l0' ? 'admin' : 'l0', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'rebateBps', type: 'uint256' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const message = params.kind === 'l0'
			? { admin: wallet.address, redeemHash: hash, rebateBps: params.rebateBps, nonce, deadline }
			: { l0: wallet.address, redeemHash: hash, rebateBps: params.rebateBps, nonce, deadline }
		const signature = await wallet.signTypedData(
			{ name: 'ReferralRegistryVaultV1', version: '1', chainId: 224422, verifyingContract: CONET_REFERRAL_REGISTRY_VAULT_V1 },
			types,
			message,
		)
		const response = await fetch(`${beamioApi}/api/referralRegistryRedeem`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action, account: wallet.address, redeemHash: hash, rebateBps: params.rebateBps.toString(), nonce: nonce.toString(), deadline: deadline.toString(), signature }),
		})
		const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
		if (!response.ok || !json.success || !json.txHash) throw new Error(json.error ?? 'Referral redeem relay failed.')
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
		const typeName = params.kind === 'l0' ? 'CancelL0RedeemCode' : 'CancelL1RedeemCode'
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
			body: JSON.stringify({ action: params.kind === 'l0' ? 'cancelL0' : 'cancelL1', account: wallet.address, redeemHash: params.hash, nonce: nonce.toString(), deadline: deadline.toString(), signature }),
		})
		const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
		if (!response.ok || !json.success || !json.txHash) throw new Error(json.error ?? 'Referral redeem cancellation relay failed.')
		return json.txHash
	})
}
