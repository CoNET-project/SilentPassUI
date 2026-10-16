import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Gift, Hexagon, Settings2, Share2, Store, Users, Wallet } from 'lucide-react'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useConetAaWalletBalances, useConetWalletBalances } from '@/hooks/useConetUsdcBalance'
import { useDaemonValidatorWalletNodeProfile } from '@/hooks/useDaemonValidatorWalletNodeProfile'
import { useDaemonUnifiedIncomeStats } from '@/hooks/useDaemonUnifiedIncomeStats'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { formatWithThousands } from '@/services/beamio'
import { formatConetChainTokenBalance, formatConetChainTokenBalanceCompact } from '@/services/conetUsdcBalance'
import { formatGbDisplay } from '@/utils/formatGbDisplay'
import { formatDigitalAssetDisplay } from '@/utils/formatDigitalAssetDisplay'
import { fetchGenesisMemberSnapshot } from '@/services/genesisNodeReferral'
import { gbBandwidthProvidedParts } from '@/services/validatorWalletNodeProfile'

/**
 * Bounty Board — node rewards hub.
 * Top bar aligned with /wallet: fixed left title capsule, no right control / back.
 * Reached from the global bar's right-most tab (formerly /Pay).
 */

const BOUNTY_CAPSULE_ACCENT = '#1562f0'

const capsuleChrome =
	'rounded-full border border-slate-100/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800'

const cardChrome =
	'rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'

type RewardsHubView = 'overview' | 'referrals' | 'merchants' | 'nodes' | 'earnings'

const HUB_TABS: { id: Exclude<RewardsHubView, 'earnings'>; label: string }[] = [
	{ id: 'overview', label: 'Overview' },
	{ id: 'referrals', label: 'Referrals' },
	{ id: 'merchants', label: 'Merchants' },
	{ id: 'nodes', label: 'Nodes' },
]

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
	return formatDigitalAssetDisplay(Math.max(0, Number(balance) || 0))
}

