import { ethers } from 'ethers'
import type { AaMultisigTaskLocal } from '@/utils/aaMultisigProtocol'
import { listAaMultisigStorageAaAccounts } from '@/utils/aaMultisigLocalStore'
import { readAaThresholdPolicy, type AaThresholdPolicy } from '@/utils/aaMultisigUserOp'
import { listOwnInstitutionalAa, resolveBeamioTagForAddress, listComanagedInstitutionalAa } from '@/utils/institutionalAaAccounts'
import { BEAMIO_AA_FACTORY_V2 } from '@/config/chainAddresses'
import { isInstitutionalAaV2 } from '@/utils/aaInstitutionalV2Eip712'

export type AaMultisigTransferEligibleWallet = {
	aaAccount: string
	policy: AaThresholdPolicy
	/** Profile / factory-resolved Smart Wallet for the viewer EOA. */
	isOwnAa: boolean
	lastActivityAt: number
}

export type InstitutionalManageableWallet = {
	aaAccount: string
	kind: 'own_institutional' | 'comanaged'
	index?: number
	/** BeamioTag bound to this AA (AccountRegistry), if any. */
	accountName?: string
	policy: AaThresholdPolicy
	lastActivityAt: number
}

/** Candidate AA addresses before on-chain manager verification. */
export function collectTransferAaAccountCandidates(
	viewerEoa: string,
	ownAaAccount: string,
	tasks: AaMultisigTaskLocal[]
): string[] {
	const viewer = viewerEoa.trim().toLowerCase()
	if (!viewer.startsWith('0x') || viewer.length !== 42) return []

	const seen = new Set<string>()
	const out: string[] = []
	const push = (raw: string) => {
		const trimmed = raw?.trim()
		if (!trimmed || !ethers.isAddress(trimmed)) return
		const aa = ethers.getAddress(trimmed)
		const key = aa.toLowerCase()
		if (seen.has(key)) return
		seen.add(key)
		out.push(aa)
	}

	push(ownAaAccount)
	for (const aa of listAaMultisigStorageAaAccounts(viewerEoa)) push(aa)
	for (const t of tasks) {
		if (t.managers.some((m) => m.toLowerCase() === viewer)) push(t.aaAccount)
	}
	return out
}

/** Smart Wallets on CoNET where the viewer EOA is a threshold manager (can propose transfers). */
export async function discoverAaMultisigTransferEligibleWallets(
	provider: ethers.Provider,
	viewerEoa: string,
	candidates: string[],
	opts?: { ownAaAccount?: string; tasks?: AaMultisigTaskLocal[]; fallbackEoa?: string }
): Promise<AaMultisigTransferEligibleWallet[]> {
	const viewer = viewerEoa.trim().toLowerCase()
	if (!viewer.startsWith('0x') || viewer.length !== 42) return []

	const ownLower = opts?.ownAaAccount?.trim().toLowerCase()
	const activityByAa = new Map<string, number>()
	for (const t of opts?.tasks ?? []) {
		const key = t.aaAccount.toLowerCase()
		const at = Math.max(t.updatedAt, t.createdAt)
		activityByAa.set(key, Math.max(activityByAa.get(key) ?? 0, at))
	}

	const eligible: AaMultisigTransferEligibleWallet[] = []
	for (const raw of candidates) {
		if (!raw?.trim() || !ethers.isAddress(raw)) continue
		try {
			const aaAccount = ethers.getAddress(raw)
			const policy = await readAaThresholdPolicy(provider, aaAccount, {
				fallbackEoa: opts?.fallbackEoa ?? viewerEoa,
			})
			if (!policy.managers.some((m) => m.toLowerCase() === viewer)) continue
			eligible.push({
				aaAccount,
				policy,
				isOwnAa: ownLower === aaAccount.toLowerCase(),
				lastActivityAt: activityByAa.get(aaAccount.toLowerCase()) ?? 0,
			})
		} catch {
			/* undeployed or unreadable — skip */
		}
	}

	eligible.sort((a, b) => {
		if (a.isOwnAa !== b.isOwnAa) return a.isOwnAa ? -1 : 1
		return b.lastActivityAt - a.lastActivityAt
	})
	return eligible
}

/**
 * Institutional AA Multisig list: own V2 Factory AAs ∪ V2 AAs where viewer is a manager.
 * Excludes personal Express Pay (V1 index=0) and abandoned V1 institutional AAs.
 */
