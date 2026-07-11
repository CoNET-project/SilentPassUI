import { useEffect, useRef, useState } from 'react'
import { Share2 } from 'lucide-react'
import type { DiscoverSocialMissionMetrics } from '@/utils/discoverMerchantPromotions'
import { DiscoverSocialMissionEarnColumns } from './DiscoverSocialMissionEarnColumns'

/** Compact Social Missions reward breakdown for Available Offers coupon rows. */
export function DiscoverOfferSocialMissionTrigger(props: {
	user: DiscoverSocialMissionMetrics | null
	referrer: DiscoverSocialMissionMetrics | null
	className?: string
}) {
	const { user, referrer, className } = props
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const onPointerDown = (event: MouseEvent | TouchEvent) => {
			const target = event.target as Node | null
			if (rootRef.current && target && !rootRef.current.contains(target)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', onPointerDown)
		document.addEventListener('touchstart', onPointerDown)
		return () => {
			document.removeEventListener('mousedown', onPointerDown)
			document.removeEventListener('touchstart', onPointerDown)
		}
	}, [open])

	if (!user && !referrer) return null

	return (
		<div ref={rootRef} className={['relative inline-flex', className].filter(Boolean).join(' ')}>
			<button
				type="button"
				className={[
					'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition active:scale-[0.98]',
					open
						? 'border-[#eadcf7] bg-[#f5ecff] text-[#8d3a8b] dark:border-[#8d3a8b]/40 dark:bg-[#8d3a8b]/15'
						: 'border-[#eadcf7]/80 bg-white text-[#8d3a8b] hover:bg-[#f5ecff] dark:border-[#8d3a8b]/30 dark:bg-slate-900 dark:hover:bg-[#8d3a8b]/10',
				].join(' ')}
				aria-label="Social Missions rewards"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
			>
				<Share2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
				<span className="hidden sm:inline">Social</span>
			</button>
			{open ? (
				<div
					className="absolute left-0 top-full z-30 mt-1.5 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-[#eadcf7] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:border-[#8d3a8b]/30 dark:bg-slate-900"
					role="dialog"
					aria-label="Social Missions rewards"
				>
					<p className="text-[10px] font-bold uppercase tracking-wider text-[#8d3a8b]">Social Missions</p>
					<p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
						#13 reward points per action
					</p>
					<DiscoverSocialMissionEarnColumns
						className="mt-3"
						user={user}
						referrer={referrer}
						compact
					/>
				</div>
			) : null}
		</div>
	)
}
