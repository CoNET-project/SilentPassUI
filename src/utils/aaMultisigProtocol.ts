/**
 * AA Smart Wallet multisig over CoNET decentralized chat.
 * Type: `beamio_aa_multisig_v1` — local-first task store + gossip sync; offline sign/import supported.
 */

import { ethers } from 'ethers'

export const BEAMIO_AA_MULTISIG_TYPE = 'beamio_aa_multisig_v1' as const

export type AaMultisigAction = 'propose' | 'sign' | 'reject' | 'submitted'

export type AaMultisigTaskKind = 'transfer' | 'set_policy' | 'cancel'

/** CoNET / Base Smart Wallet transfer asset (local + gossip). */
export type AaMultisigTransferAssetId =
	| 'cnet'
	| 'usdc'
	| 'gb_paid'
	| 'buint_paid'
	| 'base_eth'
	| 'base_usdc'

export type AaMultisigTaskStatus =
	| 'pending'
	| 'ready'
	| 'submitted'
	| 'completed'
	| 'rejected'
	| 'failed'
	| 'expired'

/** Task no longer needs gossip / offline sync for co-signers. */
export const AA_MULTISIG_TERMINAL_TASK_STATUSES: readonly AaMultisigTaskStatus[] = [
	'submitted',
	'completed',
	'rejected',
	'failed',
	'expired',
]

export function isAaMultisigTaskTerminalStatus(status: AaMultisigTaskStatus): boolean {
	return (AA_MULTISIG_TERMINAL_TASK_STATUSES as readonly string[]).includes(status)
}

export type AaMultisigSignatureEntry = {
	signer: string
	signature: string
	signedAt: number
	/** CoNET relay / vote tx hash when known (explorer `/tx/`). */
	txHash?: string
}

export type AaMultisigRejectEntry = {
	signer: string
	reason?: string
	rejectedAt: number
}

/** Packed UserOp fields (JSON-serializable) */
export type AaMultisigPackedUserOp = {
	sender: string
	nonce: string
	initCode: string
	callData: string
	accountGasLimits: string
	preVerificationGas: string
	gasFees: string
	paymasterAndData: string
	signature?: string
}

export type AaMultisigTaskLocal = {
	taskId: string
	aaAccount: string
	creatorEoa: string
	kind: AaMultisigTaskKind
	status: AaMultisigTaskStatus
	threshold: number
	managers: string[]
	entryPointNonce: string
	userOpHash: string
	packedUserOp: AaMultisigPackedUserOp
	signatures: AaMultisigSignatureEntry[]
	rejects: AaMultisigRejectEntry[]
	toEoa?: string
	amountUsdc6?: string
	transferAsset?: AaMultisigTransferAssetId
	amountRaw?: string
	newManagers?: string[]
	newThreshold?: number
	title?: string
	memo?: string
	txHash?: string
	createdAt: number
	updatedAt: number
	/** 2 = on-chain Institutional V2 task (EIP-712); omit / 1 = legacy UserOp path */
	protocolVersion?: 1 | 2
	/** On-chain task id when protocolVersion === 2 */
	onChainTaskId?: string
}

export type AaMultisigInnerBase = {
	type: typeof BEAMIO_AA_MULTISIG_TYPE
	action: AaMultisigAction
	taskId: string
	aaAccount: string
	sendId: string
	createdAt: number
}

export type AaMultisigProposeInner = AaMultisigInnerBase & {
	action: 'propose'
	kind: AaMultisigTaskKind
	creatorEoa: string
	threshold: number
	managers: string[]
	entryPointNonce: string
	userOpHash: string
	packedUserOp: AaMultisigPackedUserOp
	toEoa?: string
	amountUsdc6?: string
	transferAsset?: AaMultisigTransferAssetId
	amountRaw?: string
	newManagers?: string[]
	newThreshold?: number
	title?: string
	memo?: string
	/** Optional first signature from creator */
	creatorSignature?: string
}

export type AaMultisigSignInner = AaMultisigInnerBase & {
	action: 'sign'
	signerEoa: string
	userOpHash: string
	signature: string
}

export type AaMultisigRejectInner = AaMultisigInnerBase & {
	action: 'reject'
	signerEoa: string
	reason?: string
}

export type AaMultisigSubmittedInner = AaMultisigInnerBase & {
	action: 'submitted'
	submitterEoa: string
	txHash: string
}

export type AaMultisigInner =
	| AaMultisigProposeInner
	| AaMultisigSignInner
	| AaMultisigRejectInner
	| AaMultisigSubmittedInner

function normEoa(a: string | undefined | null): string {
	const t = (a ?? '').trim().toLowerCase()
	return t.startsWith('0x') && t.length === 42 ? t : ''
}

