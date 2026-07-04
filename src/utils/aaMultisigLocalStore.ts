import type { AaMultisigTaskLocal } from '@/utils/aaMultisigProtocol'

export const AA_MULTISIG_TASKS_CHANGED_EVENT = 'beamio-aa-multisig-tasks-changed'

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
}

export function getAaMultisigTask(
	walletEoa: string,
	aaAccount: string,
	taskId: string
): AaMultisigTaskLocal | null {
	return loadAaMultisigTasks(walletEoa, aaAccount).find((t) => t.taskId === taskId) ?? null
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
	const signer = signerEoa.toLowerCase()
	return loadAaMultisigTasks(walletEoa, aaAccount).filter((t) => {
		if (t.status === 'rejected' || t.status === 'completed' || t.status === 'failed') return false
		if (!t.managers.some((m) => m.toLowerCase() === signer)) return false
		if (t.rejects.some((r) => r.signer.toLowerCase() === signer)) return false
		if (t.signatures.some((s) => s.signer.toLowerCase() === signer)) return false
		return t.status === 'pending' || t.status === 'ready'
	})
}

export function listReadyAaMultisigTasks(
	walletEoa: string,
	aaAccount: string
): AaMultisigTaskLocal[] {
	return loadAaMultisigTasks(walletEoa, aaAccount).filter((t) => t.status === 'ready')
}

export function listAaMultisigHistory(
	walletEoa: string,
	aaAccount: string
): AaMultisigTaskLocal[] {
	return loadAaMultisigTasks(walletEoa, aaAccount).filter((t) =>
		['completed', 'rejected', 'failed', 'submitted'].includes(t.status)
	)
}
