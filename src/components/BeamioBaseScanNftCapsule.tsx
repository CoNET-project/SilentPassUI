import React from 'react'
import { ExternalLink } from 'lucide-react'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { beamioBaseScanNftLabel, beamioBaseScanNftUrl } from '@/utils/beamioBaseScanNft'

/** Issued ERC-1155 coupon/catalog NFT link for BaseScan (`tokenId >= 100000000000`). */
export default function BeamioBaseScanNftCapsule({
	cardAddress,
	tokenId,
	className = '',
}: {
	cardAddress: string
	tokenId: string | number | undefined
	className?: string
}) {
	const url = beamioBaseScanNftUrl(cardAddress, tokenId)
	if (!url) return null
	const label = beamioBaseScanNftLabel(tokenId)
	return (
		<button
			type="button"
			onClick={() => openExternalUrl(url)}
			className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-[#cbd5e1] bg-white px-2.5 py-1 text-[10px] font-bold tracking-tight text-[#334155] transition-colors hover:border-[#94a3b8] hover:bg-[#f8fafc] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${className}`}
			aria-label={`View ${label} on BaseScan`}
			title="View NFT on BaseScan"
		>
			{label}
			<ExternalLink className="h-3 w-3 opacity-70" strokeWidth={2.2} aria-hidden />
		</button>
	)
}
