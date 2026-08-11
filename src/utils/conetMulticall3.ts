/**
 * Main-thread Multicall3 aggregate3 on CoNET.
 * One eth_call regardless of conetDepinProvider batchMaxCount:1.
 */

import { ethers } from 'ethers'
import { CONET_MULTICALL3 } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

const MULTICALL3_ABI = [
	'function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[])',
] as const

export type ConetMulticallCall = {
	target: string
	allowFailure?: boolean
	callData: string
}

export type ConetMulticallResult = {
	success: boolean
	returnData: string
}

let multicallCodeOk: boolean | null = null

async function multicallAvailable(provider: ethers.Provider): Promise<boolean> {
	if (multicallCodeOk != null) return multicallCodeOk
	if (!CONET_MULTICALL3 || !ethers.isAddress(CONET_MULTICALL3)) {
		multicallCodeOk = false
		return false
	}
	try {
		const code = await provider.getCode(CONET_MULTICALL3)
		multicallCodeOk = Boolean(code && code !== '0x' && code !== '0x0')
	} catch {
		multicallCodeOk = false
	}
	return multicallCodeOk
}

export async function multicallAggregate3ConetMain(
	calls: ConetMulticallCall[],
	provider: ethers.Provider = conetDepinProvider,
): Promise<ConetMulticallResult[]> {
	if (!calls.length) return []
	if (await multicallAvailable(provider)) {
		try {
			const mc = new ethers.Contract(CONET_MULTICALL3, MULTICALL3_ABI, provider)
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
			/* fall through */
		}
	}
	return Promise.all(
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
}

export function decodeMulticallUint256(returnData: string): bigint | null {
	if (!returnData || returnData === '0x' || returnData.length < 66) return null
	try {
		const [v] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], returnData)
		return v as bigint
	} catch {
		return null
	}
}
