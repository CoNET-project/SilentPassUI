/**
 * Institutional AA V2 — EIP-712 typed data + Factory relay API.
 * See: .cursor/rules/beamio-aa-account-dev.mdc
 */
import { ethers } from 'ethers'
import { BEAMIO_AA_FACTORY_V2, CONET_MAINNET_CHAIN_ID, CONET_USDC, CONET_BUINT, CONET_GB_ERC20 } from '@/config/chainAddresses'
import { beamioApi, conetDepinProvider } from '@/utils/constants'
import type { AaMultisigTransferAssetId } from '@/utils/aaMultisigProtocol'

export const AA_V2_EIP712_NAME = 'BeamioAccountInstitutionalV2'
export const AA_V2_EIP712_VERSION = '2'

export const AA_V2_ACCOUNT_READ_ABI = [
	'function accountVersion() view returns (uint256)',
	'function factory() view returns (address)',
	'function owner() view returns (address)',
	'function threshold() view returns (uint256)',
	'function isThresholdManager(address) view returns (bool)',
	'function isSoleSelfSigner() view returns (bool)',
	'function policyLockActive() view returns (bool)',
	'function spendable(address token) view returns (uint256)',
	'function nextTaskId() view returns (uint256)',
	'function pendingPolicyTaskId() view returns (uint256)',
	'function reservedOf(address token) view returns (uint256)',
	'function taskVote(uint256 taskId, address voter) view returns (uint8)',
	'function getTask(uint256 taskId) view returns (uint8 kind,uint8 status,address proposer,address token,address to,uint256 amount,uint256 thresholdSnap,uint256 approveCount,uint256 rejectCount,uint64 deadline,bytes32 managersHash,address[] managersSnap)',
] as const

const proposeTransferTypes: Record<string, Array<{ name: string; type: string }>> = {
	ProposeTransfer: [
		{ name: 'account', type: 'address' },
		{ name: 'token', type: 'address' },
		{ name: 'to', type: 'address' },
		{ name: 'amount', type: 'uint256' },
		{ name: 'deadline', type: 'uint64' },
		{ name: 'nonce', type: 'bytes32' },
	],
}

const proposeSetPolicyTypes: Record<string, Array<{ name: string; type: string }>> = {
	ProposeSetPolicy: [
		{ name: 'account', type: 'address' },
		{ name: 'managersHash', type: 'bytes32' },
		{ name: 'newThreshold', type: 'uint256' },
		{ name: 'deadline', type: 'uint64' },
		{ name: 'nonce', type: 'bytes32' },
	],
}

const voteTypes: Record<string, Array<{ name: string; type: string }>> = {
	Vote: [
		{ name: 'account', type: 'address' },
		{ name: 'taskId', type: 'uint256' },
		{ name: 'approve', type: 'bool' },
		{ name: 'deadline', type: 'uint64' },
		{ name: 'nonce', type: 'bytes32' },
	],
}

export function aaV2Eip712Domain(account: string) {
	return {
		name: AA_V2_EIP712_NAME,
		version: AA_V2_EIP712_VERSION,
		chainId: CONET_MAINNET_CHAIN_ID,
		verifyingContract: ethers.getAddress(account),
	}
}

export function newAaV2SigNonce(): string {
	return ethers.hexlify(ethers.randomBytes(32))
}

export function defaultAaV2DeadlineSec(hours = 72): number {
	return Math.floor(Date.now() / 1000) + hours * 3600
}

export function managersHashSorted(managersSorted: string[]): string {
	const sorted = managersSorted.map((a) => ethers.getAddress(a))
	return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address[]'], [sorted]))
}

export async function isInstitutionalAaV2(
	aaAccount: string,
	provider: ethers.Provider = conetDepinProvider
): Promise<boolean> {
	if (!ethers.isAddress(aaAccount)) return false
	try {
		const aa = new ethers.Contract(aaAccount, AA_V2_ACCOUNT_READ_ABI, provider)
		const ver = (await aa.accountVersion()) as bigint
		if (ver !== 2n) return false
		const fac = ethers.getAddress((await aa.factory()) as string)
		return fac.toLowerCase() === BEAMIO_AA_FACTORY_V2.toLowerCase()
	} catch {
		return false
	}
}

