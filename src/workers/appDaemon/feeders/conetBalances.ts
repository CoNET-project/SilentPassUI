/**
 * CoNET wallet balances via Multicall3 (or batched eth_call fallback).
 */

import { ethers } from 'ethers'
import type { AppDaemonConetBalances } from '../protocol'
import { multicallAggregate3Conet, decodeUint256 } from '../multicall'
import { getAppDaemonConetProvider } from '../rpc'

const ERC20_IFACE = new ethers.Interface([
	'function balanceOf(address account) view returns (uint256)',
])
const CONET_USDC = '0x5209865D404aA5646eDe5B91CD4218909eA72eDA'
const CONET_GB = '0xC3EF02DaE632b4C10abB66e07d92a387c10838D8'

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

export async function fetchWorkerConetBalances(
	owner: string,
): Promise<{ ok: true; balances: AppDaemonConetBalances } | { ok: false }> {
	try {
		if (!ethers.isAddress(owner)) return { ok: false }
		const checksum = ethers.getAddress(owner)
		const usdcData = ERC20_IFACE.encodeFunctionData('balanceOf', [checksum])
		const gbData = ERC20_IFACE.encodeFunctionData('balanceOf', [checksum])
		const provider = getAppDaemonConetProvider()
		const [mc, cnetRaw] = await Promise.all([
			multicallAggregate3Conet([
				{ target: CONET_USDC, callData: usdcData, allowFailure: true },
				{ target: CONET_GB, callData: gbData, allowFailure: true },
			]),
			provider.getBalance(checksum),
		])
		const usdcRaw = mc[0]?.success ? decodeUint256(mc[0].returnData) : null
		const gbRaw = mc[1]?.success ? decodeUint256(mc[1].returnData) : null
		if (usdcRaw == null || gbRaw == null) return { ok: false }
		return {
			ok: true,
			balances: {
				usdc: formatUnitsTrunc(usdcRaw, 6, 4),
				cnet: formatUnitsTrunc(cnetRaw, 18, 4),
				gb: formatUnitsTrunc(gbRaw, 9, 4),
			},
		}
	} catch {
		return { ok: false }
	}
}

/** Fetch EOA + optional AA balances in one Multicall batch (4 ERC20 + 2 getBalance). */
export async function fetchWorkerConetBalancesPair(
	eoa: string,
	aa?: string | null,
): Promise<
	| {
			ok: true
			eoaBalances: AppDaemonConetBalances
			aaBalances: AppDaemonConetBalances | null
	  }
	| { ok: false }
> {
	try {
		if (!ethers.isAddress(eoa)) return { ok: false }
		const eoaAddr = ethers.getAddress(eoa)
		const aaAddr = aa && ethers.isAddress(aa) ? ethers.getAddress(aa) : null
		const calls = [
			{ target: CONET_USDC, callData: ERC20_IFACE.encodeFunctionData('balanceOf', [eoaAddr]) },
			{ target: CONET_GB, callData: ERC20_IFACE.encodeFunctionData('balanceOf', [eoaAddr]) },
		]
		if (aaAddr) {
			calls.push(
				{ target: CONET_USDC, callData: ERC20_IFACE.encodeFunctionData('balanceOf', [aaAddr]) },
				{ target: CONET_GB, callData: ERC20_IFACE.encodeFunctionData('balanceOf', [aaAddr]) },
			)
		}
		const provider = getAppDaemonConetProvider()
		const [mc, eoaNative, aaNative] = await Promise.all([
			multicallAggregate3Conet(calls.map((c) => ({ ...c, allowFailure: true }))),
			provider.getBalance(eoaAddr),
			aaAddr ? provider.getBalance(aaAddr) : Promise.resolve(null as bigint | null),
		])
		const eoaUsdc = mc[0]?.success ? decodeUint256(mc[0].returnData) : null
		const eoaGb = mc[1]?.success ? decodeUint256(mc[1].returnData) : null
		if (eoaUsdc == null || eoaGb == null) return { ok: false }
		const eoaBalances: AppDaemonConetBalances = {
			usdc: formatUnitsTrunc(eoaUsdc, 6, 4),
			cnet: formatUnitsTrunc(eoaNative, 18, 4),
			gb: formatUnitsTrunc(eoaGb, 9, 4),
		}
		let aaBalances: AppDaemonConetBalances | null = null
		if (aaAddr && aaNative != null) {
			const aaUsdc = mc[2]?.success ? decodeUint256(mc[2].returnData) : null
			const aaGb = mc[3]?.success ? decodeUint256(mc[3].returnData) : null
			if (aaUsdc != null && aaGb != null) {
				aaBalances = {
					usdc: formatUnitsTrunc(aaUsdc, 6, 4),
					cnet: formatUnitsTrunc(aaNative, 18, 4),
					gb: formatUnitsTrunc(aaGb, 9, 4),
				}
			}
		}
		return { ok: true, eoaBalances, aaBalances }
	} catch {
		return { ok: false }
	}
}
