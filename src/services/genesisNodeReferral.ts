/**
 * GenesisNodeReferralVaultV1 — CoNET Admin/L0/L1 redeem + read helpers for Mining UI.
 * Purchase attribution may use Admin (no L0 cut), active L0 (no L1 cut), or active L1 (ratio of L0 pool).
 * L0 sets ratioBps (% of L0's 10% node bucket) when issuing L1 redeem codes.
 */
import { ethers } from 'ethers'
import {
	CONET_GENESIS_NODE_REFERRAL_VAULT,
	CONET_GENESIS_NODE_REFERRAL_VAULT_DEPLOY_BLOCK,
} from '@/config/chainAddresses'
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

export type GenesisReferrerRole = 'admin' | 'l0' | 'l1'

export type GenesisReferrerCandidate = {
	address: string
	role: GenesisReferrerRole
	/** Optional @BeamioTag plain name for first-paint / seed display. */
	accountName?: string
}

/** Resolve whether an EOA is a valid Genesis purchase referrer (Admin / L0 / L1). */
export async function resolveGenesisReferrerRole(
	eoa: string,
): Promise<{ address: string; role: GenesisReferrerRole } | null> {
	if (!eoa || !ethers.isAddress(eoa)) return null
	return enqueueRpc(async () => {
		const account = ethers.getAddress(eoa)
		const [isAdmin, isL1, isL0] = await Promise.all([
			vaultRead.admins(account) as Promise<boolean>,
			vaultRead.isActiveL1(account) as Promise<boolean>,
			vaultRead.isActiveL0(account) as Promise<boolean>,
		])
		if (Boolean(isL1)) return { address: account, role: 'l1' }
		if (Boolean(isL0)) return { address: account, role: 'l0' }
		if (Boolean(isAdmin)) return { address: account, role: 'admin' }
		return null
	})
}

/**
 * Selectable referrers for Discover Genesis seat purchase:
 * all active Admins (from AdminUpdated logs + foundation / defaultAdminPayout),
 * plus all active L0 + L1.
 */
export async function fetchGenesisReferrerCandidates(): Promise<GenesisReferrerCandidate[]> {
	return enqueueRpc(async () => {
		const out: GenesisReferrerCandidate[] = []
		const seen = new Set<string>()
		const push = (addr: string, role: GenesisReferrerRole) => {
			const key = addr.toLowerCase()
			if (seen.has(key)) return
			seen.add(key)
			out.push({ address: addr, role })
		}

		const [foundation, defaultAdminPayout] = await Promise.all([
			vaultRead.foundation() as Promise<string>,
			vaultRead.defaultAdminPayout() as Promise<string>,
		])
		const seedAdmins = [foundation, defaultAdminPayout]
		try {
			const fromEvents = await Promise.race([
				fetchGenesisAdminAddressesFromEvents(),
				new Promise<string[]>((_, reject) => {
					setTimeout(() => reject(new Error('AdminUpdated log scan timeout')), 12_000)
				}),
			])
			seedAdmins.push(...fromEvents)
		} catch {
			/* event scan failed / timed out — still use foundation / defaultAdminPayout */
		}
		for (const raw of seedAdmins) {
			if (!raw || !ethers.isAddress(raw)) continue
			const a = ethers.getAddress(raw)
			if (Boolean(await vaultRead.admins(a))) push(a, 'admin')
		}

		const l0Count = Number(await vaultRead.l0Count())
		if (Number.isFinite(l0Count) && l0Count > 0) {
			for (let i = 0; i < l0Count; i++) {
				const a = await vaultRead.l0At(i)
				if (!a || !ethers.isAddress(a)) continue
				const addr = ethers.getAddress(a)
				if (Boolean(await vaultRead.isActiveL0(addr))) push(addr, 'l0')
			}
		}

		const l1Count = Number(await vaultRead.l1Count())
		if (Number.isFinite(l1Count) && l1Count > 0) {
			for (let i = 0; i < l1Count; i++) {
				const a = await vaultRead.l1At(i)
				if (!a || !ethers.isAddress(a)) continue
				const addr = ethers.getAddress(a)
				if (Boolean(await vaultRead.isActiveL1(addr))) push(addr, 'l1')
			}
		}

		return out
	})
}

