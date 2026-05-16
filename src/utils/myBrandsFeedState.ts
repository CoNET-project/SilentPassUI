import type { UserCardInfo } from '@/services/BeamioCard'
import type { MyBrandsFeedDetailsSnapshot } from '@/utils/myBrandsFeedLocalCache'

export type MyBrandCardFeedDetailsMap = MyBrandsFeedDetailsSnapshot

/** 卡列表是否仅地址集合变化（忽略顺序） */
export function myBrandCardListSignature(cards: UserCardInfo[]): string {
	return [...cards.map((c) => c.cardAddress.toLowerCase())].sort().join('|')
}

/** 展示相关字段快照，用于跳过无意义的 details 重渲染 */
function detailRowDisplayKey(row: MyBrandCardFeedDetailsMap[string] | undefined): string {
	if (!row) return ''
	return JSON.stringify({
		p: row.assets?.points ?? null,
		c: row.assets?.cardCurrency ?? null,
		n: row.meta?.name ?? null,
		i: row.meta?.image ?? null,
	})
}

export function areMyBrandDetailsMapsEqual(
	a: MyBrandCardFeedDetailsMap,
	b: MyBrandCardFeedDetailsMap
): boolean {
	const keysA = Object.keys(a)
	const keysB = Object.keys(b)
	if (keysA.length !== keysB.length) return false
	for (const k of keysA) {
		if (detailRowDisplayKey(a[k]) !== detailRowDisplayKey(b[k])) return false
	}
	return true
}
