import {
	parseAaMultisigInnerFromExport,
	resolveFromEoaForMultisigInner,
	serializeAaMultisigInnerForExport,
	mergeInboundMultisigInner,
	isAaMultisigTaskTerminalStatus,
	type AaMultisigInner,
	type AaMultisigSignInner,
	type AaMultisigProposeInner,
	type AaMultisigTaskLocal,
} from '@/utils/aaMultisigProtocol'
import {
	AA_MULTISIG_TASKS_CHANGED_EVENT,
	getAaMultisigTask,
	getAaMultisigTaskAny,
	setAaMultisigOutboundPruneFn,
	upsertAaMultisigTask,
} from '@/utils/aaMultisigLocalStore'
import { broadcastAaMultisigInner, buildSignInner, buildProposeInner } from '@/services/aaMultisigGossip'
import {
	isPaidOfflineSignInner,
	postAaMultisigOfflineSignSubmit,
} from '@/services/aaMultisigOfflineSubmitApi'
import { formatTransferTaskSummary } from '@/utils/aaMultisigConetTransferAssets'

export const AA_MULTISIG_OUTBOUND_CHANGED_EVENT = 'beamio-aa-multisig-outbound-changed'

/** Background flush interval (setTimeout chain on Multisig page). */
export const AA_MULTISIG_OUTBOUND_FLUSH_INTERVAL_MS = 15_000

/** Drop queued gossip after this many failed flush rounds (~4 min at 15s). */
export const AA_MULTISIG_OUTBOUND_MAX_FLUSH_ATTEMPTS = 16

const OUTBOUND_PREFIX = 'beamio_aa_multisig_outbound_v1:'

export type AaMultisigOutboundItem = {
	id: string
	walletEoa: string
	recipients: string[]
	inner: AaMultisigInner
	createdAt: number
	lastAttemptAt?: number
	attempts: number
}

function outboundStorageKey(walletEoa: string): string | null {
	const w = (walletEoa ?? '').trim().toLowerCase()
	if (!w.startsWith('0x') || w.length !== 42) return null
	return `${OUTBOUND_PREFIX}${w}`
}

function notifyOutboundChanged(): void {
	try {
		window.dispatchEvent(new CustomEvent(AA_MULTISIG_OUTBOUND_CHANGED_EVENT))
	} catch {
		/* ignore */
	}
}

function outboundDedupeKey(item: Pick<AaMultisigOutboundItem, 'inner'>): string {
	const inner = item.inner
	const base = `${inner.taskId}:${inner.action}`
	if (inner.action === 'sign' || inner.action === 'reject') {
		return `${base}:${inner.signerEoa.toLowerCase()}`
	}
	if (inner.action === 'propose') {
		return `${base}:${inner.sendId}`
	}
	return `${base}:${inner.sendId}`
}

