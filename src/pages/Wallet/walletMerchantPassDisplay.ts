import type { UserCardInfo } from '@/services/BeamioCard'
import { resolveCardImageUrl, resolveHeldTierPresentation } from '@/pages/Brands/MyBrandsListSection'
import { cardTierGradientCss, cardTierGradientTheme } from '@/utils/cardTierGradient'
import type { MyBrandCardFeedDetailsMap } from '@/utils/myBrandsFeedState'

export type WalletMerchantPassStackDisplay = {
	sig: string
	title: string
	tierLbl: string
	balanceLine: string
	balanceSubtitle: string
	imgUrl: string
	tierGradient: string
	tierTheme: ReturnType<typeof cardTierGradientTheme>
}

function formatPointSubtitle(raw: unknown): string {
	if (raw == null || String(raw).trim() === '') return ''
	const n = Number(raw)
	if (!Number.isFinite(n)) return ''
	return `${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })} Point`
}

export function buildWalletMerchantPassStackDisplay(
	uc: UserCardInfo,
	detail: MyBrandCardFeedDetailsMap[string] | undefined
): WalletMerchantPassStackDisplay {
	const title = (detail?.meta?.name && detail.meta.name.trim()) || uc.name || '商户卡'
	const tierPres = resolveHeldTierPresentation(detail)
	const tierLbl = tierPres.tierName.trim() || 'Loyalty Member'
	const imgUrl = resolveCardImageUrl(detail?.meta?.image) ?? ''
	const ptsRaw = detail?.assets?.points
	const ptsNum =
		ptsRaw != null && String(ptsRaw).trim() !== '' ? Number(ptsRaw) : NaN
	const cardGlobalCurrency = (detail?.assets?.cardCurrency ?? uc.currency ?? 'CAD').toUpperCase()
	const balanceLine = Number.isFinite(ptsNum)
		? `${cardGlobalCurrency} ${ptsNum.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`
		: detail === undefined
			? '…'
			: '—'
	const pointSystemOn = detail?.meta?.pointSystem?.enabled === true
	const balanceSubtitle = pointSystemOn ? formatPointSubtitle(detail?.assets?.chargeRewardPoints) : ''
	const balanceSig = Number.isFinite(ptsNum) ? ptsNum.toFixed(2) : balanceLine
	const tierGradient = cardTierGradientCss(tierPres.accentColor)
	const tierTheme = cardTierGradientTheme(tierPres.accentColor)
	const sig = JSON.stringify({
		title,
		tierLbl,
		balance: balanceSig,
		balanceSubtitle,
		imgUrl,
		accent: tierPres.accentColor ?? '',
		border: tierTheme.cardBorder,
	})
	return {
		sig,
		title,
		tierLbl,
		balanceLine,
		balanceSubtitle,
		imgUrl,
		tierGradient,
		tierTheme,
	}
}
