import { ethers } from 'ethers'
import { beamioApi, conetDepinProvider } from '@/utils/constants'
import { CONET_REFERRAL_PURCHASE_SPLIT_V1 } from '@/config/chainAddresses'

export const PURCHASE_SPLIT_IMMEDIATE_BPS = 6000
export const PURCHASE_SPLIT_DEFERRED_BPS = 4000
export const PURCHASE_SPLIT_MAX_WALLETS = 16

const SPLIT_ABI = [
	'function actionNonces(address) view returns (uint256)',
	'function immediateSplit() view returns (address payout,uint256 payoutBps,address[] wallets,uint256[] bps)',
] as const

const DOMAIN = {
	name: 'ReferralPurchaseSplitV1',
	version: '1',
	chainId: 224422,
	verifyingContract: CONET_REFERRAL_PURCHASE_SPLIT_V1,
} as const

const TYPES = {
	SetImmediateSplit: [
		{ name: 'admin', type: 'address' },
		{ name: 'adminPayout', type: 'address' },
		{ name: 'adminBps', type: 'uint256' },
		{ name: 'wallets', type: 'address[]' },
		{ name: 'bps', type: 'uint256[]' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
} as const

export type ReferralPurchaseSplitSnapshot = {
	adminPayout: string
	adminBps: bigint
	wallets: string[]
	bps: bigint[]
}

const CACHE_KEY = 'beamio:referral:purchase-split:v1'
let memoryCache: { fetchedAt: number; snapshot: ReferralPurchaseSplitSnapshot } | null = null
let inFlight: Promise<ReferralPurchaseSplitSnapshot> | null = null
const TTL_MS = 30_000

export function isReferralPurchaseSplitConfigured(): boolean {
	return ethers.isAddress(CONET_REFERRAL_PURCHASE_SPLIT_V1) && CONET_REFERRAL_PURCHASE_SPLIT_V1 !== ethers.ZeroAddress
}

export function readCachedReferralPurchaseSplit(): ReferralPurchaseSplitSnapshot | null {
	if (memoryCache) return memoryCache.snapshot
	try {
		const raw = localStorage.getItem(CACHE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as {
			adminPayout?: string
			adminBps?: string
			wallets?: string[]
			bps?: string[]
		}
		if (!parsed.adminPayout || !ethers.isAddress(parsed.adminPayout) || !Array.isArray(parsed.wallets) || !Array.isArray(parsed.bps)) {
			return null
		}
		return {
			adminPayout: ethers.getAddress(parsed.adminPayout),
			adminBps: BigInt(parsed.adminBps ?? '0'),
			wallets: parsed.wallets.map((w) => ethers.getAddress(w)),
			bps: parsed.bps.map((v) => BigInt(v)),
		}
	} catch {
		return null
	}
}

function saveCachedReferralPurchaseSplit(snapshot: ReferralPurchaseSplitSnapshot): void {
	try {
		localStorage.setItem(
			CACHE_KEY,
			JSON.stringify({
				adminPayout: snapshot.adminPayout,
				adminBps: snapshot.adminBps.toString(),
				wallets: snapshot.wallets,
				bps: snapshot.bps.map((v) => v.toString()),
			}),
		)
	} catch {
		// Cache write is best-effort.
	}
}

export async function fetchReferralPurchaseSplit(): Promise<ReferralPurchaseSplitSnapshot> {
	if (!isReferralPurchaseSplitConfigured()) {
		throw new Error('Purchase split contract is not configured.')
	}
	if (memoryCache && Date.now() - memoryCache.fetchedAt < TTL_MS) return memoryCache.snapshot
	if (inFlight) return inFlight
	inFlight = (async () => {
		try {
			const split = new ethers.Contract(CONET_REFERRAL_PURCHASE_SPLIT_V1, SPLIT_ABI, conetDepinProvider)
			const raw = await split.immediateSplit()
			const snapshot: ReferralPurchaseSplitSnapshot = {
				adminPayout: ethers.getAddress(raw.payout),
				adminBps: BigInt(raw.payoutBps.toString()),
				wallets: (raw.wallets as string[]).map((w) => ethers.getAddress(w)),
				bps: (raw.bps as bigint[]).map((v) => BigInt(v.toString())),
			}
			memoryCache = { fetchedAt: Date.now(), snapshot }
			saveCachedReferralPurchaseSplit(snapshot)
			return snapshot
		} catch (error) {
			const previous = memoryCache?.snapshot ?? readCachedReferralPurchaseSplit()
			if (previous) return previous
			throw error
		}
	})()
	try {
		return await inFlight
	} finally {
		inFlight = null
	}
}

export async function setReferralPurchaseSplit(params: {
	adminPrivateKeyArmor: string
	adminPayout: string
	adminBps: bigint
	wallets: string[]
	bps: bigint[]
}): Promise<string> {
	if (!isReferralPurchaseSplitConfigured()) {
		throw new Error('Purchase split contract is not configured.')
	}
	const wallet = new ethers.Wallet(params.adminPrivateKeyArmor)
	const split = new ethers.Contract(CONET_REFERRAL_PURCHASE_SPLIT_V1, SPLIT_ABI, conetDepinProvider)
	const nonce = BigInt((await split.actionNonces(wallet.address)).toString())
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
	const adminPayout = ethers.getAddress(params.adminPayout)
	const wallets = params.wallets.map((w) => ethers.getAddress(w))
	const message = {
		admin: wallet.address,
		adminPayout,
		adminBps: params.adminBps,
		wallets,
		bps: params.bps,
		nonce,
		deadline,
	}
	const signature = await wallet.signTypedData(DOMAIN, TYPES as any, message)
	const response = await fetch(`${beamioApi}/api/referralPurchaseSplit`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			admin: wallet.address,
			adminPayout,
			adminBps: params.adminBps.toString(),
			wallets,
			bps: params.bps.map((v) => v.toString()),
			nonce: nonce.toString(),
			deadline: deadline.toString(),
			signature,
		}),
	})
	const json = (await response.json()) as { success?: boolean; txHash?: string; error?: string }
	if (!response.ok || !json.success || !json.txHash) {
		throw new Error(json.error ?? 'Purchase split relay failed.')
	}
	memoryCache = null
	return json.txHash
}

export function bpsToPurchasePercent(bps: bigint): string {
	const whole = bps / 100n
	const frac = bps % 100n
	if (frac === 0n) return whole.toString()
	return `${whole}.${frac.toString().padStart(2, '0').replace(/0+$/, '')}`
}

export function purchasePercentToBps(raw: string): bigint {
	const trimmed = raw.trim()
	if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) throw new Error('Percent must be a number with up to 2 decimal places.')
	const [whole, frac = ''] = trimmed.split('.')
	return BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'))
}
