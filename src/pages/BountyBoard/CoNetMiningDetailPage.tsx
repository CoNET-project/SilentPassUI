import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Server,
	Coins,
	TrendingUp,
	ShieldCheck,
	Database,
	TicketPlus,
	Ticket,
	Loader2,
	RefreshCw,
	Check,
	AlertTriangle,
} from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { ValidatorDepositRedeemAdminSheet } from '@/components/BountyBoard/ValidatorDepositRedeemAdminSheet'
import { ValidatorDepositRedeemClaimSheet } from '@/components/BountyBoard/ValidatorDepositRedeemClaimSheet'
import { useValidatorDepositRedeemAdmin } from '@/hooks/useValidatorDepositRedeemAdmin'
import { useValidatorWalletNodeProfile } from '@/hooks/useValidatorWalletNodeProfile'
import { useUnifiedIncomeStats } from '@/hooks/useUnifiedIncomeStats'
import { useDepinNodeCountryLabelsByIp } from '@/hooks/useDepinNodeCountryLabelsByIp'
import { resolveSessionEoa } from '@/utils/resolveSessionEoa'
import { syncValidatorDepositRedeemIssuedForAdmin } from '@/utils/syncValidatorDepositRedeemIssuedRecords'
import type { ValidatorWalletNodeProfile } from '@/services/validatorWalletNodeProfile'

const VALIDATOR_REDEEM_ISSUED_SYNC_MS = 30_000

type RefreshStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * CoNET Mining detail — second-level page opened from the Bounty Board mining panel.
 * Follows the /discover item-detail convention: NO bottom global nav bar, a floating
 * circular back button over a hero header. Footer is hidden while mounted.
 *
 * Dashboard 指标遵守「本地优先、全局 background daemon 刷新」：数据由 DaemonProvider
 * 全局喂料（首屏即有本地缓存/seed 值，永不 `—`、永不 loading），本页只读不拉取。
 * 见 beamio-app-dashboard-daemon-local-first.mdc。
 *
 * 用户个人节点 / 收益：直读 ValidatorDepositRedeem（resolveNodeBundle + resolveUnifiedIncomeStats）。
 */

const cardChrome =
	'rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'

function formatBalance(raw: string): string {
	const n = Number(raw)
	if (!Number.isFinite(n)) return raw
	if (n === 0) return '0'
	if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
	return n.toLocaleString(undefined, { maximumFractionDigits: 8 })
}

function beneficiaryHasNodes(profile: ValidatorWalletNodeProfile | null): boolean {
	if (!profile) return false
	return (
		profile.validatorNodeCount > 0 ||
		profile.gbMiningNodeCount > 0 ||
		profile.conetDepinNodeIps.length > 0
	)
}

