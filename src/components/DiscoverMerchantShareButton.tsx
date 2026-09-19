import React, { useCallback, useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { tu } from '@/locale/beamioLocale'
import { BeamioHeroGlassIconButton } from '@/components/BeamioCircularBackButton'
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

	const handleShare = useCallback(async () => {
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
	}, [shareUrl, merchantTitle, referrerEoa])

	if (!shareUrl) return null

	return (
		<BeamioHeroGlassIconButton
			onClick={() => void handleShare()}
			className={className}
			ariaLabel="Share brand link"
			title="Share brand link"
		>
			{shared ? (
				<Check className="h-[17px] w-[17px] text-emerald-400" strokeWidth={2.5} aria-hidden />
			) : (
				<Share2 className="h-[17px] w-[17px]" strokeWidth={2.5} aria-hidden />
			)}
		</BeamioHeroGlassIconButton>
	)
}
