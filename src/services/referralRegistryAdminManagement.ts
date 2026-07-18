import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import { CONET_REFERRAL_REGISTRY_VAULT_V1 } from '@/config/chainAddresses'

const DOMAIN = {
	name: 'ReferralRegistryVaultV1',
	version: '1',
	chainId: 224422,
	verifyingContract: CONET_REFERRAL_REGISTRY_VAULT_V1,
} as const

const TYPES = {
	setL0Rate: {
		SetL0Rate: [
			{ name: 'admin', type: 'address' },
			{ name: 'l0', type: 'address' },
			{ name: 'rebateBps', type: 'uint256' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
		],
	},
	assignMerchant: {
		AssignMerchantToL0: [
			{ name: 'admin', type: 'address' },
			{ name: 'l0', type: 'address' },
			{ name: 'merchant', type: 'address' },
			{ name: 'card', type: 'address' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
		],
	},
} as const

export type ReferralMerchantCandidate = {
	merchant: string
	cardAddress: string
	metadata: Record<string, unknown> | null
}

async function readAdminNonce(admin: string): Promise<bigint> {
	const response = await fetch(`${beamioApi}/api/referralRegistryAdminNonce?account=${encodeURIComponent(admin)}`)
	const json = await response.json() as { success?: boolean; nonce?: string; error?: string }
	if (!response.ok || !json.success || json.nonce == null) {
		throw new Error(json.error ?? 'Could not read Referral Admin nonce.')
	}
	return BigInt(json.nonce)
}

export async function fetchReferralMerchantCandidates(admin: string): Promise<ReferralMerchantCandidate[]> {
	const response = await fetch(`${beamioApi}/api/referralRegistryMerchantCandidates?admin=${encodeURIComponent(admin)}`)
	const json = await response.json() as { success?: boolean; candidates?: ReferralMerchantCandidate[]; error?: string }
	if (!response.ok || !json.success || !Array.isArray(json.candidates)) {
		throw new Error(json.error ?? 'Could not load merchant candidates.')
	}
	return json.candidates.filter((item) => ethers.isAddress(item.merchant) && ethers.isAddress(item.cardAddress))
}

async function postAdminAction(body: Record<string, string>): Promise<string> {
	const response = await fetch(`${beamioApi}/api/referralRegistryAdminManagement`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	})
	const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
	if (!response.ok || !json.success || !json.txHash) {
		throw new Error(json.error ?? 'Referral Admin management relay failed.')
	}
	return json.txHash
}

export async function setReferralL0RebateRate(params: {
	adminPrivateKeyArmor: string
	l0: string
	rebateBps: bigint
}): Promise<string> {
	const wallet = new ethers.Wallet(params.adminPrivateKeyArmor)
	const nonce = await readAdminNonce(wallet.address)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
	const message = {
		admin: wallet.address,
		l0: ethers.getAddress(params.l0),
		rebateBps: params.rebateBps,
		nonce,
		deadline,
	}
	const signature = await wallet.signTypedData(DOMAIN, TYPES.setL0Rate as any, message)
	return postAdminAction({
		action: 'setL0Rate',
		admin: wallet.address,
		l0: message.l0,
		rebateBps: params.rebateBps.toString(),
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})
}

export async function assignReferralMerchantToL0(params: {
	adminPrivateKeyArmor: string
	l0: string
	merchant: string
	card: string
}): Promise<string> {
	const wallet = new ethers.Wallet(params.adminPrivateKeyArmor)
	const nonce = await readAdminNonce(wallet.address)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
	const message = {
		admin: wallet.address,
		l0: ethers.getAddress(params.l0),
		merchant: ethers.getAddress(params.merchant),
		card: ethers.getAddress(params.card),
		nonce,
		deadline,
	}
	const signature = await wallet.signTypedData(DOMAIN, TYPES.assignMerchant as any, message)
	return postAdminAction({
		action: 'assignMerchant',
		admin: wallet.address,
		l0: message.l0,
		merchant: message.merchant,
		card: message.card,
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})
}
