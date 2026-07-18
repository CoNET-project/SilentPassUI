import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { AlertTriangle, Check, Clipboard, Copy, Gift, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { useReferralRegistryRole } from '@/hooks/useReferralRegistryRole'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import {
	referralRegistryRoleLabel,
	type ReferralRegistryRoleSnapshot,
} from '@/services/referralRegistryRole'
import {
	cancelReferralRedeemCode,
	fetchReferralRedeemCodes,
	issueReferralRedeemCode,
	referralBpsToPercent,
	referralPercentToBps,
	type ReferralRedeemCodeRecord,
	type ReferralRedeemKind,
} from '@/services/referralRegistryRedeem'

type RefreshStatus = 'idle' | 'loading' | 'success' | 'error'

function formatUsdc6(value: string): string {
	try {
		return (Number(value) / 1_000_000).toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})
	} catch {
		return '0.00'
	}
}

function formatUnits6(value: string): string {
	try {
		return (Number(value) / 1_000_000).toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})
	} catch {
		return '0.00'
	}
}

function AddressCapsule({ address }: { address: string }) {
	const [copied, setCopied] = useState(false)
	const short = `${address.slice(0, 6)}…${address.slice(-4)}`
	const copy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(address)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch {
			setCopied(false)
		}
	}, [address])
	return (
		<button
			type="button"
			onClick={() => void copy()}
			className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-left font-mono text-xs text-slate-200 transition hover:bg-white/10"
			aria-label={`Copy address ${address}`}
		>
			<span className="truncate">{short}</span>
			{copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden /> : <Clipboard className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
		</button>
	)
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
	return (
		<div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
			<p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
			<p className="mt-2 text-2xl font-semibold text-white">{value}</p>
			{detail ? <p className="mt-1 text-xs text-slate-400">{detail}</p> : null}
		</div>
	)
}

function RoleSection({ snapshot }: { snapshot: ReferralRegistryRoleSnapshot }) {
	const role = referralRegistryRoleLabel(snapshot.role)
	return (
		<>
			<div className="rounded-3xl border border-indigo-300/20 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 p-5 shadow-[0_12px_40px_rgba(45,55,120,0.18)]">
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200">Referral role</p>
						<h2 className="mt-2 text-2xl font-semibold text-white">{role}</h2>
					</div>
					<ShieldCheck className="h-7 w-7 text-indigo-200" aria-hidden />
				</div>
				<div className="mt-4">
					<p className="text-xs text-slate-400">Connected EOA</p>
					<div className="mt-2"><AddressCapsule address={snapshot.eoa} /></div>
				</div>
				{snapshot.role === 'l1' ? (
					<div className="mt-4">
						<p className="text-xs text-slate-400">Parent L0</p>
						<div className="mt-2"><AddressCapsule address={snapshot.parentL0} /></div>
					</div>
				) : null}
			</div>

			<div className="grid grid-cols-2 gap-3">
				<MetricCard label="Rebate rate" value={`${Number(snapshot.rebateBps) / 100}%`} />
				<MetricCard label="L1 ratio" value={`${Number(snapshot.ratioBps) / 100}%`} detail={snapshot.role === 'l0' ? 'Applied to L1 rewards' : undefined} />
				<MetricCard label="Claimable CONET-USDC" value={`$${formatUsdc6(snapshot.claimableConetUsdc)}`} />
				<MetricCard label="Claim status" value={snapshot.claimPaused ? 'Paused' : 'Active'} />
			</div>

			{snapshot.role === 'l0' ? (
				<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
					<h3 className="font-semibold text-white">Merchant code quota</h3>
					<div className="mt-3 grid grid-cols-2 gap-3 text-sm">
						<div><p className="text-slate-400">Starter Kets remaining</p><p className="mt-1 text-white">{snapshot.starterKetRemaining}</p></div>
						<div><p className="text-slate-400">Paid B-Units remaining</p><p className="mt-1 text-white">{formatUnits6(snapshot.paidBunitRemaining)}</p></div>
						<div><p className="text-slate-400">Codes issued</p><p className="mt-1 text-white">{snapshot.issuedCodeCount}</p></div>
						<div><p className="text-slate-400">Codes claimed</p><p className="mt-1 text-white">{snapshot.claimedCodeCount}</p></div>
					</div>
				</div>
			) : null}
		</>
	)
}

