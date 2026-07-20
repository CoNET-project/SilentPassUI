import { ethers } from 'ethers'
import { beamioApi, conetDepinProvider } from '@/utils/constants'
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
	setL0Quota: {
		SetL0Quota: [
			{ name: 'admin', type: 'address' },
			{ name: 'l0', type: 'address' },
			{ name: 'starterKetRemaining', type: 'uint256' },
			{ name: 'paidBunitRemaining', type: 'uint256' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
		],
	},
	setL0StarterQuota: {
		SetL0StarterKetQuota: [
			{ name: 'admin', type: 'address' },
			{ name: 'l0', type: 'address' },
			{ name: 'starterKetRemaining', type: 'uint256' },
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

export type ReferralL0Quota = {
	starterKetRemaining: string
	paidBunitRemaining: string
}

const REFERRAL_L0_QUOTA_CACHE_PREFIX = 'beamio:referral:l0-quota:v1:'
const REFERRAL_L0_QUOTA_TTL_MS = 30_000
const REFERRAL_REGISTRY_QUOTA_ABI = [
	'function merchantQuotas(address) view returns (uint256 starterKetRemaining,uint256 paidBunitRemaining,uint256 issuedCodeCount,uint256 claimedCodeCount)',
] as const
const quotaCache = new Map<string, { fetchedAt: number; quota: ReferralL0Quota }>()
const quotaInFlight = new Map<string, Promise<ReferralL0Quota>>()

function quotaCacheKey(l0: string): string {
	return `${REFERRAL_L0_QUOTA_CACHE_PREFIX}${ethers.getAddress(l0).toLowerCase()}`
}

function isValidQuotaValue(value: unknown): value is string {
	return typeof value === 'string' && /^\d+$/.test(value)
}

export function readCachedReferralL0Quota(l0: string): ReferralL0Quota | null {
	try {
		const raw = localStorage.getItem(quotaCacheKey(l0))
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<ReferralL0Quota>
		if (!isValidQuotaValue(parsed.starterKetRemaining) || !isValidQuotaValue(parsed.paidBunitRemaining)) return null
		return {
			starterKetRemaining: parsed.starterKetRemaining,
			paidBunitRemaining: parsed.paidBunitRemaining,
		}
	} catch {
		return null
	}
}

function saveCachedReferralL0Quota(l0: string, quota: ReferralL0Quota): void {
	try {
		localStorage.setItem(quotaCacheKey(l0), JSON.stringify(quota))
	} catch {
		// Cache failure must not change the trusted network result.
	}
}

export async function fetchReferralL0Quota(l0: string): Promise<ReferralL0Quota> {
	const normalizedL0 = ethers.getAddress(l0)
	const key = normalizedL0.toLowerCase()
	const cached = quotaCache.get(key)
	if (cached && Date.now() - cached.fetchedAt < REFERRAL_L0_QUOTA_TTL_MS) return cached.quota
	const existing = quotaInFlight.get(key)
	if (existing) return existing
	const request = (async () => {
		try {
			const registry = new ethers.Contract(CONET_REFERRAL_REGISTRY_VAULT_V1, REFERRAL_REGISTRY_QUOTA_ABI, conetDepinProvider)
			const raw = await registry.merchantQuotas(normalizedL0)
			const quota = {
				starterKetRemaining: raw.starterKetRemaining.toString(),
				paidBunitRemaining: raw.paidBunitRemaining.toString(),
			}
			quotaCache.set(key, { fetchedAt: Date.now(), quota })
			saveCachedReferralL0Quota(normalizedL0, quota)
			return quota
		} catch (error) {
			const previous = quotaCache.get(key)?.quota ?? readCachedReferralL0Quota(normalizedL0)
			if (previous) return previous
			throw error
		}
	})()
	quotaInFlight.set(key, request)
	try {
		return await request
	} finally {
		quotaInFlight.delete(key)
	}
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

export async function setReferralL0Quota(params: {
	adminPrivateKeyArmor: string
	l0: string
	starterKetRemaining: bigint
	paidBunitRemaining: bigint
}): Promise<string> {
	const wallet = new ethers.Wallet(params.adminPrivateKeyArmor)
	const nonce = await readAdminNonce(wallet.address)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
	const message = {
		admin: wallet.address,
		l0: ethers.getAddress(params.l0),
		starterKetRemaining: params.starterKetRemaining,
		paidBunitRemaining: params.paidBunitRemaining,
		nonce,
		deadline,
	}
	const signature = await wallet.signTypedData(DOMAIN, TYPES.setL0Quota as any, message)
	return postAdminAction({
		action: 'setL0Quota',
		admin: wallet.address,
		l0: message.l0,
		starterKetRemaining: params.starterKetRemaining.toString(),
		paidBunitRemaining: params.paidBunitRemaining.toString(),
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})
}

export async function setReferralL0StarterQuota(params: {
	adminPrivateKeyArmor: string
	l0: string
	starterKetRemaining: bigint
}): Promise<string> {
	const wallet = new ethers.Wallet(params.adminPrivateKeyArmor)
	const nonce = await readAdminNonce(wallet.address)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
	const message = {
		admin: wallet.address,
		l0: ethers.getAddress(params.l0),
		starterKetRemaining: params.starterKetRemaining,
		nonce,
		deadline,
	}
	const signature = await wallet.signTypedData(DOMAIN, TYPES.setL0StarterQuota as any, message)
	return postAdminAction({
		action: 'setL0StarterQuota',
		admin: wallet.address,
		l0: message.l0,
		starterKetRemaining: params.starterKetRemaining.toString(),
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
