import { ethers } from 'ethers'
import {
	CONET_MAINNET_CHAIN_ID,
	CONET_VALIDATOR_DEPOSIT_REDEEM,
	CONET_GUARDIAN_NODES_INFO_V6,
} from '@/config/chainAddresses'
import { conetDepinProvider, beamioApi } from '@/utils/constants'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { tu } from '@/locale/beamioLocale'
import type { ValidatorDepositRedeemIssuedStatus } from '@/utils/validatorDepositRedeemIssuedDb'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const uuid62 = require('uuid62') as { v4: () => string }

const REDEEM_ADMINS_ABI = ['function redeemAdmins(address account) view returns (bool)'] as const
const ADMINS_ABI = ['function admins(address account) view returns (bool)'] as const
const REDEEM_ADMIN_NONCES_ABI = ['function redeemAdminNonces(address account) view returns (uint256)'] as const
const GET_REDEEM_ABI = [
	'function getRedeem(bytes32 codeHash) view returns (address allowedClaimer, address referrer, uint256 validatorCount, string targetNodeIp, uint256 gbMiningNodeCount, uint64 validAfter, uint64 validBefore, bool active, bool consumed, bool airdrop)',
] as const

const CLAIM_ALLOC_REDEEM_ABI = [
	'function nextGuardianAllocId() view returns (uint256)',
	'function guardianAllocStartId() view returns (uint256)',
	'function guardianIdBeneficiary(uint256 nodeId) view returns (address)',
	'function nodeWalletBeneficiary(address nodeWallet) view returns (address)',
] as const

const GUARDIAN_ALLOC_ABI = [
	'function id2ip(uint256 id) view returns (string)',
	'function idOwner(uint256 id) view returns (address)',
	'function ipaddress2owner(string ip) view returns (address)',
	'function ipaddressExisting(string ip) view returns (bool)',
] as const

/** RPC preflight: would the next guardian allocation succeed for this beneficiary? */
export async function preflightValidatorDepositRedeemClaimAllocation(
	beneficiaryEoa: string,
	validatorCount: bigint,
	contractAddress: string = CONET_VALIDATOR_DEPOSIT_REDEEM,
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!ethers.isAddress(beneficiaryEoa)) return { ok: false, error: 'Invalid beneficiary' }
	if (validatorCount <= 0n) return { ok: true }
	const ben = ethers.getAddress(beneficiaryEoa.trim())
	const redeem = new ethers.Contract(contractAddress, CLAIM_ALLOC_REDEEM_ABI, conetDepinProvider)
	const guardian = new ethers.Contract(CONET_GUARDIAN_NODES_INFO_V6, GUARDIAN_ALLOC_ABI, conetDepinProvider)
	let nextId = (await redeem.nextGuardianAllocId!()) as bigint
	const startId = (await redeem.guardianAllocStartId!()) as bigint
	for (let need = 0n; need < validatorCount; need++) {
		let resolved = false
		while (!resolved) {
			if (nextId < startId) {
				return { ok: false, error: 'Guardian allocation pool exhausted.' }
			}
			const idBen = ethers.getAddress((await redeem.guardianIdBeneficiary!(nextId)) as string)
			if (idBen !== ethers.ZeroAddress) {
				nextId++
				continue
			}
			const ip = String(await guardian.id2ip!(nextId))
			if (!ip) return { ok: false, error: `Guardian node ${nextId.toString()} has no IP.` }
			if (!(await guardian.ipaddressExisting!(ip))) {
				return { ok: false, error: `Guardian IP ${ip} is not registered on-chain.` }
			}
			let nodeWallet = ethers.getAddress((await guardian.idOwner!(nextId)) as string)
			if (nodeWallet === ethers.ZeroAddress) {
				nodeWallet = ethers.getAddress((await guardian.ipaddress2owner!(ip)) as string)
			}
			if (nodeWallet === ethers.ZeroAddress) {
				return { ok: false, error: `Guardian node ${nextId.toString()} has no operator wallet.` }
			}
			const walletBen = ethers.getAddress((await redeem.nodeWalletBeneficiary!(nodeWallet)) as string)
			if (walletBen !== ethers.ZeroAddress && walletBen.toLowerCase() !== ben.toLowerCase()) {
				return {
					ok: false,
					error:
						'The next DePIN operator wallet is already assigned to another beneficiary. Claim with the same beneficiary wallet as the prior claim, or wait for a ValidatorDepositRedeem contract upgrade.',
				}
			}
			resolved = true
			nextId++
		}
	}
	return { ok: true }
}

