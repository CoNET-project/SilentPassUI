import { useDaemonContext } from '@/providers/DaemonProvider'
import type { UnifiedIncomeStats } from '@/services/validatorWalletNodeProfile'

/**
 * 用户 CoNET Mining 收益（GB/CNET cumulative + 每节点明细）— 只读 DaemonProvider 全局喂料。
 * 本地优先 + daemon 每 6s 后台 RPC 刷新。
 */
export function useDaemonUnifiedIncomeStats(): {
	stats: UnifiedIncomeStats | null
} {
	const { unifiedIncomeStats } = useDaemonContext()
	return { stats: unifiedIncomeStats }
}
