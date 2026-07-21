import { ethers } from 'ethers'
import type { AaMultisigTaskLocal } from '@/utils/aaMultisigProtocol'
import { viewerNeedsToSignMultisigTask } from '@/utils/aaMultisigTaskUi'

export const AA_MULTISIG_TASKS_CHANGED_EVENT = 'beamio-aa-multisig-tasks-changed'

type AaMultisigOutboundPruneFn = (walletEoa: string, task: AaMultisigTaskLocal) => void

let aaMultisigOutboundPruneFn: AaMultisigOutboundPruneFn | null = null

/** Registered by aaMultisigOfflineSync on load — clears outbound queue when task reaches terminal status. */
export function setAaMultisigOutboundPruneFn(fn: AaMultisigOutboundPruneFn | null): void {
	aaMultisigOutboundPruneFn = fn
}

const STORAGE_PREFIX = 'beamio_aa_multisig_tasks_v1:'

function storageKey(walletEoa: string, aaAccount: string): string | null {
	const w = (walletEoa ?? '').trim().toLowerCase()
	const a = (aaAccount ?? '').trim().toLowerCase()
	if (!w.startsWith('0x') || w.length !== 42) return null
	if (!a.startsWith('0x') || a.length !== 42) return null
	return `${STORAGE_PREFIX}${w}:${a}`
}

function notifyChanged(): void {
	try {
		window.dispatchEvent(new CustomEvent(AA_MULTISIG_TASKS_CHANGED_EVENT))
	} catch {
		/* ignore */
	}
}

export function loadAaMultisigTasks(walletEoa: string, aaAccount: string): AaMultisigTaskLocal[] {
	const key = storageKey(walletEoa, aaAccount)
	if (!key) return []
	try {
		const raw = localStorage.getItem(key)
		if (!raw) return []
		const parsed = JSON.parse(raw) as AaMultisigTaskLocal[]
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

/** Every Smart Wallet (AA) address with a local multisig task partition for this viewer EOA. */
export function listAaMultisigStorageAaAccounts(walletEoa: string): string[] {
	const w = (walletEoa ?? '').trim().toLowerCase()
	if (!w.startsWith('0x') || w.length !== 42) return []
	const prefix = `${STORAGE_PREFIX}${w}:`
	const out: string[] = []
	const seen = new Set<string>()
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)
			if (!key?.startsWith(prefix)) continue
			const aaRaw = key.slice(prefix.length)
			if (!aaRaw.startsWith('0x') || aaRaw.length !== 42) continue
			const keyLower = aaRaw.toLowerCase()
			if (seen.has(keyLower)) continue
			seen.add(keyLower)
			try {
				out.push(ethers.getAddress(aaRaw))
			} catch {
				/* skip malformed */
			}
		}
	} catch {
		return []
	}
	return out
}

/** All multisig tasks for this wallet EOA across every Smart Wallet (AA) partition. */
export function loadAllAaMultisigTasksForWallet(walletEoa: string): AaMultisigTaskLocal[] {
	const w = (walletEoa ?? '').trim().toLowerCase()
	if (!w.startsWith('0x') || w.length !== 42) return []
	const prefix = `${STORAGE_PREFIX}${w}:`
	const byId = new Map<string, AaMultisigTaskLocal>()
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)
			if (!key?.startsWith(prefix)) continue
			const raw = localStorage.getItem(key)
			if (!raw) continue
			const parsed = JSON.parse(raw) as AaMultisigTaskLocal[]
			if (!Array.isArray(parsed)) continue
			for (const task of parsed) {
				if (!task?.taskId) continue
				const existing = byId.get(task.taskId)
				if (!existing || task.updatedAt > existing.updatedAt) {
					byId.set(task.taskId, task)
				}
			}
		}
	} catch {
		return []
	}
	return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getAaMultisigTaskAny(walletEoa: string, taskId: string): AaMultisigTaskLocal | null {
	return loadAllAaMultisigTasksForWallet(walletEoa).find((t) => t.taskId === taskId) ?? null
}

export function saveAaMultisigTasks(
	walletEoa: string,
	aaAccount: string,
	tasks: AaMultisigTaskLocal[]
): void {
	const key = storageKey(walletEoa, aaAccount)
	if (!key) return
	try {
		localStorage.setItem(key, JSON.stringify(tasks))
		notifyChanged()
	} catch {
		/* ignore quota */
	}
}

export function upsertAaMultisigTask(
	walletEoa: string,
	aaAccount: string,
	task: AaMultisigTaskLocal
): void {
	const list = loadAaMultisigTasks(walletEoa, aaAccount)
	const idx = list.findIndex((t) => t.taskId === task.taskId)
	if (idx >= 0) list[idx] = task
	else list.unshift(task)
	list.sort((a, b) => b.updatedAt - a.updatedAt)
	saveAaMultisigTasks(walletEoa, aaAccount, list)
	aaMultisigOutboundPruneFn?.(walletEoa, task)
}

/** Upsert using `task.aaAccount` (shared Smart Wallet), not the viewer's default AA. */
export function upsertAaMultisigTaskRecord(walletEoa: string, task: AaMultisigTaskLocal): void {
	upsertAaMultisigTask(walletEoa, task.aaAccount, task)
}

