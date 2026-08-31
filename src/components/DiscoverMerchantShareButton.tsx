import React, { useCallback, useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { tu } from '@/locale/beamioLocale'
import {
	buildDiscoverMerchantShareUrl,
	shareDiscoverMerchantUrl,
} from '@/utils/discoverMerchantShare'

export default function DiscoverMerchantShareButton({
	cardAddress,
	merchantTitle,
	referrerEoa,
	className = '',
}: {
	cardAddress: string
	merchantTitle?: string
	/** Sharer wallet — embedded as `ref=` so openers attribute the click to this referrer. */
	referrerEoa?: string | null
	className?: string
}) {
	const [shared, setShared] = useState(false)
	const shareUrl = buildDiscoverMerchantShareUrl(cardAddress, referrerEoa)

	const handleShare = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()
			if (!shareUrl) {
				Toast.show({ content: tu('share_url_is_unavailable'), position: 'top' })
				return
			}
			const outcome = await shareDiscoverMerchantUrl(shareUrl, {
				title: merchantTitle?.trim()
					? `Discover ${merchantTitle.trim()} on Beamio`
					: 'Discover this brand on Beamio',
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
			if (outcome === 'failed') {
				Toast.show({ content: tu('could_not_share_claim_url'), position: 'top' })
			}
		},
		[shareUrl, merchantTitle, referrerEoa]
	)

	if (!shareUrl) return null

	return (
		<button
			type="button"
			onClick={(e) => void handleShare(e)}
			className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-800/85 text-white shadow-lg ring-1 ring-white/10 transition active:scale-95 ${className}`}
			aria-label="Share brand link"
			title="Share brand link"
		>
			{shared ? (
				<Check className="h-5 w-5 text-emerald-400" strokeWidth={2.4} aria-hidden />
			) : (
				<Share2 className="h-5 w-5" strokeWidth={2} aria-hidden />
			)}
		</button>
	)
}
