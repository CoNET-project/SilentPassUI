import type { UserCardInfo } from '@/services/BeamioCard'
import { isGenericMerchantCardDisplayName } from '@/utils/isGenericMerchantCardDisplayName'
import { resolveHeldTierPresentation } from '@/pages/Brands/MyBrandsListSection'
import { pickMerchantCardListIconUrl } from '@/utils/merchantCardDatabase'
import { cardTierGradientCss, cardTierGradientTheme } from '@/utils/cardTierGradient'
import type { MyBrandCardFeedDetailsMap } from '@/utils/myBrandsFeedState'
import {
	clampTierLogoDisplayScale,
	type TierLogoDisplayScale,
} from '@/utils/tierLogoDisplayScale'
import type { CardPassBackgroundImageFit } from '@/components/card/CardPassBackgroundImage'
import {
	isDiscoverMembershipNftTokenId,
	parseDiscoverNftTokenId,
	type DiscoverMembershipNftLike,
} from '@/utils/discoverMembershipFee'

export type WalletMerchantPassStackDisplay = {
	sig: string
	title: string
	tierLbl: string
	balanceLine: string
	balanceSubtitle: string
	/** Merchant logo (card meta.icon / image) — top-left on pass face */
	logoUrl: string
	/** Tier pass background image */
	backgroundImageUrl: string
	backgroundImageFit: CardPassBackgroundImageFit
	logoDisplayScale: TierLogoDisplayScale
	/**
	 * Top-right: valid membership card number (`M-000100`), or empty when none.
	 * Replaces former “Member pricing” / “Up to N%”.
	 */
	discountHeadline: string
	tierGradient: string
	tierTheme: ReturnType<typeof cardTierGradientTheme>
}

function formatPointSubtitle(raw: unknown): string {
	if (raw == null || String(raw).trim() === '') return ''
	const n = Number(raw)
	if (!Number.isFinite(n)) return ''
	return `${Math.max(0, n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })} Point`
}

/**
 * #13 Reward PT — always shown on the wallet pass.
 * Independent of Top-up / Charge Promotion (`pointSystem.enabled`).
 * V16+: chargeRewardPoints and socialRewardPoints are the same #13 balance — do not add.
 */
function pickRewardPoints13(detail: MyBrandCardFeedDetailsMap[string] | undefined): number | null {
	if (detail === undefined) return null
	const chargeRaw = detail.assets?.chargeRewardPoints
	const socialRaw = detail.assets?.socialRewardPoints
	const chargeN = chargeRaw != null && String(chargeRaw).trim() !== '' ? Number(chargeRaw) : NaN
	const socialN = socialRaw != null && String(socialRaw).trim() !== '' ? Number(socialRaw) : NaN
	if (Number.isFinite(chargeN) && chargeN >= 0) return chargeN
	if (Number.isFinite(socialN) && socialN >= 0) return socialN
	return 0
}

/** Display form for membership NFT tokenId ∈ [100, 1e11), e.g. `M-000100`. */
export function formatWalletMembershipMemberNo(tokenId: string | number): string {
	const id = parseDiscoverNftTokenId(tokenId)
	if (id == null || !isDiscoverMembershipNftTokenId(tokenId)) return ''
	return `M-${id.toString().padStart(6, '0')}`
}

/**
 * Best valid membership NFT: tokenId ∈ [100, 1e11), not expired.
 * Prefer highest minUsdc6 via tier index when metadata exists; else highest tokenId.
 */
