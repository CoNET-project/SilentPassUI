/**
 * Coupon social + supply — Multicall3 batched views.
 */

import { ethers } from 'ethers'
import { multicallAggregate3Conet, decodeUint256 } from '../multicall'

const USER_LIKE_METRIC = 5
const REF_CLICK_METRIC = 7
const TARGET_ISSUED_COUPON = 2
const COUPON_USER_LIKE_OFFSET = 620_000_000_000n
const COUPON_REF_CLICK_OFFSET = 200_000_000_000n

const IFACE = new ethers.Interface([
	'function totalSupply(uint256 id) view returns (uint256)',
	'function issuedNftMaxSupply(uint256 tokenId) view returns (uint256)',
	'function issuedNftMintedCount(uint256 tokenId) view returns (uint256)',
	'function resolveUserCumulativeStatTokenId(uint8 metricKind, uint8 targetKind, uint256 issuedParentId) view returns (uint256 globalTokenId, uint256 scopedTokenId)',
])

export type WorkerCouponSocialStat = {
	cardAddress: string
	tokenId: string
	likeCount: number | null
	shareClickCount: number | null
	maxSupply: string | null
	remainingSupply: string | null
}

function asCount(raw: bigint | null): number | null {
	if (raw == null) return null
	const n = Number(raw)
	return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
}

function decodeScoped(returnData: string): bigint | null {
	if (!returnData || returnData === '0x' || returnData.length < 130) return null
	try {
		const [, scoped] = ethers.AbiCoder.defaultAbiCoder().decode(
			['uint256', 'uint256'],
			returnData,
		) as unknown as [bigint, bigint]
		return scoped > 0n ? scoped : null
	} catch {
		return null
	}
}

export async function fetchWorkerCouponSocialStats(
	targets: { cardAddress: string; tokenId: string }[],
): Promise<WorkerCouponSocialStat[]> {
	if (!targets.length) return []
	const rows: { card: string; parentId: bigint }[] = []
	for (const t of targets) {
		try {
			rows.push({ card: ethers.getAddress(t.cardAddress), parentId: BigInt(t.tokenId) })
		} catch {
			/* skip */
		}
	}
	if (!rows.length) return []

	// Pass 1: resolve scoped token ids (2 per target)
	const resolveCalls = rows.flatMap((r) => [
		{
			target: r.card,
			allowFailure: true,
			callData: IFACE.encodeFunctionData('resolveUserCumulativeStatTokenId', [
				USER_LIKE_METRIC,
				TARGET_ISSUED_COUPON,
				r.parentId,
			]),
		},
		{
			target: r.card,
			allowFailure: true,
			callData: IFACE.encodeFunctionData('resolveUserCumulativeStatTokenId', [
				REF_CLICK_METRIC,
				TARGET_ISSUED_COUPON,
				r.parentId,
			]),
		},
	])
	const resolveMc = await multicallAggregate3Conet(resolveCalls)

	const likeScoped = rows.map((r, i) => {
		const decoded = resolveMc[i * 2]?.success ? decodeScoped(resolveMc[i * 2].returnData) : null
		return decoded ?? r.parentId + COUPON_USER_LIKE_OFFSET
	})
	const shareScoped = rows.map((r, i) => {
		const decoded = resolveMc[i * 2 + 1]?.success
			? decodeScoped(resolveMc[i * 2 + 1].returnData)
			: null
		return decoded ?? r.parentId + COUPON_REF_CLICK_OFFSET
	})

	// Pass 2: totalSupply ×2 + max + minted
	const supplyCalls = rows.flatMap((r, i) => [
		{
			target: r.card,
			allowFailure: true,
			callData: IFACE.encodeFunctionData('totalSupply', [likeScoped[i]]),
		},
		{
			target: r.card,
			allowFailure: true,
			callData: IFACE.encodeFunctionData('totalSupply', [shareScoped[i]]),
		},
		{
			target: r.card,
			allowFailure: true,
			callData: IFACE.encodeFunctionData('issuedNftMaxSupply', [r.parentId]),
		},
		{
			target: r.card,
			allowFailure: true,
			callData: IFACE.encodeFunctionData('issuedNftMintedCount', [r.parentId]),
		},
	])
	const supplyMc = await multicallAggregate3Conet(supplyCalls)

	const out: WorkerCouponSocialStat[] = []
	for (let i = 0; i < rows.length; i++) {
		const base = i * 4
		const likeCount = asCount(
			supplyMc[base]?.success ? decodeUint256(supplyMc[base].returnData) : null,
		)
		const shareClickCount = asCount(
			supplyMc[base + 1]?.success ? decodeUint256(supplyMc[base + 1].returnData) : null,
		)
		const maxRaw = supplyMc[base + 2]?.success
			? decodeUint256(supplyMc[base + 2].returnData)
			: null
		const mintedRaw = supplyMc[base + 3]?.success
			? decodeUint256(supplyMc[base + 3].returnData)
			: null
		let maxSupply: string | null = null
		let remainingSupply: string | null = null
		if (maxRaw != null && mintedRaw != null) {
			if (maxRaw === 0n) {
				maxSupply = null
				remainingSupply = null
			} else {
				maxSupply = maxRaw.toString()
				remainingSupply = (maxRaw > mintedRaw ? maxRaw - mintedRaw : 0n).toString()
			}
		}
		if (likeCount == null && shareClickCount == null && maxRaw == null) continue
		out.push({
			cardAddress: rows[i].card.toLowerCase(),
			tokenId: rows[i].parentId.toString(),
			likeCount,
			shareClickCount,
			maxSupply,
			remainingSupply,
		})
	}
	return out
}
