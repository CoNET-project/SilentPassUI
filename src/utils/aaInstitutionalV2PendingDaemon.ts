/**
 * Institutional AA V2 — daemon pull of on-chain pending tasks for co-signers.
 * Proposer offline-signs EIP-712 → Proxy relays on-chain; co-signers discover via this feed.
 * See: beamio-aa-account-dev.mdc, beamio-app-dashboard-daemon-local-first.mdc
 */
import { ethers } from 'ethers'
import { conetDepinProvider } from '@/utils/constants'
import { BEAMIO_AA_FACTORY_V2 } from '@/config/chainAddresses'
import { isInstitutionalAaV2 } from '@/utils/aaInstitutionalV2Eip712'
import {
	applyAaV2VotesToLocalTask,
	fetchAaV2OnChainTasks,
	onChainAaV2TaskToLocal,
	readAaV2ManagerVotes,
	type OnChainAaV2Task,
} from '@/utils/aaInstitutionalV2Tasks'
import {
	AA_MULTISIG_TASKS_CHANGED_EVENT,
	getAaMultisigTaskAny,
	listAaMultisigStorageAaAccounts,
	loadAllAaMultisigTasksForWallet,
	upsertAaMultisigTaskRecord,
} from '@/utils/aaMultisigLocalStore'
import { loadInstitutionalManageableWalletsLocal } from '@/utils/institutionalManageableWalletsLocalCache'
import { listOwnInstitutionalAa } from '@/utils/institutionalAaAccounts'
import { viewerNeedsToSignMultisigTask } from '@/utils/aaMultisigTaskUi'

export const AA_V2_PENDING_TASKS_FEED_INTERVAL_MS = 15_000

export type AaV2PendingDaemonResult = {
	ok: true
	aaScanned: number
	tasksUpserted: number
	pendingNeedVote: number
}

export type AaV2PendingDaemonFailure = {
	ok: false
	error: string
}

async function collectInstitutionalAaCandidates(
	viewerEoa: string,
	provider: ethers.Provider
): Promise<string[]> {
	const viewer = ethers.getAddress(viewerEoa)
	const seen = new Set<string>()
	const out: string[] = []

	const add = (raw: string) => {
		if (!ethers.isAddress(raw)) return
		const a = ethers.getAddress(raw)
		const k = a.toLowerCase()
		if (seen.has(k)) return
		seen.add(k)
		out.push(a)
	}

	for (const w of loadInstitutionalManageableWalletsLocal(viewer)) {
		add(w.aaAccount)
	}
	for (const aa of listAaMultisigStorageAaAccounts(viewer)) {
		add(aa)
	}

	try {
		const own = await listOwnInstitutionalAa(provider, viewer, BEAMIO_AA_FACTORY_V2)
		for (const row of own) add(row.aa)
	} catch {
		/* untrusted — keep local candidates */
	}

	return out
}

/**
 * Pull on-chain V2 tasks for every institutional AA the viewer can manage,
 * upsert into local multisig store (EOA-partitioned). Trusted success only writes.
 */
export async function runAaInstitutionalV2PendingTasksDaemonTick(
	viewerEoa: string,
	provider: ethers.Provider = conetDepinProvider
): Promise<AaV2PendingDaemonResult | AaV2PendingDaemonFailure> {
	if (!ethers.isAddress(viewerEoa)) {
		return { ok: false, error: 'Invalid viewer EOA' }
	}
	const viewer = ethers.getAddress(viewerEoa)
	const now = Date.now()
	let aaScanned = 0
	let tasksUpserted = 0

	try {
		const candidates = await collectInstitutionalAaCandidates(viewer, provider)
		for (const aaAccount of candidates) {
			let isV2 = false
			try {
				isV2 = await isInstitutionalAaV2(aaAccount, provider)
			} catch {
				continue
			}
			if (!isV2) continue

			aaScanned += 1
			let rows: OnChainAaV2Task[] = []
			try {
				rows = await fetchAaV2OnChainTasks(aaAccount, provider)
			} catch {
				continue
			}

			for (const row of rows) {
				const isManager = row.managersSnap.some((m) => m.toLowerCase() === viewer.toLowerCase())
				if (!isManager) continue

				let local = onChainAaV2TaskToLocal(aaAccount, row, viewer)
				const existing = getAaMultisigTaskAny(viewer, local.taskId)
				if (existing?.createdAt) {
					local = { ...local, createdAt: existing.createdAt }
				}

				if (row.status === 1 || row.status === 2 || row.status === 3) {
					try {
						const votes = await readAaV2ManagerVotes(
							aaAccount,
							row.taskId,
							row.managersSnap,
							provider
						)
						local = applyAaV2VotesToLocalTask(local, votes, now)
					} catch {
						/* keep count-based placeholders */
					}
				}

				upsertAaMultisigTaskRecord(viewer, local)
				tasksUpserted += 1
			}
		}

		try {
			window.dispatchEvent(new CustomEvent(AA_MULTISIG_TASKS_CHANGED_EVENT))
		} catch {
			/* ignore */
		}

		const pendingNeedVote = loadAllAaMultisigTasksForWallet(viewer).filter((t) =>
			viewerNeedsToSignMultisigTask(t, viewer)
		).length

		return { ok: true, aaScanned, tasksUpserted, pendingNeedVote }
	} catch (e: unknown) {
		return {
			ok: false,
			error: e instanceof Error ? e.message : String(e),
		}
	}
}
