import { ethers } from 'ethers'
import { CONET_VALIDATOR_DEPOSIT_REDEEM } from '@/config/chainAddresses'
import { conetDepinProvider, beamioApi } from '@/utils/constants'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { tu } from '@/locale/beamioLocale'
import {
	readValidatorDepositRedeemOnChain,
	validatorDepositRedeemCodeHashFromSecret,
	validatorDepositRedeemEip712Domain,
	type ValidatorDepositRedeemChainRedeem,
} from '@/services/validatorDepositRedeemAdmin'

export const VALIDATOR_DEPOSIT_REDEEM_CLAIM_TYPED_DATA_TYPES: Record<string, { name: string; type: string }[]> = {
	ClaimRedeem: [
		{ name: 'claimer', type: 'address' },
		{ name: 'codeHash', type: 'bytes32' },
		{ name: 'beneficiary', type: 'address' },
		{ name: 'referrer', type: 'address' },
		{ name: 'validatorCount', type: 'uint256' },
		{ name: 'targetNodeIp', type: 'string' },
		{ name: 'gbMiningNodeCount', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

export type ValidatorDepositRedeemClaimPreview =
	| { ok: true; codeHash: string; redeem: ValidatorDepositRedeemChainRedeem }
	| { ok: false; error: string }

/** RPC precheck: redeem code exists, active, and claimer may claim. */
export async function previewValidatorDepositRedeemClaim(input: {
	secretCode: string
	claimerEoa: string
	beneficiaryEoa?: string
}): Promise<ValidatorDepositRedeemClaimPreview> {
	const code = input.secretCode.trim()
	const bytes = ethers.toUtf8Bytes(code)
	if (!code || bytes.length === 0 || bytes.length > 512) {
		return { ok: false, error: 'Enter a valid redeem code.' }
	}
	if (!input.claimerEoa || !ethers.isAddress(input.claimerEoa)) {
		return { ok: false, error: 'Wallet EOA unavailable.' }
	}
	const claimer = ethers.getAddress(input.claimerEoa.trim())
	let beneficiary = claimer
	if (input.beneficiaryEoa?.trim()) {
		if (!ethers.isAddress(input.beneficiaryEoa.trim())) {
			return { ok: false, error: 'Beneficiary must be a valid address.' }
		}
		beneficiary = ethers.getAddress(input.beneficiaryEoa.trim())
	}

	const codeHash = validatorDepositRedeemCodeHashFromSecret(code)
	const chain = await readValidatorDepositRedeemOnChain(codeHash, CONET_VALIDATOR_DEPOSIT_REDEEM)
	if (!chain.ok) return { ok: false, error: chain.error }
	if (!chain.exists) return { ok: false, error: 'Redeem code not found on-chain.' }
	if (chain.consumed) return { ok: false, error: 'This redeem code was already claimed.' }
	if (!chain.active) return { ok: false, error: 'This redeem code is not active.' }

	const allowed = chain.allowedClaimer
	if (
		allowed &&
		allowed !== ethers.ZeroAddress &&
		ethers.getAddress(allowed).toLowerCase() !== claimer.toLowerCase()
	) {
		return { ok: false, error: 'Your wallet is not the allowed claimer for this code.' }
	}

	const referrer = chain.referrer ? ethers.getAddress(chain.referrer) : ethers.ZeroAddress
	if (referrer !== ethers.ZeroAddress && referrer.toLowerCase() === beneficiary.toLowerCase()) {
		return { ok: false, error: 'Referrer cannot equal beneficiary.' }
	}

	return { ok: true, codeHash, redeem: chain }
}

export async function signAndSubmitValidatorDepositRedeemClaim(params: {
	claimerEoa: string
	secretCode: string
	beneficiaryEoa?: string
	privateKeyArmor?: string
}): Promise<{ success: true; txHash?: string } | { success: false; error: string }> {
	const preview = await previewValidatorDepositRedeemClaim({
		secretCode: params.secretCode,
		claimerEoa: params.claimerEoa,
		beneficiaryEoa: params.beneficiaryEoa,
	})
	if (!preview.ok) return { success: false, error: preview.error }

	const claimer = ethers.getAddress(params.claimerEoa.trim())
	let beneficiary = claimer
	if (params.beneficiaryEoa?.trim()) {
		beneficiary = ethers.getAddress(params.beneficiaryEoa.trim())
	}

	const armor = params.privateKeyArmor?.trim() || resolveSigningPrivateKeyArmor()
	if (!armor) {
		return { success: false, error: 'Unlock your wallet to sign the claim.' }
	}

	const redeem = preview.redeem
	const referrer = redeem.referrer ? ethers.getAddress(redeem.referrer) : ethers.ZeroAddress
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60)
	const message = {
		claimer,
		codeHash: preview.codeHash as `0x${string}`,
		beneficiary,
		referrer,
		validatorCount: BigInt(redeem.validatorCount),
		targetNodeIp: redeem.targetNodeIp.trim(),
		gbMiningNodeCount: BigInt(redeem.gbMiningNodeCount),
		deadline,
	}

	let signature: string
	try {
		const wallet = new ethers.Wallet(armor, conetDepinProvider)
		signature = await wallet.signTypedData(
			validatorDepositRedeemEip712Domain(),
			VALIDATOR_DEPOSIT_REDEEM_CLAIM_TYPED_DATA_TYPES,
			message,
		)
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'Signing failed' }
	}

	try {
		const res = await fetch(`${beamioApi}/api/validatorDepositRedeemClaim`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				claimer,
				beneficiary,
				code: params.secretCode.trim(),
				deadline: deadline.toString(),
				signature,
			}),
		})
		const data = (await res.json().catch(() => ({}))) as { success?: boolean; txHash?: string; error?: string }
		if (!res.ok || !data.success) {
			return { success: false, error: data.error ?? res.statusText ?? 'Claim failed' }
		}
		return { success: true, txHash: data.txHash }
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? tu('network_error') }
	}
}
