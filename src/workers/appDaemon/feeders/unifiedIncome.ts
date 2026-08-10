/**
 * Unified Income stats — Worker RPC via shared service (no secrets).
 * Daemon path: skipClientSideAssemble to avoid OOG RPC storms.
 */

import { fetchUnifiedIncomeStats } from '../../../services/validatorWalletNodeProfile'

export async function fetchWorkerUnifiedIncomeStats(
	walletAddress: string,
): Promise<{ ok: true; stats: unknown } | { ok: false }> {
	const res = await fetchUnifiedIncomeStats(walletAddress, 0, {
		skipClientSideAssemble: true,
	}).catch(() => ({ ok: false as const }))
	if (!res.ok) return { ok: false }
	return { ok: true, stats: res.stats }
}
