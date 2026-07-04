import {
	parseAaMultisigInnerFromExport,
	resolveFromEoaForMultisigInner,
	serializeAaMultisigInnerForExport,
	mergeInboundMultisigInner,
	type AaMultisigInner,
	type AaMultisigSignInner,
	type AaMultisigProposeInner,
	type AaMultisigTaskLocal,
} from '@/utils/aaMultisigProtocol'
import {
	AA_MULTISIG_TASKS_CHANGED_EVENT,
	getAaMultisigTask,
	upsertAaMultisigTask,
} from '@/utils/aaMultisigLocalStore'
import { broadcastAaMultisigInner, buildSignInner, buildProposeInner } from '@/services/aaMultisigGossip'
import {
	isPaidOfflineSignInner,
	postAaMultisigOfflineSignSubmit,
} from '@/services/aaMultisigOfflineSubmitApi'

export const AA_MULTISIG_OUTBOUND_CHANGED_EVENT = 'beamio-aa-multisig-outbound-changed'

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

export function removeAaMultisigOutboundByDedupe(walletEoa: string, inner: AaMultisigInner): void {
	const dedupe = outboundDedupeKey({ inner })
	const next = loadAaMultisigOutboundQueue(walletEoa).filter(
		(row) => outboundDedupeKey(row) !== dedupe
	)
	saveAaMultisigOutboundQueue(walletEoa, next)
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
		return { mode: 'broadcast', sent, failed }
	}

	enqueueAaMultisigOutbound({
		walletEoa: params.walletEoa,
		recipients: params.recipients,
		inner: params.inner,
	})
	return { mode: 'queued', sent: 0, failed }
}

let flushInFlight: Promise<{ sent: number; failed: number; remaining: number }> | null = null

/** Retry queued gossip when CoNET chat nodes are available. */
export async function flushAaMultisigOutboundQueue(params: {
	walletEoa: string
	privateKeyArmor: string
	allNodes: nodeInfo[]
}): Promise<{ sent: number; failed: number; remaining: number }> {
	if (flushInFlight) return flushInFlight
	if (!params.allNodes?.length || !params.privateKeyArmor) {
		return { sent: 0, failed: 0, remaining: countAaMultisigOutboundPending(params.walletEoa) }
	}

	flushInFlight = (async () => {
		let sent = 0
		let failed = 0
		const queue = loadAaMultisigOutboundQueue(params.walletEoa)
		const remaining: AaMultisigOutboundItem[] = []

		for (const row of queue) {
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
		if (sent > 0) {
			window.dispatchEvent(new CustomEvent(AA_MULTISIG_TASKS_CHANGED_EVENT))
		}
		return { sent, failed, remaining: remaining.length }
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
