/**
 * Referrer dashboard summary — Worker RPC.
 */

import { ethers } from 'ethers'
import { getAppDaemonConetProvider } from '../rpc'

const VDR = '0xc71e246DD78B37C2fABc905D340932F28F503433'
const EXT_ABI = [
	'function getReferrerSummary(address) view returns (uint256,uint256,uint256,uint256,uint256)',
	'function REFERRER_NODES_PER_REWARD() view returns (uint256)',
] as const

export type WorkerReferrerSummary = {
	referrer: string
	referredBeneficiaryCount: string
	referralNodeTotal: string
	rewardMilestonePaid: string
	pendingRewardNodes: string
	referredNodesOwnedTotal: string
	nodesPerReward: string
}

export async function fetchWorkerReferrerSummary(
	referrerAddress: string,
): Promise<{ ok: true; summary: WorkerReferrerSummary } | { ok: false }> {
	if (!ethers.isAddress(referrerAddress)) return { ok: false }
	try {
		const provider = getAppDaemonConetProvider()
		const vdr = new ethers.Contract(
			VDR,
			['function referrerExtension() view returns (address)'],
			provider,
		)
		const extAddr = (await vdr.referrerExtension()) as string
		if (!extAddr || extAddr === ethers.ZeroAddress) return { ok: false }
		const referrer = ethers.getAddress(referrerAddress)
		const read = new ethers.Contract(extAddr, EXT_ABI, provider)
		const [summaryTuple, nodesPerReward] = await Promise.all([
			read.getReferrerSummary(referrer) as Promise<bigint[]>,
			read.REFERRER_NODES_PER_REWARD() as Promise<bigint>,
		])
		const s = summaryTuple
		return {
			ok: true,
			summary: {
				referrer,
				referredBeneficiaryCount: s[0].toString(),
				referralNodeTotal: s[1].toString(),
				rewardMilestonePaid: s[2].toString(),
				pendingRewardNodes: s[3].toString(),
				referredNodesOwnedTotal: s[4].toString(),
				nodesPerReward: nodesPerReward.toString(),
			},
		}
	} catch {
		return { ok: false }
	}
}
