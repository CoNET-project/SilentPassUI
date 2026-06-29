import { ethers } from 'ethers'
import { CONET_VALIDATOR_DEPOSIT_REDEEM } from '@/config/chainAddresses'
import { conetDepinProvider, beamioApi } from '@/utils/constants'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { tu } from '@/locale/beamioLocale'
import { validatorDepositRedeemEip712Domain } from '@/services/validatorDepositRedeemAdmin'

/**
 * EIP-712 {ClaimAirdrop} — must stay byte-identical to the on-chain CLAIM_AIRDROP_TYPEHASH in
 * ValidatorDepositRedeemStatsLib so the relayed claimAirdropFor signature recovers to the beneficiary.
 */
export const VALIDATOR_DEPOSIT_REDEEM_CLAIM_AIRDROP_TYPED_DATA_TYPES: Record<
	string,
	{ name: string; type: string }[]
> = {
	ClaimAirdrop: [
		{ name: 'beneficiary', type: 'address' },
		{ name: 'amount', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

const AIRDROP_INFO_ABI = [
	'function airdropInfoOf(address beneficiary) view returns (uint256 accrued, uint256 claimed, uint256 claimable, uint64 claimableAt)',
] as const

const BENEFICIARY_NONCES_ABI = [
	'function beneficiaryNonces(address account) view returns (uint256)',
] as const

const CLAIM_AIRDROP_FOR_ABI = [
	'function claimAirdropFor(address beneficiary, uint256 amount, uint256 nonce, uint256 deadline, bytes signature) external',
] as const

/**
 * Linear vesting window for the CNET airdrop. Mirrors the on-chain (internal) constant
 * {ValidatorDepositRedeem.AIRDROP_VESTING_DURATION} = 180 days. Accrued CNET unlocks linearly from the on-chain
 * {airdropClaimableAt} start over this duration; clients render the schedule against that on-chain start.
 */
export const VALIDATOR_DEPOSIT_REDEEM_AIRDROP_VESTING_DURATION_SECONDS = 180 * 24 * 60 * 60

export type ValidatorDepositRedeemAirdropInfo = {
	ok: true
	/** Cumulative CNET entitlement accrued (wei, 18 decimals). */
	accrued: bigint
	/** CNET already claimed (wei). */
	claimed: bigint
	/** claimable = accrued - claimed (wei). */
	claimable: bigint
	/** Unix seconds from which the airdrop may be claimed; 0 = closed. */
	claimableAt: bigint
}

/**
 * RPC-direct read of the airdrop ledger for a beneficiary. Failures are returned (not thrown) so callers can keep the
 * last trusted value and avoid showing a balance of 0 on a transient RPC error (beamio-trusted-vs-untrusted-fetch).
 */
export async function readValidatorDepositRedeemAirdropInfo(
	beneficiaryEoa: string,
	contractAddress: string = CONET_VALIDATOR_DEPOSIT_REDEEM,
): Promise<ValidatorDepositRedeemAirdropInfo | { ok: false; error: string }> {
	if (!beneficiaryEoa || !ethers.isAddress(beneficiaryEoa)) {
		return { ok: false, error: 'Invalid beneficiary' }
	}
	const contract = contractAddress?.trim() || CONET_VALIDATOR_DEPOSIT_REDEEM
	if (!ethers.isAddress(contract)) {
		return { ok: false, error: 'ValidatorDepositRedeem address not configured' }
	}
	const beneficiary = ethers.getAddress(beneficiaryEoa.trim())
	const c = new ethers.Contract(contract, AIRDROP_INFO_ABI, conetDepinProvider)
	try {
		const row = await c.airdropInfoOf!(beneficiary)
		return {
			ok: true,
			accrued: row[0] as bigint,
			claimed: row[1] as bigint,
			claimable: row[2] as bigint,
			claimableAt: row[3] as bigint,
		}
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'airdropInfoOf failed' }
	}
}

async function readBeneficiaryNonce(
	beneficiary: string,
	contractAddress: string,
): Promise<{ ok: true; nonce: bigint } | { ok: false; error: string }> {
	try {
		const c = new ethers.Contract(contractAddress, BENEFICIARY_NONCES_ABI, conetDepinProvider)
		const nonce = (await c.beneficiaryNonces!(beneficiary)) as bigint
		return { ok: true, nonce }
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'Failed to read nonce' }
	}
}

/**
 * Sign EIP-712 {ClaimAirdrop} offline and submit to the gas-sponsored relay (cluster pre-check + master
 * claimAirdropFor). When `amount` is omitted the full claimable balance is claimed.
 */
export async function signAndSubmitValidatorDepositRedeemClaimAirdrop(params: {
	beneficiaryEoa: string
	/** Optional explicit amount in wei; defaults to the full claimable balance. */
	amount?: bigint
	privateKeyArmor?: string
	contractAddress?: string
}): Promise<{ success: true; txHash?: string } | { success: false; error: string }> {
	if (!params.beneficiaryEoa || !ethers.isAddress(params.beneficiaryEoa)) {
		return { success: false, error: 'Wallet EOA unavailable.' }
	}
	const beneficiary = ethers.getAddress(params.beneficiaryEoa.trim())
	const contract = params.contractAddress?.trim() || CONET_VALIDATOR_DEPOSIT_REDEEM
	if (!ethers.isAddress(contract)) {
		return { success: false, error: 'ValidatorDepositRedeem address not configured' }
	}

	const armor = params.privateKeyArmor?.trim() || resolveSigningPrivateKeyArmor()
	if (!armor) {
		return { success: false, error: 'Unlock your wallet to sign the airdrop claim.' }
	}

	const info = await readValidatorDepositRedeemAirdropInfo(beneficiary, contract)
	if (!info.ok) return { success: false, error: info.error }
	if (info.claimableAt === 0n) {
		return { success: false, error: 'Airdrop claim is not open yet.' }
	}
	if (BigInt(Math.floor(Date.now() / 1000)) < info.claimableAt) {
		return { success: false, error: 'Airdrop claim is not open yet.' }
	}
	const amount = params.amount ?? info.claimable
	if (amount <= 0n) {
		return { success: false, error: 'No claimable airdrop balance.' }
	}
	if (amount > info.claimable) {
		return { success: false, error: 'Amount exceeds claimable airdrop.' }
	}

	const nonceRes = await readBeneficiaryNonce(beneficiary, contract)
	if (!nonceRes.ok) return { success: false, error: nonceRes.error }

	const nonce = nonceRes.nonce
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60)
	const message = { beneficiary, amount, nonce, deadline }

	let signature: string
	try {
		const wallet = new ethers.Wallet(armor, conetDepinProvider)
		signature = await wallet.signTypedData(
			validatorDepositRedeemEip712Domain(),
			VALIDATOR_DEPOSIT_REDEEM_CLAIM_AIRDROP_TYPED_DATA_TYPES,
			message,
		)
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'Signing failed' }
	}

	try {
		const res = await fetch(`${beamioApi}/api/validatorDepositRedeemClaimAirdrop`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				beneficiary,
				amount: amount.toString(),
				nonce: nonce.toString(),
				deadline: deadline.toString(),
				signature,
			}),
		})
		const data = (await res.json().catch(() => ({}))) as { success?: boolean; txHash?: string; error?: string }
		if (!res.ok || !data.success) {
			return { success: false, error: data.error ?? res.statusText ?? 'Airdrop claim failed' }
		}
		return { success: true, txHash: data.txHash }
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? tu('network_error') }
	}
}