/** Proxy deploy block — keep in sync with `CONET_GENESIS_NODE_REFERRAL_VAULT_DEPLOY_BLOCK`. */
const GENESIS_VAULT_PROXY_DEPLOY_BLOCK = CONET_GENESIS_NODE_REFERRAL_VAULT_DEPLOY_BLOCK
/** CoNET RPC caps eth_getLogs at 5000 blocks. */
const ADMIN_EVENT_LOG_CHUNK = 5_000

/**
 * Collect Admin EOAs from AdminUpdated events, then caller verifies with admins().
 */
async function fetchGenesisAdminAddressesFromEvents(): Promise<string[]> {
	const iface = new ethers.Interface([
		'event AdminUpdated(address indexed account, bool enabled)',
	])
	const topic = iface.getEvent('AdminUpdated')!.topicHash
	const latest = Number(await conetDepinProvider.getBlockNumber())
	const enabled = new Map<string, string>()
	const start = Number.isFinite(GENESIS_VAULT_PROXY_DEPLOY_BLOCK)
		? GENESIS_VAULT_PROXY_DEPLOY_BLOCK
		: Math.max(0, latest - ADMIN_EVENT_LOG_CHUNK)
	for (let from = start; from <= latest; from += ADMIN_EVENT_LOG_CHUNK) {
		const to = Math.min(latest, from + ADMIN_EVENT_LOG_CHUNK - 1)
		const logs = await conetDepinProvider.getLogs({
			address: CONET_GENESIS_NODE_REFERRAL_VAULT,
			fromBlock: from,
			toBlock: to,
			topics: [topic],
		})
		for (const log of logs) {
			const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data })
			if (!parsed) continue
			const account = ethers.getAddress(String(parsed.args.account))
			if (Boolean(parsed.args.enabled)) {
				enabled.set(account.toLowerCase(), account)
			} else {
				enabled.delete(account.toLowerCase())
			}
		}
	}
	return [...enabled.values()]
}


export type GenesisDownstreamL0Item = {
	address: string
	earnedUsdc6: string
	/** Active L1 Evangelists under this L0 (item count for Admin Downstream list). */
	l1Count: number
}

export type GenesisDownstreamL1Item = {
	address: string
	ratioBps: number
	earnedUsdc6: string
}

export async function fetchGenesisL0List(forAdmin?: string): Promise<GenesisDownstreamL0Item[]> {
	return enqueueRpc(async () => {
		const count = Number(await vaultRead.l0Count())
		if (!Number.isFinite(count) || count <= 0) return []
		const adminLower = forAdmin && ethers.isAddress(forAdmin) ? ethers.getAddress(forAdmin).toLowerCase() : null
		const l1Total = Number(await vaultRead.l1Count())
		const l1ParentCounts = new Map<string, number>()
		if (Number.isFinite(l1Total) && l1Total > 0) {
			for (let i = 0; i < l1Total; i++) {
				const a = await vaultRead.l1At(i)
				if (!a || !ethers.isAddress(a)) continue
				const m = await vaultRead.members(ethers.getAddress(a))
				if (!m.active || Number(m.role) !== 2) continue
				const parent = ethers.getAddress(m.parentL0).toLowerCase()
				if (parent === ethers.ZeroAddress.toLowerCase()) continue
				l1ParentCounts.set(parent, (l1ParentCounts.get(parent) ?? 0) + 1)
			}
		}
		const out: GenesisDownstreamL0Item[] = []
		for (let i = 0; i < count; i++) {
			const a = await vaultRead.l0At(i)
			if (!a || !ethers.isAddress(a)) continue
			const addr = ethers.getAddress(a)
			if (adminLower) {
				const m = await vaultRead.members(addr)
				const parent = ethers.getAddress(m.parentAdmin).toLowerCase()
				if (parent !== adminLower) continue
			}
			const earned = (await vaultRead.earnedUsdc6(addr)) as bigint
			out.push({
				address: addr,
				earnedUsdc6: earned.toString(),
				l1Count: l1ParentCounts.get(addr.toLowerCase()) ?? 0,
			})
		}
		return out
	})
}

