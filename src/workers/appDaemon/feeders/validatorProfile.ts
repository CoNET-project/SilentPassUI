/**
 * Validator wallet node profile — Worker RPC (resolveNodeBundle).
 * Shape matches ValidatorWalletNodeProfile for main-thread setState.
 */

import { ethers } from 'ethers'
import { getAppDaemonConetProvider } from '../rpc'

const VDR = '0xc71e246DD78B37C2fABc905D340932F28F503433'
const NODE_BUNDLE_TUPLE =
	'tuple(address beneficiary, uint256[] guardianNodeIds, string[] depinNodeIps, address[] nodeWallets, bytes[] validatorPubkeys, bool[] validatorActive, uint256 validatorNodeCount, uint256 gbMiningNodeCount, uint256 claimCount, uint256 nativeBalance, uint256 gbBalance, uint256 usdcBalance)'
const ABI = [
	`function resolveNodeBundle(address maybeWallet, string conetDepinNodeIp) view returns (${NODE_BUNDLE_TUPLE})`,
] as const

export type WorkerValidatorWalletNodeProfile = {
	wallet: string
	validatorNodeCount: number
	validatorPendingCount: number
	gbMiningNodeCount: number
	claimCount: number
	conetDepinNodeIps: string[]
	nativeBalanceRaw: string
	gbBalanceRaw: string
	usdcBalanceRaw: string
	nativeBalance: string
	gbBalance: string
	usdcBalance: string
}

export async function fetchWorkerValidatorWalletNodeProfile(
	walletAddress: string,
): Promise<{ ok: true; profile: WorkerValidatorWalletNodeProfile } | { ok: false }> {
	if (!ethers.isAddress(walletAddress)) return { ok: false }
	try {
		const provider = getAppDaemonConetProvider()
		const c = new ethers.Contract(VDR, ABI, provider)
		const wallet = ethers.getAddress(walletAddress)
		const r = await c.resolveNodeBundle(wallet, '')
		const beneficiaryAddr = ethers.getAddress(String(r.beneficiary ?? r[0]))
		if (!beneficiaryAddr || beneficiaryAddr === ethers.ZeroAddress) return { ok: false }
		const validatorActive = ((r.validatorActive ?? r[5]) as boolean[]).map(Boolean)
		const validatorNodeCount = Number((r.validatorNodeCount ?? r[6]) as bigint)
		const active = validatorActive.filter(Boolean).length
		const nativeBalanceRaw = ((r.nativeBalance ?? r[9]) as bigint).toString()
		const gbBalanceRaw = ((r.gbBalance ?? r[10]) as bigint).toString()
		const usdcBalanceRaw = ((r.usdcBalance ?? r[11]) as bigint).toString()
		const ips = ((r.depinNodeIps ?? r[2]) as string[]).map((ip) => String(ip ?? '').trim())
		return {
			ok: true,
			profile: {
				wallet: beneficiaryAddr,
				validatorNodeCount,
				validatorPendingCount: Math.max(0, validatorNodeCount - active),
				gbMiningNodeCount: Number((r.gbMiningNodeCount ?? r[7]) as bigint),
				claimCount: Number((r.claimCount ?? r[8]) as bigint),
				conetDepinNodeIps: ips,
				nativeBalanceRaw,
				gbBalanceRaw,
				usdcBalanceRaw,
				nativeBalance: ethers.formatUnits(nativeBalanceRaw, 18),
				gbBalance: ethers.formatUnits(gbBalanceRaw, 18),
				usdcBalance: ethers.formatUnits(usdcBalanceRaw, 6),
			},
		}
	} catch {
		return { ok: false }
	}
}
