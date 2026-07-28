/**
 * GenesisNodeReferralVaultV1 — CoNET Admin/L0/L1 redeem + read helpers for Mining UI.
 * Purchase attribution must use an active L1 Evangelist (not bare L0).
 * L0 sets ratioBps (% of L0's 10% node bucket) when issuing L1 redeem codes.
 */
import { ethers } from 'ethers'
import { CONET_GENESIS_NODE_REFERRAL_VAULT } from '@/config/chainAddresses'
import { beamioApi, conetDepinProvider } from '@/utils/constants'
import { buildDiscoverMerchantShareUrl } from '@/utils/discoverMerchantShare'

const uuid62 = require('uuid62') as { v4: () => string }

/** Discover card used for Genesis Node Offers (Evangelist share target). */
export const CONET_GENESIS_DISCOVER_CARD_ADDRESS = '0xafE482D2612327a0D723544B9fB713C514a793a2'

const ABI = [
	'function admins(address) view returns (bool)',
	'function members(address) view returns (uint8 role,address parentAdmin,bool active,address parentL0,uint256 ratioBps)',
	'function isActiveL0(address) view returns (bool)',
	'function isActiveL1(address) view returns (bool)',
	'function foundation() view returns (address)',
	'function defaultAdminPayout() view returns (address)',
	'function earnedUsdc6(address) view returns (uint256)',
	'function l0Count() view returns (uint256)',
	'function l0At(uint256) view returns (address)',
	'function l1Count() view returns (uint256)',
	'function l1At(uint256) view returns (address)',
	'function l0RedeemHashCount() view returns (uint256)',
	'function l0RedeemHashAt(uint256) view returns (bytes32)',
	'function l0RedeemCodes(bytes32) view returns (address issuerAdmin,bool active,bool claimed,bool cancelled)',
	'function l1RedeemHashCount() view returns (uint256)',
	'function l1RedeemHashAt(uint256) view returns (bytes32)',
	'function l1RedeemCodes(bytes32) view returns (address issuerL0,uint256 ratioBps,bool active,bool claimed,bool cancelled)',
	'function redeemActionNonces(address) view returns (uint256)',
	'function claimNonces(address) view returns (uint256)',
] as const

const vaultRead = new ethers.Contract(CONET_GENESIS_NODE_REFERRAL_VAULT, ABI, conetDepinProvider)

const EIP712_DOMAIN = {
	name: 'GenesisNodeReferralVaultV1',
	version: '1',
	chainId: 224422,
	verifyingContract: CONET_GENESIS_NODE_REFERRAL_VAULT,
} as const

const LOCAL_SECRET_KEY = 'beamio:genesis-node-referral-secrets:v1'
const RPC_TTL_MS = 30_000

export type GenesisRedeemStatus = 'pending' | 'claimed' | 'cancelled'

export type GenesisL0RedeemRecord = {
	hash: string
	secret?: string
	issuer: string
	active: boolean
	claimed: boolean
	cancelled: boolean
	status: GenesisRedeemStatus
}

export type GenesisL1RedeemRecord = {
	hash: string
	secret?: string
	issuerL0: string
	ratioBps: number
	active: boolean
	claimed: boolean
	cancelled: boolean
	status: GenesisRedeemStatus
}

export type GenesisMemberSnapshot = {
	isAdmin: boolean
	isL0: boolean
	isL1: boolean
	parentAdmin: string | null
	parentL0: string | null
	ratioBps: number
	foundation: string
	defaultAdminPayout: string
	earnedUsdc6: string
	earnedUsdcDisplay: string
}

export type IssuedGenesisL0Redeem = {
	secret: string
	hash: string
	txHash: string
	record: GenesisL0RedeemRecord
}

export type IssuedGenesisL1Redeem = {
	secret: string
	hash: string
	txHash: string
	ratioBps: number
	record: GenesisL1RedeemRecord
}

let rpcQueue: Promise<void> = Promise.resolve()
let writeQueue: Promise<void> = Promise.resolve()

function enqueueRpc<T>(fn: () => Promise<T>): Promise<T> {
	const run = rpcQueue.then(fn, fn)
	rpcQueue = run.then(
		() => undefined,
		() => undefined,
	)
	return run
}

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
	const run = writeQueue.then(fn, fn)
	writeQueue = run.then(
		() => undefined,
		() => undefined,
	)
	return run
}