/** Remove a task from local storage (e.g. nonce submit failure — do not keep in History). */
export function removeAaMultisigTask(
	walletEoa: string,
	aaAccount: string,
	taskId: string
): boolean {
	const list = loadAaMultisigTasks(walletEoa, aaAccount)
	const next = list.filter((t) => t.taskId !== taskId)
	if (next.length === list.length) return false
	saveAaMultisigTasks(walletEoa, aaAccount, next)
	return true
}

export function removeAaMultisigTaskRecord(walletEoa: string, task: AaMultisigTaskLocal): boolean {
	return removeAaMultisigTask(walletEoa, task.aaAccount, task.taskId)
}

/**
 * Drop `failed` tasks (typically EntryPoint nonce / AA25 after submit).
 * They clutter History; user should re-propose with a fresh nonce.
 */
export function pruneFailedAaMultisigTasksForWallet(walletEoa: string): number {
	const w = (walletEoa ?? '').trim().toLowerCase()
	if (!w.startsWith('0x') || w.length !== 42) return 0
	let removed = 0
	for (const aa of listAaMultisigStorageAaAccounts(walletEoa)) {
		const list = loadAaMultisigTasks(walletEoa, aa)
		const next = list.filter((t) => {
			if (t.status !== 'failed') return true
			removed += 1
			return false
		})
		if (next.length !== list.length) {
			saveAaMultisigTasks(walletEoa, aa, next)
		}
	}
	return removed
}

/** True when submit error is EntryPoint / account nonce related (do not archive as History). */
export function isAaMultisigNonceRelatedSubmitError(error: string | undefined | null): boolean {
	const m = (error ?? '').toLowerCase()
	if (!m) return false
	return (
		m.includes('aa25') ||
		m.includes('invalid account nonce') ||
		m.includes('entrypoint nonce') ||
		m.includes('nonce consumed') ||
		m.includes('nonce mismatch') ||
		/\bnonce\b/.test(m)
	)
}

export function getAaMultisigTask(
	walletEoa: string,
	aaAccount: string,
	taskId: string
): AaMultisigTaskLocal | null {
	return loadAaMultisigTasks(walletEoa, aaAccount).find((t) => t.taskId === taskId) ?? null
}

function filterPendingForSigner(
	tasks: AaMultisigTaskLocal[],
	signerEoa: string
): AaMultisigTaskLocal[] {
	return tasks.filter((t) => viewerNeedsToSignMultisigTask(t, signerEoa))
}

function filterReadyTasks(tasks: AaMultisigTaskLocal[]): AaMultisigTaskLocal[] {
	return tasks.filter((t) => t.status === 'ready')
}

function filterHistoryTasks(tasks: AaMultisigTaskLocal[]): AaMultisigTaskLocal[] {
	return tasks.filter((t) =>
		(['completed', 'rejected', 'submitted', 'expired'] as AaMultisigTaskLocal['status'][]).includes(
			t.status
		)
	)
}

export function ingestAaMultisigTaskLocal(
	walletEoa: string,
	aaAccount: string,
	task: AaMultisigTaskLocal
): void {
	upsertAaMultisigTask(walletEoa, aaAccount, task)
}

export function listPendingAaMultisigForSigner(
	walletEoa: string,
	aaAccount: string,
	signerEoa: string
): AaMultisigTaskLocal[] {
	return filterPendingForSigner(loadAaMultisigTasks(walletEoa, aaAccount), signerEoa)
}

/** Pending tasks for signer across all Smart Wallet partitions (co-signer on shared AA). */
export function listPendingAaMultisigForSignerWallet(
	walletEoa: string,
	signerEoa: string
): AaMultisigTaskLocal[] {
	return filterPendingForSigner(loadAllAaMultisigTasksForWallet(walletEoa), signerEoa)
}

export function listReadyAaMultisigTasks(
	walletEoa: string,
	aaAccount: string
): AaMultisigTaskLocal[] {
	return filterReadyTasks(loadAaMultisigTasks(walletEoa, aaAccount))
}

export function listReadyAaMultisigTasksForWallet(walletEoa: string): AaMultisigTaskLocal[] {
	return filterReadyTasks(loadAllAaMultisigTasksForWallet(walletEoa))
}

export function listAaMultisigHistory(
	walletEoa: string,
	aaAccount: string
): AaMultisigTaskLocal[] {
	return filterHistoryTasks(loadAaMultisigTasks(walletEoa, aaAccount))
}

export function listAaMultisigHistoryForWallet(walletEoa: string): AaMultisigTaskLocal[] {
	return filterHistoryTasks(loadAllAaMultisigTasksForWallet(walletEoa))
}

export function filterPendingAaMultisigTasksForSigner(
	tasks: AaMultisigTaskLocal[],
	signerEoa: string
): AaMultisigTaskLocal[] {
	return filterPendingForSigner(tasks, signerEoa)
}

export function filterReadyAaMultisigTasks(tasks: AaMultisigTaskLocal[]): AaMultisigTaskLocal[] {
	return filterReadyTasks(tasks)
}

export function filterAaMultisigHistoryTasks(tasks: AaMultisigTaskLocal[]): AaMultisigTaskLocal[] {
	return filterHistoryTasks(tasks)
}
