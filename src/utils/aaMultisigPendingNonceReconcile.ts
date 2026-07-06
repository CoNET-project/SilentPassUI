import { ethers } from 'ethers'
import type { AaMultisigTaskLocal } from '@/utils/aaMultisigProtocol'
import { loadAllAaMultisigTasksForWallet } from '@/utils/aaMultisigLocalStore'
import {
	isAaMultisigEntryPointNonceStale,
	markAaMultisigTaskExpiredIfNonceStale,
	readFreshAaEntryPointNonce,
} from '@/utils/aaMultisigEntryPointNonce'

/** Background reconcile interval on Multisig Pending (setTimeout chain). */
export const AA_MULTISIG_PENDING_NONCE_RECONCILE_MS = 30_000

const ACTIVE_TASK_STATUSES = new Set<AaMultisigTaskLocal['status']>(['pending', 'ready'])

function isActiveMultisigTask(task: AaMultisigTaskLocal): boolean {
	return ACTIVE_TASK_STATUSES.has(task.status)
}

function collectAaAccountsFromTasks(
	tasks: AaMultisigTaskLocal[],
	extraAaAccounts: string[] = []
): string[] {
	const set = new Set<string>()
	for (const raw of extraAaAccounts) {
		try {
			set.add(ethers.getAddress(raw).toLowerCase())
		} catch {
			/* skip */
		}
	}
	for (const task of tasks) {
		if (!isActiveMultisigTask(task)) continue
		try {
			set.add(ethers.getAddress(task.aaAccount).toLowerCase())
		} catch {
			/* skip */
		}
	}
	return [...set]
}

function activeTasksForAa(tasks: AaMultisigTaskLocal[], aaLower: string): AaMultisigTaskLocal[] {
	return tasks.filter(
		(t) => isActiveMultisigTask(t) && t.aaAccount.toLowerCase() === aaLower
	)
}

/**
 * EntryPoint allows the next UserOp at `chainNonce`.
 * In-flight pending/ready tasks at the same slot must be superseded before a new draft.
 */
export function resolveUserOpNonceForNewMultisigTask(
	chainNonce: bigint,
	tasks: AaMultisigTaskLocal[],
	aaAccount: string
): bigint {
	const aaLower = aaAccount.toLowerCase()
	const active = activeTasksForAa(tasks, aaLower)
	for (const task of active) {
		if (BigInt(task.entryPointNonce) === chainNonce) {
			// Caller should supersede same-slot drafts before building a new UserOp.
			continue
		}
	}
	return chainNonce
}

function expireStaleActiveTasksForAa(
	tasks: AaMultisigTaskLocal[],
	aaLower: string,
	chainNonce: bigint
): AaMultisigTaskLocal[] {
	const expired: AaMultisigTaskLocal[] = []
	for (const task of activeTasksForAa(tasks, aaLower)) {
		if (!isAaMultisigEntryPointNonceStale(task.entryPointNonce, chainNonce)) continue
		const marked = markAaMultisigTaskExpiredIfNonceStale(task, chainNonce)
		if (marked) expired.push(marked)
	}
	return expired
}

function expireSameSlotDraftsForAa(
	tasks: AaMultisigTaskLocal[],
	aaLower: string,
	chainNonce: bigint
): AaMultisigTaskLocal[] {
	const expired: AaMultisigTaskLocal[] = []
	for (const task of activeTasksForAa(tasks, aaLower)) {
		if (isAaMultisigEntryPointNonceStale(task.entryPointNonce, chainNonce)) continue
		if (BigInt(task.entryPointNonce) !== chainNonce) continue
		// Never supersede tasks still collecting co-signer signatures (sequential queue per AA).
		if (
			task.status === 'pending' &&
			task.threshold > 1 &&
			task.signatures.length < task.threshold
		) {
			continue
		}
		expired.push({
			...task,
			status: 'expired',
			memo: 'Superseded by a newer signing request.',
			updatedAt: Date.now(),
		})
	}
	return expired
}

/** Daemon tick: expire pending/ready tasks whose nonce no longer matches chain. */
export async function reconcileAaMultisigPendingNoncesForWallet(
	walletEoa: string,
	extraAaAccounts: string[] = []
): Promise<{ expired: AaMultisigTaskLocal[]; chainNonceByAa: Map<string, bigint> }> {
	const tasks = loadAllAaMultisigTasksForWallet(walletEoa)
	const aaAccounts = collectAaAccountsFromTasks(tasks, extraAaAccounts)
	const expired: AaMultisigTaskLocal[] = []
	const chainNonceByAa = new Map<string, bigint>()

	await Promise.all(
		aaAccounts.map(async (aaLower) => {
			const aa = ethers.getAddress(aaLower)
			const chainNonce = await readFreshAaEntryPointNonce(aa)
			chainNonceByAa.set(aaLower, chainNonce)
			expired.push(...expireStaleActiveTasksForAa(tasks, aaLower, chainNonce))
		})
	)

	return { expired, chainNonceByAa }
}

/** Before Create multisig task: refresh chain nonce, reconcile pending, optionally supersede same slot. */
export async function prepareAaMultisigNewTaskNonce(
	walletEoa: string,
	aaAccount: string,
	opts?: { supersedeSameSlot?: boolean }
): Promise<{
	chainNonce: bigint
	userOpNonce: bigint
	expired: AaMultisigTaskLocal[]
}> {
	const tasks = loadAllAaMultisigTasksForWallet(walletEoa)
	const aa = ethers.getAddress(aaAccount)
	const aaLower = aa.toLowerCase()
	const chainNonce = await readFreshAaEntryPointNonce(aa)

	const expired = expireStaleActiveTasksForAa(tasks, aaLower, chainNonce)
	if (opts?.supersedeSameSlot) {
		expired.push(...expireSameSlotDraftsForAa(tasks, aaLower, chainNonce))
	}

	const userOpNonce = resolveUserOpNonceForNewMultisigTask(chainNonce, tasks, aa)
	return { chainNonce, userOpNonce, expired }
}
