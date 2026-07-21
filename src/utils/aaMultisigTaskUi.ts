import { ethers } from 'ethers'
import type { AaMultisigTaskLocal } from '@/utils/aaMultisigProtocol'

function normEoa(a: string): string {
	return (a ?? '').trim().toLowerCase()
}

function ordinal(n: number): string {
	if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`
	switch (n % 10) {
		case 1:
			return `${n}st`
		case 2:
			return `${n}nd`
		case 3:
			return `${n}rd`
		default:
			return `${n}th`
	}
}

/**
 * Smart Wallet policy owner EOA — lowest address among signers (Beamio AA contract rule).
 * Used to show the wallet owner's @beamioTag on pending rows and transfer selectors.
 */
export function resolveAaMultisigPolicyOwnerEoa(managers: string[]): string | null {
	const sorted = managers
		.filter((m) => ethers.isAddress(m))
		.map((m) => ethers.getAddress(m))
		.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
	return sorted[0] ?? null
}

export function resolveAaMultisigTaskOwnerEoa(task: AaMultisigTaskLocal): string | null {
	return resolveAaMultisigPolicyOwnerEoa(task.managers)
}

/** User-visible @beamioTag line; falls back to @Beamio when tag is not in local DB yet. */
export function formatBeamioTagDisplayLine(raw: string): string {
	const t = raw?.trim()
	if (!t) return '@Beamio'
	return t.startsWith('@') ? t : `@${t}`
}

function shortAaAddress(aaAccount: string): string {
	return `${aaAccount.slice(0, 6)}…${aaAccount.slice(-4)}`
}

/** Primary label for transfer Smart Wallet dropdown options (tag first). */
export function formatTransferEligibleWalletOptionLabel(opts: {
	isOwnAa: boolean
	ownerTagRaw: string
	aaAccount: string
}): string {
	const tag = formatBeamioTagDisplayLine(opts.ownerTagRaw)
	const shortAa = shortAaAddress(opts.aaAccount)
	if (opts.isOwnAa) {
		return `${tag} · Your Smart Wallet (${shortAa})`
	}
	return `${tag} · Co-signer (${shortAa})`
}

/** True when pending/ready tasks still hold the EntryPoint nonce for this Smart Wallet. */
export function hasActiveMultisigTasksForAa(
	tasks: AaMultisigTaskLocal[],
	aaAccount: string
): boolean {
	const aaLower = aaAccount.toLowerCase()
	return tasks.some(
		(t) =>
			(t.status === 'pending' || t.status === 'ready') &&
			t.aaAccount.toLowerCase() === aaLower
	)
}

export const AA_MULTISIG_BLOCK_NEW_TRANSFER_TOAST =
	'Finish or reject the pending transfer before creating a new one.'

/** Shared progress copy for Pending, History, and Chat cards. */
export function formatMultisigSignatureProgress(task: AaMultisigTaskLocal): string {
	const n = task.signatures.length
	const t = task.threshold
	if (t <= 0) return `${n} signature${n === 1 ? '' : 's'} collected`
	if (n >= t) return `${n}/${t} signatures — ready to submit`
	if (n === 0) return `Waiting for ${ordinal(1)} signature (0/${t})`
	const next = n + 1
	if (next === t) {
		return `${n} signature${n === 1 ? '' : 's'} complete — waiting for ${ordinal(next)} signature (${n}/${t})`
	}
	return `${n} signature${n === 1 ? '' : 's'} complete — waiting for ${ordinal(next)} signature (${n}/${t})`
}

export function isActiveMultisigTaskForManager(
	task: AaMultisigTaskLocal,
	managerEoa: string
): boolean {
	const viewer = normEoa(managerEoa)
	if (!viewer) return false
	if (!task.managers.some((m) => m.toLowerCase() === viewer)) return false
	if (task.status === 'completed' || task.status === 'rejected' || task.status === 'failed') {
		return false
	}
	if (task.status === 'expired') return false
	if (task.rejects.some((r) => r.signer.toLowerCase() === viewer)) return false
	return task.status === 'pending' || task.status === 'ready'
}

/** True when this manager still needs to sign (pending, not yet signed). */
export function viewerNeedsToSignMultisigTask(
	task: AaMultisigTaskLocal,
	managerEoa: string
): boolean {
	const viewer = normEoa(managerEoa)
	if (!viewer || task.status !== 'pending') return false
	if (!isActiveMultisigTaskForManager(task, managerEoa)) return false
	return !task.signatures.some((s) => s.signer.toLowerCase() === viewer)
}

export function filterActiveMultisigTasksForManager(
	tasks: AaMultisigTaskLocal[],
	managerEoa: string
): AaMultisigTaskLocal[] {
	return tasks.filter((t) => isActiveMultisigTaskForManager(t, managerEoa))
}

export function filterPendingCollectingSignatures(
	tasks: AaMultisigTaskLocal[],
	managerEoa: string
): AaMultisigTaskLocal[] {
	return filterActiveMultisigTasksForManager(tasks, managerEoa).filter((t) => t.status === 'pending')
}

export function filterReadyMultisigForManager(
	tasks: AaMultisigTaskLocal[],
	managerEoa: string
): AaMultisigTaskLocal[] {
	const viewer = normEoa(managerEoa)
	if (!viewer) return []
	return tasks.filter(
		(t) =>
			t.status === 'ready' &&
			t.managers.some((m) => m.toLowerCase() === viewer) &&
			!t.rejects.some((r) => r.signer.toLowerCase() === viewer)
	)
}

export type MultisigTaskRowMode = 'sign' | 'waiting' | 'ready' | 'history'

export function resolveMultisigTaskRowMode(
	task: AaMultisigTaskLocal,
	viewerEoa: string
): MultisigTaskRowMode {
	if (
		task.status === 'completed' ||
		task.status === 'rejected' ||
		task.status === 'failed' ||
		task.status === 'expired' ||
		task.status === 'submitted'
	) {
		return 'history'
	}
	if (task.status === 'ready') return 'ready'
	if (viewerNeedsToSignMultisigTask(task, viewerEoa)) return 'sign'
	return 'waiting'
}

/** User-visible status chip (English). */
export function multisigTaskStatusChipLabel(
	task: AaMultisigTaskLocal,
	viewerEoa: string
): string {
	switch (task.status) {
		case 'completed':
			return task.kind === 'transfer' ? 'Completed' : 'Done'
		case 'rejected':
			return 'Rejected'
		case 'failed':
			return 'Failed'
		case 'expired':
			return 'Expired'
		case 'ready':
			return 'Ready'
		case 'pending':
			return viewerNeedsToSignMultisigTask(task, viewerEoa) ? 'Sign needed' : 'Waiting'
		default:
			return task.status
	}
}

/** Secondary line under progress for Pending rows. */
export function multisigPendingSecondaryMessage(
	task: AaMultisigTaskLocal,
	viewerEoa: string
): string | null {
	const viewer = normEoa(viewerEoa)
	const userSigned = task.signatures.some((s) => s.signer.toLowerCase() === viewer)
	const isCreator = task.creatorEoa.toLowerCase() === viewer

	if (userSigned) {
		return 'You signed — waiting for more signatures'
	}
	if (isCreator && task.signatures.length > 0) {
		return 'Request sent to all co-signers — waiting for signatures'
	}
	if (isCreator) {
		return 'Request sent to all co-signers'
	}
	return null
}

export function filterHistoryMultisigForManager(
	tasks: AaMultisigTaskLocal[],
	managerEoa: string
): AaMultisigTaskLocal[] {
	const viewer = normEoa(managerEoa)
	if (!viewer) return []
	return tasks.filter(
		(t) =>
			['completed', 'rejected', 'submitted', 'expired'].includes(t.status) &&
			t.managers.some((m) => m.toLowerCase() === viewer)
	)
}

export function multisigHistorySummary(task: AaMultisigTaskLocal): string | null {
	if (task.status === 'expired') {
		return task.memo ?? 'EntryPoint nonce expired — create a new signing request'
	}
	if (task.status !== 'completed') return null
	if (task.kind === 'transfer') return 'Transfer completed successfully'
	if (task.kind === 'set_policy') return 'Policy update completed successfully'
	return 'Multisig task completed successfully'
}
