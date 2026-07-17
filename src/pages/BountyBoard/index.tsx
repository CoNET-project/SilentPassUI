import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Gift,
	Utensils,
	Share2,
	Filter,
	Settings2,
	Info,
	UserPlus,
	MousePointerClick,
	Smartphone,
	Ticket,
	Store,
	ShoppingBag,
	Sparkles,
} from 'lucide-react'
import { useDaemonReferrerSummary } from '@/hooks/useDaemonReferrerSummary'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useConetAaWalletBalances, useConetWalletBalances } from '@/hooks/useConetUsdcBalance'
import { useDaemonValidatorWalletNodeProfile } from '@/hooks/useDaemonValidatorWalletNodeProfile'
import { useDaemonUnifiedIncomeStats } from '@/hooks/useDaemonUnifiedIncomeStats'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { formatWithThousands } from '@/services/beamio'
import { formatConetChainTokenBalance, formatConetChainTokenBalanceCompact } from '@/services/conetUsdcBalance'
import {
	fetchBountySocialReferralPoints,
	formatSocialPoints,
	type MerchantSocialReferralPoints,
	type SocialReferralEventKey,
} from '@/utils/bountySocialReferralPoints'

/**
 * Bounty Board — referral rewards hub.
 * Top bar aligned with /wallet: fixed left title capsule, no right control / back.
 * Static presentation aligned to the approved design; wire live data later.
 * Reached from the global bar's right-most tab (formerly /Pay).
 */

type BountyItem = {
	id: string
	name: string
	poolLeftUsd: string
	claimRewardUsd: string
	redeemRewardUsd: string
}

const BOUNTY_CAPSULE_ACCENT = '#1562f0'

const capsuleChrome =
	'rounded-full border border-slate-100/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800'

const cardChrome =
	'rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'

const FALLBACK_RATES: Record<string, number> = { USD: 1, CAD: 1.35, JPY: 150, EUR: 0.92, CNY: 7.2, HKD: 7.8, TWD: 31, SGD: 1.35 }

function fxRateUsdcToCurrency(currency: ICurrency, currencyData: Record<string, number>): number {
	const usdcToUsd = (currencyData.USDC ?? 1) || 1
	if (currency === 'USD') return usdcToUsd
	if (currency === 'USDC') return 1
	const raw = currencyData[currency] ?? FALLBACK_RATES[currency] ?? 1
	const rate = usdcToUsd * (raw || (FALLBACK_RATES[currency] ?? 1))
	return rate > 0 ? rate : (FALLBACK_RATES[currency] ?? 1)
}

function formatConetUsdcFiatApprox(usdcAmount: string, currency: ICurrency, currencyData: Record<string, number>): string {
	const n = Math.max(0, Number(usdcAmount) || 0)
	const rate = fxRateUsdcToCurrency(currency, currencyData)
	const v = currency === 'USDC' ? n : n * rate
	switch (currency) {
		case 'EUR':
			return `≈ € ${formatWithThousands(v, 2)}`
		case 'TWD':
			return `≈ NT$ ${formatWithThousands(v, 2)}`
		case 'SGD':
			return `≈ SG$ ${formatWithThousands(v, 2)}`
		case 'HKD':
			return `≈ HK$ ${formatWithThousands(v, 2)}`
		case 'JPY':
			return `≈ JP¥ ${formatWithThousands(v, 0)}`
		case 'CNY':
			return `≈ RMB¥ ${formatWithThousands(v, 2)}`
		case 'CAD':
			return `≈ CA$ ${formatWithThousands(v, 2)}`
		case 'USDC':
			return `≈ ${formatWithThousands(n, 2)} USDC`
		case 'USD':
		default:
			return `≈ US$ ${formatWithThousands(v, 2)}`
	}
}

function formatConetUsdcDisplay(balance: string): string {
	return formatWithThousands(Math.max(0, Number(balance) || 0), 2)
}

