/**
 * Unified Income stats — Worker RPC via shared service (no secrets).
 * Posts serializable UnifiedIncomeStats for main-thread mirror + cache.
 */

import { fetchUnifiedIncomeStats } from '../../../services/validatorWalletNodeProfile'

export async function fetchWorkerUnifiedIncomeStats(
	walletAddress: string,
): Promise<{ ok: true; stats: unknown } | { ok: false }> {
	const res = await fetchUnifiedIncomeStats(walletAddress, 0).catch(() => ({ ok: false as const }))
	if (!res.ok) return { ok: false }
	return { ok: true, stats: res.stats }
}
