import React, { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import {
	BEAMIO_POINTS_ERC1155_TOKEN_ID,
	beamioBaseScanNftLabel,
	beamioBaseScanNftLabelForToken,
	beamioBaseScanNftUrl,
	beamioBaseScanPointsNftUrl,
	resolveBeamioNftExplorerUrlForToken,
	resolveBeamioPointsNftExplorerUrl,
} from '@/utils/beamioBaseScanNft'

/**
 * Blockscout ERC-1155 NFT capsule (`/token/{card}/instance/{tokenId}`).
 * - `issuedOnly` (default): coupon/catalog (`tokenId >= 100000000000`)
 * - `pointsBalance`: program card points token `#0`
 */
export default function BeamioBaseScanNftCapsule({
	cardAddress,
	tokenId,
	pointsBalance = false,
	className = '',
}: {
	cardAddress: string
	/** Used when `pointsBalance` is false. */
	tokenId?: string | number | undefined
	/** My Brands merchant balance row → `/nft/{card}/0`. */
	pointsBalance?: boolean
	className?: string
}) {
	const fallbackUrl = pointsBalance
		? beamioBaseScanPointsNftUrl(cardAddress)
		: beamioBaseScanNftUrl(cardAddress, tokenId)
	const [resolvedUrl, setResolvedUrl] = useState<string | null>(fallbackUrl)
	useEffect(() => {
		let cancelled = false
		setResolvedUrl(fallbackUrl)
		if (!fallbackUrl) return
		const run = pointsBalance
			? resolveBeamioPointsNftExplorerUrl(cardAddress)
			: resolveBeamioNftExplorerUrlForToken(cardAddress, tokenId)
		run.then((url) => {
			if (!cancelled && url) setResolvedUrl(url)
		}).catch(() => {
			/* keep fallback URL */
		})
		return () => {
			cancelled = true
		}
	}, [cardAddress, fallbackUrl, pointsBalance, tokenId])
	if (!fallbackUrl) return null
	const label = pointsBalance
		? beamioBaseScanNftLabelForToken(BEAMIO_POINTS_ERC1155_TOKEN_ID)
		: beamioBaseScanNftLabel(tokenId)
	const targetUrl = resolvedUrl ?? fallbackUrl
	const explorerLabel = targetUrl.includes('scan.conet.network') ? 'CoNET Scan' : 'BaseScan'
	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation()
				openExternalUrl(targetUrl)
			}}
			className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-[#cbd5e1] bg-white px-2.5 py-1 text-[10px] font-bold tracking-tight text-[#334155] transition-colors hover:border-[#94a3b8] hover:bg-[#f8fafc] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${className}`}
			aria-label={`View ${label} on ${explorerLabel}`}
			title={`View NFT on ${explorerLabel}`}
		>
			{label}
			<ExternalLink className="h-3 w-3 opacity-70" strokeWidth={2.2} aria-hidden />
		</button>
	)
}