export function loadAaMultisigOutboundQueue(walletEoa: string): AaMultisigOutboundItem[] {
	const key = outboundStorageKey(walletEoa)
	if (!key) return []
	try {
		const raw = localStorage.getItem(key)
		if (!raw) return []
		const parsed = JSON.parse(raw) as AaMultisigOutboundItem[]
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

function saveAaMultisigOutboundQueue(walletEoa: string, items: AaMultisigOutboundItem[]): void {
	const key = outboundStorageKey(walletEoa)
	if (!key) return
	try {
		localStorage.setItem(key, JSON.stringify(items))
		notifyOutboundChanged()
	} catch {
		/* ignore quota */
	}
}

export function enqueueAaMultisigOutbound(params: {
	walletEoa: string
	recipients: string[]
	inner: AaMultisigInner
}): void {
	if (shouldSkipOutboundEnqueue(params.walletEoa, params.inner)) return
	const list = loadAaMultisigOutboundQueue(params.walletEoa)
	const dedupe = outboundDedupeKey({ inner: params.inner })
	if (list.some((row) => outboundDedupeKey(row) === dedupe)) return
	list.push({
		id: crypto.randomUUID().toLowerCase(),
		walletEoa: params.walletEoa.toLowerCase(),
		recipients: params.recipients,
		inner: params.inner,
		createdAt: Date.now(),
		attempts: 0,
	})
	saveAaMultisigOutboundQueue(params.walletEoa, list)
}

function shouldSkipOutboundEnqueue(walletEoa: string, inner: AaMultisigInner): boolean {
	const taskId = inner.taskId?.trim()
	if (!taskId) return false
	const task = getAaMultisigTaskAny(walletEoa, taskId)
	if (!task) return false
	return isAaMultisigOutboundItemRedundant(walletEoa, {
		id: '',
		walletEoa,
		recipients: [],
		inner,
		createdAt: 0,
		attempts: 0,
	})
}

export function removeAaMultisigOutboundByDedupe(walletEoa: string, inner: AaMultisigInner): void {
	const dedupe = outboundDedupeKey({ inner })
	const next = loadAaMultisigOutboundQueue(walletEoa).filter(
		(row) => outboundDedupeKey(row) !== dedupe
	)
	saveAaMultisigOutboundQueue(walletEoa, next)
}

/** Remove all outbound packets for a task when it reaches terminal status. */
export function pruneAaMultisigOutboundForTaskIfTerminal(
	walletEoa: string,
	task: Pick<AaMultisigTaskLocal, 'taskId' | 'status'>
): number {
	if (!isAaMultisigTaskTerminalStatus(task.status)) return 0
	const taskId = task.taskId.trim()
	if (!taskId) return 0
	const queue = loadAaMultisigOutboundQueue(walletEoa)
	const next = queue.filter((row) => row.inner.taskId?.trim() !== taskId)
	if (next.length === queue.length) return 0
	saveAaMultisigOutboundQueue(walletEoa, next)
	return queue.length - next.length
}

function normEoa(a: string): string {
	return (a ?? '').trim().toLowerCase()
}

function isActiveMultisigTaskStatus(status: AaMultisigTaskLocal['status']): boolean {
	return status === 'pending' || status === 'ready'
}

/** Outbound row no longer needs UI or retry (local task already reflects this packet). */
function isAaMultisigOutboundItemRedundant(walletEoa: string, row: AaMultisigOutboundItem): boolean {
	const inner = row.inner
	const taskId = inner.taskId?.trim()
	if (!taskId) return false
	const task = getAaMultisigTaskAny(walletEoa, taskId)
	if (!task) return false
	const viewer = normEoa(walletEoa)

	if (inner.action === 'propose') {
		// Creator already has an active local task — use task row / export, not a stuck Propose row.
		if (normEoa(task.creatorEoa) === viewer && isActiveMultisigTaskStatus(task.status)) {
			return true
		}
	}

	if (inner.action === 'sign' && inner.signerEoa) {
		const signer = normEoa(inner.signerEoa)
		if (signer === viewer && task.signatures.some((s) => normEoa(s.signer) === signer)) {
			return true
		}
	}

	if (inner.action === 'reject' && inner.signerEoa) {
		const signer = normEoa(inner.signerEoa)
		if (task.rejects.some((r) => normEoa(r.signer) === signer)) {
			return true
		}
	}

	return false
}

function isAaMultisigOutboundItemFlushExhausted(row: AaMultisigOutboundItem): boolean {
	return row.attempts >= AA_MULTISIG_OUTBOUND_MAX_FLUSH_ATTEMPTS
}

/** Terminal tasks, redundant rows, and exhausted retries — unified queue reconcile. */
export function reconcileAaMultisigOutboundQueue(walletEoa: string): number {
	const queue = loadAaMultisigOutboundQueue(walletEoa)
	if (queue.length === 0) return 0
	const next = queue.filter((row) => {
		if (isAaMultisigOutboundItemFlushExhausted(row)) return false
		if (isAaMultisigOutboundItemRedundant(walletEoa, row)) return false
		const taskId = row.inner.taskId?.trim()
		if (!taskId) return true
		const task = getAaMultisigTaskAny(walletEoa, taskId)
		if (!task) return true
		return !isAaMultisigTaskTerminalStatus(task.status)
	})
	if (next.length === queue.length) return 0
	saveAaMultisigOutboundQueue(walletEoa, next)
	return queue.length - next.length
}

/** @deprecated Prefer reconcileAaMultisigOutboundQueue */
export function pruneAaMultisigOutboundForTerminalTasks(walletEoa: string): number {
	return reconcileAaMultisigOutboundQueue(walletEoa)
}

/** User dismissed a queued packet (gossip still pending). */
export function dismissAaMultisigOutboundItem(walletEoa: string, itemId: string): boolean {
	const id = itemId.trim().toLowerCase()
	if (!id) return false
	const queue = loadAaMultisigOutboundQueue(walletEoa)
	const next = queue.filter((row) => row.id.toLowerCase() !== id)
	if (next.length === queue.length) return false
	saveAaMultisigOutboundQueue(walletEoa, next)
	return true
}

export function isAaMultisigOutboundPending(
	walletEoa: string,
	taskId: string,
	signerEoa: string
): boolean {
	const signer = signerEoa.toLowerCase()
	return loadAaMultisigOutboundQueue(walletEoa).some((row) => {
		if (row.inner.taskId !== taskId) return false
		if (row.inner.action !== 'sign' && row.inner.action !== 'reject') return false
		return row.inner.signerEoa.toLowerCase() === signer
	})
}

export function countAaMultisigOutboundPending(walletEoa: string): number {
	return loadAaMultisigOutboundQueue(walletEoa).length
}

export type AaMultisigOutboundListItem = {
	id: string
	actionLabel: string
	title: string
	detail: string
	attempts: number
	createdAt: number
	inner: AaMultisigInner
}

function shortTaskId(taskId: string): string {
	const t = taskId.trim()
	if (t.length <= 10) return t
	return `${t.slice(0, 8)}…`
}

/** Human-readable rows for Offline sync queue UI (oldest first). */
export function listAaMultisigOutboundForDisplay(walletEoa: string): AaMultisigOutboundListItem[] {
	reconcileAaMultisigOutboundQueue(walletEoa)
	return loadAaMultisigOutboundQueue(walletEoa)
		.slice()
		.sort((a, b) => a.createdAt - b.createdAt)
		.map((row) => {
			const inner = row.inner
			const task =
				inner.aaAccount && inner.taskId
					? getAaMultisigTask(walletEoa, inner.aaAccount, inner.taskId)
					: null

			let actionLabel: string = inner.action
			let title = task?.title ?? ''

			if (inner.action === 'propose') {
				actionLabel = 'Propose'
				if (inner.kind === 'transfer') {
					title =
						inner.title ??
						task?.title ??
						formatTransferTaskSummary({
							transferAsset: inner.transferAsset,
							amountRaw: inner.amountRaw,
							amountUsdc6: inner.amountUsdc6,
							toEoa: inner.toEoa,
						})
				} else {
					title = inner.title ?? task?.title ?? 'Update multisig signers'
				}
			} else if (inner.action === 'sign') {
				actionLabel = 'Sign'
				title = task?.title ?? `Sign · ${shortTaskId(inner.taskId)}`
			} else if (inner.action === 'reject') {
				actionLabel = 'Reject'
				title = task?.title ?? `Reject · ${shortTaskId(inner.taskId)}`
			}

			const detailParts = [`${row.recipients.length} recipient${row.recipients.length === 1 ? '' : 's'}`]
			if (row.attempts > 0) {
				detailParts.push(`${row.attempts} retr${row.attempts === 1 ? 'y' : 'ies'}`)
			}

			return {
				id: row.id,
				actionLabel,
				title,
				detail: detailParts.join(' · '),
				attempts: row.attempts,
				createdAt: row.createdAt,
				inner,
			}
		})
}

/** Sign packets must pass paid API (0.1 B-Unit) before gossip sync. */
async function ensureOfflineSignSubmittedViaApi(
	inner: AaMultisigInner,
	walletEoa: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!isPaidOfflineSignInner(inner)) return { ok: true }
	const submitterEoa = inner.signerEoa
	if (submitterEoa.toLowerCase() !== walletEoa.toLowerCase()) {
		return { ok: false, error: 'Sign submitter must match local wallet' }
	}
	const api = await postAaMultisigOfflineSignSubmit(inner, submitterEoa)
	if (!api.ok) return { ok: false, error: api.error }
	return { ok: true }
}

/** After local sign/reject: paid API (sign only) then try gossip; queue remainder for retry or manual export. */
export async function publishAaMultisigInnerWithOfflineFallback(params: {
	walletEoa: string
	recipients: string[]
	inner: AaMultisigInner
	privateKeyArmor: string
	allNodes: nodeInfo[]
	excludeEoa?: string
}): Promise<{ mode: 'broadcast' | 'queued'; sent: number; failed: number; apiError?: string }> {
	if (isPaidOfflineSignInner(params.inner)) {
		const apiGate = await ensureOfflineSignSubmittedViaApi(params.inner, params.walletEoa)
		if (!apiGate.ok) {
			enqueueAaMultisigOutbound({
				walletEoa: params.walletEoa,
				recipients: params.recipients,
				inner: params.inner,
			})
			return { mode: 'queued', sent: 0, failed: params.recipients.length, apiError: apiGate.error }
		}
	}

	if (!params.allNodes?.length) {
		enqueueAaMultisigOutbound({
			walletEoa: params.walletEoa,
			recipients: params.recipients,
			inner: params.inner,
		})
		return { mode: 'queued', sent: 0, failed: params.recipients.length }
	}

	const { sent, failed } = await broadcastAaMultisigInner({
		recipients: params.recipients,
		inner: params.inner,
		privateKeyArmor: params.privateKeyArmor,
		allNodes: params.allNodes,
		excludeEoa: params.excludeEoa,
	})

	if (sent > 0) {
		removeAaMultisigOutboundByDedupe(params.walletEoa, params.inner)
		reconcileAaMultisigOutboundQueue(params.walletEoa)
		return { mode: 'broadcast', sent, failed }
	}

	if (shouldSkipOutboundEnqueue(params.walletEoa, params.inner)) {
		return { mode: 'broadcast', sent: 0, failed: params.recipients.length }
	}

	enqueueAaMultisigOutbound({
		walletEoa: params.walletEoa,
		recipients: params.recipients,
		inner: params.inner,
	})
	return { mode: 'queued', sent: 0, failed }
}

let flushInFlight: Promise<{ sent: number; failed: number; remaining: number; pruned: number }> | null =
	null

/** Reconcile queue, then retry gossip for remaining rows. */
export async function autoProcessAaMultisigOutboundQueue(params: {
	walletEoa: string
	privateKeyArmor: string
	allNodes: nodeInfo[]
}): Promise<{ sent: number; failed: number; remaining: number; pruned: number }> {
	const pruned = reconcileAaMultisigOutboundQueue(params.walletEoa)
	const flush = await flushAaMultisigOutboundQueue(params)
	return { ...flush, pruned: pruned + flush.pruned }
}

/** Retry queued gossip when CoNET chat nodes are available. */
export async function flushAaMultisigOutboundQueue(params: {
	walletEoa: string
	privateKeyArmor: string
	allNodes: nodeInfo[]
}): Promise<{ sent: number; failed: number; remaining: number; pruned: number }> {
	if (flushInFlight) return flushInFlight
	const prunedBefore = reconcileAaMultisigOutboundQueue(params.walletEoa)
	if (!params.allNodes?.length || !params.privateKeyArmor) {
		return {
			sent: 0,
			failed: 0,
			remaining: countAaMultisigOutboundPending(params.walletEoa),
			pruned: prunedBefore,
		}
	}

	flushInFlight = (async () => {
		let sent = 0
		let failed = 0
		const queue = loadAaMultisigOutboundQueue(params.walletEoa)
		const remaining: AaMultisigOutboundItem[] = []

		for (const row of queue) {
			if (isAaMultisigOutboundItemRedundant(params.walletEoa, row)) continue
			if (isAaMultisigOutboundItemFlushExhausted(row)) continue

			if (isPaidOfflineSignInner(row.inner)) {
				const apiGate = await ensureOfflineSignSubmittedViaApi(row.inner, params.walletEoa)
				if (!apiGate.ok) {
					remaining.push({
						...row,
						attempts: row.attempts + 1,
						lastAttemptAt: Date.now(),
					})
					failed += row.recipients.length
					continue
				}
			}
			const result = await broadcastAaMultisigInner({
				recipients: row.recipients,
				inner: row.inner,
				privateKeyArmor: params.privateKeyArmor,
				allNodes: params.allNodes,
				excludeEoa: params.walletEoa,
			})
			sent += result.sent
			failed += result.failed
			if (result.sent > 0) continue
			remaining.push({
				...row,
				attempts: row.attempts + 1,
				lastAttemptAt: Date.now(),
			})
		}

		saveAaMultisigOutboundQueue(params.walletEoa, remaining)
		const prunedAfter = reconcileAaMultisigOutboundQueue(params.walletEoa)
		if (sent > 0) {
			window.dispatchEvent(new CustomEvent(AA_MULTISIG_TASKS_CHANGED_EVENT))
		}
		return {
			sent,
			failed,
			remaining: countAaMultisigOutboundPending(params.walletEoa),
			pruned: prunedBefore + prunedAfter,
		}
	})()

	try {
		return await flushInFlight
	} finally {
		flushInFlight = null
	}
}

export function buildSignInnerExportForTask(
	task: AaMultisigTaskLocal,
	signerEoa: string
): AaMultisigSignInner | null {
	const signer = signerEoa.toLowerCase()
	const entry = task.signatures.find((s) => s.signer.toLowerCase() === signer)
	if (!entry) return null
	return buildSignInner({
		taskId: task.taskId,
		aaAccount: task.aaAccount,
		createdAt: entry.signedAt,
		signerEoa: entry.signer,
		userOpHash: task.userOpHash,
		signature: entry.signature,
	})
}

export function buildProposeInnerExportFromTask(task: AaMultisigTaskLocal): AaMultisigProposeInner {
	const creatorSig = task.signatures.find(
		(s) => s.signer.toLowerCase() === task.creatorEoa.toLowerCase()
	)?.signature
	return buildProposeInner({
		taskId: task.taskId,
		aaAccount: task.aaAccount,
		createdAt: task.createdAt,
		kind: task.kind,
		creatorEoa: task.creatorEoa,
		threshold: task.threshold,
		managers: task.managers,
		entryPointNonce: task.entryPointNonce,
		userOpHash: task.userOpHash,
		packedUserOp: task.packedUserOp,
		toEoa: task.toEoa,
		amountUsdc6: task.amountUsdc6,
		transferAsset: task.transferAsset,
		amountRaw: task.amountRaw,
		newManagers: task.newManagers,
		newThreshold: task.newThreshold,
		title: task.title,
		memo: task.memo,
		creatorSignature: creatorSig,
	})
}

export async function copyAaMultisigInnerExport(inner: AaMultisigInner): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(serializeAaMultisigInnerForExport(inner))
		return true
	} catch {
		return false
	}
}