export function tokenAddressForTransferAsset(asset: AaMultisigTransferAssetId): string {
	switch (asset) {
		case 'cnet':
		case 'base_eth':
			return ethers.ZeroAddress
		case 'usdc':
			return CONET_USDC
		case 'base_usdc':
			return CONET_USDC
		case 'gb_paid':
			return CONET_GB_ERC20
		case 'buint_paid':
			return CONET_BUINT
		default:
			return ethers.ZeroAddress
	}
}

export async function signAaV2ProposeTransfer(params: {
	privateKeyArmor: string
	account: string
	token: string
	to: string
	amount: bigint
	deadline: number
	nonce: string
}): Promise<string> {
	const wallet = new ethers.Wallet(params.privateKeyArmor)
	const domain = aaV2Eip712Domain(params.account)
	const value = {
		account: ethers.getAddress(params.account),
		token: params.token === ethers.ZeroAddress ? ethers.ZeroAddress : ethers.getAddress(params.token),
		to: ethers.getAddress(params.to),
		amount: params.amount,
		deadline: params.deadline,
		nonce: params.nonce,
	}
	return wallet.signTypedData(domain, proposeTransferTypes, value)
}

export async function signAaV2ProposeSetPolicy(params: {
	privateKeyArmor: string
	account: string
	managersSorted: string[]
	newThreshold: number
	deadline: number
	nonce: string
}): Promise<string> {
	const wallet = new ethers.Wallet(params.privateKeyArmor)
	const domain = aaV2Eip712Domain(params.account)
	const value = {
		account: ethers.getAddress(params.account),
		managersHash: managersHashSorted(params.managersSorted),
		newThreshold: params.newThreshold,
		deadline: params.deadline,
		nonce: params.nonce,
	}
	return wallet.signTypedData(domain, proposeSetPolicyTypes, value)
}

export async function signAaV2Vote(params: {
	privateKeyArmor: string
	account: string
	taskId: bigint | string | number
	approve: boolean
	deadline: number
	nonce: string
}): Promise<string> {
	const wallet = new ethers.Wallet(params.privateKeyArmor)
	const domain = aaV2Eip712Domain(params.account)
	const value = {
		account: ethers.getAddress(params.account),
		taskId: BigInt(params.taskId),
		approve: params.approve,
		deadline: params.deadline,
		nonce: params.nonce,
	}
	return wallet.signTypedData(domain, voteTypes, value)
}

async function postV2Relay<T extends Record<string, unknown>>(
	path: string,
	body: Record<string, unknown>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
	try {
		const res = await fetch(`${beamioApi}/api/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const json = (await res.json().catch(() => null)) as (T & { success?: boolean; error?: string }) | null
		if (!res.ok || !json?.success) {
			return { success: false, error: json?.error || `HTTP ${res.status}` }
		}
		return { success: true, data: json as T }
	} catch (e: unknown) {
		return { success: false, error: e instanceof Error ? e.message : String(e) }
	}
}

export async function relayAaV2ProposeTransfer(body: {
	account: string
	token: string
	to: string
	amount: string
	deadline: number
	nonce: string
	signature: string
	signerEoa: string
}): Promise<{ success: true; taskId: string; txHash?: string } | { success: false; error: string }> {
	const r = await postV2Relay<{ taskId?: string; txHash?: string }>('aaInstitutionalV2ProposeTransfer', body)
	if (!r.success) return r
	if (!r.data.taskId) return { success: false, error: 'Missing taskId in response' }
	return { success: true, taskId: String(r.data.taskId), txHash: r.data.txHash }
}

export async function relayAaV2ProposeSetPolicy(body: {
	account: string
	managersSorted: string[]
	newThreshold: number
	deadline: number
	nonce: string
	signature: string
	signerEoa: string
}): Promise<{ success: true; taskId: string; txHash?: string } | { success: false; error: string }> {
	const r = await postV2Relay<{ taskId?: string; txHash?: string }>('aaInstitutionalV2ProposeSetPolicy', body)
	if (!r.success) return r
	if (!r.data.taskId) return { success: false, error: 'Missing taskId in response' }
	return { success: true, taskId: String(r.data.taskId), txHash: r.data.txHash }
}

export async function relayAaV2Vote(body: {
	account: string
	taskId: string
	approve: boolean
	deadline: number
	nonce: string
	signature: string
	signerEoa: string
}): Promise<{ success: true; txHash?: string } | { success: false; error: string }> {
	const r = await postV2Relay<{ txHash?: string }>('aaInstitutionalV2Vote', body)
	if (!r.success) return r
	return { success: true, txHash: r.data.txHash }
}
