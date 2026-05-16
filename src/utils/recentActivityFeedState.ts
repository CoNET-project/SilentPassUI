import type { TxView } from '@/pages/History/recentActivityIndexerMerge'

export function recentActivityListSignature(items: TxView[]): string {
	return items
		.map((i) => `${i.id}:${i.timestampMs}:${i.amountUSDC}:${i.isInbound ? 1 : 0}`)
		.join('|')
}

export function areRecentActivityListsEqual(a: TxView[], b: TxView[]): boolean {
	return recentActivityListSignature(a) === recentActivityListSignature(b)
}

/** 展示字段未变但链上补全了 rawTransaction 时仍需更新（本地缓存无 raw） */
export function shouldUpdateRecentActivityList(prev: TxView[], next: TxView[]): boolean {
	if (!areRecentActivityListsEqual(prev, next)) return true
	return next.some((n) => {
		const p = prev.find((x) => x.id === n.id)
		return Boolean(n.rawTransaction) && !p?.rawTransaction
	})
}
