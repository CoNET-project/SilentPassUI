import React, { useCallback, useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { tu } from '@/locale/beamioLocale'
import {
	buildCouponOpenClaimDistributionShareUrl,
	shareCouponOpenClaimDistributionUrl,
} from '@/utils/couponOpenClaimShare'

export default function CouponOpenClaimShareButton({
	cardAddress,
	couponId,
	couponTitle,
	referrerEoa = null,
	className = '',
}: {
	cardAddress: string
	couponId: string
	couponTitle?: string
	referrerEoa?: string | null
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
		[shareUrl, couponTitle]
	)

	if (!shareUrl) return null

	return (
		<button
			type="button"
			onClick={(e) => void handleShare(e)}
			className={`inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-[#334155] transition-colors hover:border-[#94a3b8] hover:bg-[#f8fafc] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${className}`}
			aria-label="Share claim URL"
			title="Share claim URL"
		>
			{shared ? (
				<Check className="h-3 w-3 text-emerald-500" strokeWidth={2.4} aria-hidden />
			) : (
				<Share2 className="h-3 w-3 opacity-80" strokeWidth={2.2} aria-hidden />
			)}
		</button>
	)
}
