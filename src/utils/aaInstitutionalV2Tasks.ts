/**
 * Read on-chain Institutional AA V2 tasks into local UI task shape.
 */
import { ethers } from 'ethers'
import { conetDepinProvider } from '@/utils/constants'
import {
	AA_V2_ACCOUNT_READ_ABI,
	isInstitutionalAaV2,
} from '@/utils/aaInstitutionalV2Eip712'
import type { AaMultisigTaskLocal, AaMultisigTaskStatus, AaMultisigTransferAssetId } from '@/utils/aaMultisigProtocol'
import { CONET_USDC, CONET_BUINT, CONET_GB_ERC20 } from '@/config/chainAddresses'
import { getAaMultisigTaskAny } from '@/utils/aaMultisigLocalStore'

/** TaskKind: None=0, Transfer=1, SetPolicy=2 */
/** TaskStatus: None=0, Pending=1, Executed=2, Cancelled=3, Expired=4 */

function mapOnChainStatus(status: number, approveCount: number, threshold: number): AaMultisigTaskStatus {
	switch (status) {
		case 1:
			return approveCount >= threshold ? 'ready' : 'pending'
		case 2:
			return 'completed'
		case 3:
			return 'rejected'
		case 4:
			return 'expired'
		default:
			return 'failed'
	}
}

function guessTransferAsset(token: string): AaMultisigTransferAssetId {
	const t = token.toLowerCase()
	if (t === ethers.ZeroAddress.toLowerCase()) return 'cnet'
	if (t === CONET_USDC.toLowerCase()) return 'usdc'
	if (t === CONET_GB_ERC20.toLowerCase()) return 'gb_paid'
	if (t === CONET_BUINT.toLowerCase()) return 'buint_paid'
	return 'usdc'
}

function emptyPackedUserOp(aa: string): AaMultisigTaskLocal['packedUserOp'] {
	return {
		sender: aa,
		nonce: '0',
		initCode: '0x',
		callData: '0x',
		accountGasLimits: ethers.ZeroHash,
		preVerificationGas: '0',
		gasFees: ethers.ZeroHash,
		paymasterAndData: '0x',
	}
}

export type OnChainAaV2Task = {
	taskId: bigint
	kind: number
	status: number
	proposer: string
	token: string
	to: string
	amount: bigint
	thresholdSnap: number
	approveCount: number
	rejectCount: number
	deadline: number
	managersSnap: string[]
}

export async function fetchAaV2OnChainTasks(
	aaAccount: string,
	provider: ethers.Provider = conetDepinProvider
): Promise<OnChainAaV2Task[]> {
	if (!(await isInstitutionalAaV2(aaAccount, provider))) return []
	const aa = new ethers.Contract(aaAccount, AA_V2_ACCOUNT_READ_ABI, provider)
	const nextId = (await aa.nextTaskId()) as bigint
	const out: OnChainAaV2Task[] = []
	for (let id = 1n; id <= nextId; id++) {
		try {
			const t = await aa.getTask(id)
			const kind = Number(t.kind ?? t[0])
			const status = Number(t.status ?? t[1])
			if (kind === 0 || status === 0) continue
			const managersSnap: string[] = Array.isArray(t.managersSnap)
				? t.managersSnap.map((m: string) => ethers.getAddress(m))
				: Array.isArray(t[11])
					? (t[11] as string[]).map((m) => ethers.getAddress(m))
					: []
			out.push({
				taskId: id,
				kind,
				status,
				proposer: ethers.getAddress(String(t.proposer ?? t[2])),
				token: ethers.getAddress(String(t.token ?? t[3])),
				to: ethers.getAddress(String(t.to ?? t[4])),
				amount: BigInt(t.amount ?? t[5]),
				thresholdSnap: Number(t.thresholdSnap ?? t[6]),
				approveCount: Number(t.approveCount ?? t[7]),
				rejectCount: Number(t.rejectCount ?? t[8]),
				deadline: Number(t.deadline ?? t[9]),
				managersSnap,
			})
		} catch {
			/* skip */
		}
	}
	return out
}

/** Vote: 0=None, 1=Approve, 2=Reject (matches Solidity enum). */
export async function readAaV2ManagerVotes(
	aaAccount: string,
	taskId: bigint,
	managers: string[],
	provider: ethers.Provider = conetDepinProvider
): Promise<Map<string, 0 | 1 | 2>> {
	const aa = new ethers.Contract(aaAccount, AA_V2_ACCOUNT_READ_ABI, provider)
	const map = new Map<string, 0 | 1 | 2>()
	for (const m of managers) {
		try {
			const v = Number((await aa.taskVote(taskId, m)) as bigint)
			map.set(m.toLowerCase(), v === 1 || v === 2 ? (v as 1 | 2) : 0)
		} catch {
			map.set(m.toLowerCase(), 0)
		}
	}
	return map
}