export default function BountyBoard() {
	const navigate = useNavigate()
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(true)
	const { profiles, currencyData, beamio, setShowFooter } = useDaemonContext()
	const eoa = profiles?.[0]?.keyID?.trim() ?? ''
	const aaAccount = profiles?.[0]?.aaAccount?.trim() ?? ''
	const profileCurrency = (beamio?.currency ?? 'USD') as ICurrency
	const { balances: conetWalletBalances } = useConetWalletBalances(eoa)
	const { balances: aaWalletBalances } = useConetAaWalletBalances()
	const { profile: validatorProfile } = useDaemonValidatorWalletNodeProfile()
	const { stats: incomeStats } = useDaemonUnifiedIncomeStats()

	const usdcDisplay = useMemo(() => formatConetUsdcDisplay(conetWalletBalances.usdc), [conetWalletBalances.usdc])
	const fiatApprox = useMemo(
		() => formatConetUsdcFiatApprox(conetWalletBalances.usdc, profileCurrency, currencyData as Record<string, number>),
		[conetWalletBalances.usdc, profileCurrency, currencyData],
	)
	const bandwidthProvided = useMemo(() => gbBandwidthProvidedParts(incomeStats), [incomeStats])
	const miningGbDisplay = useMemo(
		() => formatGbDisplay(String(bandwidthProvided.totalGb)),
		[bandwidthProvided.totalGb],
	)
	const miningGbUsdcApprox = useMemo(() => {
		const gb = bandwidthProvided.totalGb
		const usdc = Number.isFinite(gb) && gb > 0 ? gb * 0.01 : 0
		return `≈ ${formatDigitalAssetDisplay(usdc)} USDC`
	}, [bandwidthProvided.totalGb])
	const miningCnetDisplay = useMemo(
		() => formatConetChainTokenBalanceCompact(incomeStats?.cnetBeneficiary.cumulative ?? '0'),
		[incomeStats?.cnetBeneficiary.cumulative],
	)
	const miningCnetUnitLabel = useMemo(() => {
		const d = miningCnetDisplay
		if (d.endsWith('K') || d.endsWith('M')) return ''
		return 'CNET'
	}, [miningCnetDisplay])
	const totalNodesDisplay = useMemo(() => {
		const staked = validatorProfile?.validatorNodeCount ?? 0
		const depin = validatorProfile?.gbMiningNodeCount ?? 0
		return Math.max(staked, depin).toLocaleString()
	}, [validatorProfile?.validatorNodeCount, validatorProfile?.gbMiningNodeCount])

	const capsulePointer = capsuleOpacity < 0.05 ? 'none' : 'auto'

	const [hubView, setHubView] = useState<RewardsHubView>('overview')
	const [isGenesisReferralAdmin, setIsGenesisReferralAdmin] = useState(false)
	const [isGenesisL0, setIsGenesisL0] = useState(false)
	const [isGenesisL1, setIsGenesisL1] = useState(false)

	// Main tab: always keep global Footer (detail pages hide it and restore on unmount).
	useEffect(() => {
		setShowFooter(true)
	}, [setShowFooter])

	useEffect(() => {
		if (!eoa) {
			setIsGenesisReferralAdmin(false)
			setIsGenesisL0(false)
			setIsGenesisL1(false)
			return
		}
		let cancelled = false
		void fetchGenesisMemberSnapshot(eoa)
			.then((snap) => {
				if (cancelled || !snap) return
				setIsGenesisReferralAdmin(snap.isAdmin)
				setIsGenesisL0(snap.isL0)
				setIsGenesisL1(snap.isL1)
			})
			.catch(() => {
				// Keep last trusted role flags on RPC failure.
			})
		return () => {
			cancelled = true
		}
	}, [eoa])

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-[#F2F2F7] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
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
					<span className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">Rewards Hub</span>
				</div>
				{eoa ? (
					<button
						type="button"
						onClick={() => navigate('/BountyBoard/genesis-referral')}
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-100/90 bg-white text-[#1562f0] shadow-[0_4px_24px_rgba(15,23,42,0.08)] transition active:scale-[0.96] hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
						style={{ pointerEvents: capsulePointer }}
						aria-label={
							isGenesisReferralAdmin || isGenesisL0 || isGenesisL1
								? 'Genesis Node referral'
								: 'Claim Genesis referral redeem code'
						}
						title={
							isGenesisReferralAdmin || isGenesisL0 || isGenesisL1
								? 'Genesis referral'
								: 'Claim Genesis code'
						}
					>
						<Share2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
					</button>
				) : null}
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
					<div
						className="flex gap-1 rounded-full bg-white/80 p-1 shadow-sm dark:bg-slate-900/80"
						role="tablist"
						aria-label="Rewards Hub sections"
					>
						{HUB_TABS.map((tab) => {
							const selected = hubView === tab.id || (hubView === 'earnings' && tab.id === 'overview')
							return (
								<button
									key={tab.id}
									type="button"
									role="tab"
									aria-selected={selected}
									onClick={() => setHubView(tab.id)}
									className={`min-w-0 flex-1 rounded-full px-2 py-2 text-[12px] font-semibold transition ${
										selected
											? 'bg-white text-[#1562f0] shadow-sm dark:bg-slate-800 dark:text-blue-300'
											: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
									}`}
								>
									{tab.label}
								</button>
							)
						})}
					</div>

					{hubView === 'overview' || hubView === 'earnings' ? (
						<section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d4ed8] to-[#2563eb] text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)]">
							<div className="p-6 pb-4">
								<div className="flex items-center justify-between gap-3">
									<p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
										Total rewards received
									</p>
									<span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90">
										All time
									</span>
								</div>
								<p className="mt-3 text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
									{usdcDisplay} <span className="text-3xl font-bold">USDC</span>
								</p>
								<p className="mt-2 text-sm text-white/80">{fiatApprox}</p>
								<p className="mt-3 text-sm text-white/75">From referrals, network contributions and nodes</p>
							</div>
							<div className="flex items-center justify-between gap-3 bg-[#1e3a8a]/45 px-6 py-3">
								<p className="text-xs text-white/80">Wallet USDC on this device</p>
								<button
									type="button"
									onClick={() => setHubView(hubView === 'earnings' ? 'overview' : 'earnings')}
									className="inline-flex items-center gap-0.5 text-xs font-semibold text-white"
								>
									{hubView === 'earnings' ? 'Hide breakdown' : 'View breakdown'}
									<ChevronRight className="h-3.5 w-3.5" aria-hidden />
								</button>
							</div>
						</section>
					) : null}

					{hubView === 'earnings' ? (
						<section className={`${cardChrome} p-5`}>
							<h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Rewards breakdown</h2>
							<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
								Live wallet and node figures. Program referral payouts appear here after they settle.
							</p>
							<dl className="mt-4 space-y-3 text-sm">
								<div className="flex items-center justify-between gap-3">
									<dt className="text-slate-500 dark:text-slate-400">Wallet USDC</dt>
									<dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{usdcDisplay} USDC</dd>
								</div>
								<div className="flex items-center justify-between gap-3">
									<dt className="text-slate-500 dark:text-slate-400">DePIN routing</dt>
									<dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{miningGbUsdcApprox}</dd>
								</div>
								<div className="flex items-center justify-between gap-3">
									<dt className="text-slate-500 dark:text-slate-400">L1 network</dt>
									<dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
										{miningCnetDisplay}
										{miningCnetUnitLabel ? ` ${miningCnetUnitLabel}` : ''}
									</dd>
								</div>
							</dl>
						</section>
					) : null}

					{hubView === 'overview' ? (
						<>
							<section>
								<h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-50">Your next steps</h2>
								<div className="grid grid-cols-2 gap-3">
									<div className={`${cardChrome} flex flex-col p-4`}>
										<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9edff] text-[#0051d1]">
											<Users className="h-4 w-4" strokeWidth={2.25} aria-hidden />
										</div>
										<h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Invite friends</h3>
										<p className="mt-1 flex-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
											Your personal invitation, ready to share.
										</p>
										<button
											type="button"
											onClick={() => navigate('/BountyBoard/genesis-referral')}
											className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1562f0] px-3 py-2 text-xs font-semibold text-white"
										>
											<Share2 className="h-3.5 w-3.5" aria-hidden />
											Share invite
										</button>
									</div>
									<div className={`${cardChrome} flex flex-col p-4`}>
										<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5ecff] text-[#8d3a8b]">
											<Store className="h-4 w-4" strokeWidth={2.25} aria-hidden />
										</div>
										<h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Business onboarding</h3>
										<p className="mt-1 flex-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
											Invite a business and help them get started.
										</p>
										<button
											type="button"
											onClick={() => setHubView('merchants')}
											className="mt-4 inline-flex items-center justify-center gap-1 rounded-full border border-[#1562f0]/30 px-3 py-2 text-xs font-semibold text-[#1562f0]"
										>
											Invite a business
											<ChevronRight className="h-3.5 w-3.5" aria-hidden />
										</button>
									</div>
								</div>
							</section>

							<section>
								<h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-50">Referral offers</h2>
								<div className={`${cardChrome} p-4`}>
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5ecff] text-sm font-bold text-[#8d3a8b]">
											LN
										</div>
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">Lao Nong Tang</p>
											<p className="text-xs text-slate-500 dark:text-slate-400">Restaurant · Merchant-funded reward</p>
										</div>
									</div>
									<div className="mt-4 flex items-end justify-between gap-3 border-t border-dashed border-slate-200 pt-4 dark:border-slate-700">
										<div>
											<p className="text-sm text-slate-600 dark:text-slate-300">Share a top-up. Earn a reward.</p>
											<span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
												Example offer
											</span>
										</div>
										<p className="shrink-0 text-right text-lg font-bold text-slate-900 dark:text-slate-50">
											5%
											<span className="mt-0.5 block text-[11px] font-medium text-slate-500">referral reward</span>
										</p>
									</div>
									<button
										type="button"
										onClick={() => setHubView('referrals')}
										className="mt-3 inline-flex items-center gap-0.5 text-sm font-semibold text-[#1562f0]"
									>
										View offer
										<ChevronRight className="h-4 w-4" aria-hidden />
									</button>
								</div>
							</section>
						</>
					) : null}

					{hubView === 'referrals' ? (
						<section className="space-y-4">
							<div>
								<h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Bring friends to Beamio</h2>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Share your invitation and see who joins.</p>
							</div>
							<div className={`${cardChrome} p-4`}>
								<h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Your personal invitation</h3>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">One link to share. Registration follows each program’s rules.</p>
								<button
									type="button"
									onClick={() => navigate('/BountyBoard/genesis-referral')}
									className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1562f0] px-4 py-2 text-sm font-semibold text-white"
								>
									<Share2 className="h-4 w-4" aria-hidden />
									Show invite
								</button>
							</div>
							<div className={`${cardChrome} p-4`}>
								<h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Lao Nong Tang</h3>
								<p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
									5% <span className="text-sm font-medium text-slate-500">referral reward</span>
								</p>
								<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
									Example offer. Qualifying top-ups made through your referral can earn this merchant-funded reward.
								</p>
							</div>
						</section>
					) : null}

					{hubView === 'merchants' ? (
						<section className="space-y-4">
							<div>
								<h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Your referred merchants</h2>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
									Track onboarding from your invitation. Usage and income appear after a business finishes setup.
								</p>
							</div>
							<button
								type="button"
								onClick={() => navigate('/BountyBoard/genesis-referral')}
								className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1562f0] px-4 py-2 text-sm font-semibold text-white"
							>
								Invite a business
							</button>
							<div className={`${cardChrome} p-4`}>
								<div className="flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
										<Store className="h-4 w-4" aria-hidden />
									</div>
									<div className="min-w-0 flex-1">
										<h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Lao Nong Tang</h3>
										<p className="text-xs text-slate-500 dark:text-slate-400">Example · referred merchant</p>
									</div>
									<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
										Example
									</span>
								</div>
								<p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
									B-Unit usage and income for a referred business show on this card after onboarding.
								</p>
							</div>
						</section>
					) : null}

					{hubView === 'overview' || hubView === 'nodes' ? (
						<>
							{hubView === 'nodes' ? (
								<div>
									<h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">CoNET node income</h2>
									<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your CNET balances and node rewards.</p>
								</div>
							) : (
								<div className="flex items-center justify-between">
									<h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">CoNET node income</h2>
									<button
										type="button"
										onClick={() => setHubView('nodes')}
										className="inline-flex items-center gap-0.5 text-sm font-semibold text-[#1562f0]"
									>
										View details
										<ChevronRight className="h-4 w-4" aria-hidden />
									</button>
								</div>
							)}

							<section className={`${cardChrome} p-5`}>
								<p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">CNET balances</p>
								<div className="mt-4 grid grid-cols-2 gap-3">
									<div className="rounded-xl border border-[#dce2f7] bg-[#e9edff] px-3 py-3 dark:border-[#0051d1]/30 dark:bg-[#0051d1]/15">
										<p className="flex items-center gap-1.5 text-xs font-semibold text-[#424655] dark:text-slate-300">
											<Wallet className="h-3.5 w-3.5 text-[#0051d1]" strokeWidth={2.25} aria-hidden />
											EOA Wallet
										</p>
										<p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
											{formatConetChainTokenBalance(conetWalletBalances.cnet)} CNET
										</p>
									</div>
									<div className="rounded-xl border border-[#eadcf7] bg-[#f5ecff] px-3 py-3 dark:border-[#8d3a8b]/30 dark:bg-[#8d3a8b]/15">
										<p className="flex items-center gap-1.5 text-xs font-semibold text-[#424655] dark:text-slate-300">
											<Hexagon className="h-3.5 w-3.5 text-[#8d3a8b]" strokeWidth={2.25} aria-hidden />
											Smart Wallet
										</p>
										<p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
											{aaAccount ? `${formatConetChainTokenBalance(aaWalletBalances.cnet)} CNET` : 'Not connected'}
										</p>
									</div>
								</div>
							</section>

							<section className={`${cardChrome} p-5`}>
								<div className="flex items-center justify-between gap-2">
									<p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Node rewards</p>
									<button
										type="button"
										onClick={() => navigate('/BountyBoard/conet-mining')}
										aria-label="CoNET Mining settings"
										className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1562f0] transition active:scale-[0.96] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
									>
										<Settings2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
									</button>
								</div>
								<div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
									<div className="col-span-2 min-w-0 sm:col-span-1">
										<p className="text-xs font-medium text-slate-500 dark:text-slate-400">DePIN Routing</p>
										<div className="mt-1 flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-stretch sm:justify-start sm:gap-0">
											<p className="min-w-0 break-words text-lg font-extrabold tabular-nums leading-none text-slate-900 sm:text-xl dark:text-slate-50">
												{miningGbDisplay}
												<span className="ml-1 text-sm font-bold text-slate-400 dark:text-slate-500">GB</span>
											</p>
											<p className="shrink-0 text-[11px] font-medium tabular-nums text-slate-400 sm:mt-0.5 dark:text-slate-500">
												{miningGbUsdcApprox}
											</p>
										</div>
										<div className="mt-2 flex justify-end sm:justify-start">
											<button
												type="button"
												disabled
												aria-disabled="true"
												title="Claim USDC is not available yet"
												className="inline-flex max-w-full items-center justify-center rounded-full bg-[#e9edff] px-3 py-1.5 text-xs font-bold text-[#1562f0] disabled:cursor-not-allowed disabled:opacity-60"
											>
												Claim USDC
											</button>
										</div>
									</div>
									<div className="min-w-0 border-t border-slate-100 pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0 dark:border-slate-800">
										<p className="text-xs font-medium text-slate-500 dark:text-slate-400">L1 Network</p>
										<p className="mt-1 break-words text-lg font-extrabold tabular-nums leading-none text-slate-900 sm:text-xl dark:text-slate-50">
											{miningCnetDisplay}
											{miningCnetUnitLabel ? (
												<span className="ml-1 text-sm font-bold text-slate-400 dark:text-slate-500">{miningCnetUnitLabel}</span>
											) : null}
										</p>
									</div>
									<div className="min-w-0 border-t border-l border-slate-100 pl-3 pt-3 sm:border-t-0 sm:pt-0 dark:border-slate-800">
										<p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Nodes</p>
										<p className="mt-1 break-words text-lg font-extrabold tabular-nums leading-none text-slate-900 sm:text-xl dark:text-slate-50">
											{totalNodesDisplay}
										</p>
									</div>
								</div>
							</section>
						</>
					) : null}
				</main>
			</div>
		</div>
	)
}
