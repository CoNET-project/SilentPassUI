import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, Utensils, Share2, Filter, Settings2 } from 'lucide-react'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'

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

const SAMPLE_BOUNTIES: BountyItem[] = [
	{
		id: 'lao-nong-tang',
		name: 'Lao Nong Tang',
		poolLeftUsd: '150.00',
		claimRewardUsd: '0.50',
		redeemRewardUsd: '2.00',
	},
]

function BountyCard({ item }: { item: BountyItem }) {
	return (
		<div className={`${cardChrome} p-4`}>
			<div className="flex items-start gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-orange-500/15">
					<Utensils className="h-5 w-5" strokeWidth={2.25} aria-hidden />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<h3 className="truncate text-base font-bold text-slate-900 dark:text-slate-50">{item.name}</h3>
						<span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
							Pool: ${item.poolLeftUsd} left
						</span>
					</div>
					<p className="mt-1 text-sm leading-snug text-slate-500 dark:text-slate-400">
						Share with friends. Get <span className="font-semibold text-[#1562f0]">${item.claimRewardUsd}</span> when
						they claim, plus <span className="font-semibold text-[#1562f0]">${item.redeemRewardUsd}</span> when they
						redeem in-store.
					</p>
				</div>
			</div>

			<div className="mt-4 grid grid-cols-2 gap-3">
				<button
					type="button"
					className="flex items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200"
				>
					View Details
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

export default function BountyBoard() {
	const navigate = useNavigate()
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(true)

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
						<p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Total Bounties Earned</p>
						<p className="mt-2 text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
							245.80 <span className="text-3xl font-bold">USDC</span>
						</p>
						<p className="mt-2 text-sm text-white/75">≈ CA$ 332.10</p>

						<div className="mt-5 grid grid-cols-2 gap-3">
							<button
								type="button"
								onClick={() => navigate('/Pay')}
								className="flex items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-bold text-[#1562f0] transition active:scale-[0.98]"
							>
								Pay In-Store
							</button>
							<button
								type="button"
								className="flex items-center justify-center rounded-full border border-white/70 px-4 py-3 text-sm font-bold text-white transition active:scale-[0.98] hover:bg-white/10"
							>
								Cash Out
							</button>
						</div>
					</section>

					{/* CONET mining */}
					<section className={`${cardChrome} p-5`}>
						<div className="flex items-center justify-between gap-2">
							<p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
								CoNET Mining
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
							{/* DePIN Mining */}
							<div className="min-w-0">
								<p className="text-xs font-medium text-slate-500 dark:text-slate-400">DePIN Mining</p>
								<p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">1,240 GB</p>
								<p className="text-[11px] text-slate-400">≈ 12.40 USDC</p>
								<button
									type="button"
									className="mt-2 inline-flex items-center justify-center rounded-full border border-[#1562f0] px-3 py-1.5 text-xs font-bold text-[#1562f0] transition active:scale-[0.98]"
								>
									Claim USDC
								</button>
							</div>

							{/* L1 Mining */}
							<div className="min-w-0 border-l border-slate-100 pl-3 dark:border-slate-800">
								<p className="text-xs font-medium text-slate-500 dark:text-slate-400">L1 Mining</p>
								<p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">85.5</p>
								<p className="text-sm font-bold text-slate-900 dark:text-slate-50">$CNET</p>
								<p className="mt-1 text-[11px] leading-tight text-slate-400">Native Gas Token</p>
							</div>

							{/* Total Nodes */}
							<div className="min-w-0 border-l border-slate-100 pl-3 dark:border-slate-800">
								<p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Nodes</p>
								<p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">1,248</p>
								<p className="mt-1 text-[11px] leading-tight text-slate-400">Active Nodes</p>
							</div>
						</div>
					</section>

					{/* Bounty board list */}
					<section className="space-y-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Bounty Board</h2>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
									Share with friends. Earn when they claim and redeem.
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

						{SAMPLE_BOUNTIES.map((item) => (
							<BountyCard key={item.id} item={item} />
						))}
					</section>
				</main>
			</div>
		</div>
	)
}
