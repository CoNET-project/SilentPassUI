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
			`Create a new signing request with the current chain nonce.`
		)
	}
	return (
		`EntryPoint nonce mismatch (task ${taskNonce}, chain ${chainNonce.toString()}). ` +
		`Create a new signing request with the current chain nonce.`
	)
}

/** Mark pending/ready tasks expired when EntryPoint nonce no longer matches chain. */
export function markAaMultisigTaskExpiredIfNonceStale(
	task: AaMultisigTaskLocal,
	chainNonce: bigint
): AaMultisigTaskLocal | null {
	if (task.status !== 'pending' && task.status !== 'ready') return null
	if (!isAaMultisigEntryPointNonceStale(task.entryPointNonce, chainNonce)) return null
	return {
		...task,
		status: 'expired',
		memo: formatAaMultisigStaleNonceMessage(task.entryPointNonce, chainNonce),
		updatedAt: Date.now(),
	}
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

/** Read chain EntryPoint nonce immediately before composing a new multisig UserOp. */
export async function readFreshAaEntryPointNonce(aaAccount: string): Promise<bigint> {
	return readAaEntryPointNonce(aaMultisigProvider, aaAccount)
}

/**
 * Expire pending/ready tasks that would conflict with a new proposal at `chainNonce`:
 * stale nonces and duplicate drafts occupying the same nonce slot.
 */
export function expireConflictingMultisigTasksForNewProposal(
	tasks: AaMultisigTaskLocal[],
	aaAccount: string,
	chainNonce: bigint
): AaMultisigTaskLocal[] {
	const aaLower = aaAccount.toLowerCase()
	const out: AaMultisigTaskLocal[] = []
	for (const task of tasks) {
		if (task.aaAccount.toLowerCase() !== aaLower) continue
		if (task.status !== 'pending' && task.status !== 'ready') continue
		if (isAaMultisigEntryPointNonceStale(task.entryPointNonce, chainNonce)) {
			const expired = markAaMultisigTaskExpiredIfNonceStale(task, chainNonce)
			if (expired) out.push(expired)
			continue
		}
		if (BigInt(task.entryPointNonce) === chainNonce) {
			// Never supersede tasks still collecting co-signer signatures.
			if (
				task.status === 'pending' &&
				task.threshold > 1 &&
				task.signatures.length < task.threshold
			) {
				continue
			}
			out.push({
				...task,
				status: 'expired',
				memo: 'Superseded by a newer signing request.',
				updatedAt: Date.now(),
			})
		}
	}
	return out
}