function shortAddress(addr: string): string {
	if (addr.length < 12) return addr
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function CoNetMiningDetailPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter, conetNetworkStats: networkStats, conetDepinStats: depinStats } =
		useDaemonContext()
	const eoa = useMemo(() => resolveSessionEoa(profiles), [profiles])
	const { isRedeemAdmin } = useValidatorDepositRedeemAdmin(eoa)
	const { profile, loading: profileLoading, stale: profileStale, refresh: refreshProfile } =
		useValidatorWalletNodeProfile(eoa)
	const { stats: incomeStats, loading: incomeLoading, stale: incomeStale, refresh: refreshIncome } =
		useUnifiedIncomeStats(eoa)
	const nodeIncomeIps = useMemo(
		() => (incomeStats?.nodes ?? []).map((row) => row.depinNodeIp).filter(Boolean),
		[incomeStats?.nodes]
	)
	const { countryByIp } = useDepinNodeCountryLabelsByIp(nodeIncomeIps)

	const [redeemSheetOpen, setRedeemSheetOpen] = useState(false)
	const [claimSheetOpen, setClaimSheetOpen] = useState(false)
	const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>('idle')

	const showRedeemAdminManageButton = isRedeemAdmin === true
	const hasNodes = beneficiaryHasNodes(profile)
	const personalStale = profileStale || incomeStale
	const showPersonalLoading = Boolean(eoa && profileLoading && !profile)

	const handlePersonalRefresh = useCallback(async () => {
		if (refreshStatus !== 'idle' || !eoa) return
		setRefreshStatus('loading')
		try {
			refreshProfile()
			refreshIncome()
			await new Promise((r) => window.setTimeout(r, 600))
			setRefreshStatus('success')
		} catch {
			setRefreshStatus('error')
		} finally {
			window.setTimeout(() => setRefreshStatus('idle'), 3000)
		}
	}, [eoa, refreshProfile, refreshIncome, refreshStatus])

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	// Background prune of local issued-code ghosts (failed old-contract creates, etc.)
	useEffect(() => {
		if (!eoa || !showRedeemAdminManageButton) return
		const adminLower = eoa.trim().toLowerCase()
		let cancelled = false
		let timer: ReturnType<typeof setTimeout> | undefined

		const tick = () => {
			void (async () => {
				if (cancelled) return
				await syncValidatorDepositRedeemIssuedForAdmin(adminLower).catch(() => undefined)
				if (!cancelled) timer = setTimeout(tick, VALIDATOR_REDEEM_ISSUED_SYNC_MS)
			})()
		}

		tick()
		return () => {
			cancelled = true
			if (timer !== undefined) clearTimeout(timer)
		}
	}, [eoa, showRedeemAdminManageButton])

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-[#F2F2F7] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
			<div
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
				style={{ WebkitOverflowScrolling: 'touch' }}
			>
				{/* Hero header with floating back button (aligned to /discover detail) */}
				<div className="relative shrink-0 overflow-hidden rounded-b-[28px] bg-gradient-to-br from-[#1d4ed8] to-[#2563eb] px-5 pb-8 text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)]">
					<div
						className="flex items-start justify-between gap-2"
						style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
					>
						<BeamioCircularBackButton onClick={() => navigate('/BountyBoard')} />
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<button
								type="button"
								onClick={() => setClaimSheetOpen(true)}
								disabled={!eoa}
								className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-50"
								aria-label="Claim validator redeem code"
								title="Redeem code"
							>
								<Ticket className="h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
							</button>
							{showRedeemAdminManageButton ? (
								<button
									type="button"
									onClick={() => setRedeemSheetOpen(true)}
									disabled={!eoa}
									className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-50"
									aria-label="Manage validator redeem codes"
									title="Create / manage redeem codes"
								>
									<TicketPlus className="h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
								</button>
							) : null}
							{hasNodes ? (
								<button
									type="button"
									onClick={() => void handlePersonalRefresh()}
									disabled={refreshStatus !== 'idle'}
									className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-70"
									aria-label="Refresh your mining stats"
									title="Refresh your mining stats"
								>
									{refreshStatus === 'loading' ? (
										<Loader2 className="h-[17px] w-[17px] animate-spin" aria-hidden />
									) : refreshStatus === 'success' ? (
										<Check className="h-[17px] w-[17px] text-emerald-300" aria-hidden />
									) : refreshStatus === 'error' ? (
										<AlertTriangle className="h-[17px] w-[17px] text-amber-300" aria-hidden />
									) : (
										<RefreshCw className="h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
									)}
								</button>
							) : null}
						</div>
					</div>

					{/* Dashboard 第一行：CoNET L1 全网指标（对齐区块浏览器首页面板） */}
					<div className="mt-5 grid grid-cols-2 gap-3">
						<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
							<div className="flex items-center gap-1.5 text-white/70">
								<ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
								<span className="text-[10px] font-semibold uppercase tracking-widest">Total staked validators</span>
							</div>
							<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
								{networkStats.stakedValidatorsFormatted}
							</p>
							<p className="mt-1 text-[11px] text-white/55">CoNET L1 network</p>
						</div>
						<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
							<div className="flex items-center gap-1.5 text-white/70">
								<TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
								<span className="text-[10px] font-semibold uppercase tracking-widest">CONET supply increase</span>
							</div>
							<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
								{networkStats.supplyIncreaseFormatted}
							</p>
							<p className="mt-1 text-[11px] text-white/55">$CNET · cumulative</p>
						</div>
					</div>

					{/* Dashboard 第二行：CoNET DePIN 全网指标（节点数量 + GB 代币总产量） */}
					<div className="mt-3 grid grid-cols-2 gap-3">
						<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
							<div className="flex items-center gap-1.5 text-white/70">
								<Server className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
								<span className="text-[10px] font-semibold uppercase tracking-widest">DePIN nodes</span>
							</div>
							<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
								{depinStats.depinNodeCountFormatted}
							</p>
							<p className="mt-1 text-[11px] text-white/55">CoNET DePIN · online</p>
						</div>
						<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
							<div className="flex items-center gap-1.5 text-white/70">
								<Database className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
								<span className="text-[10px] font-semibold uppercase tracking-widest">GB minted (total)</span>
							</div>
							<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
								{depinStats.totalGbIssuedFormatted}
								<span className="ml-1 text-sm font-bold text-white/70">GB</span>
							</p>
							<p className="mt-1 text-[11px] text-white/55">DePIN bandwidth rewards</p>
						</div>
					</div>

					{/* Your CoNET Mining — 仅 redeem 受益人且持有节点时展示链上累计收益 */}
					{hasNodes && incomeStats ? (
						<div className="mt-6">
							<p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Your CoNET Mining</p>
							<div className="mt-3 grid grid-cols-2 gap-3">
								<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
									<div className="flex items-center gap-1.5 text-white/70">
										<TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
										<span className="text-[10px] font-semibold uppercase tracking-widest">L1 Mining</span>
									</div>
									<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
										{formatBalance(incomeStats.cnetBeneficiary.cumulative)}{' '}
										<span className="text-sm font-bold text-white/80">CNET</span>
									</p>
									<p className="mt-1.5 text-[11px] text-white/55">$CNET · cumulative rewards</p>
								</div>
								<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
									<div className="flex items-center gap-1.5 text-white/70">
										<Database className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
										<span className="text-[10px] font-semibold uppercase tracking-widest">DePIN Mining</span>
									</div>
									<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
										{formatBalance(incomeStats.gbBeneficiary.cumulative)}{' '}
										<span className="text-sm font-bold text-white/80">GB</span>
									</p>
									<p className="mt-1.5 text-[11px] text-white/55">GB · cumulative rewards</p>
								</div>
							</div>
							{profile ? (
								<div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
									<div className="flex items-center gap-1.5 text-white/70">
										<Server className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
										<span className="text-[10px] font-semibold uppercase tracking-widest">Your nodes</span>
									</div>
									<div className="mt-2 grid grid-cols-2 gap-3">
										<div>
											<p className="text-[11px] text-white/55">Validator nodes</p>
											<p className="mt-0.5 text-xl font-extrabold leading-none tabular-nums">
												{profile.validatorNodeCount}
											</p>
										</div>
										<div>
											<p className="text-[11px] text-white/55">DePIN mining nodes</p>
											<p className="mt-0.5 text-xl font-extrabold leading-none tabular-nums">
												{profile.gbMiningNodeCount}
											</p>
										</div>
									</div>
								</div>
							) : null}
						</div>
					) : hasNodes && incomeLoading ? (
						<div className="mt-6 flex items-center gap-2 text-sm text-white/70">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							Loading your mining rewards…
						</div>
					) : null}
				</div>

				<main className="mx-auto w-full max-w-2xl space-y-5 px-6 pt-5 pb-10">
					{showPersonalLoading ? (
						<div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
							<Loader2 className="h-5 w-5 animate-spin text-[#1562f0]" aria-hidden />
							Loading your validator profile…
						</div>
					) : null}

					{personalStale && hasNodes ? (
						<div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
							<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
							<span>Showing the last known data — couldn&apos;t refresh from CoNET just now.</span>
						</div>
					) : null}

					{eoa ? (
						<section className={`${cardChrome} p-5`}>
							<div className="flex items-start gap-3">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1562f0]/10 text-[#1562f0]">
									<Ticket className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</div>
								<div className="min-w-0 flex-1">
									<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
										Validator redeem
									</h2>
									<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
										Have a redeem code from an operator? Claim validator and DePIN GB node slots to your
										beneficiary wallet.
									</p>
									<button
										type="button"
										onClick={() => setClaimSheetOpen(true)}
										className="mt-4 w-full rounded-xl bg-[#1562f0] py-2.5 text-sm font-bold text-white shadow-sm"
									>
										Redeem code
									</button>
								</div>
							</div>
						</section>
					) : null}

					{eoa && !showPersonalLoading && !hasNodes ? (
						<section className={`${cardChrome} p-5`}>
							<p className="text-sm text-slate-500 dark:text-slate-400">
								No ValidatorDepositRedeem nodes are linked to this wallet yet. Redeem a code to claim validator and
								DePIN node slots.
							</p>
						</section>
					) : null}

					{hasNodes && profile ? (
						<>
							{/* Per-node earnings */}
							{incomeStats && incomeStats.nodes.length > 0 ? (
								<section className={`${cardChrome} p-5`}>
									<div className="flex items-center gap-2">
										<Coins className="h-4 w-4 text-[#1562f0]" aria-hidden />
										<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
											Node earnings
										</h2>
										<span className="ml-auto text-xs font-semibold tabular-nums text-slate-400">
											{incomeStats.nodes.length}
										</span>
									</div>
									<div className="mt-4 overflow-x-auto">
										<table className="w-full min-w-[320px] text-left text-sm">
											<thead>
												<tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:border-slate-700">
													<th className="pb-2 pr-3 font-bold">Node</th>
													<th className="pb-2 pr-3 font-bold">Country</th>
													<th className="pb-2 pr-3 font-bold text-right">GB</th>
													<th className="pb-2 font-bold text-right">CNET</th>
												</tr>
											</thead>
											<tbody>
												{incomeStats.nodes.map((row) => {
													const ipKey = row.depinNodeIp.trim().toLowerCase()
													const countryLabel = ipKey ? countryByIp[ipKey] : undefined
													return (
													<tr
														key={`${row.nodeWallet}-${row.depinNodeIp}`}
														className="border-b border-slate-50 last:border-0 dark:border-slate-800"
													>
														<td className="py-3 pr-3 align-top">
															<div className="font-mono text-xs text-slate-800 dark:text-slate-100">
																{row.depinNodeIp || shortAddress(row.nodeWallet)}
															</div>
															{row.depinNodeIp ? (
																<div className="mt-0.5 font-mono text-[10px] text-slate-400">
																	{shortAddress(row.nodeWallet)}
																</div>
															) : null}
														</td>
														<td className="py-3 pr-3 align-top text-xs text-slate-600 dark:text-slate-300">
															{countryLabel ?? (ipKey ? '…' : 'Unavailable')}
														</td>
														<td className="py-3 pr-3 align-top text-right tabular-nums font-semibold text-slate-900 dark:text-slate-50">
															{formatBalance(row.gb.cumulative)}
														</td>
														<td className="py-3 align-top text-right tabular-nums font-semibold text-slate-900 dark:text-slate-50">
															{formatBalance(row.cnet.cumulative)}
														</td>
													</tr>
													)
												})}
											</tbody>
										</table>
									</div>
								</section>
							) : null}
						</>
					) : null}
				</main>
			</div>

			{eoa ? (
				<>
					<ValidatorDepositRedeemClaimSheet
						open={claimSheetOpen}
						onClose={() => setClaimSheetOpen(false)}
						claimerEoa={eoa}
					/>
					<ValidatorDepositRedeemAdminSheet
						open={redeemSheetOpen}
						onClose={() => setRedeemSheetOpen(false)}
						adminEoa={eoa}
						canCreate={isRedeemAdmin === true}
					/>
				</>
			) : null}
		</div>
	)
}
