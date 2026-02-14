/**
 * 全局 RPC 故障熔断：相同失败不重复触发，避免雪崩式重试。
 * 当 RPC 返回 quota/network 错误时，60 秒内跳过 RPC 直连，改为使用 API。
 */

const RPC_DEGRADED_COOLDOWN_MS = 60 * 1000
let lastRpcFailureTime = 0

/** 检测是否属于 RPC 配额/网络类错误（应触发熔断） */
export const isRpcQuotaOrNetworkError = (err: unknown): boolean => {
	const msg = String((err as Error)?.message ?? err)
	return (
		/Exceeded the quota usage/i.test(msg) ||
		/BAD_DATA/i.test(msg) ||
		/missing response for request/i.test(msg) ||
		/JsonRpcProvider failed to detect network/i.test(msg) ||
		/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ERR_CONNECTION_CLOSED|net::/i.test(msg)
	)
}

/** 上报 RPC 失败，触发熔断 */
export const reportRpcFailure = (): void => {
	lastRpcFailureTime = Date.now()
}

/** 是否处于熔断期（应跳过 RPC，使用 API） */
export const isRpcDegraded = (): boolean => {
	return Date.now() - lastRpcFailureTime < RPC_DEGRADED_COOLDOWN_MS
}
