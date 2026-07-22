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
		upsert(eoa, local)
	}
	return rows.length
}
