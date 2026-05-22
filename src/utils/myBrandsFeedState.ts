import type { UserCardInfo } from '@/services/BeamioCard'
import type { MyBrandsFeedDetailsSnapshot, MyBrandsOwnedCouponSnapshot } from '@/utils/myBrandsFeedLocalCache'

export type MyBrandCardFeedDetailsMap = MyBrandsFeedDetailsSnapshot

/** Home / My Brands list: render owned coupon ticket when count > 0 even if firstCoupon mapping missed. */
export function resolveMyBrandsOwnedCouponDisplay(
	cardAddress: string,
	claimable:
		| {
				count: number
				firstTitle?: string
				firstCoupon?: MyBrandsOwnedCouponSnapshot | null
				coupons?: MyBrandsOwnedCouponSnapshot[]
		  }
		| null
		| undefined
): MyBrandsOwnedCouponSnapshot | null {
	if (!claimable || claimable.count <= 0) return null
	if (claimable.firstCoupon) return claimable.firstCoupon
	if (claimable.firstTitle) {
		return {
			id: `${cardAddress.toLowerCase()}:owned`,
			cardAddress,
			tokenId: '',
			couponId: claimable.firstTitle,
			title: claimable.firstTitle,
			subtitle: 'Gift voucher',
			iconUrl: '',
			backgroundImage: '',
			backgroundColorHex: '',
			validBeforeSec: null,
		}
	}
	return null
}

export function resolveMyBrandsOwnedCouponDisplays(
	cardAddress: string,
	claimable:
		| {
				count: number
				firstTitle?: string
				firstCoupon?: MyBrandsOwnedCouponSnapshot | null
				coupons?: MyBrandsOwnedCouponSnapshot[]
		  }
		| null
		| undefined
): MyBrandsOwnedCouponSnapshot[] {
	if (!claimable || claimable.count <= 0) return []
	const seen = new Set<string>()
	const out: MyBrandsOwnedCouponSnapshot[] = []
	for (const coupon of claimable.coupons ?? []) {
		const key = coupon.id || `${coupon.cardAddress.toLowerCase()}:${coupon.tokenId || coupon.couponId}`
		if (seen.has(key)) continue
		seen.add(key)
		out.push(coupon)
	}
	const fallback = resolveMyBrandsOwnedCouponDisplay(cardAddress, claimable)
	if (fallback) {
		const key = fallback.id || `${fallback.cardAddress.toLowerCase()}:${fallback.tokenId || fallback.couponId}`
		if (!seen.has(key)) out.push(fallback)
	}
	return out
}

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
		cp: row.assets?.chargeRewardPoints ?? null,
		cp6: row.assets?.chargeRewardPoints6 ?? null,
		c: row.assets?.cardCurrency ?? null,
		n: row.meta?.name ?? null,
		i: row.meta?.image ?? null,
		pointSystem: row.meta?.pointSystem ?? null,
		coupons: row.claimableCoupons?.count ?? 0,
		couponTitle: row.claimableCoupons?.firstTitle ?? null,
		couponItems: (row.claimableCoupons?.coupons ?? [])
			.map((coupon) =>
				[
					coupon.id,
					coupon.title,
					coupon.subtitle,
					coupon.iconUrl,
					coupon.backgroundImage,
					coupon.backgroundColorHex,
					coupon.validBeforeSec,
				].join('|')
			)
			.join('||'),
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