export function applyAaV2VotesToLocalTask(
	task: AaMultisigTaskLocal,
	votes: Map<string, 0 | 1 | 2>,
	now = Date.now()
): AaMultisigTaskLocal {
	const signatures: AaMultisigTaskLocal['signatures'] = []
	const rejects: AaMultisigTaskLocal['rejects'] = []
	for (const m of task.managers) {
		const v = votes.get(m.toLowerCase()) ?? 0
		if (v === 1) {
			signatures.push({ signer: m, signature: '0x', signedAt: now })
		} else if (v === 2) {
			rejects.push({ signer: m, rejectedAt: now, reason: 'On-chain reject' })
		}
	}
	return { ...task, signatures, rejects, updatedAt: now }
}

export function onChainAaV2TaskToLocal(
	aaAccount: string,
	row: OnChainAaV2Task,
	_viewerEoa: string
): AaMultisigTaskLocal {
	const aa = ethers.getAddress(aaAccount)
	const now = Date.now()
	const status = mapOnChainStatus(row.status, row.approveCount, row.thresholdSnap)
	const isTransfer = row.kind === 1
	// Placeholder counts until `readAaV2ManagerVotes` hydrates real voters.
	const signatures: AaMultisigTaskLocal['signatures'] = []
	for (let i = 0; i < row.approveCount; i++) {
		signatures.push({
			signer: row.managersSnap[i] ?? ethers.ZeroAddress,
			signature: '0x',
			signedAt: now,
		})
	}
	const rejects: AaMultisigTaskLocal['rejects'] = []
	for (let i = 0; i < row.rejectCount; i++) {
		rejects.push({
			signer: row.managersSnap[Math.max(0, row.managersSnap.length - 1 - i)] ?? ethers.ZeroAddress,
			rejectedAt: now,
			reason: 'On-chain reject',
		})
	}
	return {
		taskId: `v2-${aa.toLowerCase()}-${row.taskId.toString()}`,
		aaAccount: aa,
		creatorEoa: row.proposer,
		kind: isTransfer ? 'transfer' : 'set_policy',
		status,
		threshold: row.thresholdSnap,
		managers: row.managersSnap,
		entryPointNonce: '0',
		userOpHash: ethers.ZeroHash,
		packedUserOp: emptyPackedUserOp(aa),
		signatures,
		rejects,
		toEoa: isTransfer ? row.to : undefined,
		amountRaw: isTransfer ? row.amount.toString() : undefined,
		transferAsset: isTransfer ? guessTransferAsset(row.token) : undefined,
		amountUsdc6:
			isTransfer && guessTransferAsset(row.token) === 'usdc' ? row.amount.toString() : undefined,
		newThreshold: !isTransfer ? Number(row.amount) : undefined,
		title: isTransfer
			? `Transfer #${row.taskId.toString()}`
			: `Update signers #${row.taskId.toString()}`,
		createdAt: now,
		updatedAt: now,
		protocolVersion: 2,
		onChainTaskId: row.taskId.toString(),
	}
}

export function getOnChainTaskId(task: AaMultisigTaskLocal): string | null {
	const ext = task as AaMultisigTaskLocal & { onChainTaskId?: string; protocolVersion?: number }
	if (ext.protocolVersion === 2 && ext.onChainTaskId) return ext.onChainTaskId
	if (task.taskId.startsWith('v2-')) {
		const parts = task.taskId.split('-')
		return parts[parts.length - 1] ?? null
	}
	return null
}

export function isAaV2LocalTask(task: AaMultisigTaskLocal): boolean {
	const ext = task as AaMultisigTaskLocal & { protocolVersion?: number }
	return ext.protocolVersion === 2 || task.taskId.startsWith('v2-')
}

const AA_V2_TASK_EVENT_ABI = [
	'event TaskProposed(uint256 indexed taskId, uint8 kind, address indexed proposer)',
	'event TaskVoted(uint256 indexed taskId, address indexed voter, bool approve)',
	'event TaskExecuted(uint256 indexed taskId)',
] as const

function normalizeTxHash(h: string | null | undefined): string | undefined {
	const t = (h ?? '').trim().toLowerCase()
	return /^0x[0-9a-f]{64}$/.test(t) ? t : undefined
}