export const VALIDATOR_DEPOSIT_REDEEM_CREATE_TYPED_DATA_TYPES: Record<string, { name: string; type: string }[]> = {
	CreateRedeem: [
		{ name: 'admin', type: 'address' },
		{ name: 'codeHash', type: 'bytes32' },
		{ name: 'allowedClaimer', type: 'address' },
		{ name: 'referrer', type: 'address' },
		{ name: 'validatorCount', type: 'uint256' },
		{ name: 'targetNodeIp', type: 'string' },
		{ name: 'gbMiningNodeCount', type: 'uint256' },
		{ name: 'airdrop', type: 'bool' },
		{ name: 'validAfter', type: 'uint256' },
		{ name: 'validBefore', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

export const VALIDATOR_DEPOSIT_REDEEM_CANCEL_TYPED_DATA_TYPES: Record<string, { name: string; type: string }[]> = {
	CancelRedeem: [
		{ name: 'admin', type: 'address' },
		{ name: 'codeHash', type: 'bytes32' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

export function validatorDepositRedeemEip712Domain() {
	return {
		name: 'ValidatorDepositRedeem',
		version: '1',
		chainId: CONET_MAINNET_CHAIN_ID,
		verifyingContract: ethers.getAddress(CONET_VALIDATOR_DEPOSIT_REDEEM),
	} as const
}

/** Matches on-chain claimRedeemFor: keccak256(bytes(code)). */
export function validatorDepositRedeemCodeHashFromSecret(code: string): string {
	return ethers.keccak256(ethers.toUtf8Bytes(code))
}

export function generateValidatorDepositRedeemSecretCode(): { code: string; codeHash: string } {
	const code = uuid62.v4()
	return { code, codeHash: validatorDepositRedeemCodeHashFromSecret(code) }
}

const IP_LIKE_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/

export function isValidTargetNodeIp(raw: string): boolean {
	const ip = raw.trim()
	if (!ip || ip.length > 45) return false
	return IP_LIKE_RE.test(ip)
}

export type ValidatorDepositRedeemAdminProbe =
	| { ok: true; isRedeemAdmin: boolean; isContractAdmin: boolean }
	| { ok: false; error: string }

/** RPC-direct: redeem admin can create/cancel; contract admin alone cannot. */
export async function probeValidatorDepositRedeemAdmin(eoa: string): Promise<ValidatorDepositRedeemAdminProbe> {
	if (!eoa || !ethers.isAddress(eoa)) {
		return { ok: false, error: 'Invalid EOA' }
	}
	const addr = ethers.getAddress(eoa.trim())
	const contract = CONET_VALIDATOR_DEPOSIT_REDEEM
	const cRedeem = new ethers.Contract(contract, REDEEM_ADMINS_ABI, conetDepinProvider)
	try {
		const isRedeemAdmin = Boolean(await cRedeem.redeemAdmins!(addr))
		let isContractAdmin = false
		try {
			const cAdmin = new ethers.Contract(contract, ADMINS_ABI, conetDepinProvider)
			isContractAdmin = Boolean(await cAdmin.admins!(addr))
		} catch {
			// redeemAdmins is authoritative for TicketPlus; admins read is optional chrome.
		}
		return { ok: true, isRedeemAdmin, isContractAdmin }
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'Admin probe failed' }
	}
}

export async function readValidatorDepositRedeemAdminNonceOnChain(
	admin: string,
): Promise<{ ok: true; nonce: string } | { ok: false; error: string }> {
	if (!admin || !ethers.isAddress(admin)) {
		return { ok: false, error: 'Invalid admin' }
	}
	const adminNorm = ethers.getAddress(admin.trim())
	const c = new ethers.Contract(CONET_VALIDATOR_DEPOSIT_REDEEM, REDEEM_ADMIN_NONCES_ABI, conetDepinProvider)
	try {
		const n = (await c.redeemAdminNonces!(adminNorm)) as bigint
		return { ok: true, nonce: n.toString() }
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'redeemAdminNonces read failed' }
	}
}

export type ValidatorDepositRedeemChainRedeem = {
	ok: true
	exists: boolean
	allowedClaimer: string
	referrer: string
	validatorCount: string
	targetNodeIp: string
	gbMiningNodeCount: string
	validAfter: string
	validBefore: string
	active: boolean
	consumed: boolean
	airdrop: boolean
}

/** Grace after create tx before pruning a pending row that is not yet visible on-chain. */
export const VALIDATOR_DEPOSIT_REDEEM_PENDING_CHAIN_GRACE_MS = 3 * 60 * 1000

/** Previous broken deployment — failed creates there must not linger in Issued codes. */
export const LEGACY_VALIDATOR_DEPOSIT_REDEEM = '0x970792658C09A96E27Fc4D8B69fF9989C2AcB50E'

/** Retired deployments still probed for issued-code reconciliation (newest last). */
export const DEPRECATED_VALIDATOR_DEPOSIT_REDEEM_ADDRESSES = [
	'0x970792658C09A96E27Fc4D8B69fF9989C2AcB50E',
	'0x02C425537E3E2C7B9F3071DdFc4E0d81DD3B2EFC',
] as const

function isLegacyValidatorDepositRedeemContract(contract: string | undefined): boolean {
	if (!contract || !ethers.isAddress(contract)) return false
	const normalized = ethers.getAddress(contract)
	return DEPRECATED_VALIDATOR_DEPOSIT_REDEEM_ADDRESSES.some(
		(a) => ethers.getAddress(a) === normalized,
	)
}

export async function readValidatorDepositRedeemCreateTxReceipt(
	txHash: string | undefined,
): Promise<{ ok: true; status: 'pending' | 'success' | 'reverted' } | { ok: false }> {
	if (!txHash || !ethers.isHexString(txHash, 32)) return { ok: false }
	try {
		const receipt = await conetDepinProvider.getTransactionReceipt(txHash)
		if (!receipt) return { ok: true, status: 'pending' }
		return { ok: true, status: receipt.status === 1 ? 'success' : 'reverted' }
	} catch {
		return { ok: false }
	}
}

export async function readValidatorDepositRedeemOnChain(
	codeHash: string,
	contractAddress: string = CONET_VALIDATOR_DEPOSIT_REDEEM,
): Promise<ValidatorDepositRedeemChainRedeem | { ok: false; error: string }> {
	if (!ethers.isHexString(codeHash, 32)) {
		return { ok: false, error: 'Invalid codeHash' }
	}
	const contract = contractAddress?.trim() || CONET_VALIDATOR_DEPOSIT_REDEEM
	if (!ethers.isAddress(contract)) {
		return { ok: false, error: 'ValidatorDepositRedeem address not configured' }
	}
	const c = new ethers.Contract(contract, GET_REDEEM_ABI, conetDepinProvider)
	try {
		const row = await c.getRedeem!(codeHash)
		const validatorCount = (row[2] as bigint).toString()
		const exists = BigInt(validatorCount) > 0n
		return {
			ok: true,
			exists,
			allowedClaimer: String(row[0]),
			referrer: String(row[1]),
			validatorCount,
			targetNodeIp: String(row[3] ?? ''),
			gbMiningNodeCount: (row[4] as bigint).toString(),
			validAfter: (row[5] as bigint).toString(),
			validBefore: (row[6] as bigint).toString(),
			active: Boolean(row[7]),
			consumed: Boolean(row[8]),
			airdrop: Boolean(row[9]),
		}
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'getRedeem failed' }
	}
}

export function shouldRemoveValidatorDepositRedeemIssuedAfterTrustedChainProbe(input: {
	row: {
		localStatus: ValidatorDepositRedeemIssuedStatus
		createTxHash?: string
		createdAt: string
		contract?: string
	}
	/** Trusted result: redeem exists on canonical and/or legacy contract probes. */
	existsOnChain: boolean
	nowMs?: number
	/** When set, refines pending+createTxHash grace (reverted/success → prune immediately). */
	createTxReceipt?: 'pending' | 'success' | 'reverted'
}): boolean {
	if (input.existsOnChain) return false
	// In-flight create — wait for API / handleCreate to finish; never prune during submit.
	if (input.row.localStatus === 'submitting') return false
	if (isLegacyValidatorDepositRedeemContract(input.row.contract)) return true
	const now = input.nowMs ?? Date.now()
	if (input.row.localStatus === 'create_failed' || input.row.localStatus === 'unknown') {
		return true
	}
	if (input.row.localStatus === 'pending') {
		if (!input.row.createTxHash) return true
		if (input.createTxReceipt === 'reverted' || input.createTxReceipt === 'success') {
			return true
		}
		if (input.createTxReceipt === 'pending') {
			const createdMs = Date.parse(input.row.createdAt)
			if (!Number.isFinite(createdMs)) return true
			return now - createdMs > VALIDATOR_DEPOSIT_REDEEM_PENDING_CHAIN_GRACE_MS
		}
		const createdMs = Date.parse(input.row.createdAt)
		if (!Number.isFinite(createdMs)) return true
		return now - createdMs > VALIDATOR_DEPOSIT_REDEEM_PENDING_CHAIN_GRACE_MS
	}
	// Local ghost rows (claimed/cancelled) with no on-chain redeem anywhere.
	return true
}

/** Failed / indeterminate local drafts — remove immediately without waiting for RPC. */
export function shouldEagerRemoveValidatorDepositRedeemIssuedLocally(
	localStatus: ValidatorDepositRedeemIssuedStatus,
): boolean {
	return localStatus === 'create_failed' || localStatus === 'unknown'
}

export function resolveValidatorDepositRedeemDisplayStatus(input: {
	localStatus: ValidatorDepositRedeemIssuedStatus
	chain?: ValidatorDepositRedeemChainRedeem | null
}): ValidatorDepositRedeemIssuedStatus {
	if (input.localStatus === 'submitting' || input.localStatus === 'create_failed') {
		return input.localStatus
	}
	const chain = input.chain
	if (!chain?.ok || !chain.exists) {
		return input.localStatus === 'pending' ? 'unknown' : input.localStatus
	}
	if (chain.consumed) return 'claimed'
	if (chain.active) return 'pending'
	return 'cancelled'
}

export function validatorDepositRedeemStatusLabel(status: ValidatorDepositRedeemIssuedStatus): string {
	switch (status) {
		case 'pending':
			return 'Pending'
		case 'claimed':
			return 'Claimed'
		case 'cancelled':
			return 'Cancelled'
		case 'submitting':
			return 'Submitting'
		case 'create_failed':
			return 'Create failed'
		default:
			return 'Unknown'
	}
}

async function postValidatorDepositRedeemAdminCreate(body: Record<string, string>): Promise<
	| { success: true; txHash?: string }
	| { success: false; error: string }
> {
	try {
		const res = await fetch(`${beamioApi}/api/validatorDepositRedeemAdminCreate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const data = (await res.json().catch(() => ({}))) as { success?: boolean; txHash?: string; error?: string }
		if (!res.ok || !data.success) {
			return { success: false, error: data.error ?? res.statusText ?? 'Create redeem failed' }
		}
		return { success: true, txHash: data.txHash }
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? tu('network_error') }
	}
}

async function postValidatorDepositRedeemAdminCancel(body: Record<string, string>): Promise<
	| { success: true; txHash?: string }
	| { success: false; error: string }
> {
	try {
		const res = await fetch(`${beamioApi}/api/validatorDepositRedeemAdminCancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const data = (await res.json().catch(() => ({}))) as { success?: boolean; txHash?: string; error?: string }
		if (!res.ok || !data.success) {
			return { success: false, error: data.error ?? res.statusText ?? 'Cancel redeem failed' }
		}
		return { success: true, txHash: data.txHash }
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? tu('network_error') }
	}
}

export async function signAndSubmitValidatorDepositRedeemCreate(params: {
	adminEoa: string
	codeHash: string
	validatorCount: number
	targetNodeIp: string
	gbMiningNodeCount: number
	allowedClaimer?: string
	referrer?: string
	airdrop?: boolean
	validAfter?: bigint
	validBefore?: bigint
	privateKeyArmor?: string
}): Promise<
	| { success: true; txHash?: string; codeHash: string }
	| { success: false; error: string }
> {
	const admin = ethers.getAddress(params.adminEoa.trim())
	const armor = params.privateKeyArmor?.trim() || resolveSigningPrivateKeyArmor()
	if (!armor) {
		return { success: false, error: 'Wallet signing key unavailable. Unlock your wallet and try again.' }
	}
	if (!Number.isFinite(params.validatorCount) || params.validatorCount <= 0) {
		return { success: false, error: 'Validator count must be a positive integer.' }
	}
	if (!isValidTargetNodeIp(params.targetNodeIp)) {
		return { success: false, error: 'Enter a valid target validator node IP.' }
	}

	const nonceRes = await readValidatorDepositRedeemAdminNonceOnChain(admin)
	if (!nonceRes.ok) {
		return { success: false, error: nonceRes.error }
	}

	const nonce = BigInt(nonceRes.nonce)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60)
	const validAfter = params.validAfter ?? 0n
	const validBefore = params.validBefore ?? 0n
	const allowedClaimer =
		params.allowedClaimer?.trim() && ethers.isAddress(params.allowedClaimer)
			? ethers.getAddress(params.allowedClaimer.trim())
			: ethers.ZeroAddress
	const referrer =
		params.referrer?.trim() && ethers.isAddress(params.referrer)
			? ethers.getAddress(params.referrer.trim())
			: ethers.ZeroAddress
	const validatorCount = BigInt(params.validatorCount)
	const gbMiningNodeCount = BigInt(params.gbMiningNodeCount)
	const airdrop = Boolean(params.airdrop)
	const domain = validatorDepositRedeemEip712Domain()
	const message = {
		admin,
		codeHash: params.codeHash as `0x${string}`,
		allowedClaimer,
		referrer,
		validatorCount,
		targetNodeIp: params.targetNodeIp.trim(),
		gbMiningNodeCount,
		airdrop,
		validAfter,
		validBefore,
		nonce,
		deadline,
	}

	let signature: string
	try {
		const wallet = new ethers.Wallet(armor, conetDepinProvider)
		signature = await wallet.signTypedData(domain, VALIDATOR_DEPOSIT_REDEEM_CREATE_TYPED_DATA_TYPES, message)
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'Signing failed' }
	}

	const submit = await postValidatorDepositRedeemAdminCreate({
		admin,
		codeHash: params.codeHash,
		allowedClaimer,
		referrer,
		validatorCount: validatorCount.toString(),
		targetNodeIp: params.targetNodeIp.trim(),
		gbMiningNodeCount: gbMiningNodeCount.toString(),
		airdrop: airdrop ? 'true' : 'false',
		validAfter: validAfter.toString(),
		validBefore: validBefore.toString(),
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})

	if (!submit.success) {
		return { success: false, error: submit.error }
	}
	return { success: true, txHash: submit.txHash, codeHash: params.codeHash }
}

export async function signAndSubmitValidatorDepositRedeemCancel(params: {
	adminEoa: string
	codeHash: string
	privateKeyArmor?: string
}): Promise<{ success: true; txHash?: string } | { success: false; error: string }> {
	const admin = ethers.getAddress(params.adminEoa.trim())
	const armor = params.privateKeyArmor?.trim() || resolveSigningPrivateKeyArmor()
	if (!armor) {
		return { success: false, error: 'Wallet signing key unavailable. Unlock your wallet and try again.' }
	}

	const nonceRes = await readValidatorDepositRedeemAdminNonceOnChain(admin)
	if (!nonceRes.ok) {
		return { success: false, error: nonceRes.error }
	}

	const nonce = BigInt(nonceRes.nonce)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60)
	const domain = validatorDepositRedeemEip712Domain()
	const message = {
		admin,
		codeHash: params.codeHash as `0x${string}`,
		nonce,
		deadline,
	}

	let signature: string
	try {
		const wallet = new ethers.Wallet(armor, conetDepinProvider)
		signature = await wallet.signTypedData(domain, VALIDATOR_DEPOSIT_REDEEM_CANCEL_TYPED_DATA_TYPES, message)
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'Signing failed' }
	}

	const submit = await postValidatorDepositRedeemAdminCancel({
		admin,
		codeHash: params.codeHash,
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})

	if (!submit.success) {
		return { success: false, error: submit.error }
	}
	return { success: true, txHash: submit.txHash }
}