function statusOf(row: { active: boolean; claimed: boolean; cancelled: boolean }): GenesisRedeemStatus {
	if (row.claimed) return 'claimed'
	if (row.cancelled) return 'cancelled'
	return 'pending'
}

function readLocalSecrets(): Record<string, string> {
	if (typeof window === 'undefined') return {}
	try {
		const raw = localStorage.getItem(LOCAL_SECRET_KEY)
		if (!raw) return {}
		const parsed = JSON.parse(raw) as Record<string, string>
		return parsed && typeof parsed === 'object' ? parsed : {}
	} catch {
		return {}
	}
}

function saveLocalSecret(hash: string, secret: string): void {
	if (typeof window === 'undefined') return
	try {
		const next = { ...readLocalSecrets(), [hash.toLowerCase()]: secret }
		localStorage.setItem(LOCAL_SECRET_KEY, JSON.stringify(next))
	} catch {
		// Local secret cache is best-effort.
	}
}

export function generateGenesisL0RedeemSecret(): string {
	return `beamio-genesis-l0-${uuid62.v4()}`
}

export function generateGenesisL1RedeemSecret(): string {
	return `beamio-genesis-l1-${uuid62.v4()}`
}

export function genesisRedeemHash(secret: string): string {
	const normalized = secret.replace(/[\s\u200B-\u200D\uFEFF]+/g, '').trim()
	if (!normalized) throw new Error('Redeem code cannot be empty.')
	return ethers.keccak256(ethers.toUtf8Bytes(normalized))
}

/** @deprecated use genesisRedeemHash */
export function genesisL0RedeemHash(secret: string): string {
	return genesisRedeemHash(secret)
}

/** Evangelist Discover share — must be an L1 EOA (purchase attribution). */
export function buildGenesisEvangelistShareUrl(l1Eoa: string): string {
	return buildDiscoverMerchantShareUrl(CONET_GENESIS_DISCOVER_CARD_ADDRESS, l1Eoa)
}

