import { useCallback, useMemo, useState } from 'react'
import {
	Banknote,
	Check,
	Gift,
	Hand,
	Heart,
	Loader2,
	Store,
	UserPlus,
	type LucideIcon,
} from 'lucide-react'
import { ethers } from 'ethers'
import { Toast } from 'antd-mobile'
import { tu } from '@/locale/beamioLocale'
import type { DiscoverSocialMissionMetrics } from '@/utils/discoverMerchantPromotions'
import {
	buildDiscoverMerchantShareUrl,
	shareDiscoverMerchantUrl,
} from '@/utils/discoverMerchantShare'

const HEADER_ICON_BLUE = '#1562f0'
const HEADER_ICON_SURFACE = '#e8f0fe'
const ACTION_ICON_BLUE = '#1562f0'
const FRIEND_GIFT_ORANGE = '#f97316'

type EarnLine = {
	key: string
	Icon: LucideIcon
	label: string
}

/** Sharer (`ref`) rewards shown under YOU EARN on Share Profile. */
function buildYouEarnLines(metrics: DiscoverSocialMissionMetrics | null): EarnLine[] {
	if (!metrics) return []
	const lines: EarnLine[] = []
	if (metrics.linkClick != null) {
		lines.push({
			key: 'linkClick',
			Icon: Hand,
			label: `${metrics.linkClick.toLocaleString('en-US')} pts / click`,
		})
	}
	if (metrics.like != null) {
		lines.push({
			key: 'like',
			Icon: Heart,
			label: `${metrics.like.toLocaleString('en-US')} pts / like`,
		})
	}
	if (metrics.topup != null) {
		lines.push({
			key: 'topup',
			Icon: Banknote,
			label: `${metrics.topup.toLocaleString('en-US')} pts / spend`,
		})
	}
	if (metrics.claim != null) {
		lines.push({
			key: 'claim',
			Icon: Gift,
			label: `${metrics.claim.toLocaleString('en-US')} pts / claim`,
		})
	}
	if (metrics.burn != null) {
		lines.push({
			key: 'burn',
			Icon: Gift,
			label: `${metrics.burn.toLocaleString('en-US')} pts / redeem`,
		})
	}
	return lines
}

/**
 * Merchant-card Social Missions promo: Share {Name} Profile + YOU EARN | FRIEND EARNS
 * (Welcome Voucher), matching Discover design comps.
 */
export function DiscoverMerchantShareProfilePromotionCard(props: {
	cardAddress: string
	merchantName: string
	/** Sharer (`ref`) metrics — YOU EARN. */
	sharerMetrics: DiscoverSocialMissionMetrics | null
	/** Fallback if sharer metrics empty. */
	fallbackYouMetrics?: DiscoverSocialMissionMetrics | null
	getPrivateKeyArmor?: () => string | undefined
	className?: string
}) {
	const {
		cardAddress,
		merchantName,
		sharerMetrics,
		fallbackYouMetrics = null,
		getPrivateKeyArmor,
		className,
	} = props

	const [sharing, setSharing] = useState(false)
	const [shared, setShared] = useState(false)

	const displayName = merchantName.trim() || 'Brand'
	const shareTitle = `Share ${displayName} Profile`

	const referrerEoa = useMemo(() => {
		const pk = getPrivateKeyArmor?.()?.trim() ?? ''
		if (!pk) return null
		try {
			return ethers.getAddress(new ethers.Wallet(pk).address)
		} catch {
			return null
		}
	}, [getPrivateKeyArmor])

	const shareUrl = buildDiscoverMerchantShareUrl(cardAddress, referrerEoa)

	const youLines = useMemo(() => {
		const primary = buildYouEarnLines(sharerMetrics)
		if (primary.length > 0) return primary
		return buildYouEarnLines(fallbackYouMetrics)
	}, [sharerMetrics, fallbackYouMetrics])

	const handleShare = useCallback(async () => {
		if (!shareUrl) {
			Toast.show({ content: tu('share_url_is_unavailable'), position: 'top' })
			return
		}
		if (sharing) return
		setSharing(true)
		try {
			const outcome = await shareDiscoverMerchantUrl(shareUrl, {
				title: `Discover ${displayName} on Beamio`,
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
	}, [shareUrl, sharing, displayName])

	return (
		<div
			className={[
				'overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900',
				className,
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div className="flex items-center gap-2 px-4 pt-4 pb-2">
				<UserPlus
					className="h-[18px] w-[18px] shrink-0"
					style={{ color: HEADER_ICON_BLUE }}
					strokeWidth={2.25}
					aria-hidden
				/>
				<p className="text-[15px] font-semibold text-[#1f2328] dark:text-slate-100">Social Missions</p>
			</div>

			<div className="flex items-center gap-3 px-4 py-3">
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
					style={{ backgroundColor: HEADER_ICON_SURFACE, color: HEADER_ICON_BLUE }}
				>
					<Store className="h-5 w-5" strokeWidth={2.25} aria-hidden />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-[15px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">
						{shareTitle}
					</p>
					<p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
						Invite friends to discover our restaurant.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void handleShare()}
					disabled={!shareUrl || sharing}
					aria-busy={sharing}
					aria-label={`Share ${displayName} profile`}
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

			<div className="mx-4 mb-4 rounded-xl bg-[#f3f4f6] px-4 py-3.5 dark:bg-slate-800/60">
				<div
					className="flex items-start gap-4 sm:gap-6"
					role="group"
					aria-label="Social Missions rewards"
				>
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
											strokeWidth={2.25}
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
								<Gift
									className="h-4 w-4 shrink-0"
									style={{ color: FRIEND_GIFT_ORANGE }}
									strokeWidth={2.25}
									aria-hidden
								/>
								<span className="text-[13px] font-medium text-[#1f2328] dark:text-slate-100">
									Welcome Voucher
								</span>
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	)
}
