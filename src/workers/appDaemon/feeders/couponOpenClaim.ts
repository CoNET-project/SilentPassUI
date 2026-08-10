/**
 * Coupon open-claim — Multicall3 batched claimUsed + balanceOf.
 */

import { ethers } from 'ethers'
import { multicallAggregate3Conet, decodeUint256, decodeBool } from '../multicall'

const ISSUED_NFT_START = 100_000_000_000n
const IFACE = new ethers.Interface([
	'function issuedNftUserSigClaimUsed(address user, uint256 tokenId) view returns (bool)',
	'function balanceOf(address account, uint256 id) view returns (uint256)',
])

export type WorkerCouponOpenClaimResult = {
	cardAddress: string
	tokenId: string
	couponId?: string
	status: 'claimed' | 'redeemed'
}

export async function fetchWorkerCouponOpenClaimStatuses(
	userEoa: string,
	targets: { cardAddress: string; tokenId: string; couponId?: string }[],
): Promise<WorkerCouponOpenClaimResult[]> {
	let user: string
	try {
		user = ethers.getAddress(userEoa)
	} catch {
		return []
	}
	if (!targets.length) return []

	const rows: { card: string; tokenId: bigint; couponId?: string }[] = []
	for (const t of targets) {
		try {
			const tokenId = BigInt(t.tokenId)
			if (tokenId < ISSUED_NFT_START) continue
			rows.push({
				card: ethers.getAddress(t.cardAddress),
				tokenId,
				couponId: t.couponId,
			})
		} catch {
			/* skip */
		}
	}
	if (!rows.length) return []

	const calls = rows.flatMap((r) => [
		{
			target: r.card,
			allowFailure: true,
			callData: IFACE.encodeFunctionData('issuedNftUserSigClaimUsed', [user, r.tokenId]),
		},
		{
			target: r.card,
			allowFailure: true,
			callData: IFACE.encodeFunctionData('balanceOf', [user, r.tokenId]),
		},
	])
	const mc = await multicallAggregate3Conet(calls)
	const out: WorkerCouponOpenClaimResult[] = []
	for (let i = 0; i < rows.length; i++) {
		const claimed = mc[i * 2]?.success ? decodeBool(mc[i * 2].returnData) : null
		const bal = mc[i * 2 + 1]?.success ? decodeUint256(mc[i * 2 + 1].returnData) : null
		if (claimed == null && bal == null) continue
		const holds = (bal ?? 0n) > 0n
		if (holds) {
			out.push({
				cardAddress: rows[i].card.toLowerCase(),
				tokenId: rows[i].tokenId.toString(),
				couponId: rows[i].couponId,
				status: 'claimed',
			})
		} else if (claimed) {
			out.push({
				cardAddress: rows[i].card.toLowerCase(),
				tokenId: rows[i].tokenId.toString(),
				couponId: rows[i].couponId,
				status: 'redeemed',
			})
		}
	}
	return out
}