const SAMPLE_BOUNTIES: BountyItem[] = [
	{
		id: 'lao-nong-tang',
		name: 'Lao Nong Tang',
		poolLeftUsd: '150.00',
		claimRewardUsd: '0.50',
		redeemRewardUsd: '2.00',
	},
]

function GenesisNodeReferralCard() {
	const { summary } = useDaemonReferrerSummary()
	const perReward = Math.max(1, Number(summary?.nodesPerReward ?? '10') || 10)
	const referredTotal = Math.max(0, Number(summary?.referralNodeTotal ?? '0') || 0)
	// 当前里程碑内进度（每满 perReward 个推荐节点奖励 1 个 FREE Node）
	const progress = referredTotal % perReward
	const remaining = perReward - progress

	return (
		<div className={`${cardChrome} relative overflow-hidden border-l-4 border-l-amber-400 p-4`}>
			<div className="flex items-start justify-between gap-2">
				<h3 className="text-base font-bold text-slate-900 dark:text-slate-50">Genesis Node Referral</h3>
				<span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
					[ 10% USDC Direct Reward ]
				</span>
			</div>

			<p className="mt-2 text-sm leading-snug text-slate-600 dark:text-slate-300">
				Refer <span className="font-bold text-amber-600 dark:text-amber-400">{remaining}</span> more to get 1 FREE Node.
			</p>

			<div className="mt-4">
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs font-bold text-slate-500 dark:text-slate-400">Progress</span>
					<span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
						{progress}/{perReward} Nodes Referred
					</span>
				</div>
				<div className="mt-2 flex items-center gap-1.5">
					{Array.from({ length: perReward }).map((_, i) => (
						<div
							key={i}
							className={`h-1.5 flex-1 rounded-full ${
								i < progress ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'
							}`}
						/>
					))}
				</div>
			</div>

			<div className="mt-4 grid grid-cols-2 gap-3">
				<button
					type="button"
					className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200"
				>
					<Info className="h-4 w-4" strokeWidth={2.25} aria-hidden />
					Details
				</button>
				<button
					type="button"
					className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200"
				>
					<UserPlus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
					Invite Friends
				</button>
			</div>
		</div>
	)
}

function BountyCard({ item }: { item: BountyItem }) {
	return (
		<div className={`${cardChrome} p-4`}>
			<div className="flex items-start gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-orange-500/15">
					<Utensils className="h-5 w-5" strokeWidth={2.25} aria-hidden />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<h3 className="truncate text-base font-bold text-slate-900 dark:text-slate-50">
							{item.name} <span className="font-bold">[ Beamio Partner ]</span>
						</h3>
						<span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
							Pool: ${item.poolLeftUsd} left
						</span>
					</div>
					<span className="mt-1 inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
						Verified Merchant
					</span>
				</div>
			</div>

			<p className="mt-3 text-sm leading-snug text-slate-600 dark:text-slate-300">
				Earn <span className="font-bold text-[#1562f0]">${item.claimRewardUsd}</span> on claim +{' '}
				<span className="font-bold text-[#1562f0]">${item.redeemRewardUsd}</span> on store redeem.
			</p>

			<div className="mt-4 grid grid-cols-2 gap-3">
				<button
					type="button"
					className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200"
				>
					<Info className="h-4 w-4" strokeWidth={2.25} aria-hidden />
					Details
				</button>
				<button
					type="button"
					className="flex items-center justify-center gap-2 rounded-xl bg-[#1562f0] px-4 py-3 text-sm font-bold text-white transition active:scale-[0.98]"
				>
					<Share2 className="h-4 w-4" strokeWidth={2.5} aria-hidden />
					Share &amp; Earn
				</button>
			</div>
		</div>
	)
}

const EVENT_ICON: Record<SocialReferralEventKey, React.ReactNode> = {
	shareClicks: <MousePointerClick className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />,
	installs: <Smartphone className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />,
	claims: <Ticket className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />,
	redeems: <Store className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />,
	purchases: <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />,
}

