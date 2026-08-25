import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Check, ChevronDown, ChevronUp, Loader2, Share2 } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { tu } from '@/locale/beamioLocale'
import {
	buildDiscoverMerchantShareUrl,
	shareDiscoverMerchantUrl,
} from '@/utils/discoverMerchantShare'
import {
	fetchCardProgramReferrerDashboard,
	fetchCardReferrerAmountRatioPercents,
	formatNetworkPtsWhole,
	pickNetworkEarningsRaw,
	type CardProgramReferrerDashboardSnapshot,
	type CardReferrerAmountRatioPercents,
} from '@/utils/cardProgramReferrerDashboard'
import type { ChainCardSocialPromotion } from '@/utils/discoverMerchantSocialPromotionChain'

type RewardDetailRow = {
	key: string
	label: string
	value: string
	tone: 'you' | 'friend'
}

function formatLikePointsLabel(points: number, singular: string, plural: string): string {
	const n = Math.max(0, Math.trunc(points))
	if (n === 1) return `+1 ${singular}`
	return `+${n.toLocaleString('en-US')} ${plural}`
}

function buildHeadlinePercent(ratios: CardReferrerAmountRatioPercents): number {
	return Math.max(ratios.chargePercent, ratios.topupPercent)
}

function buildSpendEarnValue(ratios: CardReferrerAmountRatioPercents): string | null {
	const { chargePercent, topupPercent } = ratios
	if (chargePercent <= 0 && topupPercent <= 0) return null
	if (chargePercent > 0 && topupPercent > 0) {
		if (chargePercent === topupPercent) {
			return `${chargePercent}% on their Top-ups & Spend`
		}
		return `${topupPercent}% on Top-ups · ${chargePercent}% on Spend`
	}
	if (topupPercent > 0) return `${topupPercent}% on their Top-ups`
	return `${chargePercent}% on their Spend`
}

