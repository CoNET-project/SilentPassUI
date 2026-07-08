import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
	CreditCard,
	Flame,
	Gift,
	Heart,
	MousePointerClick,
	Share2,
	Ticket,
	UserRound,
} from 'lucide-react'
import type { DiscoverSocialMissionMetrics } from '@/utils/discoverMerchantPromotions'

const ACCENT = '#8d3a8b'
const ACCENT_SURFACE = '#f5ecff'

function SocialMissionMetricsPill(props: { metrics: DiscoverSocialMissionMetrics; compact?: boolean }) {
	const { metrics, compact } = props
	const items: Array<{ icon: typeof MousePointerClick; value: number; label: string }> = []
	if (metrics.linkClick != null) {
		items.push({ icon: MousePointerClick, value: metrics.linkClick, label: 'Share click' })
	}
	if (metrics.like != null) items.push({ icon: Heart, value: metrics.like, label: 'Like' })
	if (metrics.topup != null) items.push({ icon: CreditCard, value: metrics.topup, label: 'Top-up' })
	if (metrics.claim != null) items.push({ icon: Ticket, value: metrics.claim, label: 'Claim' })
	if (metrics.burn != null) items.push({ icon: Flame, value: metrics.burn, label: 'Redeem' })
	if (items.length === 0) return null
	return (
		<div
			className={[
				'flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full bg-slate-100 dark:bg-slate-800',
				compact ? 'px-2 py-1' : 'px-3 py-1.5',
			].join(' ')}
		>
			{items.map(({ icon: Icon, value, label }) => (
				<span
					key={label}
					className="inline-flex items-center gap-1 text-xs font-semibold text-[#1f2328] dark:text-slate-100"
					title={label}
				>
					<Icon className="h-3 w-3 shrink-0" style={{ color: ACCENT }} strokeWidth={2.25} aria-hidden />
					{value.toLocaleString('en-US')}
				</span>
			))}
		</div>
	)
}

function RoleIcon(props: { children: ReactNode }) {
	return (
		<div
			className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
			style={{ backgroundColor: ACCENT_SURFACE, color: ACCENT }}
		>
			{props.children}
		</div>
	)
}

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
					className="absolute left-0 top-full z-30 mt-1.5 w-[min(calc(100vw-2rem),17.5rem)] rounded-xl border border-[#eadcf7] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:border-[#8d3a8b]/30 dark:bg-slate-900"
					role="dialog"
					aria-label="Social Missions rewards"
				>
					<p className="text-[10px] font-bold uppercase tracking-wider text-[#8d3a8b]">Social Missions</p>
					<p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
						#13 reward points per action
					</p>
					<div className="mt-2.5 space-y-2">
						{user ? (
							<div className="flex items-center gap-2">
								<RoleIcon>
									<UserRound className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
								</RoleIcon>
								<div className="min-w-0 flex-1">
									<p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
										You
									</p>
									<SocialMissionMetricsPill metrics={user} compact />
								</div>
							</div>
						) : null}
						{referrer ? (
							<div className="flex items-center gap-2">
								<RoleIcon>
									<Gift className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
								</RoleIcon>
								<div className="min-w-0 flex-1">
									<p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
										Referrer
									</p>
									<SocialMissionMetricsPill metrics={referrer} compact />
								</div>
							</div>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	)
}