export function ingestAaMultisigFromExport(params: {
	payloadText: string
	walletEoa: string
}): { ok: true; task: AaMultisigTaskLocal } | { ok: false; error: string } {
	const inner = parseAaMultisigInnerFromExport(params.payloadText)
	if (!inner) {
		return { ok: false, error: 'Invalid multisig payload. Paste the full JSON export.' }
	}

	const fromEoa = resolveFromEoaForMultisigInner(inner)
	if (!fromEoa) {
		return { ok: false, error: 'Could not determine signer from payload.' }
	}

	const aaAccount = inner.aaAccount?.trim()
	if (!aaAccount) {
		return { ok: false, error: 'Payload missing Smart Wallet (AA) address.' }
	}

	const existing = getAaMultisigTask(params.walletEoa, aaAccount, inner.taskId)
	const merged = mergeInboundMultisigInner(existing, inner, fromEoa)
	if (!merged) {
		return {
			ok: false,
			error: existing
				? 'Payload could not be merged (duplicate, invalid signature, or stale task).'
				: 'Unknown task. Import a propose packet first, then sign packets.',
		}
	}

	upsertAaMultisigTask(params.walletEoa, aaAccount, merged)
	return { ok: true, task: merged }
}

setAaMultisigOutboundPruneFn((_walletEoa, _task) => {
	reconcileAaMultisigOutboundQueue(_walletEoa)
})
