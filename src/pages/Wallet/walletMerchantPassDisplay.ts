import type { UserCardInfo } from '@/services/BeamioCard'
import {
	resolveHeldTierPresentation,
	resolveMyBrandCardIconUrl,
} from '@/pages/Brands/MyBrandsListSection'
import { cardTierGradientCss, cardTierGradientTheme } from '@/utils/cardTierGradient'
import type { MyBrandCardFeedDetailsMap } from '@/utils/myBrandsFeedState'
import {
	clampTierLogoDisplayScale,
	type TierLogoDisplayScale,
} from '@/utils/tierLogoDisplayScale'
import type { CardPassBackgroundImageFit } from '@/components/card/CardPassBackgroundImage'
import { fiatPrefix } from '@/services/currency'

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
	/** Top-right: "Up to 10%" or "Member pricing" */
	discountHeadline: string
	/** Bottom-right: "Starting from CA$ 10" or empty */
	startingFromLine: string
	tierGradient: string
	tierTheme: ReturnType<typeof cardTierGradientTheme>
}

function formatPointSubtitle(raw: unknown): string {
	if (raw == null || String(raw).trim() === '') return ''
	const n = Number(raw)
	if (!Number.isFinite(n)) return ''
	return `${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })} Point`
}

/** Align with biz Programs overview pass: "Up to N%" / "Member pricing". */
function formatPassDiscountHeadline(discountLabel: string | null): string {
	if (!discountLabel?.trim()) return 'Member pricing'
	const m = discountLabel.match(/(\d+(?:\.\d+)?)\s*%/)
	if (m?.[1]) return `Up to ${m[1]}%`
	const digits = discountLabel.replace(/\D/g, '').slice(0, 3)
	if (digits) return `Up to ${digits}%`
	return 'Member pricing'
}

/** Human threshold from on-chain/metadata minUsdc6 (6-decimal fixed). */
function formatStartingFromLine(minUsdc6: string | undefined, currencyCode: string): string {
	if (!minUsdc6?.trim()) return ''
	let human = NaN
	try {
		const head = minUsdc6.trim().split(/[.\s]/)[0] ?? '0'
		const bi = BigInt(head || '0')
		human = Number(bi) / 1e6
	} catch {
		human = Number(minUsdc6)
	}
	if (!Number.isFinite(human) || human < 0) return ''
	const prefix = fiatPrefix((currencyCode as 'CAD' | 'USD' | 'EUR' | 'JPY' | 'CNY' | 'HKD' | 'SGD' | 'TWD' | 'USDC') || 'CAD') || `${currencyCode} `
	const glue = /[$€¥]$/.test(prefix.trim()) ? '' : ' '
	const amount =
		human % 1 === 0
			? human.toLocaleString('en-US')
			: human.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
	return `Starting from ${prefix}${glue}${amount}`
}

export function buildWalletMerchantPassStackDisplay(
	uc: UserCardInfo,
	detail: MyBrandCardFeedDetailsMap[string] | undefined
): WalletMerchantPassStackDisplay {
	const title = (detail?.meta?.name && detail.meta.name.trim()) || uc.name || 'Merchant Pass'
	const tierPres = resolveHeldTierPresentation(detail)
	// Default merchant tier is named "Base" in Programs; do not show that label on the wallet pass.
	const rawTierName = tierPres.tierName.trim()
	const tierLbl =
		rawTierName && rawTierName.toLowerCase() !== 'base' ? rawTierName : ''
	const logoUrl = resolveMyBrandCardIconUrl(detail?.meta) ?? ''
	const backgroundImageUrl = tierPres.backgroundImageUrl ?? ''
	const backgroundImageFit = tierPres.backgroundImageFit
	const logoDisplayScale = clampTierLogoDisplayScale(tierPres.logoDisplayScale)
	const discountHeadline = formatPassDiscountHeadline(tierPres.discountLabel)
	const ptsRaw = detail?.assets?.points
	const ptsNum = ptsRaw != null && String(ptsRaw).trim() !== '' ? Number(ptsRaw) : NaN
	const cardGlobalCurrency = (detail?.assets?.cardCurrency ?? uc.currency ?? 'CAD').toUpperCase()
	const balanceLine = Number.isFinite(ptsNum)
		? `${cardGlobalCurrency} ${ptsNum.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`
		: detail === undefined
			? '…'
			: '—'
	const pointSystemOn = detail?.meta?.pointSystem?.enabled === true
	const rewardTotal =
		(Number(detail?.assets?.chargeRewardPoints ?? 0) || 0) +
		(Number(detail?.assets?.socialRewardPoints ?? 0) || 0)
	const balanceSubtitle = pointSystemOn && rewardTotal > 0 ? formatPointSubtitle(rewardTotal) : ''
	const startingFromLine = formatStartingFromLine(tierPres.minUsdc6, cardGlobalCurrency)
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
		startingFromLine,
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
		startingFromLine,
		tierGradient,
		tierTheme,
	}
}