export function DiscoverMerchantInviteFriendsPanel(props: {
	cardAddress: string
	merchantTitle: string
	referrerEoa: string | null
	chainCardSocialPromotion?: ChainCardSocialPromotion | null
	isMember?: boolean
	onOpenMyNetwork?: () => void
}) {
	const {
		cardAddress,
		merchantTitle,
		referrerEoa,
		chainCardSocialPromotion,
		isMember = false,
		onOpenMyNetwork,
	} = props
	const [ratios, setRatios] = useState<CardReferrerAmountRatioPercents | null>(null)
	const [dashboard, setDashboard] = useState<CardProgramReferrerDashboardSnapshot | null>(null)
	const [detailsOpen, setDetailsOpen] = useState(false)
	const [sharing, setSharing] = useState(false)
	const [shared, setShared] = useState(false)

	useEffect(() => {
		if (!cardAddress) return
		let cancelled = false
		void fetchCardReferrerAmountRatioPercents(cardAddress).then((next) => {
			if (cancelled || !next) return
			setRatios(next)
		})
		return () => {
			cancelled = true
		}
	}, [cardAddress])

	useEffect(() => {
		if (!isMember || !cardAddress || !referrerEoa) return
		let cancelled = false
		void fetchCardProgramReferrerDashboard(cardAddress, referrerEoa).then((next) => {
			if (cancelled || !next) return
			setDashboard(next)
		})
		return () => {
			cancelled = true
		}
	}, [isMember, cardAddress, referrerEoa])

	const headlinePercent = ratios ? buildHeadlinePercent(ratios) : 0
	const visible = Boolean(ratios && headlinePercent > 0)

	const shareUrl = buildDiscoverMerchantShareUrl(cardAddress, referrerEoa)
	const displayName = merchantTitle.trim() || 'this store'

	const earnedPtsLabel = useMemo(() => {
		const raw = pickNetworkEarningsRaw(dashboard?.rewardVoucher13Raw, dashboard?.rewardBalanceRaw)
		return formatNetworkPtsWhole(raw)
	}, [dashboard])

	const detailRows = useMemo((): RewardDetailRow[] => {
		if (!ratios) return []
		const rows: RewardDetailRow[] = []
		const spend = buildSpendEarnValue(ratios)
		if (spend) {
			rows.push({
				key: 'spend',
				label: 'YOU EARN →',
				value: spend,
				tone: 'you',
			})
		}
		const like = chainCardSocialPromotion?.events?.like
		const youLike = like?.ref?.enabled ? like.ref.points13 : 0
		const friendLike = like?.user?.enabled ? like.user.points13 : 0
		if (youLike > 0) {
			rows.push({
				key: 'you-like',
				label: 'YOU EARN →',
				value: `${formatLikePointsLabel(youLike, 'Pt', 'Pts')} when they Like & Engage`,
				tone: 'you',
			})
		}
		if (friendLike > 0) {
			rows.push({
				key: 'friend-like',
				label: 'FRIEND EARNS →',
				value: `${formatLikePointsLabel(friendLike, 'Pt', 'Pts')} for Liking & Joining`,
				tone: 'friend',
			})
		}
		return rows
	}, [ratios, chainCardSocialPromotion])

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
			} else if (outcome === 'failed') {
				Toast.show({ content: tu('could_not_share_claim_url'), position: 'top' })
			}
		} finally {
			setSharing(false)
		}
	}, [shareUrl, sharing, displayName])

	if (!visible || !ratios) return null

	const showMemberDetailsChrome = isMember && detailsOpen

	return (
		<section
			className="overflow-hidden rounded-[22px] border border-[#dce8f7] bg-gradient-to-b from-[#eef5ff] to-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:from-slate-900 dark:to-slate-900 sm:p-6"
			aria-label="Invite friends referral rewards"
		>
			<h3 className="text-[17px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">
				Invite Friends, Earn {headlinePercent}% & Bonus Points! ✨
			</h3>
			<p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
				Share this store. Earn a {headlinePercent}% match when they spend, plus you both get
				instant points when they visit and Like!
			</p>
			<button
				type="button"
				onClick={() => void handleShare()}
				disabled={!shareUrl || sharing}
				aria-busy={sharing}
				aria-label="Share store link"
				className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1562f0] px-4 py-3 text-[15px] font-bold text-white shadow-sm transition active:scale-[0.98] hover:bg-[#1256d4] disabled:cursor-not-allowed disabled:opacity-60"
			>
				{sharing ? (
					<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
				) : shared ? (
					<Check className="h-5 w-5 text-emerald-300" strokeWidth={2.5} aria-hidden />
				) : (
					<Share2 className="h-5 w-5" strokeWidth={2.25} aria-hidden />
				)}
				{shared ? 'Link shared' : 'Share Store Link'}
			</button>
			{detailsOpen && detailRows.length > 0 ? (
				<div className="mt-5 space-y-4">
					{isMember ? (
						<div className="rounded-xl bg-[#e8f1ff] px-3 py-2.5 text-center text-[13px] font-medium text-[#1f2328] dark:bg-[#1562f0]/20 dark:text-slate-100">
							🎉 You&apos;ve earned{' '}
							<span className="font-bold text-[#1562f0] dark:text-blue-300">{earnedPtsLabel} Pts</span>{' '}
							from your network!
						</div>
					) : null}
					<ul className="space-y-3">
						{detailRows.map((row) => (
							<li key={row.key} className="flex items-baseline justify-between gap-3">
								<span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
									{row.label}
								</span>
								<span
									className={[
										'text-right text-[13px] font-bold leading-snug',
										row.tone === 'friend' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#1562f0]',
									].join(' ')}
								>
									{row.value}
								</span>
							</li>
						))}
					</ul>
				</div>
			) : null}
			{showMemberDetailsChrome ? (
				<div className="mt-4 flex items-center justify-between gap-3">
					<button
						type="button"
						onClick={() => setDetailsOpen(false)}
						className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#1562f0]"
						aria-expanded
					>
						Hide Details
						<ChevronUp className="h-4 w-4" strokeWidth={2.25} aria-hidden />
					</button>
					<button
						type="button"
						onClick={() => onOpenMyNetwork?.()}
						disabled={!onOpenMyNetwork}
						className="inline-flex items-center gap-1.5 rounded-lg border border-[#1562f0]/35 bg-[#eef5ff] px-3 py-1.5 text-[13px] font-bold text-[#1562f0] transition active:scale-[0.98] disabled:opacity-50 dark:border-blue-400/40 dark:bg-slate-800 dark:text-blue-300"
						aria-label="My Network"
					>
						<BarChart3 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
						My Network
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setDetailsOpen((open) => !open)}
					className="mt-4 flex w-full items-center justify-center gap-1 text-[13px] font-semibold text-[#1562f0]"
					aria-expanded={detailsOpen}
				>
					{detailsOpen ? 'Hide Details' : 'View Reward Details'}
					{detailsOpen ? (
						<ChevronUp className="h-4 w-4" strokeWidth={2.25} aria-hidden />
					) : (
						<ChevronDown className="h-4 w-4" strokeWidth={2.25} aria-hidden />
					)}
				</button>
			)}
		</section>
	)
}