/**
 * @deprecated V1-only. Institutional `/wallet/aa-multisig` uses `buildManagersOwnerFirst`.
 * Kept only so accidental imports fail with a clear message instead of silent wrong order.
 */
export function sortManagersStrict(_owner: string, _others: string[]): never {
	throw new Error(
		'sortManagersStrict is V1-only and removed from institutional Smart Wallet flows. Use buildManagersOwnerFirst.'
	)
}

/**
 * Institutional V2: `managers[0] == owner`; remaining co-signers unique + ascending.
 * Owner address may be higher or lower than co-signers (not the V1 “lowest address” rule).
 */
export function buildManagersOwnerFirst(owner: string, others: string[]): string[] {
	const ownerAddr = ethers.getAddress(owner)
	const rest = new Set<string>()
	for (const raw of others) {
		if (!ethers.isAddress(raw)) continue
		const addr = ethers.getAddress(raw)
		if (addr.toLowerCase() === ownerAddr.toLowerCase()) continue
		rest.add(addr)
	}
	const sortedRest = [...rest].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
	return [ownerAddr, ...sortedRest]
}

export function concatMultisigSignatures(entries: AaMultisigSignatureEntry[]): string {
	const sorted = [...entries].sort((a, b) =>
		a.signer.toLowerCase().localeCompare(b.signer.toLowerCase())
	)
	let hex = '0x'
	for (const row of sorted) {
		const sig = row.signature.startsWith('0x') ? row.signature.slice(2) : row.signature
		if (sig.length !== 130) throw new Error('Each multisig signature must be 65 bytes')
		hex += sig
	}
	return hex
}

/** Unwrap gossip/chat layers to inner multisig JSON (same pattern as POS permission). */
export function parseAaMultisigInnerFromChatDisplayText(displayText: string): AaMultisigInner | null {
	try {
		let trimmed = (displayText ?? '').trim()
		if (!trimmed.startsWith('{')) return null
		let obj: Record<string, unknown> = JSON.parse(trimmed) as Record<string, unknown>
		for (let hop = 0; hop < 8; hop++) {
			if (obj?.type === BEAMIO_AA_MULTISIG_TYPE && typeof obj.action === 'string') {
				return obj as unknown as AaMultisigInner
			}
			const nested = obj?.text
			if (typeof nested !== 'string') return null
			const next = nested.trim()
			if (!next.startsWith('{')) return null
			obj = JSON.parse(next) as Record<string, unknown>
		}
		return null
	} catch {
		return null
	}
}

/** Parse exported JSON (inner or chat outer line) for offline import. */
export function parseAaMultisigInnerFromExport(text: string): AaMultisigInner | null {
	const trimmed = (text ?? '').trim()
	if (!trimmed) return null
	try {
		const obj = JSON.parse(trimmed) as Record<string, unknown>
		if (obj?.type === BEAMIO_AA_MULTISIG_TYPE && typeof obj.action === 'string') {
			return obj as unknown as AaMultisigInner
		}
		if (typeof obj.text === 'string') {
			const fromOuter = parseAaMultisigInnerFromChatDisplayText(trimmed)
			if (fromOuter) return fromOuter
		}
	} catch {
		/* fall through */
	}
	return parseAaMultisigInnerFromChatDisplayText(trimmed)
}

export function serializeAaMultisigInnerForExport(inner: AaMultisigInner): string {
	return JSON.stringify(inner, null, 2)
}

export function resolveFromEoaForMultisigInner(inner: AaMultisigInner): string | null {
	switch (inner.action) {
		case 'propose':
			return normEoa(inner.creatorEoa)
		case 'sign':
			return normEoa(inner.signerEoa)
		case 'reject':
			return normEoa(inner.signerEoa)
		case 'submitted':
			return normEoa(inner.submitterEoa)
		default:
			return null
	}
}

export function buildAaMultisigChatOuterLine(inner: AaMultisigInner): string {
	return JSON.stringify({
		sendId: inner.sendId,
		from: 'me',
		text: JSON.stringify(inner),
		createdAt: inner.createdAt,
	})
}

export function verifyUserOpSignature(signerEoa: string, userOpHash: string, signature: string): boolean {
	try {
		const hashBytes = ethers.getBytes(userOpHash)
		const recovered = ethers.verifyMessage(hashBytes, signature)
		return recovered.toLowerCase() === signerEoa.toLowerCase()
	} catch {
		return false
	}
}

