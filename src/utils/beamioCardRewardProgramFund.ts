import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'
import { resolveBeamioAaOnConet } from '@/utils/resolveBeamioAaFromCardFactory'

const PURCHASE_REWARD_ENDPOINT = `${beamioApi}/api/cardPurchaseRewardProgram`

const REWARD_POOL_READ_ABI = [
	'function rewardMintBudget13() view returns (uint256)',
	'function balanceOf(address account, uint256 id) view returns (uint256)',
] as const

/** RewardPoolStorage asset kinds (matches x402sdk UC_REWARD_ASSET). */
export const UC_REWARD_ASSET = {
	POINTS0: 1,
	CHARGE_REWARD2: 2,
	VOUCHER13: 3,
} as const

export type RewardFundAssetKind = (typeof UC_REWARD_ASSET)[keyof typeof UC_REWARD_ASSET]

const TOKEN_ID_BY_ASSET: Record<RewardFundAssetKind, bigint> = {
	[UC_REWARD_ASSET.POINTS0]: 0n,
	[UC_REWARD_ASSET.CHARGE_REWARD2]: 2n,
	[UC_REWARD_ASSET.VOUCHER13]: 13n,
}

const READ_CACHE_TTL_MS = 30_000
let budgetCache: { card: string; value: bigint; fetchedAt: number } | null = null

export function formatRewardMintBudget13Display(budget13: bigint): string {
	return (Number(budget13) / 1).toFixed(2)
}

/** On-chain #13 mint budget; null = untrusted RPC failure. */
export async function readRewardMintBudget13(cardAddress: string): Promise<bigint | null> {
	const card = ethers.getAddress(cardAddress)
	const key = card.toLowerCase()
	if (budgetCache && budgetCache.card === key && Date.now() - budgetCache.fetchedAt < READ_CACHE_TTL_MS) {
		return budgetCache.value
	}
	try {
		const { provider } = await providerForBeamioUserCard(card)
		const reader = new ethers.Contract(card, REWARD_POOL_READ_ABI, provider)
		const raw = (await reader.rewardMintBudget13()) as bigint
		const value = BigInt(raw.toString())
		budgetCache = { card: key, value, fetchedAt: Date.now() }
		return value
	} catch {
		return null
	}
}

export function invalidateRewardMintBudgetCache(): void {
	budgetCache = null
}

/** Sum EOA + AA balances for the selected reward asset token. */
export async function readOwnerRewardAssetBalance(
	cardAddress: string,
	ownerEOA: string,
	assetKind: RewardFundAssetKind,
): Promise<bigint | null> {
	const card = ethers.getAddress(cardAddress)
	const eoa = ethers.getAddress(ownerEOA)
	const tokenId = TOKEN_ID_BY_ASSET[assetKind]
	try {
		const { provider } = await providerForBeamioUserCard(card)
		const reader = new ethers.Contract(card, REWARD_POOL_READ_ABI, provider)
		let total = 0n
		const eoaBal = (await reader.balanceOf(eoa, tokenId)) as bigint
		total += BigInt(eoaBal.toString())
		const aa = await resolveBeamioAaOnConet(provider, eoa).catch(() => null)
		if (aa && ethers.isAddress(aa)) {
			const aaBal = (await reader.balanceOf(ethers.getAddress(aa), tokenId)) as bigint
			total += BigInt(aaBal.toString())
		}
		return total
	} catch {
		return null
	}
}

export type PurchaseRewardProgramResult =
	| { success: true; hash?: string }
	| { success: false; error: string }

/**
 * Fund share-click #13 mint budget via gateway purchaseRewardProgram (owner points / charge reward burn).
 * `amount6` = burn amount in 6-decimal fixed point (e.g. 100 program points ⇒ 100_000_000n).
 */
export async function postPurchaseRewardProgram(params: {
	cardAddress: string
	payerEOA: string
	assetKind: RewardFundAssetKind
	amount6: bigint
	budget13PerUnit?: bigint
}): Promise<PurchaseRewardProgramResult> {
	const card = ethers.getAddress(params.cardAddress)
	const payer = ethers.getAddress(params.payerEOA)
	if (params.amount6 <= 0n) return { success: false, error: 'Amount must be greater than zero' }
	const budget13PerUnit = params.budget13PerUnit ?? 1n
	try {
		const res = await fetch(PURCHASE_REWARD_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: card,
				payerEOA: payer,
				assetKind: params.assetKind,
				amount: params.amount6.toString(),
				budget13PerUnit: budget13PerUnit.toString(),
				cumulativeTargetKind: 1,
				cumulativeIssuedParentId: '0',
			}),
		})
		const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; hash?: string }
		if (!res.ok || !data.success) {
			return { success: false, error: data.error ?? `HTTP ${res.status}` }
		}
		invalidateRewardMintBudgetCache()
		return { success: true, hash: data.hash }
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? String(e) }
	}
}
