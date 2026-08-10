/**
 * Coupon social + supply stats — Worker RPC (no localStorage).
 */

import { ethers } from 'ethers'
import { APP_DAEMON_CONET_RPC } from '../protocol'

const USER_LIKE_METRIC = 5
const REF_CLICK_METRIC = 7
const TARGET_ISSUED_COUPON = 2
const COUPON_USER_LIKE_OFFSET = 620_000_000_000n
const COUPON_REF_CLICK_OFFSET = 200_000_000_000n

const ABI = [
	'function totalSupply(uint256 id) view returns (uint256)',
	'function issuedNftMaxSupply(uint256 tokenId) view returns (uint256)',
	'function issuedNftMintedCount(uint256 tokenId) view returns (uint256)',
	'function resolveUserCumulativeStatTokenId(uint8 metricKind, uint8 targetKind, uint256 issuedParentId) view returns (uint256 globalTokenId, uint256 scopedTokenId)',
] as const

export type WorkerCouponSocialStat = {
	cardAddress: string
	tokenId: string
	likeCount: number | null
	shareClickCount: number | null
	maxSupply: string | null
	remainingSupply: string | null
}

async function resolveScoped(
	reader: ethers.Contract,
	metric: number,
	parentId: bigint,
	fallbackOffset: bigint,
): Promise<bigint | null> {
	try {
		const [, scoped] = (await reader.resolveUserCumulativeStatTokenId(
			metric,
			TARGET_ISSUED_COUPON,
			parentId,
		)) as [bigint, bigint]
		if (scoped != null && scoped > 0n) return scoped
	} catch {
		/* fallback */
	}
	return parentId + fallbackOffset
}

async function supplyOf(reader: ethers.Contract, scoped: bigint): Promise<number | null> {
	try {
		const raw = (await reader.totalSupply(scoped)) as bigint
		const n = Number(raw)
		return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
	} catch {
		return null
	}
}

export async function fetchWorkerCouponSocialStats(
	targets: { cardAddress: string; tokenId: string }[],
): Promise<WorkerCouponSocialStat[]> {
	if (!targets.length) return []
	const provider = new ethers.JsonRpcProvider(APP_DAEMON_CONET_RPC, 224422, {
		staticNetwork: true,
		batchMaxCount: 1,
	})
	const out: WorkerCouponSocialStat[] = []
	for (const t of targets) {
		let card: string
		let parentId: bigint
		try {
			card = ethers.getAddress(t.cardAddress)
			parentId = BigInt(t.tokenId)
		} catch {
			continue
		}
		const reader = new ethers.Contract(card, ABI, provider)
		try {
			const [likeScoped, shareScoped] = await Promise.all([
				resolveScoped(reader, USER_LIKE_METRIC, parentId, COUPON_USER_LIKE_OFFSET),
				resolveScoped(reader, REF_CLICK_METRIC, parentId, COUPON_REF_CLICK_OFFSET),
			])
			const [likeCount, shareClickCount, maxRaw, mintedRaw] = await Promise.all([
				likeScoped != null ? supplyOf(reader, likeScoped) : Promise.resolve(null),
				shareScoped != null ? supplyOf(reader, shareScoped) : Promise.resolve(null),
				reader.issuedNftMaxSupply(parentId).catch(() => null) as Promise<bigint | null>,
				reader.issuedNftMintedCount(parentId).catch(() => null) as Promise<bigint | null>,
			])
			let maxSupply: string | null = null
			let remainingSupply: string | null = null
			if (maxRaw != null && mintedRaw != null) {
				if (maxRaw === 0n) {
					maxSupply = null
					remainingSupply = null
				} else {
					maxSupply = maxRaw.toString()
					const left = maxRaw > mintedRaw ? maxRaw - mintedRaw : 0n
					remainingSupply = left.toString()
				}
			}
			if (likeCount == null && shareClickCount == null && maxRaw == null) continue
			out.push({
				cardAddress: card.toLowerCase(),
				tokenId: parentId.toString(),
				likeCount,
				shareClickCount,
				maxSupply,
				remainingSupply,
			})
		} catch {
			/* skip card */
		}
	}
	return out
}
