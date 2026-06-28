import { useDaemonContext } from '@/providers/DaemonProvider'
import type { ValidatorWalletNodeProfile } from '@/services/validatorWalletNodeProfile'

/**
 * 用户 CoNET 验证节点 / DePIN 节点档案 — 只读 DaemonProvider 全局喂料结果。
 * 本地优先 + daemon 每 6s 后台 RPC 刷新（与 conetWalletBalances 同轨）。
 */
export function useDaemonValidatorWalletNodeProfile(): {
	profile: ValidatorWalletNodeProfile | null
} {
	const { validatorWalletNodeProfile } = useDaemonContext()
	return { profile: validatorWalletNodeProfile }
}