function recomputeStatus(task: AaMultisigTaskLocal): AaMultisigTaskStatus {
	if (
		task.status === 'rejected' ||
		task.status === 'completed' ||
		task.status === 'failed' ||
		task.status === 'expired'
	) {
		return task.status
	}
	if (task.txHash) return 'completed'
	if (task.rejects.length > 0) return 'rejected'
	if (task.signatures.length >= task.threshold) return 'ready'
	return 'pending'
}

/** True when policy is 1-of-1 and the only manager is the current wallet EOA. */
export function isSoleSelfSignerMultisig(
	walletEoa: string,
	managers: string[],
	threshold: number
): boolean {
	if (threshold !== 1 || managers.length !== 1) return false
	const w = normEoa(walletEoa)
	const m = normEoa(managers[0])
	return Boolean(w && m && w === m)
}

export function mergeInboundMultisigInner(
	existing: AaMultisigTaskLocal | null,
	inner: AaMultisigInner,
	fromEoa: string
): AaMultisigTaskLocal | null {
	const from = normEoa(fromEoa)
	if (!from) return existing

	if (inner.action === 'propose') {
		const managers = inner.managers.map((m) => ethers.getAddress(m))
		if (!managers.some((m) => m.toLowerCase() === from)) return existing
		const sigs: AaMultisigSignatureEntry[] = []
		if (inner.creatorSignature && verifyUserOpSignature(from, inner.userOpHash, inner.creatorSignature)) {
			sigs.push({ signer: from, signature: inner.creatorSignature, signedAt: inner.createdAt })
		}
		const task: AaMultisigTaskLocal = {
			taskId: inner.taskId,
			aaAccount: ethers.getAddress(inner.aaAccount),
			creatorEoa: ethers.getAddress(inner.creatorEoa),
			kind: inner.kind,
			status: 'pending',
			threshold: inner.threshold,
			managers,
			entryPointNonce: String(inner.entryPointNonce),
			userOpHash: inner.userOpHash,
			packedUserOp: inner.packedUserOp,
			signatures: sigs,
			rejects: [],
			toEoa: inner.toEoa ? ethers.getAddress(inner.toEoa) : undefined,
			amountUsdc6: inner.amountUsdc6,
			transferAsset: inner.transferAsset,
			amountRaw: inner.amountRaw,
			newManagers: inner.newManagers?.map((m) => ethers.getAddress(m)),
			newThreshold: inner.newThreshold,
			title: inner.title,
			memo: inner.memo,
			createdAt: inner.createdAt,
			updatedAt: inner.createdAt,
		}
		task.status = recomputeStatus(task)
		if (existing && existing.updatedAt > task.updatedAt) return existing
		return task
	}

	if (!existing) return null
	if (existing.taskId !== inner.taskId) return existing
	if (ethers.getAddress(inner.aaAccount).toLowerCase() !== existing.aaAccount.toLowerCase()) return existing

	if (inner.action === 'sign') {
		const signer = normEoa(inner.signerEoa)
		if (!signer || signer !== from) return existing
		if (inner.userOpHash.toLowerCase() !== existing.userOpHash.toLowerCase()) return existing
		if (!existing.managers.some((m) => m.toLowerCase() === signer)) return existing
		if (!verifyUserOpSignature(signer, existing.userOpHash, inner.signature)) return existing
		if (existing.signatures.some((s) => s.signer.toLowerCase() === signer)) return existing
		if (existing.rejects.some((r) => r.signer.toLowerCase() === signer)) return existing
		const next: AaMultisigTaskLocal = {
			...existing,
			signatures: [
				...existing.signatures,
				{ signer, signature: inner.signature, signedAt: inner.createdAt },
			],
			updatedAt: Math.max(existing.updatedAt, inner.createdAt),
		}
		next.status = recomputeStatus(next)
		return next
	}

	if (inner.action === 'reject') {
		const signer = normEoa(inner.signerEoa)
		if (!signer || signer !== from) return existing
		if (!existing.managers.some((m) => m.toLowerCase() === signer)) return existing
		if (existing.rejects.some((r) => r.signer.toLowerCase() === signer)) return existing
		const next: AaMultisigTaskLocal = {
			...existing,
			rejects: [...existing.rejects, { signer, reason: inner.reason, rejectedAt: inner.createdAt }],
			status: 'rejected',
			updatedAt: Math.max(existing.updatedAt, inner.createdAt),
		}
		return next
	}

	if (inner.action === 'submitted') {
		const submitter = normEoa(inner.submitterEoa)
		if (!submitter || submitter !== from) return existing
		if (!/^0x[0-9a-fA-F]{64}$/.test(inner.txHash.trim())) return existing
		return {
			...existing,
			txHash: inner.txHash.toLowerCase(),
			status: 'completed',
			updatedAt: Math.max(existing.updatedAt, inner.createdAt),
		}
	}

	return existing
}
