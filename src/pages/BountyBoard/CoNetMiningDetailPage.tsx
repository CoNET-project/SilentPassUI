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
	Clock,
	Loader2,
	ArrowRight,
	CheckCircle2,
	Check,
	Copy,
	ExternalLink,
	Lock,
} from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { ValidatorDepositRedeemAdminSheet } from '@/components/BountyBoard/ValidatorDepositRedeemAdminSheet'
import { ValidatorDepositRedeemClaimSheet } from '@/components/BountyBoard/ValidatorDepositRedeemClaimSheet'
import { GenesisLoyaltyVestingSheet } from '@/components/BountyBoard/GenesisLoyaltyVestingSheet'
import { useValidatorDepositRedeemAdmin } from '@/hooks/useValidatorDepositRedeemAdmin'
import { useDaemonValidatorWalletNodeProfile } from '@/hooks/useDaemonValidatorWalletNodeProfile'
import { useDaemonUnifiedIncomeStats } from '@/hooks/useDaemonUnifiedIncomeStats'
import { useDepinNodeCountryLabelsByIp } from '@/hooks/useDepinNodeCountryLabelsByIp'
import { resolveSessionEoa } from '@/utils/resolveSessionEoa'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import {
	previewValidatorDepositRedeemClaim,
	signAndSubmitValidatorDepositRedeemClaim,
} from '@/services/validatorDepositRedeemClaim'
import { syncValidatorDepositRedeemIssuedForAdmin } from '@/utils/syncValidatorDepositRedeemIssuedRecords'
import type { ValidatorWalletNodeProfile } from '@/services/validatorWalletNodeProfile'

const VALIDATOR_REDEEM_ISSUED_SYNC_MS = 30_000

/**
 * CoNET Mining detail — second-level page opened from the Bounty Board mining panel.
 * Follows the /discover item-detail convention: NO bottom global nav bar, a floating
 * circular back button over a hero header. Footer is hidden while mounted.
 *
 * Dashboard 指标遵守「本地优先、全局 background daemon 刷新」：数据由 DaemonProvider
 * 全局喂料（首屏即有本地缓存/seed 值，永不 `—`、永不 loading），本页只读不拉取。
 * 见 beamio-app-dashboard-daemon-local-first.mdc。
 *
 * 用户个人节点 / 收益：DaemonProvider 每 6s 喂料（resolveNodeBundle + resolveUnifiedIncomeStats）。
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

/** CNET airdrop（vesting）展示：固定两位小数（如 100.00 CNET）。 */
function formatVestingCnet(value: string): string {
	const n = Number(value)
	if (!Number.isFinite(n)) return value
	return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Genesis Loyalty 子行：有授予额即展示（含 claimableAt 未开、线性尚未解锁时 accrued>0 / claimable=0）。 */
function genesisLoyaltyPanelLine(airdrop: { accrued: string; claimable: string } | null | undefined): string | null {
	if (!airdrop) return null
	const accrued = Number(airdrop.accrued)
	const claimable = Number(airdrop.claimable)
	if (!Number.isFinite(accrued) || accrued <= 0) return null
	if (Number.isFinite(claimable) && claimable > 0) {
		return `${formatVestingCnet(airdrop.claimable)} CNET (Vesting)`
	}
	return `${formatVestingCnet(airdrop.accrued)} CNET (Genesis Loyalty)`
}

/** DePIN Routing GB → USDC 估值：1 GB = 0.1 USDC（GB 为 0 也显示 ≈ 0.00 USDC） */
function formatGbUsdcApprox(gbCumulative: string): string {
	const gb = Number(gbCumulative)
	const usdc = Number.isFinite(gb) && gb > 0 ? gb * 0.1 : 0
	return `≈ ${usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
}

function ValidatorNodeCountDisplay({ profile }: { profile: ValidatorWalletNodeProfile }) {
	const { validatorNodeCount } = profile
	const validatorPendingCount = profile.validatorPendingCount ?? 0
	if (validatorPendingCount <= 0) {
		return <span>{validatorNodeCount}</span>
	}
	return (
		<span className="inline-flex items-center gap-1">
			<span>{validatorNodeCount}</span>
			<span className="font-bold text-white/55">/</span>
			<span
				className="inline-flex items-center gap-1 text-amber-300"
				title={`${validatorPendingCount} validator node${validatorPendingCount === 1 ? '' : 's'} pending activation`}
			>
				<span>{validatorPendingCount}</span>
				<Clock className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
			</span>
		</span>
	)
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

function NodeWalletAddressCapsule({ address }: { address: string }) {
	const [copied, setCopied] = useState(false)
	const normalized = address.trim()
	if (!normalized) return null

	const copyAddress = async (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault()
		event.stopPropagation()
		try {
			await navigator.clipboard.writeText(normalized)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch {
			// Clipboard access can be unavailable in non-secure browser contexts.
		}
	}

	return (
		<div className="inline-flex max-w-full items-center overflow-hidden rounded-full border border-[#dce2f7] bg-[#e9edff] text-[#424655]">
			<a
				href={`https://mainnet.conet.network/address/${encodeURIComponent(normalized)}`}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex min-w-0 items-center gap-1.5 py-1.5 pl-2.5 text-xs font-medium transition hover:bg-[#dfe5ff]"
				aria-label={`Open node wallet ${normalized} on CoNET Explorer`}
			>
				<span className="truncate font-mono">{shortAddress(normalized)}</span>
				<ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#0051d1]" strokeWidth={2.25} aria-hidden />
			</a>
			<button
				type="button"
				onClick={copyAddress}
				className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-[#0051d1] transition hover:bg-[#dfe5ff]"
				aria-label={copied ? 'Node wallet address copied' : 'Copy node wallet address'}
			>
				{copied ? (
					<Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} aria-hidden />
				) : (
					<Copy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
				)}
			</button>
		</div>
	)
}

