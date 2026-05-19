import type { UserCardInfo } from '@/services/BeamioCard'
import type { MyBrandsFeedDetailsSnapshot } from '@/utils/myBrandsFeedLocalCache'

export type MyBrandCardFeedDetailsMap = MyBrandsFeedDetailsSnapshot

/** 卡列表是否仅地址集合变化（忽略顺序） */
export function myBrandCardListSignature(cards: UserCardInfo[]): string {
	return [...cards.map((c) => c.cardAddress.toLowerCase())].sort().join('|')
}

function nftTierDisplaySig(
	nfts: { tokenId?: string | number; isExpired?: boolean; tier?: string }[] | undefined
): string {
	if (!nfts?.length) return ''
	return nfts
		.filter((n) => Number(n.tokenId) > 0 && !n.isExpired)
		.map((n) => `${n.tokenId}:${n.tier ?? ''}`)
		.sort()
		.join(',')
}

/** 展示相关字段快照，用于跳过无意义的 details 重渲染 */
function detailRowDisplayKey(row: MyBrandCardFeedDetailsMap[string] | undefined): string {
	if (!row) return ''
	const metaTiers = row.meta?.tiers
	return JSON.stringify({
		p: row.assets?.points ?? null,
		c: row.assets?.cardCurrency ?? null,
		n: row.meta?.name ?? null,
		i: row.meta?.image ?? null,
		coupons: row.claimableCoupons?.count ?? 0,
		couponTitle: row.claimableCoupons?.firstTitle ?? null,
		couponItem: row.claimableCoupons?.firstCoupon
			? [
				row.claimableCoupons.firstCoupon.id,
				row.claimableCoupons.firstCoupon.title,
				row.claimableCoupons.firstCoupon.subtitle,
				row.claimableCoupons.firstCoupon.iconUrl,
				row.claimableCoupons.firstCoupon.backgroundImage,
				row.claimableCoupons.firstCoupon.backgroundColorHex,
				row.claimableCoupons.firstCoupon.validBeforeSec,
			].join('|')
			: null,
		nft: nftTierDisplaySig(row.assets?.nfts),
		tiers: Array.isArray(metaTiers) ? metaTiers.length : 0,
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
