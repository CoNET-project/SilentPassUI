import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Network, Coins, Globe, TrendingUp, ShieldCheck, Database, TicketPlus, Ticket } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { ValidatorDepositRedeemAdminSheet } from '@/components/BountyBoard/ValidatorDepositRedeemAdminSheet'
import { ValidatorDepositRedeemClaimSheet } from '@/components/BountyBoard/ValidatorDepositRedeemClaimSheet'
import { useValidatorDepositRedeemAdmin } from '@/hooks/useValidatorDepositRedeemAdmin'
import { resolveSessionEoa } from '@/utils/resolveSessionEoa'
import { syncValidatorDepositRedeemIssuedForAdmin } from '@/utils/syncValidatorDepositRedeemIssuedRecords'

const VALIDATOR_REDEEM_ISSUED_SYNC_MS = 30_000

/**
 * CoNET Mining detail — second-level page opened from the Bounty Board mining panel.
 * Follows the /discover item-detail convention: NO bottom global nav bar, a floating
 * circular back button over a hero header. Footer is hidden while mounted.
 *
 * Dashboard 指标遵守「本地优先、全局 background daemon 刷新」：数据由 DaemonProvider
 * 全局喂料（首屏即有本地缓存/seed 值，永不 `—`、永不 loading），本页只读不拉取。
 * 见 beamio-app-dashboard-daemon-local-first.mdc。
 */

const cardChrome =
	'rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'

const SAMPLE_DEPIN_IPS = ['74.208.45.12', '38.102.126.30', '216.225.192.76']

export default function CoNetMiningDetailPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter, conetNetworkStats: networkStats, conetDepinStats: depinStats } =
		useDaemonContext()
	const eoa = useMemo(() => resolveSessionEoa(profiles), [profiles])
	const { isRedeemAdmin, isContractAdmin } = useValidatorDepositRedeemAdmin(eoa)
	const [redeemSheetOpen, setRedeemSheetOpen] = useState(false)
	const [claimSheetOpen, setClaimSheetOpen] = useState(false)
	const showRedeemAdminButton = isRedeemAdmin === true || isContractAdmin === true
	const showClaimButton = Boolean(eoa)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	// Background prune of local issued-code ghosts (failed old-contract creates, etc.)
	useEffect(() => {
		if (!eoa || !showRedeemAdminButton) return
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
	}, [eoa, showRedeemAdminButton])

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
							{showClaimButton ? (
								<button
									type="button"
									onClick={() => setClaimSheetOpen(true)}
									className="flex h-9 items-center gap-1.5 rounded-full border border-white/40 bg-white/20 px-3 py-2 text-white/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition hover:bg-white/30"
									aria-label="Claim validator redeem code"
									title="Claim validators"
								>
									<Ticket className="h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
									<span className="text-[13px] font-semibold">Redeem</span>
								</button>
							) : null}
							{showRedeemAdminButton ? (
								<button
									type="button"
									onClick={() => setRedeemSheetOpen(true)}
									className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition hover:bg-white/30"
									aria-label="Create validator redeem code"
									title="Validator redeem admin"
								>
									<TicketPlus className="h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
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

					{/* 第三行：Your CoNET Mining —— 左侧 L1 挖矿累计 CoNET，右侧累计 GB */}
					<div className="mt-6">
						<p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Your CoNET Mining</p>
						<div className="mt-3 grid grid-cols-2 gap-3">
							<div>
								<div className="flex items-center gap-1.5 text-white/70">
									<TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
									<span className="text-[10px] font-semibold uppercase tracking-widest">L1 Mining</span>
								</div>
								<p className="mt-1.5 text-[34px] font-extrabold leading-none tracking-tight tabular-nums">
									85.5 <span className="text-xl font-bold text-white/80">CNET</span>
								</p>
								<p className="mt-1.5 text-[11px] text-white/55">$CNET · validator rewards</p>
							</div>
							<div>
								<div className="flex items-center gap-1.5 text-white/70">
									<Database className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
									<span className="text-[10px] font-semibold uppercase tracking-widest">DePIN Mining</span>
								</div>
								<p className="mt-1.5 text-[34px] font-extrabold leading-none tracking-tight tabular-nums">
									1,240 <span className="text-xl font-bold text-white/80">GB</span>
								</p>
								<p className="mt-1.5 text-[11px] text-white/55">≈ 12.40 USDC</p>
							</div>
						</div>
					</div>
				</div>

				<main className="mx-auto w-full max-w-2xl space-y-5 px-6 pt-5 pb-10">
					{showClaimButton ? (
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

					{/* Nodes summary */}
					<section className={`${cardChrome} p-5`}>
						<div className="flex items-center gap-2">
							<Server className="h-4 w-4 text-[#1562f0]" aria-hidden />
							<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">Nodes</h2>
						</div>
						<dl className="mt-4 space-y-3">
							<div className="flex items-center justify-between">
								<dt className="text-sm text-slate-500 dark:text-slate-400">Active nodes</dt>
								<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">1,248</dd>
							</div>
							<div className="flex items-center justify-between">
								<dt className="text-sm text-slate-500 dark:text-slate-400">DePIN mining nodes</dt>
								<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">3</dd>
							</div>
							<div className="flex items-center justify-between">
								<dt className="text-sm text-slate-500 dark:text-slate-400">Validator nodes</dt>
								<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">2</dd>
							</div>
						</dl>
					</section>

					{/* Earnings */}
					<section className={`${cardChrome} p-5`}>
						<div className="flex items-center gap-2">
							<Coins className="h-4 w-4 text-[#1562f0]" aria-hidden />
							<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">Earnings</h2>
						</div>
						<dl className="mt-4 space-y-3">
							<div className="flex items-center justify-between">
								<dt className="text-sm text-slate-500 dark:text-slate-400">GB (DePIN)</dt>
								<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">1,240</dd>
							</div>
							<div className="flex items-center justify-between">
								<dt className="text-sm text-slate-500 dark:text-slate-400">$CNET (L1)</dt>
								<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">85.5</dd>
							</div>
							<div className="flex items-center justify-between">
								<dt className="text-sm text-slate-500 dark:text-slate-400">Claimable USDC</dt>
								<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">12.40</dd>
							</div>
						</dl>
					</section>

					{/* DePIN node IPs */}
					<section className={`${cardChrome} p-5`}>
						<div className="flex items-center gap-2">
							<Network className="h-4 w-4 text-[#1562f0]" aria-hidden />
							<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">DePIN node IPs</h2>
							<span className="ml-auto text-xs font-semibold tabular-nums text-slate-400">{SAMPLE_DEPIN_IPS.length}</span>
						</div>
						<ul className="mt-4 space-y-2">
							{SAMPLE_DEPIN_IPS.map((ip) => (
								<li
									key={ip}
									className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
								>
									<Globe className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
									<span className="truncate font-mono text-sm text-slate-800 dark:text-slate-100">{ip}</span>
								</li>
							))}
						</ul>
					</section>
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