export async function discoverInstitutionalManageableWallets(
	provider: ethers.Provider,
	viewerEoa: string,
	opts?: {
		/** Personal Express Pay AA (V1 index=0) — excluded from the list. */
		primaryAaAccount?: string
		tasks?: AaMultisigTaskLocal[]
		factoryAddress?: string
		fallbackEoa?: string
	}
): Promise<InstitutionalManageableWallet[]> {
	const viewer = viewerEoa.trim().toLowerCase()
	if (!viewer.startsWith('0x') || viewer.length !== 42) return []

	const primaryLower = opts?.primaryAaAccount?.trim().toLowerCase()
	const exclude = new Set<string>()
	if (primaryLower?.startsWith('0x') && primaryLower.length === 42) {
		exclude.add(primaryLower)
	}

	const activityByAa = new Map<string, number>()
	for (const t of opts?.tasks ?? []) {
		const key = t.aaAccount.toLowerCase()
		const at = Math.max(t.updatedAt, t.createdAt)
		activityByAa.set(key, Math.max(activityByAa.get(key) ?? 0, at))
	}

	const byAa = new Map<string, InstitutionalManageableWallet>()
	const factory = opts?.factoryAddress ?? BEAMIO_AA_FACTORY_V2

	const ownInstitutional = await listOwnInstitutionalAa(provider, viewerEoa, factory).catch(
		() => [] as Awaited<ReturnType<typeof listOwnInstitutionalAa>>
	)

	for (const row of ownInstitutional) {
		const key = row.aa.toLowerCase()
		if (exclude.has(key)) continue
		try {
			const policy = await readAaThresholdPolicy(provider, row.aa, {
				fallbackEoa: opts?.fallbackEoa ?? viewerEoa,
			})
			byAa.set(key, {
				aaAccount: row.aa,
				kind: 'own_institutional',
				index: row.index,
				accountName: row.accountName,
				policy,
				lastActivityAt: activityByAa.get(key) ?? 0,
			})
		} catch {
			/* skip unreadable */
		}
	}

	// Factory reverse index: AAs where viewer is co-signer (not creator enumeration).
	const comanaged = await listComanagedInstitutionalAa(provider, viewerEoa, factory).catch(
		() => [] as Awaited<ReturnType<typeof listComanagedInstitutionalAa>>
	)
	for (const row of comanaged) {
		const key = row.aa.toLowerCase()
		if (exclude.has(key)) continue
		if (byAa.has(key)) continue
		try {
			const policy = await readAaThresholdPolicy(provider, row.aa, {
				fallbackEoa: opts?.fallbackEoa ?? viewerEoa,
			})
			if (!policy.managers.some((m) => m.toLowerCase() === viewer)) continue
			byAa.set(key, {
				aaAccount: row.aa,
				kind: 'comanaged',
				accountName: row.accountName,
				policy,
				lastActivityAt: activityByAa.get(key) ?? 0,
			})
		} catch {
			/* skip */
		}
	}

	const candidates = collectTransferAaAccountCandidates(
		viewerEoa,
		opts?.primaryAaAccount ?? '',
		opts?.tasks ?? []
	)
	for (const raw of candidates) {
		const key = raw.toLowerCase()
		if (exclude.has(key)) continue
		if (byAa.has(key)) continue
		try {
			const aaAccount = ethers.getAddress(raw)
			if (!(await isInstitutionalAaV2(aaAccount, provider))) continue
			const policy = await readAaThresholdPolicy(provider, aaAccount, {
				fallbackEoa: opts?.fallbackEoa ?? viewerEoa,
			})
			if (!policy.managers.some((m) => m.toLowerCase() === viewer)) continue
			byAa.set(key, {
				aaAccount,
				kind: 'comanaged',
				accountName: (await resolveBeamioTagForAddress(aaAccount, provider)) || undefined,
				policy,
				lastActivityAt: activityByAa.get(key) ?? 0,
			})
		} catch {
			/* skip */
		}
	}

	const list = [...byAa.values()]
	list.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === 'own_institutional' ? -1 : 1
		if (a.kind === 'own_institutional' && b.kind === 'own_institutional') {
			return (a.index ?? 0) - (b.index ?? 0)
		}
		return b.lastActivityAt - a.lastActivityAt
	})
	return list
}