/**
 * User-paid-gas airdrop release. The beneficiary signs EIP-712 {ClaimAirdrop} and submits {claimAirdropFor}
 * directly from their own CoNET wallet (no relay — gas is paid by the user). The on-chain contract only pays the
 * currently vested-and-unclaimed (linear over {VALIDATOR_DEPOSIT_REDEEM_AIRDROP_VESTING_DURATION_SECONDS}) portion.
 * When `amount` is omitted the full currently releasable balance is claimed.
 */
export async function releaseValidatorDepositRedeemAirdropSelf(params: {
	beneficiaryEoa: string
	/** Optional explicit amount in wei; defaults to the full currently releasable balance. */
	amount?: bigint
	privateKeyArmor?: string
	contractAddress?: string
}): Promise<{ success: true; txHash: string; amount: bigint } | { success: false; error: string }> {
	if (!params.beneficiaryEoa || !ethers.isAddress(params.beneficiaryEoa)) {
		return { success: false, error: 'Wallet EOA unavailable.' }
	}
	const beneficiary = ethers.getAddress(params.beneficiaryEoa.trim())
	const contract = params.contractAddress?.trim() || CONET_VALIDATOR_DEPOSIT_REDEEM
	if (!ethers.isAddress(contract)) {
		return { success: false, error: 'ValidatorDepositRedeem address not configured' }
	}

	const armor = params.privateKeyArmor?.trim() || resolveSigningPrivateKeyArmor()
	if (!armor) {
		return { success: false, error: 'Unlock your wallet to release the airdrop.' }
	}

	const info = await readValidatorDepositRedeemAirdropInfo(beneficiary, contract)
	if (!info.ok) return { success: false, error: info.error }
	if (info.claimableAt === 0n) {
		return { success: false, error: 'Airdrop vesting has not started yet.' }
	}
	if (BigInt(Math.floor(Date.now() / 1000)) < info.claimableAt) {
		return { success: false, error: 'Airdrop vesting has not started yet.' }
	}
	const amount = params.amount ?? info.claimable
	if (amount <= 0n) {
		return { success: false, error: 'No unlocked CNET to release yet.' }
	}
	if (amount > info.claimable) {
		return { success: false, error: 'Amount exceeds unlocked CNET.' }
	}

	const nonceRes = await readBeneficiaryNonce(beneficiary, contract)
	if (!nonceRes.ok) return { success: false, error: nonceRes.error }

	const nonce = nonceRes.nonce
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60)
	const message = { beneficiary, amount, nonce, deadline }

	let wallet: ethers.Wallet
	let signature: string
	try {
		wallet = new ethers.Wallet(armor, conetDepinProvider)
		signature = await wallet.signTypedData(
			validatorDepositRedeemEip712Domain(),
			VALIDATOR_DEPOSIT_REDEEM_CLAIM_AIRDROP_TYPED_DATA_TYPES,
			message,
		)
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'Signing failed' }
	}

	try {
		const c = new ethers.Contract(contract, CLAIM_AIRDROP_FOR_ABI, wallet)
		const tx = await c.claimAirdropFor!(beneficiary, amount, nonce, deadline, signature)
		const receipt = await tx.wait()
		if (!receipt || receipt.status !== 1) {
			return { success: false, error: 'Release transaction failed.' }
		}
		return { success: true, txHash: tx.hash as string, amount }
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'Release failed' }
	}
}