function resolveValidMembershipMemberNo(
	detail: MyBrandCardFeedDetailsMap[string] | undefined
): string {
	const nfts = (detail?.assets?.nfts ?? []) as DiscoverMembershipNftLike[]
	const valid = nfts.filter((n) => !n.isExpired && isDiscoverMembershipNftTokenId(n.tokenId))
	if (!valid.length) return ''

	const tiers = (detail?.meta?.tiers ?? []) as Array<{
		index?: number
		minUsdc6?: string | number
	}>
	let best: DiscoverMembershipNftLike | undefined
	let bestMin = -1n

	for (const n of valid) {
		const raw = n.tier
		if (raw == null || raw === 'Default/Max' || !tiers.length) continue
		const idx = Number(raw)
		if (!Number.isInteger(idx)) continue
		const row =
			tiers.find((t) => t.index !== undefined && Number(t.index) === idx) ??
			(idx >= 0 && idx < tiers.length ? tiers[idx] : undefined)
		if (!row) continue
		const minS = row.minUsdc6 != null ? String(row.minUsdc6).trim() : '0'
		let minBi = 0n
		try {
			const head = minS.split(/[.\s]/)[0] ?? '0'
			minBi = BigInt(head || '0')
		} catch {
			minBi = 0n
		}
		if (minBi > bestMin) {
			bestMin = minBi
			best = n
		}
	}

	if (!best) {
		best = valid.reduce((a, b) => {
			const ai = parseDiscoverNftTokenId(a.tokenId) ?? 0n
			const bi = parseDiscoverNftTokenId(b.tokenId) ?? 0n
			return bi > ai ? b : a
		})
	}

	return best?.tokenId != null ? formatWalletMembershipMemberNo(best.tokenId) : ''
}

export function buildWalletMerchantPassStackDisplay(
	uc: UserCardInfo,
	detail: MyBrandCardFeedDetailsMap[string] | undefined
): WalletMerchantPassStackDisplay {
	const metaName = detail?.meta?.name?.trim()
	const ucName = uc.name?.trim()
	const title =
		(metaName && !isGenericMerchantCardDisplayName(metaName) ? metaName : '') ||
		(ucName && !isGenericMerchantCardDisplayName(ucName) ? ucName : '') ||
		'Merchant Pass'
	const tierPres = resolveHeldTierPresentation(detail)
	// Default merchant tier is named "Base" in Programs; do not show that label on the wallet pass.
	const rawTierName = tierPres.tierName.trim()
	const tierLbl =
		rawTierName && rawTierName.toLowerCase() !== 'base' ? rawTierName : ''
	const logoUrl = pickMerchantCardListIconUrl({ meta: detail?.meta }) ?? ''
	const backgroundImageUrl = tierPres.backgroundImageUrl ?? ''
	const backgroundImageFit = tierPres.backgroundImageFit
	const logoDisplayScale = clampTierLogoDisplayScale(tierPres.logoDisplayScale)
	const discountHeadline = resolveValidMembershipMemberNo(detail)
	const ptsRaw = detail?.assets?.points
	const ptsNum = ptsRaw != null && String(ptsRaw).trim() !== '' ? Number(ptsRaw) : NaN
	const cardGlobalCurrency = (detail?.assets?.cardCurrency ?? uc.currency ?? 'CAD').toUpperCase()
	const balanceLine = Number.isFinite(ptsNum)
		? `${cardGlobalCurrency} ${ptsNum.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`
		: detail === undefined
			? '…'
			: '—'
	const reward13 = pickRewardPoints13(detail)
	const balanceSubtitle = reward13 == null ? '…' : formatPointSubtitle(reward13)
	const balanceSig = Number.isFinite(ptsNum) ? ptsNum.toFixed(2) : balanceLine
	const tierGradient = cardTierGradientCss(tierPres.accentColor)
	const tierTheme = cardTierGradientTheme(tierPres.accentColor)
	const sig = JSON.stringify({
		title,
		tierLbl,
		balance: balanceSig,
		balanceSubtitle,
		logoUrl,
		backgroundImageUrl,
		backgroundImageFit,
		logoDisplayScale,
		discountHeadline,
		accent: tierPres.accentColor ?? '',
		border: tierTheme.cardBorder,
	})
	return {
		sig,
		title,
		tierLbl,
		balanceLine,
		balanceSubtitle,
		logoUrl,
		backgroundImageUrl,
		backgroundImageFit,
		logoDisplayScale,
		discountHeadline,
		tierGradient,
		tierTheme,
	}
}
