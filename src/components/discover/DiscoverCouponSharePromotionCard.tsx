import { useCallback, useMemo, useState } from 'react'
import { Check, CheckCircle2, Loader2, Tag } from 'lucide-react'
import { ethers } from 'ethers'
import { Toast } from 'antd-mobile'
import { tu } from '@/locale/beamioLocale'
import type { DiscoverSocialMissionMetrics } from '@/utils/discoverMerchantPromotions'
import {
	buildCouponOpenClaimDistributionShareUrl,
	shareCouponOpenClaimDistributionUrl,
} from '@/utils/couponOpenClaimShare'

const HEADER_ICON_BLUE = '#1562f0'
const HEADER_ICON_SURFACE = '#e8f0fe'
const ACTION_ICON_BLUE = '#1562f0'
const FRIEND_TAG_ORANGE = '#f97316'

type EarnLine = {
	key: string
	Icon: typeof Check
	label: string
	tone: 'blue' | 'orange'
}

function buildSharerEarnLines(metrics: DiscoverSocialMissionMetrics | null): EarnLine[] {
	if (!metrics) return []
	const lines: EarnLine[] = []
	if (metrics.linkClick != null) {
		lines.push({
			key: 'linkClick',
			Icon: Check,
			label: `${metrics.linkClick.toLocaleString('en-US')} pts / click`,
			tone: 'blue',
		})
	}
	if (metrics.like != null) {
		lines.push({
			key: 'like',
			Icon: Check,
			label: `${metrics.like.toLocaleString('en-US')} pts / like`,
			tone: 'blue',
		})
	}
	if (metrics.claim != null) {
		lines.push({
			key: 'claim',
			Icon: Check,
			label: `${metrics.claim.toLocaleString('en-US')} pts / claim`,
			tone: 'blue',
		})
	}
	if (metrics.burn != null) {
		lines.push({
			key: 'burn',
			Icon: CheckCircle2,
			label: `${metrics.burn.toLocaleString('en-US')} pts / redeem`,
			tone: 'blue',
		})
	}
	if (metrics.topup != null) {
		lines.push({
			key: 'topup',
			Icon: Check,
			label: `${metrics.topup.toLocaleString('en-US')} pts / spend`,
			tone: 'blue',
		})
	}
	return lines
}

/** Prefer explicit metadata points; fall back to title patterns like "500 Points". */
export function resolveCouponVoucherPointsLabel(params: {
	title?: string | null
	subtitle?: string | null
	metadata?: Record<string, unknown> | null
}): string {
	const meta = params.metadata
	const candidates: unknown[] = []
	if (meta) {
		candidates.push(
			meta.points,
			meta.pointsAmount,
			meta.amount,
			meta.value,
			meta.rewardPoints,
			(meta as { properties?: Record<string, unknown> }).properties?.points,
			(meta as { properties?: Record<string, unknown> }).properties?.amount,
		)
		const beamio = (meta as { properties?: { beamioCoupon?: Record<string, unknown> } }).properties
			?.beamioCoupon
		if (beamio) {
			candidates.push(beamio.points, beamio.amount, beamio.value, beamio.pointsAmount)
		}
	}
	for (const raw of candidates) {
		if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
			return `${Math.floor(raw).toLocaleString('en-US')} pts Voucher`
		}
		if (typeof raw === 'string') {
			const n = Number(String(raw).replace(/,/g, '').trim())
			if (Number.isFinite(n) && n > 0) {
				return `${Math.floor(n).toLocaleString('en-US')} pts Voucher`
			}
		}
	}
	const text = `${params.title ?? ''} ${params.subtitle ?? ''}`
	const match = text.match(/(\d[\d,]*)\s*(?:pts?|points)\b/i)
	if (match) {
		const n = Number(match[1].replace(/,/g, ''))
		if (Number.isFinite(n) && n > 0) {
			return `${Math.floor(n).toLocaleString('en-US')} pts Voucher`
		}
	}
	return 'Points Voucher'
}

/**
 * Share-a-voucher Social Missions promo under coupons that have coupon-level social rewards.
 * Layout: header + Share CTA, then YOU EARN | FRIEND EARNS grey panel (design comps).
 */