function ReferralRedeemManagementPanel({
	snapshot,
	kind,
	privateKeyArmor,
	onClose,
}: {
	snapshot: ReferralRegistryRoleSnapshot
	kind: ReferralRedeemKind
	privateKeyArmor: string
	onClose: () => void
}) {
	const [records, setRecords] = useState<ReferralRedeemCodeRecord[]>([])
	const [rateInput, setRateInput] = useState(kind === 'l1' ? referralBpsToPercent(snapshot.rebateBps) : '')
	const [loadingRecords, setLoadingRecords] = useState(true)
	const [isCreating, setIsCreating] = useState(false)
	const [cancellingHash, setCancellingHash] = useState('')
	const [error, setError] = useState('')
	const [newSecret, setNewSecret] = useState('')
	const [copiedSecret, setCopiedSecret] = useState(false)

	const loadRecords = useCallback(async (force = false) => {
		setLoadingRecords(true)
		try {
			const next = await fetchReferralRedeemCodes(kind, snapshot.eoa, { force })
			setRecords(next)
			setError('')
		} catch {
			setError('Could not load redeem code history from CoNET. The previous list was kept.')
		} finally {
			setLoadingRecords(false)
		}
	}, [kind, snapshot.eoa])

	useEffect(() => {
		void loadRecords()
	}, [loadRecords])

	const handleCreate = useCallback(async () => {
		if (isCreating || !privateKeyArmor) return
		setIsCreating(true)
		setError('')
		setNewSecret('')
		try {
			const rebateBps = referralPercentToBps(rateInput)
			const created = await issueReferralRedeemCode({ kind, issuerPrivateKeyArmor: privateKeyArmor, rebateBps })
			setNewSecret(created.secret)
			await loadRecords(true)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not issue the redeem code.')
		} finally {
			setIsCreating(false)
		}
	}, [isCreating, privateKeyArmor, rateInput, kind, loadRecords])

	const handleCancel = useCallback(async (hash: string) => {
		if (cancellingHash || !privateKeyArmor) return
		setCancellingHash(hash)
		setError('')
		try {
			await cancelReferralRedeemCode({ kind, issuerPrivateKeyArmor: privateKeyArmor, hash })
			await loadRecords(true)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not cancel the redeem code.')
		} finally {
			setCancellingHash('')
		}
	}, [cancellingHash, privateKeyArmor, kind, loadRecords])

	const copySecret = useCallback(async () => {
		if (!newSecret) return
		try {
			await navigator.clipboard.writeText(newSecret)
			setCopiedSecret(true)
			window.setTimeout(() => setCopiedSecret(false), 2000)
		} catch {
			setError('Could not copy the redeem code.')
		}
	}, [newSecret])

	const isL0 = kind === 'l0'
	const title = isL0 ? 'L0 redeem codes' : 'L1 redeem codes'
	const description = isL0
		? 'Create one-minute codes that register a new L0 under this Admin.'
		: 'Create one-minute codes that register a new L1 under this L0.'
	let ratioPreview = '0.00%'
	if (!isL0 && snapshot.rebateBps && Number(snapshot.rebateBps) > 0) {
		try {
			ratioPreview = `${((Number(referralPercentToBps(rateInput)) / Number(snapshot.rebateBps)) * 100).toFixed(2)}%`
		} catch {
			ratioPreview = 'Enter a valid rate'
		}
	}

	return (
		<div className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-[#071126] text-slate-50 animate-in slide-in-from-right duration-300" role="dialog" aria-modal="true" aria-labelledby="referral-code-management-title">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-amber-500/20 via-indigo-500/10 to-transparent" aria-hidden />
			<div className="relative z-10 flex min-h-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-10" style={{ WebkitOverflowScrolling: 'touch' }}>
					<div className="mx-auto w-full max-w-2xl" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={onClose} />
							<div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/20 bg-amber-300/10 text-amber-200" aria-hidden>
								<Gift className="h-4 w-4" />
							</div>
						</div>
						<header className="pb-7 pt-8">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Referral management</p>
							<h2 id="referral-code-management-title" className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
							<p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
						</header>

						<div className="space-y-4">
							<div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
								<label htmlFor="referral-rebate-rate" className="text-sm font-semibold text-white">
									{isL0 ? 'L0 rebate rate' : 'L1 rebate rate'}
								</label>
								<div className="mt-2 flex items-center gap-2">
									<input
										id="referral-rebate-rate"
										type="text"
										inputMode="decimal"
										autoComplete="off"
										value={rateInput}
										onChange={(event) => setRateInput(event.target.value)}
										placeholder="5"
										className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-indigo-300/70"
									/>
									<span className="text-slate-400">%</span>
								</div>
								{isL0 ? null : (
									<p className="mt-2 text-xs text-slate-400">
										Current L0 rebate: {referralBpsToPercent(snapshot.rebateBps)}% · L1 ratio: {ratioPreview}
									</p>
								)}
								<button
									type="button"
									onClick={() => void handleCreate()}
									disabled={isCreating || !privateKeyArmor}
									aria-busy={isCreating}
									className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isCreating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Gift className="h-4 w-4" aria-hidden />}
									{isCreating ? 'Creating code…' : `Create ${isL0 ? 'L0' : 'L1'} redeem code`}
								</button>
							</div>

							{newSecret ? (
								<div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-5">
									<p className="text-sm font-semibold text-emerald-100">Save this code now</p>
									<p className="mt-1 text-xs leading-5 text-emerald-100/70">The secret is shown once. Only its hash is stored on CoNET.</p>
									<div className="mt-3 flex items-center gap-2">
										<code className="min-w-0 flex-1 break-all rounded-lg bg-black/20 px-3 py-2 text-xs text-white">{newSecret}</code>
										<button type="button" onClick={() => void copySecret()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-300/20 text-emerald-100" aria-label="Copy redeem code">
											{copiedSecret ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
										</button>
									</div>
								</div>
							) : null}

							{error ? <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</div> : null}

							<div className="rounded-2xl border border-amber-200/15 bg-amber-300/[0.07] p-5">
								<div className="flex items-start gap-3">
									<Gift className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden />
									<div>
										<h3 className="font-semibold text-white">Code rules</h3>
										<p className="mt-2 text-sm leading-6 text-slate-300">Each code is valid for 60 seconds after the creation transaction is confirmed. Pending codes can be cancelled by the issuer.</p>
										<p className="mt-3 text-xs leading-5 text-slate-400">Keep the secret code private and deliver it directly to the intended wallet.</p>
									</div>
								</div>
							</div>

							<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
								<div className="flex items-center justify-between gap-3">
									<h3 className="font-semibold text-white">Created codes</h3>
									<button type="button" onClick={() => void loadRecords(true)} disabled={loadingRecords} className="text-xs text-indigo-200 disabled:opacity-50">
										{loadingRecords ? 'Refreshing…' : 'Refresh'}
									</button>
								</div>
								<div className="mt-3 space-y-2">
									{!loadingRecords && records.length === 0 ? <p className="text-sm text-slate-400">No codes created yet.</p> : null}
									{records.map((record) => (
										<div key={record.hash} className="rounded-xl border border-white/10 bg-black/10 p-3">
											<div className="flex items-center justify-between gap-3">
												<span className={`text-xs font-semibold uppercase ${record.status === 'pending' ? 'text-amber-200' : record.status === 'claimed' ? 'text-emerald-300' : 'text-slate-400'}`}>{record.status}</span>
												{record.status === 'pending' ? (
													<button type="button" onClick={() => void handleCancel(record.hash)} disabled={cancellingHash !== ''} aria-busy={cancellingHash === record.hash} className="inline-flex items-center gap-1 text-xs text-rose-300 disabled:opacity-50">
														{cancellingHash === record.hash ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
														Cancel
													</button>
												) : null}
											</div>
											<p className="mt-2 break-all font-mono text-[10px] text-slate-500">{record.hash}</p>
											<p className="mt-2 text-xs text-slate-300">
												Rebate {referralBpsToPercent(record.rebateBps)}%{kind === 'l1' ? ` · Ratio ${referralBpsToPercent(record.ratioBps)}%` : ''}
											</p>
											<p className="mt-1 text-[10px] text-slate-500">Expires {new Date(record.validBefore * 1000).toLocaleString()}</p>
										</div>
									))}
								</div>
							</div>

							<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
								<p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Issuer wallet</p>
								<div className="mt-3"><AddressCapsule address={snapshot.eoa} /></div>
								<p className="mt-3 text-xs text-slate-500">Code status is read directly from the CoNET referral registry.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default function ReferralRegistryDashboardPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter } = useDaemonContext()
	const profile = profiles?.[0]
	const signingArmor = resolveSigningPrivateKeyArmor(profile)
	const derivedEoa = signingArmor ? new ethers.Wallet(signingArmor).address : ''
	const eoa = profile?.keyID?.trim() || derivedEoa
	const { snapshot, loading, error, isPrivileged, refresh } = useReferralRegistryRole(eoa)
	const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>('idle')
	const [redeemPanelKind, setRedeemPanelKind] = useState<ReferralRedeemKind | null>(null)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const handleRefresh = useCallback(async () => {
		if (refreshStatus !== 'idle') return
		setRefreshStatus('loading')
		try {
			await refresh()
			setRefreshStatus('success')
		} catch {
			setRefreshStatus('error')
		} finally {
			window.setTimeout(() => setRefreshStatus('idle'), 3000)
		}
	}, [refresh, refreshStatus])

	return (
		<div className="fixed inset-0 z-[90] flex min-h-0 flex-col overflow-hidden bg-[#050b1d] text-slate-50 animate-in slide-in-from-right duration-300">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-500/20 via-purple-500/5 to-transparent" aria-hidden />
			<div className="relative z-10 flex min-h-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-10" style={{ WebkitOverflowScrolling: 'touch' }}>
					<div className="mx-auto w-full max-w-2xl" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={() => navigate('/wallet')} />
								<div className="flex items-center gap-2">
									{snapshot?.isAdmin ? (
										<button
											type="button"
											onClick={() => setRedeemPanelKind('l0')}
											className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200/20 bg-blue-300/10 text-blue-200 transition hover:bg-blue-300/20"
											aria-label="Manage L0 redeem codes"
											title="Manage L0 redeem codes"
										>
											<ShieldCheck className="h-4 w-4" aria-hidden />
										</button>
									) : null}
									{snapshot?.role === 'l0' ? (
										<button
											type="button"
											onClick={() => setRedeemPanelKind('l1')}
											className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/20 bg-amber-300/10 text-amber-200 transition hover:bg-amber-300/20"
											aria-label="Manage L1 redeem codes"
											title="Manage L1 redeem codes"
										>
											<Gift className="h-4 w-4" aria-hidden />
										</button>
									) : null}
									<button
										type="button"
										onClick={() => void handleRefresh()}
										disabled={refreshStatus !== 'idle'}
										className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 backdrop-blur-md disabled:cursor-not-allowed"
										aria-label="Refresh referral dashboard"
										aria-busy={refreshStatus === 'loading'}
									>
										{refreshStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : refreshStatus === 'success' ? <Check className="h-4 w-4 text-emerald-400" aria-hidden /> : refreshStatus === 'error' ? <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
									</button>
								</div>
						</div>
						<header className="pb-7 pt-8">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">On-chain management</p>
							<h1 className="mt-2 text-3xl font-semibold tracking-tight">Referral dashboard</h1>
							<p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Your live Admin, L0, or L1 permissions and balances from the CoNET referral registry.</p>
						</header>

						{loading && !snapshot ? (
							<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
								<Loader2 className="h-5 w-5 animate-spin text-indigo-300" aria-hidden />
								<span>Checking your CoNET role…</span>
							</div>
						) : error && !snapshot ? (
							<div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-100">
								{error}
							</div>
						) : snapshot && isPrivileged ? (
							<div className="space-y-4">
								{snapshot.isAdmin ? (
									<div className="rounded-2xl border border-blue-300/20 bg-blue-400/10 p-4">
										<div className="flex items-center gap-3">
											<ShieldCheck className="h-5 w-5 text-blue-200" aria-hidden />
											<div><p className="font-semibold text-white">Contract Admin</p><p className="mt-1 text-xs text-blue-100/70">Administrative permissions are active for this EOA.</p></div>
										</div>
									</div>
								) : null}
								<RoleSection snapshot={snapshot} />
							</div>
						) : (
							<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">This wallet is not registered as a contract Admin, L0, or L1.</div>
						)}
					</div>
				</div>
			</div>
			{redeemPanelKind && snapshot && signingArmor ? (
				<ReferralRedeemManagementPanel
					snapshot={snapshot}
					kind={redeemPanelKind}
					privateKeyArmor={signingArmor}
					onClose={() => setRedeemPanelKind(null)}
				/>
			) : null}
		</div>
	)
}
