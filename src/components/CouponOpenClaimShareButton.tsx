import React, { useCallback, useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { tu } from '@/locale/beamioLocale'
import { formatDiscoverLikeCount } from '@/utils/discoverMerchantLikeCount'
import {
	buildCouponOpenClaimDistributionShareUrl,
	shareCouponOpenClaimDistributionUrl,
} from '@/utils/couponOpenClaimShare'

/**
 * Share claim URL control — Share2 + optional share-click count in one pill button
 * (merges former separate share icon + share-count capsule).
 */
export default function CouponOpenClaimShareButton({
	cardAddress,
	couponId,
	couponTitle,
	referrerEoa = null,
	count = null,
	variant = 'light',
	className = '',
}: {
	cardAddress: string
	couponId: string
	couponTitle?: string
	referrerEoa?: string | null
	/** Aggregate share-click count shown beside the share icon. */
	count?: number | null
	variant?: 'light' | 'onDark'
	className?: string
}) {
	const [shared, setShared] = useState(false)
	const shareUrl = buildCouponOpenClaimDistributionShareUrl(cardAddress, couponId, referrerEoa)

	const handleShare = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()
			if (!shareUrl) {
				Toast.show({ content: tu('share_url_is_unavailable'), position: 'top' })
				return
			}
			const outcome = await shareCouponOpenClaimDistributionUrl(shareUrl, {
				title: couponTitle?.trim() || 'Claim this coupon on Beamio',
			})
			if (outcome === 'shared') {
				setShared(true)
				setTimeout(() => setShared(false), 2000)
				return
			}
			if (outcome === 'copied') {
				setShared(true)
				Toast.show({ content: tu('claim_url_copied'), position: 'top' })
				setTimeout(() => setShared(false), 2000)
				return
			}
			Toast.show({ content: tu('could_not_share_claim_url'), position: 'top' })
		},
		[shareUrl, couponTitle],
	)

	if (!shareUrl) return null

	const style =
		variant === 'onDark'
			? 'bg-white/15 text-white ring-white/25 hover:bg-white/25'
			: 'bg-sky-50 text-[#1562f0] ring-sky-100 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/50 dark:hover:bg-sky-950/60'
	const countLabel = count != null ? formatDiscoverLikeCount(count) : null
	const ariaLabel =
		countLabel != null ? `Share claim URL · ${countLabel} share clicks` : 'Share claim URL'

	return (
		<button
			type="button"
			onClick={(e) => void handleShare(e)}
			className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition active:scale-95 ${style} ${className}`}
			aria-label={ariaLabel}
			title="Share claim URL"
		>
			{shared ? (
				<Check className="h-3 w-3 text-emerald-500" strokeWidth={2.4} aria-hidden />
			) : (
				<Share2 className="h-3 w-3" strokeWidth={2.25} aria-hidden />
			)}
			{countLabel != null ? countLabel : null}
		</button>
	)
}
