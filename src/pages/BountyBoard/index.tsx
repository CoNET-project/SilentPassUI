import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, Settings2, Share2 } from 'lucide-react'
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
		const usdc = Number.isFinite(gb) && gb > 0 ? gb * 0.1 : 0
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
					<span className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">Bounty Board</span>
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

							<div className="min-w-0 border-l border-slate-100 pl-3 dark:border-slate-800">
								<p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Nodes</p>
								<p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
									{totalNodesDisplay}
								</p>
							</div>
						</div>
					</section>
				</main>
			</div>
		</div>
	)
}
