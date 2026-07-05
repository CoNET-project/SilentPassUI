import { ethers } from 'ethers'
import type { AaMultisigTaskLocal } from '@/utils/aaMultisigProtocol'
import { ENTRY_POINT_ADDRESS, aaMultisigProvider } from '@/utils/aaMultisigUserOp'

const ENTRY_POINT_ABI = [
	'function getNonce(address sender, uint192 key) view returns (uint256 nonce)',
]

export async function readAaEntryPointNonce(
	provider: ethers.Provider,
	aaAccount: string
): Promise<bigint> {
	const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider)
	return entryPoint.getNonce(aaAccount, 0) as Promise<bigint>
}

export function isAaMultisigEntryPointNonceStale(taskNonce: string, chainNonce: bigint): boolean {
	try {
		return BigInt(taskNonce) !== chainNonce
	} catch {
		return true
	}
}

export function formatAaMultisigStaleNonceMessage(taskNonce: string, chainNonce: bigint): string {
	const taskN = BigInt(taskNonce)
	if (taskN < chainNonce) {
		return (
			`EntryPoint nonce consumed (task ${taskNonce}, chain ${chainNonce.toString()}). ` +
			`Reject this task, then propose again — do not submit the old UserOp.`
		)
	}
	return (
		`EntryPoint nonce mismatch (task ${taskNonce}, chain ${chainNonce.toString()}). ` +
		`Reject and re-propose with the current chain nonce.`
	)
}

export async function assertAaMultisigTaskEntryPointNonceFresh(
	aaAccount: string,
	task: Pick<AaMultisigTaskLocal, 'entryPointNonce'>
): Promise<{ ok: true; chainNonce: bigint } | { ok: false; chainNonce: bigint; message: string }> {
	const chainNonce = await readAaEntryPointNonce(aaMultisigProvider, aaAccount)
	if (isAaMultisigEntryPointNonceStale(task.entryPointNonce, chainNonce)) {
		return {
			ok: false,
			chainNonce,
			message: formatAaMultisigStaleNonceMessage(task.entryPointNonce, chainNonce),
		}
	}
	return { ok: true, chainNonce }
}
