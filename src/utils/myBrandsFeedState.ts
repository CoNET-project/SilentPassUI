import type { UserCardInfo } from '@/services/BeamioCard'
import type {
	MyBrandsFeedDetailsSnapshot,
	MyBrandsOwnedCatalogSnapshot,
	MyBrandsOwnedCouponSnapshot,
} from '@/utils/myBrandsFeedLocalCache'

export type { MyBrandsOwnedCatalogSnapshot }

export type MyBrandCardFeedDetailsMap = MyBrandsFeedDetailsSnapshot

/** My Brands 右栏金额副标题：NFT#2（charge-reward）point 余额 + `pts`（数据来自 Daemon feeder → getMyAssets）。 */
export function formatMyBrandNft2PointsSubtitle(
	detail: { assets?: { chargeRewardPoints?: string } | null } | undefined
): string {
	if (detail === undefined) return '…'
	const raw = detail.assets?.chargeRewardPoints
	if (detail.assets == null) return '—'
	if (raw == null || String(raw).trim() === '') return '—'
	const n = Number(raw)
	if (!Number.isFinite(n)) return '—'
	return `${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })} pts`
}

export type MyBrandSecondarySubtitle = {
	text: string
	tone: 'reward' | 'muted'
}

/** Home / My Brands 右栏第二行：优先绿色 +pts，否则灰色 pts / — */
export function resolveMyBrandSecondarySubtitle(
	detail: { assets?: { chargeRewardPoints?: string } | null } | undefined
): MyBrandSecondarySubtitle {
	const base = formatMyBrandNft2PointsSubtitle(detail)
	if (base === '…' || base === '—') {
		return { text: base, tone: 'muted' }
	}
	const n = Number(detail?.assets?.chargeRewardPoints)
	if (Number.isFinite(n) && n > 0) {
		const formatted = n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
		return { text: `+${formatted} pts`, tone: 'reward' }
	}
	return { text: base, tone: 'muted' }
}

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

export function resolveMyBrandsOwnedCatalogDisplays(
	cardAddress: string,
	owned:
		| {
				count: number
				firstTitle?: string
				firstCatalog?: MyBrandsOwnedCatalogSnapshot | null
				catalogs?: MyBrandsOwnedCatalogSnapshot[]
		  }
		| null
		| undefined,
): MyBrandsOwnedCatalogSnapshot[] {
	if (!owned || owned.count <= 0) return []
	const seen = new Set<string>()
	const out: MyBrandsOwnedCatalogSnapshot[] = []
	for (const item of owned.catalogs ?? []) {
		const key = item.id || `${item.cardAddress.toLowerCase()}:${item.tokenId || item.productionId}`
		if (seen.has(key)) continue
		seen.add(key)
		out.push(item)
	}
	if (owned.firstCatalog) {
		const key =
			owned.firstCatalog.id ||
			`${owned.firstCatalog.cardAddress.toLowerCase()}:${owned.firstCatalog.tokenId || owned.firstCatalog.productionId}`
		if (!seen.has(key)) out.push(owned.firstCatalog)
	}
	if (out.length === 0 && owned.firstTitle) {
		out.push({
			id: `${cardAddress.toLowerCase()}:owned-catalog`,
			cardAddress,
			tokenId: '',
			productionId: owned.firstTitle,
			globalCategory: 'Service',
			title: owned.firstTitle,
			subtitle: 'Catalog item',
			iconUrl: '',
			backgroundImage: '',
			backgroundColorHex: '',
			validBeforeSec: null,
		})
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
		i: row.meta?.icon ?? row.meta?.image ?? null,
		cat: row.meta?.categoryId ?? null,
		pdesc: row.meta?.programDescription ?? null,
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
		catalogs: row.ownedCatalogs?.count ?? 0,
		catalogTitle: row.ownedCatalogs?.firstTitle ?? null,
		catalogItems: (row.ownedCatalogs?.catalogs ?? [])
			.map((item) =>
				[
					item.id,
					item.title,
					item.subtitle,
					item.globalCategory,
					item.iconUrl,
					item.backgroundImage,
					item.backgroundColorHex,
					item.validBeforeSec,
				].join('|')
			)
			.join('||'),
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