export function DiscoverCouponSharePromotionCard(props: {
	cardAddress: string
	couponId: string
	couponTitle?: string
	couponSubtitle?: string
	metadata?: Record<string, unknown> | null
	/** Sharer (`ref`) rewards — shown under YOU EARN. */
	sharerMetrics: DiscoverSocialMissionMetrics | null
	/** Fallback if sharer metrics empty — some configs only set `user`. */
	fallbackYouMetrics?: DiscoverSocialMissionMetrics | null
	getPrivateKeyArmor?: () => string | undefined
	className?: string
}) {
	const {
		cardAddress,
		couponId,
		couponTitle,
		couponSubtitle,
		metadata,
		sharerMetrics,
		fallbackYouMetrics = null,
		getPrivateKeyArmor,
		className,
	} = props

	const [sharing, setSharing] = useState(false)
	const [shared, setShared] = useState(false)

	const referrerEoa = useMemo(() => {
		const pk = getPrivateKeyArmor?.()?.trim() ?? ''
		if (!pk) return null
		try {
			return ethers.getAddress(new ethers.Wallet(pk).address)
		} catch {
			return null
		}
	}, [getPrivateKeyArmor])

	const shareUrl = buildCouponOpenClaimDistributionShareUrl(cardAddress, couponId, referrerEoa)

	const youLines = useMemo(() => {
		const primary = buildSharerEarnLines(sharerMetrics)
		if (primary.length > 0) return primary
		return buildSharerEarnLines(fallbackYouMetrics)
	}, [sharerMetrics, fallbackYouMetrics])

	const friendVoucherLabel = useMemo(
		() =>
			resolveCouponVoucherPointsLabel({
				title: couponTitle,
				subtitle: couponSubtitle,
				metadata: metadata ?? null,
			}),
		[couponTitle, couponSubtitle, metadata],
	)

	const handleShare = useCallback(async () => {
		if (!shareUrl) {
			Toast.show({ content: tu('share_url_is_unavailable'), position: 'top' })
			return
		}
		if (sharing) return
		setSharing(true)
		try {
			const outcome = await shareCouponOpenClaimDistributionUrl(shareUrl, {
				title: couponTitle?.trim() || 'Claim this coupon on Beamio',
			})
			if (outcome === 'shared' || outcome === 'copied') {
				setShared(true)
				if (outcome === 'copied') {
					Toast.show({ content: tu('claim_url_copied'), position: 'top' })
				}
				window.setTimeout(() => setShared(false), 2000)
			} else {
				Toast.show({ content: tu('could_not_share_claim_url'), position: 'top' })
			}
		} finally {
			setSharing(false)
		}
	}, [shareUrl, sharing, couponTitle])

	if (youLines.length === 0 && !friendVoucherLabel) return null

	return (
		<div
			className={[
				'overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900',
				className,
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div className="flex items-center gap-3 px-4 py-3.5">
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
					style={{ backgroundColor: HEADER_ICON_SURFACE, color: HEADER_ICON_BLUE }}
				>
					<Tag className="h-5 w-5" strokeWidth={2.25} aria-hidden />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-[15px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">
						Share a Voucher
					</p>
					<p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
						Send a Points Voucher to your friends.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void handleShare()}
					disabled={!shareUrl || sharing}
					aria-busy={sharing}
					aria-label="Share voucher"
					className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#0f172a] px-4 text-[13px] font-bold text-white transition active:scale-[0.98] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
				>
					{sharing ? (
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
					) : shared ? (
						<span className="inline-flex items-center gap-1">
							<Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.5} aria-hidden />
							Shared
						</span>
					) : (
						'Share'
					)}
				</button>
			</div>

			<div className="border-t border-slate-100 bg-[#f3f4f6] px-4 py-3.5 dark:border-slate-800 dark:bg-slate-800/60">
				<div className="flex items-start gap-4 sm:gap-6" role="group" aria-label="Voucher share rewards">
					<div className="min-w-0 flex-1">
						<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							You earn
						</p>
						{youLines.length > 0 ? (
							<ul className="mt-2.5 space-y-2">
								{youLines.map(({ key, Icon, label }) => (
									<li key={key} className="flex items-center gap-2">
										<Icon
											className="h-4 w-4 shrink-0"
											style={{ color: ACTION_ICON_BLUE }}
											strokeWidth={2.4}
											aria-hidden
										/>
										<span className="text-[13px] font-medium text-[#1f2328] dark:text-slate-100">
											{label}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="mt-2.5 text-[13px] text-slate-400">—</p>
						)}
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							Friend earns
						</p>
						<ul className="mt-2.5 space-y-2">
							<li className="flex items-center gap-2">
								<Tag
									className="h-4 w-4 shrink-0"
									style={{ color: FRIEND_TAG_ORANGE }}
									strokeWidth={2.25}
									aria-hidden
								/>
								<span className="text-[13px] font-medium text-[#1f2328] dark:text-slate-100">
									{friendVoucherLabel}
								</span>
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	)
}
