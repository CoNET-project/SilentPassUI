/**
 * Multicall3 aggregate3 helper for App Daemon Worker.
 * `aggregate3` is payable on-chain; Worker has no signer — always `staticCall` (eth_call).
 * Untrusted failure returns unsuccessful placeholders.
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
		/** payable ABI + provider-only runner → must staticCall, else ethers tries sendTransaction */
		const raw = (await mc.aggregate3.staticCall(packed)) as Array<{
			success?: boolean
			returnData?: ethers.BytesLike
			0?: boolean
			1?: ethers.BytesLike
		}>
		return raw.map((r) => ({
			success: Boolean(r.success ?? r[0]),
			returnData: toHexBytes(r.returnData ?? r[1]),
		}))
	} catch {
		return null
	}
}

function toHexBytes(v: unknown): string {
	if (v == null) return '0x'
	try {
		return ethers.hexlify(v as ethers.BytesLike)
	} catch {
		return typeof v === 'string' && v.startsWith('0x') ? v : '0x'
	}
}

function untrustedEmpty(calls: MulticallCall[]): MulticallResult[] {
	return calls.map(() => ({ success: false, returnData: '0x' }))
}

export async function multicallAggregate3Conet(calls: MulticallCall[]): Promise<MulticallResult[]> {
	if (!calls.length) return []
	const provider = getAppDaemonConetProvider()
	const via = await aggregateViaContract(provider, APP_DAEMON_CONET_MULTICALL3, calls)
	if (via) return via
	/** Never serial eth_call fallback — CoNET provider is batchMaxCount:1. */
	return untrustedEmpty(calls)
}

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
				return { success: true, returnData: toHexBytes(returnData) }
			} catch {
				return { success: false, returnData: '0x' }
			}
		}),
	)
	return results
}

export async function multicallAggregate3Base(calls: MulticallCall[]): Promise<MulticallResult[]> {
	if (!calls.length) return []
	const provider = getAppDaemonBaseProvider()
	const via = await aggregateViaContract(provider, APP_DAEMON_BASE_MULTICALL3, calls)
	if (via) return via
	/** Base JsonRpcProvider batches; direct eth_call is a trusted fallback. */
	return aggregateFallback(provider, calls)
}

export function decodeUint256(returnData: string): bigint | null {
	const hex = toHexBytes(returnData)
	if (!hex || hex === '0x' || hex.length < 66) return null
	try {
		return ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], hex)[0] as bigint
	} catch {
		return null
	}
}

export function decodeBool(returnData: string): boolean | null {
	const hex = toHexBytes(returnData)
	if (!hex || hex === '0x' || hex.length < 66) return null
	try {
		return Boolean(ethers.AbiCoder.defaultAbiCoder().decode(['bool'], hex)[0])
	} catch {
		return null
	}
}
