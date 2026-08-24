import { Banknote, Flame, Heart, MousePointerClick, Ticket, type LucideIcon } from 'lucide-react'
import type { DiscoverSocialMissionMetrics } from '@/utils/discoverMerchantPromotions'

/** Brand blue for Social Mission action icons (matches Discover comps). */
const ACTION_ICON_BLUE = '#1562f0'

type SocialMissionEarnRow = {
	key: string
	Icon: LucideIcon
	/** e.g. `10 pts / click` */
	label: string
}

function buildEarnRows(metrics: DiscoverSocialMissionMetrics): SocialMissionEarnRow[] {
	const rows: SocialMissionEarnRow[] = []
	if (metrics.linkClick != null) {
		rows.push({
			key: 'linkClick',
			Icon: MousePointerClick,
			label: `${metrics.linkClick.toLocaleString('en-US')} pts / click`,
		})
	}
	if (metrics.like != null) {
		rows.push({
			key: 'like',
			Icon: Heart,
			label: `${metrics.like.toLocaleString('en-US')} pts / like`,
		})
	}
	if (metrics.topup != null) {
		rows.push({
			key: 'topup',
			Icon: Banknote,
			label: metrics.topupAsPercent
				? `${metrics.topup}% of top-up`
				: `${metrics.topup.toLocaleString('en-US')} pts / spend`,
		})
	}
	if (metrics.claim != null) {
		rows.push({
			key: 'claim',
			Icon: Ticket,
			label: `${metrics.claim.toLocaleString('en-US')} pts / claim`,
		})
	}
	if (metrics.burn != null) {
		rows.push({
			key: 'burn',
			Icon: Flame,
			label: `${metrics.burn.toLocaleString('en-US')} pts / redeem`,
		})
	}
	return rows
}

function EarnColumn(props: {
	title: string
	metrics: DiscoverSocialMissionMetrics | null
	compact?: boolean
}) {
	const { title, metrics, compact } = props
	const rows = metrics ? buildEarnRows(metrics) : []
	if (rows.length === 0) {
		return (
			<div className="min-w-0 flex-1">
				<p
					className={[
						'font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400',
						compact ? 'text-[10px]' : 'text-[11px]',
					].join(' ')}
				>
					{title}
				</p>
				<p className={['mt-2 text-slate-400 dark:text-slate-500', compact ? 'text-[11px]' : 'text-xs'].join(' ')}>
					—
				</p>
			</div>
		)
	}
	return (
		<div className="min-w-0 flex-1">
			<p
				className={[
					'font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300',
					compact ? 'text-[10px]' : 'text-[11px]',
				].join(' ')}
			>
				{title}
			</p>
			<ul className={['mt-2.5 space-y-2', compact ? 'space-y-1.5' : ''].join(' ')}>
				{rows.map(({ key, Icon, label }) => (
					<li key={key} className="flex items-center gap-2">
						<Icon
							className={compact ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'}
							style={{ color: ACTION_ICON_BLUE }}
							strokeWidth={2.25}
							aria-hidden
						/>
						<span
							className={[
								'min-w-0 font-medium leading-snug text-[#1f2328] dark:text-slate-100',
								compact ? 'text-[11px]' : 'text-[13px]',
							].join(' ')}
						>
							{label}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}

/**
 * Dual-column Social Missions promotion breakdown:
 * YOU EARN | FRIEND EARNS — each with explicit `N pts / action` rows.
 */
export function DiscoverSocialMissionEarnColumns(props: {
	user: DiscoverSocialMissionMetrics | null
	referrer: DiscoverSocialMissionMetrics | null
	compact?: boolean
	className?: string
}) {
	const { user, referrer, compact, className } = props
	if (!user && !referrer) return null
	return (
		<div
			className={['flex items-start gap-4 sm:gap-6', className].filter(Boolean).join(' ')}
			role="group"
			aria-label="Social Missions rewards"
		>
			<EarnColumn title="You earn" metrics={user} compact={compact} />
			<div className="w-px self-stretch bg-slate-200 dark:bg-slate-700" aria-hidden />
			<EarnColumn title="Friend earns" metrics={referrer} compact={compact} />
		</div>
	)
}