/** Preserve locally known tx hashes when on-chain sync rebuilds the task. */
export function mergeAaV2TaskExplorerMeta(
	prev: AaMultisigTaskLocal | null | undefined,
	next: AaMultisigTaskLocal
): AaMultisigTaskLocal {
	if (!prev) return next
	const prevSigTx = new Map<string, string>()
	for (const s of prev.signatures) {
		const h = normalizeTxHash(s.txHash)
		if (h) prevSigTx.set(s.signer.toLowerCase(), h)
	}
	return {
		...next,
		txHash: normalizeTxHash(next.txHash) ?? normalizeTxHash(prev.txHash),
		signatures: next.signatures.map((s) => ({
			...s,
			txHash: normalizeTxHash(s.txHash) ?? prevSigTx.get(s.signer.toLowerCase()),
		})),
	}
}

/**
 * Fill per-signer vote tx hashes + execute tx from AA TaskVoted / TaskExecuted logs.
 */
export async function enrichAaV2LocalTaskWithEventTxHashes(
	aaAccount: string,
	task: AaMultisigTaskLocal,
	provider: ethers.Provider = conetDepinProvider
): Promise<AaMultisigTaskLocal> {
	const onChainId = getOnChainTaskId(task)
	if (!onChainId) return task
	const taskId = BigInt(onChainId)
	const aa = new ethers.Contract(aaAccount, AA_V2_TASK_EVENT_ABI, provider)
	const voteTxBySigner = new Map<string, string>()
	let executeTx: string | undefined
	try {
		const voted = await aa.queryFilter(aa.filters.TaskVoted(taskId))
		for (const ev of voted) {
			const voter = ethers.getAddress(String((ev as ethers.EventLog).args?.voter ?? ''))
			const h = normalizeTxHash(ev.transactionHash)
			if (voter && h) voteTxBySigner.set(voter.toLowerCase(), h)
		}
	} catch {
		/* keep prior */
	}
	try {
		const executed = await aa.queryFilter(aa.filters.TaskExecuted(taskId))
		const last = executed[executed.length - 1]
		executeTx = last ? normalizeTxHash(last.transactionHash) : undefined
	} catch {
		/* keep prior */
	}
	// T=1: propose+vote+execute share one tx — also map proposer from TaskProposed.
	if (voteTxBySigner.size === 0 || !executeTx) {
		try {
			const proposed = await aa.queryFilter(aa.filters.TaskProposed(taskId))
			const first = proposed[0]
			const h = first ? normalizeTxHash(first.transactionHash) : undefined
			const proposer = first
				? ethers.getAddress(String((first as ethers.EventLog).args?.proposer ?? ''))
				: ''
			if (h && proposer) {
				if (!voteTxBySigner.has(proposer.toLowerCase())) {
					voteTxBySigner.set(proposer.toLowerCase(), h)
				}
				if (!executeTx && task.status === 'completed') executeTx = h
			}
		} catch {
			/* ignore */
		}
	}
	const signatures = task.signatures.map((s) => ({
		...s,
		txHash: normalizeTxHash(s.txHash) ?? voteTxBySigner.get(s.signer.toLowerCase()),
	}))
	return {
		...task,
		txHash: normalizeTxHash(task.txHash) ?? executeTx,
		signatures,
	}
}

export async function syncAaV2TasksIntoLocal(
	eoa: string,
	aaAccount: string,
	upsert: (eoa: string, task: AaMultisigTaskLocal) => void,
	provider: ethers.Provider = conetDepinProvider
): Promise<number> {
	const rows = await fetchAaV2OnChainTasks(aaAccount, provider)
	const now = Date.now()
	for (const row of rows) {
		let local = onChainAaV2TaskToLocal(aaAccount, row, eoa)
		if (row.status === 1 || row.status === 2 || row.status === 3) {
			try {
				const votes = await readAaV2ManagerVotes(aaAccount, row.taskId, row.managersSnap, provider)
				local = applyAaV2VotesToLocalTask(local, votes, now)
			} catch {
				/* keep count-based placeholders */
			}
		}
		try {
			local = await enrichAaV2LocalTaskWithEventTxHashes(aaAccount, local, provider)
		} catch {
			/* explorer meta optional */
		}
		const prev = getAaMultisigTaskAny(eoa, local.taskId)
		upsert(eoa, mergeAaV2TaskExplorerMeta(prev, local))
	}
	return rows.length
}