export async function fetchGenesisL1List(forL0?: string): Promise<GenesisDownstreamL1Item[]> {
	return enqueueRpc(async () => {
		const count = Number(await vaultRead.l1Count())
		if (!Number.isFinite(count) || count <= 0) return []
		const l0Lower = forL0 && ethers.isAddress(forL0) ? ethers.getAddress(forL0).toLowerCase() : null
		const out: GenesisDownstreamL1Item[] = []
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
			const earned = (await vaultRead.earnedUsdc6(addr)) as bigint
			out.push({ address: addr, ratioBps: Number(m.ratioBps), earnedUsdc6: earned.toString() })
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

export async function setGenesisFoundation(params: {
	adminPrivateKeyArmor: string
	foundation: string
}): Promise<string> {
	if (!ethers.isAddress(params.foundation) || params.foundation === ethers.ZeroAddress) {
		throw new Error('Foundation must be a non-zero address.')
	}
	const foundation = ethers.getAddress(params.foundation)
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.adminPrivateKeyArmor)
		const nonce = await readActionNonce(wallet.address)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			SetFoundation: [
				{ name: 'admin', type: 'address' },
				{ name: 'foundation', type: 'address' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const signature = await wallet.signTypedData(EIP712_DOMAIN, types, {
			admin: wallet.address,
			foundation,
			nonce,
			deadline,
		})
		const txHash = await postRedeem({
			action: 'setFoundation',
			account: wallet.address,
			payoutAddress: foundation,
			nonce: nonce.toString(),
			deadline: deadline.toString(),
			signature,
		})
		snapshotCache.clear()
		return txHash
	})
}

export async function setGenesisDefaultAdminPayout(params: {
	adminPrivateKeyArmor: string
	payout: string
}): Promise<string> {
	if (!ethers.isAddress(params.payout) || params.payout === ethers.ZeroAddress) {
		throw new Error('Default admin payout must be a non-zero address.')
	}
	const payout = ethers.getAddress(params.payout)
	return enqueueWrite(async () => {
		const wallet = new ethers.Wallet(params.adminPrivateKeyArmor)
		const nonce = await readActionNonce(wallet.address)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
		const types = {
			SetDefaultAdminPayout: [
				{ name: 'admin', type: 'address' },
				{ name: 'payout', type: 'address' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const signature = await wallet.signTypedData(EIP712_DOMAIN, types, {
			admin: wallet.address,
			payout,
			nonce,
			deadline,
		})
		const txHash = await postRedeem({
			action: 'setDefaultAdminPayout',
			account: wallet.address,
			payoutAddress: payout,
			nonce: nonce.toString(),
			deadline: deadline.toString(),
			signature,
		})
		snapshotCache.clear()
		return txHash
	})
}

// ─── Income details (API ledger — Master writes on each purchase fulfill) ─────

const INCOME_TTL_MS = 30_000
const INCOME_CACHE_PREFIX = 'beamio:genesis-referral:income:v2:'

export type GenesisIncomeRole = 'l0' | 'l1' | 'admin' | 'foundation'

export type GenesisIncomeItem = {
	operationId: string
	/** Base USDC purchase tx hash (primary). */
	transactionHash: string
	bindTxHash?: string | null
	lockMintTxHash?: string | null
	timestampMs: number
	amountUsdc6: string
	role: GenesisIncomeRole
	qty?: string
	testMode?: boolean
	buyer?: string
}

export type GenesisIncomeSnapshot = {
	eoa: string
	items: GenesisIncomeItem[]
	fetchedAt: number
}

export type GenesisIncomeResult =
	| { ok: true; snapshot: GenesisIncomeSnapshot }
	| { ok: false; error: string }

type GenesisIncomeCacheEntry = {
	snapshot: GenesisIncomeSnapshot
	fetchedAt: number
}

const incomeMemoryCache = new Map<string, GenesisIncomeCacheEntry>()
const incomeInFlight = new Map<string, Promise<GenesisIncomeResult>>()

function incomeCacheKey(eoa: string): string {
	return `${INCOME_CACHE_PREFIX}${eoa.toLowerCase()}`
}

export function readCachedGenesisIncome(eoa: string): GenesisIncomeSnapshot | null {
	try {
		const raw = localStorage.getItem(incomeCacheKey(eoa))
		if (!raw) return null
		const parsed = JSON.parse(raw) as GenesisIncomeSnapshot
		if (parsed.eoa?.toLowerCase() !== eoa.toLowerCase() || !Array.isArray(parsed.items)) return null
		return parsed
	} catch {
		return null
	}
}

function saveGenesisIncomePersistent(snapshot: GenesisIncomeSnapshot): void {
	try {
		localStorage.setItem(incomeCacheKey(snapshot.eoa), JSON.stringify(snapshot))
	} catch {
		/* quota / private mode */
	}
}

/**
 * Income details from Cluster API (Master writes on each genesisNodeSeat fulfill).
 * Trusted-only cache; failures keep last snapshot and do not clear.
 */
export async function fetchGenesisIncomeHistory(
	rawEoa: string,
	options: { force?: boolean } = {},
): Promise<GenesisIncomeResult> {
	let eoa: string
	try {
		eoa = ethers.getAddress(rawEoa.trim())
	} catch {
		return { ok: false, error: 'The current wallet address is unavailable.' }
	}

	const key = eoa.toLowerCase()
	const cached = incomeMemoryCache.get(key)
	if (!options.force && cached && Date.now() - cached.fetchedAt < INCOME_TTL_MS) {
		return { ok: true, snapshot: cached.snapshot }
	}
	if (!options.force) {
		const persisted = readCachedGenesisIncome(eoa)
		if (persisted && Date.now() - persisted.fetchedAt < INCOME_TTL_MS) {
			incomeMemoryCache.set(key, { snapshot: persisted, fetchedAt: persisted.fetchedAt })
			return { ok: true, snapshot: persisted }
		}
	}

	const existing = incomeInFlight.get(key)
	if (existing) return existing

	const request = (async (): Promise<GenesisIncomeResult> => {
		try {
			const response = await fetch(
				`${beamioApi}/api/genesisNodeReferralIncome?account=${encodeURIComponent(eoa)}`,
			)
			const body = (await response.json().catch(() => null)) as {
				success?: boolean
				items?: Array<{
					transactionHash?: string
					operationId?: string
					bindTxHash?: string | null
					lockMintTxHash?: string | null
					amountUsdc6?: string
					role?: string
					qty?: string
					testMode?: boolean
					buyer?: string
					timestampMs?: number
				}>
				error?: string
			} | null
			if (!response.ok || !body?.success || !Array.isArray(body.items)) {
				const previous = incomeMemoryCache.get(key)?.snapshot ?? readCachedGenesisIncome(eoa)
				if (previous) return { ok: true, snapshot: previous }
				return {
					ok: false,
					error: body?.error || `Could not load Genesis income (${response.status}).`,
				}
			}
			const items: GenesisIncomeItem[] = body.items
				.flatMap((row): GenesisIncomeItem[] => {
					const role = String(row.role ?? '') as GenesisIncomeRole
					if (!['l0', 'l1', 'admin', 'foundation'].includes(role)) return []
					const transactionHash = String(row.transactionHash ?? '').trim()
					if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) return []
					return [
						{
							operationId: String(row.operationId ?? ''),
							transactionHash,
							bindTxHash: row.bindTxHash ?? null,
							lockMintTxHash: row.lockMintTxHash ?? null,
							timestampMs: Number(row.timestampMs) || 0,
							amountUsdc6: String(row.amountUsdc6 ?? '0'),
							role,
							qty: row.qty != null ? String(row.qty) : undefined,
							testMode: Boolean(row.testMode),
							buyer:
								row.buyer && ethers.isAddress(row.buyer) ? ethers.getAddress(row.buyer) : undefined,
						},
					]
				})
				.sort((a, b) => b.timestampMs - a.timestampMs)

			const snapshot: GenesisIncomeSnapshot = {
				eoa,
				items,
				fetchedAt: Date.now(),
			}
			incomeMemoryCache.set(key, { snapshot, fetchedAt: snapshot.fetchedAt })
			saveGenesisIncomePersistent(snapshot)
			return { ok: true, snapshot }
		} catch (error) {
			console.warn('[GenesisNodeReferral] income API failed', error)
			const previous = incomeMemoryCache.get(key)?.snapshot ?? readCachedGenesisIncome(eoa)
			if (previous) return { ok: true, snapshot: previous }
			return {
				ok: false,
				error: error instanceof Error ? error.message : 'Could not load Genesis income history.',
			}
		} finally {
			incomeInFlight.delete(key)
		}
	})()

	incomeInFlight.set(key, request)
	return request
}
