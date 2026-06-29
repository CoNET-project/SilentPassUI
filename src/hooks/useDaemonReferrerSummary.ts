import { useDaemonContext } from '@/providers/DaemonProvider'
import type { ReferrerDashboardSummary } from '@/services/validatorWalletNodeProfile'

/**
 * 用户 Genesis Node 推荐进度（ValidatorDepositRedeem referrer extension）— 只读 DaemonProvider 全局喂料。
 * 本地优先 + daemon 每 6s 后台 RPC 刷新。
 */
export function useDaemonReferrerSummary(): {
	summary: ReferrerDashboardSummary | null
} {
	const { referrerSummary } = useDaemonContext()
	return { summary: referrerSummary }
}