function SocialReferralPointsSection({
	rows,
}: {
	rows: MerchantSocialReferralPoints[] | null
}) {
	const totalPoints = useMemo(
		() => (rows ?? []).reduce((s, r) => s + r.points, 0),
		[rows],
	)
	const totalEvents = useMemo(
		() => (rows ?? []).reduce((s, r) => s + r.eventTotal, 0),
		[rows],
	)

	return (
		<section className="space-y-3">
			<div className="min-w-0">
				<h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
					Social Referral Points
				</h2>
				<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
					Points you earn as referrer when friends open your merchant share link, install Beamio, top up,
					claim, or redeem.
				</p>
			</div>

			<div className={`${cardChrome} overflow-hidden p-4`}>
				<div className="flex items-center gap-3">
					<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1562f0]/10 text-[#1562f0]">
						<Sparkles className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
							Total referral points
						</p>
						<p className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
							{formatSocialPoints(totalPoints)}{' '}
							<span className="text-base font-bold text-slate-500">pts</span>
						</p>
						{totalEvents > 0 ? (
							<p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
								{totalEvents.toLocaleString()} referral events across {(rows ?? []).length} merchant
								{(rows ?? []).length === 1 ? '' : 's'}
							</p>
						) : null}
					</div>
				</div>
			</div>

			{rows == null ? null : rows.length === 0 ? (
				<div className={`${cardChrome} p-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400`}>
					No referral points yet. Share a merchant card from Discover to start earning.
				</div>
			) : (
				rows.map((row) => (
					<div key={row.cardAddress} className={`${cardChrome} p-4`}>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<h3 className="truncate text-base font-bold text-slate-900 dark:text-slate-50">
									{row.merchantName}
								</h3>
								<p className="mt-0.5 font-mono text-[11px] text-slate-400">
									{row.cardAddress.slice(0, 6)}…{row.cardAddress.slice(-4)}
								</p>
							</div>
							<span className="shrink-0 rounded-full bg-[#1562f0]/10 px-3 py-1 text-sm font-extrabold tabular-nums text-[#1562f0]">
								{formatSocialPoints(row.points)} pts
							</span>
						</div>

						<ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
							{row.events.map((ev) => (
								<li
									key={ev.key}
									className="flex items-center justify-between gap-2 text-sm"
								>
									<span className="flex min-w-0 items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
										<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
											{EVENT_ICON[ev.key]}
										</span>
										<span className="truncate">{ev.label}</span>
									</span>
									<span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-slate-50">
										{ev.count.toLocaleString()}
									</span>
								</li>
							))}
						</ul>
					</div>
				))
			)}
		</section>
	)
}

