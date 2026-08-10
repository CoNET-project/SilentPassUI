/**
 * BeamioConsumerWalletDashboard.snapshot — single eth_call for 6s wallet tick.
 */

import { ethers } from 'ethers'
import {
	APP_DAEMON_WALLET_DASHBOARD,
	type AppDaemonConetBalances,
	type AppDaemonL0StartKitQuota,
} from '../protocol'
import { getAppDaemonConetProvider } from '../rpc'
import type { WorkerValidatorWalletNodeProfile } from './validatorProfile'
import type { WorkerReferrerSummary } from './referrerSummary'

const SNAPSHOT_ABI = [
	`function snapshot(address eoa, address aaOptional) view returns (
		tuple(
			address eoa,
			address aa,
			uint256 eoaNative,
			uint256 eoaUsdc,
			uint256 eoaGb,
			uint256 aaNative,
			uint256 aaUsdc,
			uint256 aaGb,
			address beneficiary,
			uint256 validatorNodeCount,
			uint256 validatorPendingCount,
			uint256 gbMiningNodeCount,
			uint256 claimCount,
			uint256 vdrNative,
			uint256 vdrGb,
			uint256 vdrUsdc,
			bool isL0,
			uint256 starterKetRemaining,
			uint256 paidBunitRemaining,
			uint256 issuedCodeCount,
			uint256 claimedCodeCount,
			uint256 referredBeneficiaryCount,
			uint256 referralNodeTotal,
			uint256 rewardMilestonePaid,
			uint256 pendingRewardNodes,
			uint256 referredNodesOwnedTotal,
			uint256 nodesPerReward
		)
	)`,
] as const

function formatUnitsTrunc(raw: bigint, decimals: number, maxFrac = 4): string {
	const neg = raw < 0n
	const v = neg ? -raw : raw
	const base = 10n ** BigInt(decimals)
	const whole = v / base
	const frac = v % base
	const fracStr = frac.toString().padStart(decimals, '0').slice(0, maxFrac).replace(/0+$/, '')
	const body = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
	return neg ? `-${body}` : body
}

function toBalances(native: bigint, usdc: bigint, gb: bigint): AppDaemonConetBalances {
	return {
		usdc: formatUnitsTrunc(usdc, 6, 4),
		cnet: formatUnitsTrunc(native, 18, 4),
		gb: formatUnitsTrunc(gb, 9, 4),
	}
}

export type WorkerWalletDashboardSnapshot = {
	eoaBalances: AppDaemonConetBalances
	aaBalances: AppDaemonConetBalances | null
	profile: WorkerValidatorWalletNodeProfile | null
	l0: { isL0: true; quota: AppDaemonL0StartKitQuota } | { isL0: false } | null
	referrer: WorkerReferrerSummary | null
}

export function isWalletDashboardConfigured(): boolean {
	return (
		Boolean(APP_DAEMON_WALLET_DASHBOARD) &&
		APP_DAEMON_WALLET_DASHBOARD !== ethers.ZeroAddress &&
		ethers.isAddress(APP_DAEMON_WALLET_DASHBOARD)
	)
}

let dashboardCodeOk: boolean | null = null

export async function fetchWorkerWalletDashboardSnapshot(
	eoaRaw: string,
	aaRaw?: string | null,
): Promise<{ ok: true; snap: WorkerWalletDashboardSnapshot } | { ok: false }> {
	if (!isWalletDashboardConfigured()) return { ok: false }
	if (!ethers.isAddress(eoaRaw)) return { ok: false }
	try {
		const eoa = ethers.getAddress(eoaRaw)
		const aa =
			aaRaw && ethers.isAddress(aaRaw) ? ethers.getAddress(aaRaw) : ethers.ZeroAddress
		const provider = getAppDaemonConetProvider()
		if (dashboardCodeOk !== true) {
			const code = await provider.getCode(APP_DAEMON_WALLET_DASHBOARD)
			dashboardCodeOk = Boolean(code && code !== '0x' && code !== '0x0')
			if (!dashboardCodeOk) return { ok: false }
		}
		const c = new ethers.Contract(APP_DAEMON_WALLET_DASHBOARD, SNAPSHOT_ABI, provider)
		const r = await c.snapshot(eoa, aa)
		const eoaBalances = toBalances(
			r.eoaNative as bigint,
			r.eoaUsdc as bigint,
			r.eoaGb as bigint,
		)
		let aaBalances: AppDaemonConetBalances | null = null
		if (aa !== ethers.ZeroAddress) {
			aaBalances = toBalances(r.aaNative as bigint, r.aaUsdc as bigint, r.aaGb as bigint)
		}
		const beneficiary = ethers.getAddress(String(r.beneficiary))
		let profile: WorkerValidatorWalletNodeProfile | null = null
		if (beneficiary && beneficiary !== ethers.ZeroAddress) {
			const nativeBalanceRaw = (r.vdrNative as bigint).toString()
			const gbBalanceRaw = (r.vdrGb as bigint).toString()
			const usdcBalanceRaw = (r.vdrUsdc as bigint).toString()
			profile = {
				wallet: beneficiary,
				validatorNodeCount: Number(r.validatorNodeCount),
				validatorPendingCount: Number(r.validatorPendingCount),
				gbMiningNodeCount: Number(r.gbMiningNodeCount),
				claimCount: Number(r.claimCount),
				conetDepinNodeIps: [],
				nativeBalanceRaw,
				gbBalanceRaw,
				usdcBalanceRaw,
				nativeBalance: ethers.formatUnits(nativeBalanceRaw, 18),
				gbBalance: ethers.formatUnits(gbBalanceRaw, 18),
				usdcBalance: ethers.formatUnits(usdcBalanceRaw, 6),
			}
		}
		const l0 = r.isL0
			? {
					isL0: true as const,
					quota: {
						eoa,
						starterKetRemaining: (r.starterKetRemaining as bigint).toString(),
						paidBunitRemaining: (r.paidBunitRemaining as bigint).toString(),
						issuedCodeCount: (r.issuedCodeCount as bigint).toString(),
						claimedCodeCount: (r.claimedCodeCount as bigint).toString(),
						fetchedAt: Date.now(),
					},
				}
			: { isL0: false as const }
		const referrer: WorkerReferrerSummary = {
			referrer: eoa,
			referredBeneficiaryCount: (r.referredBeneficiaryCount as bigint).toString(),
			referralNodeTotal: (r.referralNodeTotal as bigint).toString(),
			rewardMilestonePaid: (r.rewardMilestonePaid as bigint).toString(),
			pendingRewardNodes: (r.pendingRewardNodes as bigint).toString(),
			referredNodesOwnedTotal: (r.referredNodesOwnedTotal as bigint).toString(),
			nodesPerReward: (r.nodesPerReward as bigint).toString(),
		}
		return {
			ok: true,
			snap: { eoaBalances, aaBalances, profile, l0, referrer },
		}
	} catch {
		return { ok: false }
	}
}
