/**
 * Coupon open-claim chain read only — no localStorage (main writes LS).
 */

import { ethers } from 'ethers'
import { APP_DAEMON_CONET_RPC } from '../protocol'

const ISSUED_NFT_START = 100_000_000_000n
const ABI = [
	'function issuedNftUserSigClaimUsed(address user, uint256 tokenId) view returns (bool)',
	'function balanceOf(address account, uint256 id) view returns (uint256)',
] as const

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
	const provider = new ethers.JsonRpcProvider(APP_DAEMON_CONET_RPC, 224422, {
		staticNetwork: true,
		batchMaxCount: 1,
	})
	const out: WorkerCouponOpenClaimResult[] = []
	for (const t of targets) {
		let card: string
		let tokenId: bigint
		try {
			card = ethers.getAddress(t.cardAddress)
			tokenId = BigInt(t.tokenId)
		} catch {
			continue
		}
		if (tokenId < ISSUED_NFT_START) continue
		try {
			const c = new ethers.Contract(card, ABI, provider)
			const [alreadyClaimed, bal] = await Promise.all([
				c.issuedNftUserSigClaimUsed(user, tokenId) as Promise<boolean>,
				c.balanceOf(user, tokenId) as Promise<bigint>,
			])
			const holds = bal > 0n
			if (holds) {
				out.push({
					cardAddress: card.toLowerCase(),
					tokenId: tokenId.toString(),
					couponId: t.couponId,
					status: 'claimed',
				})
			} else if (alreadyClaimed) {
				out.push({
					cardAddress: card.toLowerCase(),
					tokenId: tokenId.toString(),
					couponId: t.couponId,
					status: 'redeemed',
				})
			}
		} catch {
			/* untrusted — skip */
		}
	}
	return out
}
