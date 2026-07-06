import { ethers } from 'ethers'
import type { AaMultisigTaskLocal } from '@/utils/aaMultisigProtocol'
import { listAaMultisigStorageAaAccounts } from '@/utils/aaMultisigLocalStore'
import { readAaThresholdPolicy, type AaThresholdPolicy } from '@/utils/aaMultisigUserOp'

export type AaMultisigTransferEligibleWallet = {
	aaAccount: string
	policy: AaThresholdPolicy
	/** Profile / factory-resolved Smart Wallet for the viewer EOA. */
	isOwnAa: boolean
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
