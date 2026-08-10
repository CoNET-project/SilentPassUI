/**
 * Multicall3 aggregate3 helper for App Daemon Worker.
 * Falls back to Promise.all(eth_call) when Multicall3 address is unset / empty code.
 */

import { ethers } from 'ethers'
import {
	APP_DAEMON_BASE_MULTICALL3,
	APP_DAEMON_CONET_MULTICALL3,
} from './protocol'
import { getAppDaemonBaseProvider, getAppDaemonConetProvider } from './rpc'

const MULTICALL3_ABI = [
	'function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[])',
] as const

export type MulticallCall = {
	target: string
	allowFailure?: boolean
	callData: string
}

export type MulticallResult = {
	success: boolean
	returnData: string
}

async function hasCode(provider: ethers.Provider, addr: string): Promise<boolean> {
	try {
		const code = await provider.getCode(addr)
		return Boolean(code && code !== '0x' && code !== '0x0')
	} catch {
		return false
	}
}

async function aggregateViaContract(
	provider: ethers.JsonRpcProvider,
	multicallAddr: string,
	calls: MulticallCall[],
): Promise<MulticallResult[] | null> {
	if (!multicallAddr || !ethers.isAddress(multicallAddr)) return null
	if (!(await hasCode(provider, multicallAddr))) return null
	try {
		const mc = new ethers.Contract(multicallAddr, MULTICALL3_ABI, provider)
		const packed = calls.map((c) => ({
			target: ethers.getAddress(c.target),
			allowFailure: c.allowFailure !== false,
			callData: c.callData,
		}))
		const raw = (await mc.aggregate3(packed)) as { success: boolean; returnData: string }[]
		return raw.map((r) => ({
			success: Boolean(r.success),
			returnData: String(r.returnData ?? '0x'),
		}))
	} catch {
		return null
	}
}

/** Sequential eth_call fallback (still benefits from JSON-RPC batch via provider). */
async function aggregateFallback(
	provider: ethers.JsonRpcProvider,
	calls: MulticallCall[],
): Promise<MulticallResult[]> {
	const results = await Promise.all(
		calls.map(async (c) => {
			try {
				const returnData = await provider.call({
					to: ethers.getAddress(c.target),
					data: c.callData,
				})
				return { success: true, returnData: returnData || '0x' }
			} catch {
				return { success: false, returnData: '0x' }
			}
		}),
	)
	return results
}

export async function multicallAggregate3Conet(calls: MulticallCall[]): Promise<MulticallResult[]> {
	if (!calls.length) return []
	const provider = getAppDaemonConetProvider()
	const via = await aggregateViaContract(provider, APP_DAEMON_CONET_MULTICALL3, calls)
	if (via) return via
	return aggregateFallback(provider, calls)
}

export async function multicallAggregate3Base(calls: MulticallCall[]): Promise<MulticallResult[]> {
	if (!calls.length) return []
	const provider = getAppDaemonBaseProvider()
	const via = await aggregateViaContract(provider, APP_DAEMON_BASE_MULTICALL3, calls)
	if (via) return via
	return aggregateFallback(provider, calls)
}

export function decodeUint256(returnData: string): bigint | null {
	if (!returnData || returnData === '0x' || returnData.length < 66) return null
	try {
		return ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], returnData)[0] as bigint
	} catch {
		return null
	}
}

export function decodeBool(returnData: string): boolean | null {
	if (!returnData || returnData === '0x' || returnData.length < 66) return null
	try {
		return Boolean(ethers.AbiCoder.defaultAbiCoder().decode(['bool'], returnData)[0])
	} catch {
		return null
	}
}