function ValidatorPubkeyCapsule({ pubkey }: { pubkey: string | undefined }) {
	const [copied, setCopied] = useState(false)
	const normalized = pubkey?.trim() ?? ''
	if (!normalized) {
		return <span className="font-mono text-xs text-slate-400">Pending</span>
	}

	const copyPubkey = async (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault()
		event.stopPropagation()
		try {
			await navigator.clipboard.writeText(normalized)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch {
			// Clipboard access can be unavailable in non-secure browser contexts.
		}
	}

	return (
		<div className="inline-flex max-w-full items-center overflow-hidden rounded-full border border-[#dce2f7] bg-[#e9edff] text-[#424655]">
			<a
				href={`https://mainnet.conet.network/search-results?q=${encodeURIComponent(normalized)}`}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex min-w-0 items-center gap-1.5 py-1.5 pl-2.5 text-xs font-medium transition hover:bg-[#dfe5ff]"
				aria-label={`Open validator ${normalized} on CoNET Explorer`}
			>
				<span className="truncate font-mono">{shortValidatorPubkey(normalized)}</span>
				<ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#0051d1]" strokeWidth={2.25} aria-hidden />
			</a>
			<button
				type="button"
				onClick={copyPubkey}
				className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-[#0051d1] transition hover:bg-[#dfe5ff]"
				aria-label={copied ? 'Validator pubkey copied' : 'Copy validator pubkey'}
			>
				{copied ? (
					<Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} aria-hidden />
				) : (
					<Copy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
				)}
			</button>
		</div>
	)
}

function shortValidatorPubkey(pubkey: string | undefined): string {
	if (!pubkey) return 'Pending'
	const hex = pubkey.startsWith('0x') ? pubkey.slice(2) : pubkey
	if (hex.length <= 16) return pubkey.startsWith('0x') ? pubkey : `0x${pubkey}`
	return `0x${hex.slice(0, 8)}…${hex.slice(-6)}`
}

export default function CoNetMiningDetailPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter, conetNetworkStats: networkStats, conetDepinStats: depinStats } =
		useDaemonContext()
	const eoa = useMemo(() => resolveSessionEoa(profiles), [profiles])
	const { isRedeemAdmin } = useValidatorDepositRedeemAdmin(eoa)
	const { profile } = useDaemonValidatorWalletNodeProfile()
	const { stats: incomeStats } = useDaemonUnifiedIncomeStats()
	const gbUsdcApprox = useMemo(
		() => formatGbUsdcApprox(incomeStats?.gbBeneficiary.cumulative ?? '0'),
		[incomeStats?.gbBeneficiary.cumulative],
	)
	const genesisLoyaltyLine = useMemo(
		() => genesisLoyaltyPanelLine(incomeStats?.airdrop ?? null),
		[incomeStats?.airdrop],
	)
	const nodeIncomeIps = useMemo(
		() => (incomeStats?.nodes ?? []).map((row) => row.depinNodeIp).filter(Boolean),
		[incomeStats?.nodes]
	)
	const { countryByIp } = useDepinNodeCountryLabelsByIp(nodeIncomeIps)

	const [redeemSheetOpen, setRedeemSheetOpen] = useState(false)
	const [claimSheetOpen, setClaimSheetOpen] = useState(false)
	const [vestingSheetOpen, setVestingSheetOpen] = useState(false)

	// Inline "Activate Your Node" redeem flow (replaces the old Redeem code button).
	const [inlineCode, setInlineCode] = useState('')
	const [inlineStatus, setInlineStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
	const [inlineError, setInlineError] = useState('')
	const [inlineRedeemedCount, setInlineRedeemedCount] = useState(0)

	const inlineBusy = inlineStatus === 'loading'

	const handleInlineRedeem = useCallback(async () => {
		if (!eoa) return
		const code = inlineCode.trim()
		if (!code) {
			setInlineStatus('error')
			setInlineError('Enter a redeem code.')
			return
		}
		const armor = resolveSigningPrivateKeyArmor(profiles?.[0])
		if (!armor) {
			setInlineStatus('error')
			setInlineError('Unlock your wallet to sign the claim.')
			return
		}
		setInlineStatus('loading')
		setInlineError('')
		try {
			const preview = await previewValidatorDepositRedeemClaim({ secretCode: code, claimerEoa: eoa })
			if (!preview.ok) {
				setInlineStatus('error')
				setInlineError(preview.error)
				return
			}
			const count = Number(preview.redeem.validatorCount) || 0
			const res = await signAndSubmitValidatorDepositRedeemClaim({
				claimerEoa: eoa,
				secretCode: code,
				privateKeyArmor: armor,
			})
			if (!res.success) {
				setInlineStatus('error')
				setInlineError(res.error)
				return
			}
			setInlineRedeemedCount(count)
			setInlineStatus('success')
		} catch (e: unknown) {
			const err = e as { message?: string }
			setInlineStatus('error')
			setInlineError(err?.message ?? String(e))
		}
	}, [eoa, inlineCode, profiles])

	const handleInlineReset = useCallback(() => {
		setInlineCode('')
		setInlineStatus('idle')
		setInlineError('')
		setInlineRedeemedCount(0)
	}, [])

	const showRedeemAdminManageButton = isRedeemAdmin === true
	const hasNodes = beneficiaryHasNodes(profile)

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
						</div>
					</div>

					{/* Dashboard 第一行：CoNET L1 全网指标（对齐区块浏览器首页面板） */}
					<div className="mt-5 grid grid-cols-2 gap-3">
						<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
							<div className="flex items-center gap-1.5 text-white/70">
								<ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
								<span className="text-[10px] font-semibold uppercase tracking-widest">L1 VALIDATORS</span>
							</div>
							<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
								{networkStats.stakedValidatorsFormatted}
							</p>
							
						</div>
						<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
							<div className="flex items-center gap-1.5 text-white/70">
								<TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
								<span className="text-[10px] font-semibold uppercase tracking-widest">L1 Gas Minted</span>
							</div>
							<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
								{networkStats.supplyIncreaseFormatted}
							</p>
						</div>
					</div>

					{/* Dashboard 第二行：CoNET DePIN 全网指标（节点数量 + GB 代币总产量） */}
					<div className="mt-3 grid grid-cols-2 gap-3">
						<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
							<div className="flex items-center gap-1.5 text-white/70">
								<Server className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
								<span className="text-[10px] font-semibold uppercase tracking-widest">Total DePIN Nodes</span>
							</div>
							<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
								{depinStats.depinNodeCountFormatted}
							</p>
							
						</div>
						<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
							<div className="flex items-center gap-1.5 text-white/70">
								<Database className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
								<span className="text-[10px] font-semibold uppercase tracking-widest">Data Routed</span>
							</div>
							<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
								{depinStats.totalGbIssuedFormatted}
								<span className="ml-1 text-sm font-bold text-white/70">GB</span>
							</p>
							
						</div>
					</div>

					{/* Your CoNET Mining — 仅 redeem 受益人且持有节点时展示链上累计收益 */}
					{hasNodes && incomeStats ? (
						<div className="mt-6">
							<p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Your Contributions</p>
							<div className="mt-3 grid grid-cols-2 gap-3">
								<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
									<div className="flex items-center gap-1.5 text-white/70">
										<TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
										<span className="text-[10px] font-semibold uppercase tracking-widest">L1 GAS EARNED</span>
									</div>
									<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
										{formatBalance(incomeStats.cnetBeneficiary.cumulative)}{' '}
										<span className="text-sm font-bold text-white/80">CNET</span>
									</p>
									{genesisLoyaltyLine ? (
										<button
											type="button"
											onClick={() => setVestingSheetOpen(true)}
											className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-white/60 underline decoration-white/30 underline-offset-2 transition hover:text-white/90"
											aria-label="View Genesis Loyalty Reward vesting details"
										>
											<Lock className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
											{genesisLoyaltyLine}
										</button>
									) : null}
								</div>
								<div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
									<div className="flex items-center gap-1.5 text-white/70">
										<Database className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
										<span className="text-[10px] font-semibold uppercase tracking-widest">BANDWIDTH PROVIDED</span>
									</div>
									<p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
										{formatBalance(incomeStats.gbBeneficiary.cumulative)}{' '}
										<span className="text-sm font-bold text-white/80">GB</span>
									</p>
									<p className="mt-1 text-[11px] font-medium tabular-nums text-white/60">
										{gbUsdcApprox}
									</p>
									
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
											<p className="text-[11px] text-white/55">L1 Validators</p>
											<p className="mt-0.5 text-xl font-extrabold leading-none tabular-nums">
												<ValidatorNodeCountDisplay profile={profile} />
											</p>
										</div>
										<div>
											<p className="text-[11px] text-white/55">DePIN Routers</p>
											<p className="mt-0.5 text-xl font-extrabold leading-none tabular-nums">
												{profile.gbMiningNodeCount}
											</p>
										</div>
									</div>
								</div>
							) : null}
						</div>
					) : null}
				</div>

				<main className="mx-auto w-full max-w-2xl space-y-5 px-6 pt-5 pb-10">
					{eoa ? (
						<section className={`${cardChrome} p-5`}>
							{inlineStatus === 'success' ? (
								<div className="flex flex-col items-center text-center">
									<div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
										<CheckCircle2 className="h-7 w-7" strokeWidth={2.25} aria-hidden />
									</div>
									<h2 className="mt-3 text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
										Congratulations!
									</h2>
									<p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
										You successfully redeemed{' '}
										<span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
											{inlineRedeemedCount}
										</span>{' '}
										CoNET node{inlineRedeemedCount === 1 ? '' : 's'}.
									</p>
									<button
										type="button"
										onClick={handleInlineReset}
										className="mt-5 w-full rounded-xl bg-[#1562f0] py-2.5 text-sm font-bold text-white shadow-sm"
									>
										OK
									</button>
								</div>
							) : (
								<div className="flex items-start gap-3">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1562f0]/10 text-[#1562f0]">
										<Ticket className="h-5 w-5" strokeWidth={2.25} aria-hidden />
									</div>
									<div className="min-w-0 flex-1">
										<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
											Activate Your Node
										</h2>
										<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
											Enter your code to unlock sovereign power and begin mining.
										</p>

										<div
											className={`mt-4 flex items-center gap-2 rounded-xl border bg-slate-50 pl-3 pr-1.5 transition-colors dark:bg-slate-800 ${
												inlineStatus === 'error'
													? 'border-red-300 dark:border-red-900/60'
													: 'border-slate-200 dark:border-slate-600'
											} ${inlineBusy ? 'opacity-70' : ''}`}
										>
											<input
												id="vdr-inline-claim-code"
												type="text"
												autoComplete="off"
												enterKeyHint="go"
												value={inlineCode}
												onChange={(e) => {
													setInlineCode(e.target.value)
													if (inlineStatus === 'error') {
														setInlineStatus('idle')
														setInlineError('')
													}
												}}
												onKeyDown={(e) => {
													if (e.key === 'Enter' && !inlineBusy && inlineCode.trim()) {
														e.preventDefault()
														void handleInlineRedeem()
													}
												}}
												disabled={inlineBusy}
												readOnly={inlineBusy}
												aria-busy={inlineBusy}
												className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-sm text-slate-900 outline-none disabled:cursor-not-allowed dark:text-slate-100"
												placeholder="Entry Redeem code"
											/>
											<button
												type="button"
												onClick={() => void handleInlineRedeem()}
												disabled={inlineBusy || !inlineCode.trim()}
												className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1562f0] text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
												aria-label="Submit redeem code"
											>
												{inlineBusy ? (
													<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
												) : (
													<ArrowRight className="h-4 w-4 stroke-[2.5]" aria-hidden />
												)}
											</button>
										</div>

										{inlineStatus === 'error' && inlineError ? (
											<p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
												{inlineError}
											</p>
										) : null}
									</div>
								</div>
							)}
						</section>
					) : null}

					{eoa && !hasNodes ? (
						<section className={`${cardChrome} p-5`}>
							<p className="text-sm text-slate-500 dark:text-slate-400">
								No ValidatorDepositRedeem nodes are linked to this wallet yet. Redeem a code to claim validator and
								DePIN node slots.
							</p>
						</section>
					) : null}

					{hasNodes && profile ? (
						<>
							{/* CoNET DePIN nodes — per DePIN node wallet, GB mining income */}
							{incomeStats && incomeStats.nodes.length > 0 ? (
								<section className={`${cardChrome} p-5`}>
									<div className="flex items-center gap-2">
										<Coins className="h-4 w-4 text-[#1562f0]" aria-hidden />
										<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
											CoNET DePIN nodes
										</h2>
										<span className="ml-auto text-xs font-semibold tabular-nums text-slate-400">
											{incomeStats.nodes.length}
										</span>
									</div>
									<div className="mt-4 overflow-x-auto">
										<table className="w-full min-w-[320px] text-left text-sm">
											<thead>
												<tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:border-slate-700">
													<th className="pb-2 pr-3 font-bold">Node wallet</th>
													<th className="pb-2 pr-3 font-bold">Country</th>
													<th className="pb-2 font-bold text-right">GB</th>
												</tr>
											</thead>
											<tbody>
												{incomeStats.nodes.map((row) => {
													const ipKey = row.depinNodeIp.trim().toLowerCase()
													const countryLabel = ipKey ? countryByIp[ipKey] : undefined
													return (
													<tr
														key={`depin-${row.nodeWallet}-${row.depinNodeIp}`}
														className="border-b border-slate-50 last:border-0 dark:border-slate-800"
													>
														<td className="py-3 pr-3 align-top">
															<div className="flex items-center gap-2">
																<NodeWalletAddressCapsule address={row.nodeWallet} />
																<span
																	className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
																	title="DePIN node: online"
																	aria-label="DePIN node online"
																/>
															</div>
														</td>
														<td className="py-3 pr-3 align-top text-xs text-slate-600 dark:text-slate-300">
															{countryLabel ?? (ipKey ? '…' : 'Unavailable')}
														</td>
														<td className="py-3 align-top text-right tabular-nums font-semibold text-slate-900 dark:text-slate-50">
															{formatBalance(row.gb.cumulative)}
														</td>
													</tr>
													)
												})}
											</tbody>
										</table>
									</div>
								</section>
							) : null}

							{/* CoNET L1 nodes — per validator BLS pubkey, CNET validator income */}
							{incomeStats && incomeStats.nodes.length > 0 ? (
								<section className={`${cardChrome} p-5`}>
									<div className="flex items-center gap-2">
										<Coins className="h-4 w-4 text-[#1562f0]" aria-hidden />
										<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
											CoNET L1 nodes
										</h2>
										<span className="ml-auto text-xs font-semibold tabular-nums text-slate-400">
											{incomeStats.nodes.length}
										</span>
									</div>
									<div className="mt-4 overflow-x-auto">
										<table className="w-full min-w-[340px] text-left text-sm">
											<thead>
												<tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:border-slate-700">
													<th className="pb-2 pr-3 font-bold">Validator pubkey</th>
													<th className="pb-2 pr-3 font-bold">Status</th>
													<th className="pb-2 font-bold text-right">CNET</th>
												</tr>
											</thead>
											<tbody>
												{incomeStats.nodes.map((row) => {
													const isActive = Boolean(row.validatorActive)
													return (
													<tr
														key={`l1-${row.nodeWallet}-${row.depinNodeIp}`}
														className="border-b border-slate-50 last:border-0 dark:border-slate-800"
													>
														<td className="py-3 pr-3 align-top">
															<ValidatorPubkeyCapsule pubkey={row.validatorPubkey} />
														</td>
														<td className="py-3 pr-3 align-top">
															<span
																className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
																	isActive
																		? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
																		: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
																}`}
															>
																<span
																	className={`h-1.5 w-1.5 shrink-0 rounded-full ${
																		isActive ? 'bg-emerald-500' : 'bg-amber-400'
																	}`}
																	aria-hidden
																/>
																{isActive ? 'Active' : 'Pending'}
															</span>
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

			<GenesisLoyaltyVestingSheet
				open={vestingSheetOpen}
				onClose={() => setVestingSheetOpen(false)}
				airdrop={incomeStats?.airdrop ?? null}
				eoa={eoa}
			/>
		</div>
	)
}