export default function BountyBoard() {
	const navigate = useNavigate()
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(true)
	const { profiles, currencyData, beamio } = useDaemonContext()
	const eoa = profiles?.[0]?.keyID?.trim() ?? ''
	const aaAccount = profiles?.[0]?.aaAccount?.trim() ?? ''
	const profileCurrency = (beamio?.currency ?? 'USD') as ICurrency
	const { balances: conetWalletBalances } = useConetWalletBalances(eoa)
	const { balances: aaWalletBalances } = useConetAaWalletBalances()
	const { profile: validatorProfile } = useDaemonValidatorWalletNodeProfile()
	const { stats: incomeStats } = useDaemonUnifiedIncomeStats()
	const [socialReferralRows, setSocialReferralRows] = useState<MerchantSocialReferralPoints[] | null>(
		null,
	)

	useEffect(() => {
		if (!eoa) {
			setSocialReferralRows(null)
			return
		}
		let cancelled = false
		void (async () => {
			const rows = await fetchBountySocialReferralPoints(eoa)
			if (cancelled) return
			// Trusted success only (incl. empty list); failure keeps previous.
			if (rows != null) setSocialReferralRows(rows)
		})()
		return () => {
			cancelled = true
		}
	}, [eoa])

	const usdcDisplay = useMemo(() => formatConetUsdcDisplay(conetWalletBalances.usdc), [conetWalletBalances.usdc])
	const fiatApprox = useMemo(
		() => formatConetUsdcFiatApprox(conetWalletBalances.usdc, profileCurrency, currencyData as Record<string, number>),
		[conetWalletBalances.usdc, profileCurrency, currencyData]
	)
	// L1 / DePIN Routing 显示受益人累计收益（非钱包余额）。
	// CNET = max(ValidatorNodeRewardIndexer, clRewardPaid)；CL 已结算奖励可能先于 indexer 入账。
	const miningGbDisplay = useMemo(
		() => formatConetChainTokenBalance(incomeStats?.gbBeneficiary.cumulative ?? '0'),
		[incomeStats?.gbBeneficiary.cumulative]
	)
	// DePIN Routing GB → USDC 估值：1 GB = 0.1 USDC（GB 为 0 也显示 ≈ 0.00 USDC）
	const miningGbUsdcApprox = useMemo(() => {
		const gb = Number(incomeStats?.gbBeneficiary.cumulative ?? '0')
		const usdc = Number.isFinite(gb) && gb > 0 ? gb * 0.1 : 0
		return `≈ ${usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
	}, [incomeStats?.gbBeneficiary.cumulative])
	const miningCnetDisplay = useMemo(
		() => formatConetChainTokenBalanceCompact(incomeStats?.cnetBeneficiary.cumulative ?? '0', 8),
		[incomeStats?.cnetBeneficiary.cumulative]
	)
	const miningCnetUnitLabel = useMemo(() => {
		const d = miningCnetDisplay
		if (d.endsWith('K') || d.endsWith('M')) return ''
		return 'CNET'
	}, [miningCnetDisplay])
	const totalNodesDisplay = useMemo(() => {
		// Validator / DePIN 成对出现（1:1），不再求和；展示节点对数量。
		const staked = validatorProfile?.validatorNodeCount ?? 0
		const depin = validatorProfile?.gbMiningNodeCount ?? 0
		return Math.max(staked, depin).toLocaleString()
	}, [validatorProfile?.validatorNodeCount, validatorProfile?.gbMiningNodeCount])

	const capsulePointer = capsuleOpacity < 0.05 ? 'none' : 'auto'

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-[#F2F2F7] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
			{/* 顶栏：左侧 Bounty Board 标题胶囊（对齐 /wallet） */}
			<div
				className="fixed left-4 right-4 z-40 flex items-center justify-between gap-2 transition-opacity duration-300"
				style={{
					top: 'max(1rem, env(safe-area-inset-top, 0px))',
					opacity: capsuleOpacity,
				}}
			>
				<div
					className={`flex items-center gap-2.5 py-2 pl-2 pr-4 ${capsuleChrome}`}
					style={{ pointerEvents: capsulePointer }}
				>
					<div
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
						style={{ backgroundColor: BOUNTY_CAPSULE_ACCENT }}
					>
						<Gift className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					</div>
					<span className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">Bounty Board</span>
				</div>
			</div>

			<div
				ref={setScrollRef}
				onScroll={onCapsuleScroll}
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-28"
				style={{ WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }}
			>
				<div
					className="shrink-0"
					style={{ minHeight: 'calc(max(1rem, env(safe-area-inset-top, 0px)) + 5rem)' }}
				/>
				<main className="mx-auto w-full max-w-2xl space-y-5 px-6 pt-2">
					{/* Total bounties earned */}
					<section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d4ed8] to-[#2563eb] p-6 text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)]">
						<p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Total Rewards Earned</p>
						<p className="mt-2 text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
							{usdcDisplay} <span className="text-3xl font-bold">USDC</span>
						</p>
						<p className="mt-2 text-sm text-white/75">{fiatApprox}</p>
						<p className="mt-4 text-[11px] leading-snug text-white/60">
							All rewards are automatically synced to your Main Wallet.
						</p>
					</section>

					{/* User wallet CNET balances — EOA and AA are separate spending wallets. */}
					<section className={`${cardChrome} p-5`}>
						<div className="flex items-center justify-between gap-2">
							<p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
								CNET BALANCES
							</p>
							<span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">CoNET Network</span>
						</div>
						<div className="mt-4 grid grid-cols-2 gap-3">
							<div className="rounded-xl bg-[#e9edff] px-3 py-3 dark:bg-[#0051d1]/15">
								<p className="text-xs font-semibold text-slate-600 dark:text-slate-300">EOA Wallet</p>
								<p className="mt-1 text-lg font-extrabold tabular-nums text-[#0051d1] dark:text-blue-300">
									{formatConetChainTokenBalance(conetWalletBalances.cnet)} CNET
								</p>
							</div>
							<div className="rounded-xl bg-[#f5ecff] px-3 py-3 dark:bg-[#8d3a8b]/15">
								<p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Smart Wallet (AA)</p>
								<p className="mt-1 text-lg font-extrabold tabular-nums text-[#8d3a8b] dark:text-purple-300">
									{aaAccount ? `${formatConetChainTokenBalance(aaWalletBalances.cnet)} CNET` : 'Not connected'}
								</p>
							</div>
						</div>
					</section>

					{/* CONET mining */}
					<section className={`${cardChrome} p-5`}>
						<div className="flex items-center justify-between gap-2">
							<p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
								NODE REWARDS
							</p>
							<button
								type="button"
								onClick={() => navigate('/BountyBoard/conet-mining')}
								aria-label="CoNET Mining settings"
								className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1562f0] transition active:scale-[0.96] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
							>
								<Settings2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
							</button>
						</div>
						<div className="mt-4 grid grid-cols-3 gap-3">
							{/* DePIN Routing */}
							<div className="min-w-0">
								<p className="text-xs font-medium text-slate-500 dark:text-slate-400">DePIN Routing</p>
								<p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
									{miningGbDisplay} GB
								</p>
								<p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
									{miningGbUsdcApprox}
								</p>
								<button
									type="button"
									className="mt-2 inline-flex items-center justify-center rounded-full border border-[#1562f0] px-3 py-1.5 text-xs font-bold text-[#1562f0] transition active:scale-[0.98]"
								>
									Claim USDC
								</button>
							</div>

							{/* L1 Network Gas */}
							<div className="min-w-0 overflow-hidden border-l border-slate-100 pl-3 dark:border-slate-800">
								<p className="text-xs font-medium text-slate-500 dark:text-slate-400">L1 Network Gas</p>
								<p className="mt-1 truncate text-lg font-extrabold tabular-nums leading-tight text-slate-900 sm:text-xl dark:text-slate-50">
									{miningCnetDisplay}
								</p>
								{miningCnetUnitLabel ? (
									<p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
										{miningCnetUnitLabel}
									</p>
								) : null}
							</div>

							{/* Total Nodes */}
							<div className="min-w-0 border-l border-slate-100 pl-3 dark:border-slate-800">
								<p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Nodes</p>
								<p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
									{totalNodesDisplay}
								</p>
							</div>
						</div>
					</section>

					<SocialReferralPointsSection rows={socialReferralRows} />

					{/* Bounty board list */}
					<section className="space-y-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Bounty Board</h2>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
									Share with friends. Earn when they join, claim, or redeem.
								</p>
							</div>
							<button
								type="button"
								className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-700 transition active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200"
							>
								<Filter className="h-4 w-4" aria-hidden />
								Filter
							</button>
						</div>

						<GenesisNodeReferralCard />

						{SAMPLE_BOUNTIES.map((item) => (
							<BountyCard key={item.id} item={item} />
						))}
					</section>
				</main>
			</div>
		</div>
	)
}
