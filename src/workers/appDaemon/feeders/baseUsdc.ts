/**
 * Base USDC (EOA + optional AA) via Multicall3 — 6s wallet tick, not CoNET budget.
 */

import { ethers } from 'ethers'
import { APP_DAEMON_USDC_BASE } from '../protocol'
import { decodeUint256, multicallAggregate3Base } from '../multicall'

const ERC20_IFACE = new ethers.Interface([
	'function balanceOf(address account) view returns (uint256)',
])

export type WorkerBaseUsdcPair =
	| {
			ok: true
			eoaUsdc: string
			/** null = no separate AA (trusted 0); undefined = AA call untrusted — skip overwrite */
			aaUsdc?: string | null
	  }
	| { ok: false }

export async function fetchWorkerBaseUsdcPair(
	eoa: string,
	aa?: string | null,
): Promise<WorkerBaseUsdcPair> {
	try {
		if (!ethers.isAddress(eoa)) return { ok: false }
		const eoaAddr = ethers.getAddress(eoa)
		const aaAddr =
			aa && ethers.isAddress(aa) && ethers.getAddress(aa) !== eoaAddr
				? ethers.getAddress(aa)
				: null
		const calls = [
			{
				target: APP_DAEMON_USDC_BASE,
				callData: ERC20_IFACE.encodeFunctionData('balanceOf', [eoaAddr]),
				allowFailure: true,
			},
		]
		if (aaAddr) {
			calls.push({
				target: APP_DAEMON_USDC_BASE,
				callData: ERC20_IFACE.encodeFunctionData('balanceOf', [aaAddr]),
				allowFailure: true,
			})
		}
		const mc = await multicallAggregate3Base(calls)
		const eoaRaw = mc[0]?.success ? decodeUint256(mc[0].returnData) : null
		if (eoaRaw == null) return { ok: false }
		if (!aaAddr) {
			return { ok: true, eoaUsdc: ethers.formatUnits(eoaRaw, 6), aaUsdc: null }
		}
		const aaRaw = mc[1]?.success ? decodeUint256(mc[1].returnData) : null
		if (aaRaw == null) {
			return { ok: true, eoaUsdc: ethers.formatUnits(eoaRaw, 6) }
		}
		return {
			ok: true,
			eoaUsdc: ethers.formatUnits(eoaRaw, 6),
			aaUsdc: ethers.formatUnits(aaRaw, 6),
		}
	} catch {
		return { ok: false }
	}
}
