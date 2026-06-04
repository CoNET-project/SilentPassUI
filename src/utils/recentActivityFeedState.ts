import type { TxView } from '@/pages/History/recentActivityIndexerMerge'

export function recentActivityListSignature(items: TxView[]): string {
	return items
		.map(
			(i) =>
				`${i.id}:${i.timestampMs}:${i.type}:${i.title}:${i.amountUSDC}:${i.amountFiat}:${i.topupBonusFiat ?? 0}:${i.merchantChargeTipFiat ?? 0}:${i.isInbound ? 1 : 0}`,
		)
		.join('|')
}

export function areRecentActivityListsEqual(a: TxView[], b: TxView[]): boolean {
	return recentActivityListSignature(a) === recentActivityListSignature(b)
}

/** 展示字段未变但链上补全了 rawTransaction / merchantCardAddress 时仍需更新（本地缓存无 raw） */
export function shouldUpdateRecentActivityList(prev: TxView[], next: TxView[]): boolean {
	if (!areRecentActivityListsEqual(prev, next)) return true
	return next.some((n) => {
		const p = prev.find((x) => x.id === n.id)
		if (!p) return true
		if (n.type !== p.type) return true
		if (n.title !== p.title) return true
		if (Boolean(n.rawTransaction) && !p.rawTransaction) return true
		if (Boolean(n.merchantCardAddress) && !p.merchantCardAddress) return true
		if (n.isMerchantCharge && !p.isMerchantCharge) return true
		if ((n.topupBonusFiat ?? 0) !== (p.topupBonusFiat ?? 0)) return true
		if ((n.merchantChargeTipFiat ?? 0) !== (p.merchantChargeTipFiat ?? 0)) return true
		return false
	})
}