export function ratioBpsToPercentLabel(ratioBps: number): string {
	const pct = Math.max(0, Math.min(100, ratioBps / 100))
	return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`
}

const snapshotCache = new Map<string, { fetchedAt: number; value: GenesisMemberSnapshot }>()
const snapshotInFlight = new Map<string, Promise<GenesisMemberSnapshot>>()

export async function fetchGenesisMemberSnapshot(eoa: string): Promise<GenesisMemberSnapshot | null> {
	if (!eoa || !ethers.isAddress(eoa)) return null
	const key = ethers.getAddress(eoa).toLowerCase()
	const cached = snapshotCache.get(key)
	if (cached && Date.now() - cached.fetchedAt < RPC_TTL_MS) return cached.value
	const inflight = snapshotInFlight.get(key)
	if (inflight) return inflight

	const request = enqueueRpc(async () => {
		const account = ethers.getAddress(eoa)
		const [isAdmin, member, foundation, defaultAdminPayout, earned] = await Promise.all([
			vaultRead.admins(account) as Promise<boolean>,
			vaultRead.members(account) as Promise<{
				role: bigint
				parentAdmin: string
				active: boolean
				parentL0: string
				ratioBps: bigint
			}>,
			vaultRead.foundation() as Promise<string>,
			vaultRead.defaultAdminPayout() as Promise<string>,
			vaultRead.earnedUsdc6(account) as Promise<bigint>,
		])
		const role = Number(member.role)
		const active = Boolean(member.active)
		const isL0 = role === 1 && active
		const isL1 = role === 2 && active
		const value: GenesisMemberSnapshot = {
			isAdmin: Boolean(isAdmin),
			isL0,
			isL1,
			parentAdmin:
				isL0 && member.parentAdmin && member.parentAdmin !== ethers.ZeroAddress
					? ethers.getAddress(member.parentAdmin)
					: null,
			parentL0:
				isL1 && member.parentL0 && member.parentL0 !== ethers.ZeroAddress
					? ethers.getAddress(member.parentL0)
					: null,
			ratioBps: isL1 ? Number(member.ratioBps) : 0,
			foundation: ethers.getAddress(foundation),
			defaultAdminPayout: ethers.getAddress(defaultAdminPayout),
			earnedUsdc6: earned.toString(),
			earnedUsdcDisplay: ethers.formatUnits(earned, 6),
		}
		snapshotCache.set(key, { fetchedAt: Date.now(), value })
		return value
	}).finally(() => {
		snapshotInFlight.delete(key)
	})

	snapshotInFlight.set(key, request)
	try {
		return await request
	} catch {
		return cached?.value ?? null
	}
}

export async function fetchGenesisL0List(forAdmin?: string): Promise<string[]> {
	return enqueueRpc(async () => {
		const count = Number(await vaultRead.l0Count())
		if (!Number.isFinite(count) || count <= 0) return []
		const adminLower = forAdmin && ethers.isAddress(forAdmin) ? ethers.getAddress(forAdmin).toLowerCase() : null
		const addrs: string[] = []
		for (let i = 0; i < count; i++) {
			const a = await vaultRead.l0At(i)
			if (!a || !ethers.isAddress(a)) continue
			const addr = ethers.getAddress(a)
			if (adminLower) {
				const m = await vaultRead.members(addr)
				const parent = ethers.getAddress(m.parentAdmin).toLowerCase()
				if (parent !== adminLower) continue
			}
			addrs.push(addr)
		}
		return addrs
	})
}

export async function fetchGenesisL1List(forL0?: string): Promise<Array<{ address: string; ratioBps: number }>> {
	return enqueueRpc(async () => {
		const count = Number(await vaultRead.l1Count())
		if (!Number.isFinite(count) || count <= 0) return []
		const l0Lower = forL0 && ethers.isAddress(forL0) ? ethers.getAddress(forL0).toLowerCase() : null
		const out: Array<{ address: string; ratioBps: number }> = []
		for (let i = 0; i < count; i++) {
			const a = await vaultRead.l1At(i)
			if (!a || !ethers.isAddress(a)) continue
			const addr = ethers.getAddress(a)
			const m = await vaultRead.members(addr)
			if (!m.active || Number(m.role) !== 2) continue
			if (l0Lower) {
				const parent = ethers.getAddress(m.parentL0).toLowerCase()
				if (parent !== l0Lower) continue
			}
			out.push({ address: addr, ratioBps: Number(m.ratioBps) })
		}
		return out
	})
}

export async function fetchGenesisL0RedeemCodesForIssuer(issuer: string): Promise<GenesisL0RedeemRecord[]> {
	if (!issuer || !ethers.isAddress(issuer)) return []
	const issuerNorm = ethers.getAddress(issuer)
	const secrets = readLocalSecrets()
	return enqueueRpc(async () => {
		const count = Number(await vaultRead.l0RedeemHashCount())
		const out: GenesisL0RedeemRecord[] = []
		for (let i = 0; i < count; i++) {
			const hash = String(await vaultRead.l0RedeemHashAt(i))
			const row = await vaultRead.l0RedeemCodes(hash)
			const issuerAdmin = ethers.getAddress(row.issuerAdmin)
			if (issuerAdmin.toLowerCase() !== issuerNorm.toLowerCase()) continue
			const active = Boolean(row.active)
			const claimed = Boolean(row.claimed)
			const cancelled = Boolean(row.cancelled)
			out.push({
				hash,
				secret: secrets[hash.toLowerCase()],
				issuer: issuerAdmin,
				active,
				claimed,
				cancelled,
				status: statusOf({ active, claimed, cancelled }),
			})
		}
		return out.reverse()
	})
}

export async function fetchGenesisL1RedeemCodesForIssuer(issuerL0: string): Promise<GenesisL1RedeemRecord[]> {
	if (!issuerL0 || !ethers.isAddress(issuerL0)) return []
	const issuerNorm = ethers.getAddress(issuerL0)
	const secrets = readLocalSecrets()
	return enqueueRpc(async () => {
		const count = Number(await vaultRead.l1RedeemHashCount())
		const out: GenesisL1RedeemRecord[] = []
		for (let i = 0; i < count; i++) {
			const hash = String(await vaultRead.l1RedeemHashAt(i))
			const row = await vaultRead.l1RedeemCodes(hash)
			const issuer = ethers.getAddress(row.issuerL0)
			if (issuer.toLowerCase() !== issuerNorm.toLowerCase()) continue
			const active = Boolean(row.active)
			const claimed = Boolean(row.claimed)
			const cancelled = Boolean(row.cancelled)
			out.push({
				hash,
				secret: secrets[hash.toLowerCase()],
				issuerL0: issuer,
				ratioBps: Number(row.ratioBps),
				active,
				claimed,
				cancelled,
				status: statusOf({ active, claimed, cancelled }),
			})
		}
		return out.reverse()
	})
}

async function postRedeem(body: Record<string, string>): Promise<string> {
	const response = await fetch(`${beamioApi}/api/genesisNodeReferralRedeem`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	})
	const json = (await response.json()) as { success?: boolean; txHash?: string; error?: string }
	if (!response.ok || !json.success || !json.txHash) {
		throw new Error(json.error ?? 'Genesis referral redeem failed.')
	}
	return json.txHash
}

async function readActionNonce(address: string): Promise<bigint> {
	const nonceResponse = await fetch(
		`${beamioApi}/api/genesisNodeReferralRedeemNonce?account=${encodeURIComponent(address)}`,
	)
	const nonceJson = (await nonceResponse.json()) as { success?: boolean; nonce?: string; error?: string }
	if (!nonceResponse.ok || !nonceJson.success || nonceJson.nonce == null) {
		throw new Error(nonceJson.error ?? 'Could not read Genesis redeem nonce.')
	}
	return BigInt(nonceJson.nonce)
}

async function readClaimNonce(address: string): Promise<bigint> {
	const nonceResponse = await fetch(
		`${beamioApi}/api/genesisNodeReferralRedeemNonce?account=${encodeURIComponent(address)}&kind=claim`,
	)
	const nonceJson = (await nonceResponse.json()) as { success?: boolean; nonce?: string; error?: string }
	if (!nonceResponse.ok || !nonceJson.success || nonceJson.nonce == null) {
		throw new Error(nonceJson.error ?? 'Could not read Genesis claim nonce.')
	}
	return BigInt(nonceJson.nonce)
}

export async function issueGenesisL0RedeemCode(params: {
	issuerPrivateKeyArmor: string
}): Promise<IssuedGenesisL0Redeem> {
	const secret = generateGenesisL0RedeemSecret()
	const hash = genesisRedeemHash(secret)
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.issuerPrivateKeyArmor)
		const nonce = await readActionNonce(wallet.address)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			IssueL0RedeemCode: [
				{ name: 'admin', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const signature = await wallet.signTypedData(EIP712_DOMAIN, types, {
			admin: wallet.address,
			redeemHash: hash,
			nonce,
			deadline,
		})
		const txHash = await postRedeem({
			action: 'issueL0',
			account: wallet.address,
			redeemHash: hash,
			nonce: nonce.toString(),
			deadline: deadline.toString(),
			signature,
		})
		saveLocalSecret(hash, secret)
		snapshotCache.clear()
		return {
			secret,
			hash,
			txHash,
			record: {
				hash,
				secret,
				issuer: wallet.address,
				active: true,
				claimed: false,
				cancelled: false,
				status: 'pending',
			},
		}
	})
}

export async function cancelGenesisL0RedeemCode(params: {
	issuerPrivateKeyArmor: string
	hash: string
}): Promise<string> {
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.issuerPrivateKeyArmor)
		const nonce = await readActionNonce(wallet.address)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			CancelL0RedeemCode: [
				{ name: 'admin', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const signature = await wallet.signTypedData(EIP712_DOMAIN, types, {
			admin: wallet.address,
			redeemHash: params.hash,
			nonce,
			deadline,
		})
		const txHash = await postRedeem({
			action: 'cancelL0',
			account: wallet.address,
			redeemHash: params.hash,
			nonce: nonce.toString(),
			deadline: deadline.toString(),
			signature,
		})
		snapshotCache.clear()
		return txHash
	})
}

export async function claimGenesisL0RedeemCode(params: {
	claimerPrivateKeyArmor: string
	secret: string
}): Promise<string> {
	const secret = params.secret.replace(/[\s\u200B-\u200D\uFEFF]+/g, '').trim()
	const hash = genesisRedeemHash(secret)
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.claimerPrivateKeyArmor)
		const nonce = await readClaimNonce(wallet.address)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			ClaimL0RedeemCode: [
				{ name: 'claimer', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const signature = await wallet.signTypedData(EIP712_DOMAIN, types, {
			claimer: wallet.address,
			redeemHash: hash,
			nonce,
			deadline,
		})
		const txHash = await postRedeem({
			action: 'claimL0',
			account: wallet.address,
			redeemHash: hash,
			nonce: nonce.toString(),
			deadline: deadline.toString(),
			signature,
			secret,
		})
		snapshotCache.clear()
		return txHash
	})
}

/** L0 issues L1 code; ratioBps = 0–10000 share of L0's 10% node bucket. */
export async function issueGenesisL1RedeemCode(params: {
	issuerPrivateKeyArmor: string
	ratioBps: number
}): Promise<IssuedGenesisL1Redeem> {
	const ratioBps = Math.round(params.ratioBps)
	if (!Number.isFinite(ratioBps) || ratioBps < 0 || ratioBps > 10_000) {
		throw new Error('L1 share must be between 0% and 100%.')
	}
	const secret = generateGenesisL1RedeemSecret()
	const hash = genesisRedeemHash(secret)
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.issuerPrivateKeyArmor)
		const nonce = await readActionNonce(wallet.address)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			IssueL1RedeemCode: [
				{ name: 'l0', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'ratioBps', type: 'uint256' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const signature = await wallet.signTypedData(EIP712_DOMAIN, types, {
			l0: wallet.address,
			redeemHash: hash,
			ratioBps: BigInt(ratioBps),
			nonce,
			deadline,
		})
		const txHash = await postRedeem({
			action: 'issueL1',
			account: wallet.address,
			redeemHash: hash,
			nonce: nonce.toString(),
			deadline: deadline.toString(),
			signature,
			ratioBps: String(ratioBps),
		})
		saveLocalSecret(hash, secret)
		snapshotCache.clear()
		return {
			secret,
			hash,
			txHash,
			ratioBps,
			record: {
				hash,
				secret,
				issuerL0: wallet.address,
				ratioBps,
				active: true,
				claimed: false,
				cancelled: false,
				status: 'pending',
			},
		}
	})
}

export async function cancelGenesisL1RedeemCode(params: {
	issuerPrivateKeyArmor: string
	hash: string
}): Promise<string> {
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.issuerPrivateKeyArmor)
		const nonce = await readActionNonce(wallet.address)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			CancelL1RedeemCode: [
				{ name: 'l0', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const signature = await wallet.signTypedData(EIP712_DOMAIN, types, {
			l0: wallet.address,
			redeemHash: params.hash,
			nonce,
			deadline,
		})
		const txHash = await postRedeem({
			action: 'cancelL1',
			account: wallet.address,
			redeemHash: params.hash,
			nonce: nonce.toString(),
			deadline: deadline.toString(),
			signature,
		})
		snapshotCache.clear()
		return txHash
	})
}

export async function claimGenesisL1RedeemCode(params: {
	claimerPrivateKeyArmor: string
	secret: string
}): Promise<string> {
	const secret = params.secret.replace(/[\s\u200B-\u200D\uFEFF]+/g, '').trim()
	const hash = genesisRedeemHash(secret)
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.claimerPrivateKeyArmor)
		const nonce = await readClaimNonce(wallet.address)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			ClaimL1RedeemCode: [
				{ name: 'claimer', type: 'address' },
				{ name: 'redeemHash', type: 'bytes32' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const signature = await wallet.signTypedData(EIP712_DOMAIN, types, {
			claimer: wallet.address,
			redeemHash: hash,
			nonce,
			deadline,
		})
		const txHash = await postRedeem({
			action: 'claimL1',
			account: wallet.address,
			redeemHash: hash,
			nonce: nonce.toString(),
			deadline: deadline.toString(),
			signature,
			secret,
		})
		snapshotCache.clear()
		return txHash
	})
}
