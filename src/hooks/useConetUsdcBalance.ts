import { useDaemonContext } from '@/providers/DaemonProvider'
import type { ConetWalletBalances } from '@/services/conetUsdcBalance'
import { EMPTY_CONET_WALLET_BALANCES } from '@/utils/conetWalletBalancesLocalCache'

/**
 * CoNET 链 USDC / CNET / GB — 只读 DaemonProvider 全局喂料结果。
 * 本地优先 + daemon 每 6s 后台 RPC 刷新（见 DaemonProvider / conetWalletBalancesLocalCache）。
 */
export function useConetWalletBalances(_eoaAddress?: string): {
	balances: ConetWalletBalances
	loading: boolean
} {
	const { conetWalletBalances } = useDaemonContext()
	return {
		balances: conetWalletBalances ?? EMPTY_CONET_WALLET_BALANCES,
		loading: false,
	}
}

/** CoNET-USDC only — 共用 daemon 喂料。 */
export function useConetUsdcBalance(_eoaAddress?: string): {
	balance: string
	loading: boolean
} {
	const { balances } = useConetWalletBalances(_eoaAddress)
	return { balance: balances.usdc, loading: false }
}
