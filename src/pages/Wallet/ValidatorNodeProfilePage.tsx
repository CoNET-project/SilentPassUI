import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Server,
	Network,
	Cpu,
	Globe,
	Coins,
	RefreshCw,
	Loader2,
	Check,
	AlertTriangle,
	Copy,
	Search,
	UserCheck,
} from 'lucide-react'
import { Toast } from 'antd-mobile'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useValidatorWalletNodeProfile } from '@/hooks/useValidatorWalletNodeProfile'
import { fetchNodeBeneficiaryProfile, type NodeBeneficiaryProfileResult } from '@/services/validatorWalletNodeProfile'
import { BeamioCircularBackButton, BEAMIO_CIRCULAR_BACK_ROW_CLASS } from '@/components/BeamioCircularBackButton'
import { formatGbDisplay } from '@/utils/formatGbDisplay'

type RefreshStatus = 'idle' | 'loading' | 'success' | 'error'

const capsuleChrome =
	'rounded-full border border-slate-100/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800'

function formatBalance(raw: string): string {
	const n = Number(raw)
	if (!Number.isFinite(n)) return raw
	if (n === 0) return '0'
	if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
	return n.toLocaleString(undefined, { maximumFractionDigits: 8 })
}

export default function ValidatorNodeProfilePage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter } = useDaemonContext()
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(true)

	const eoa = profiles?.[0]?.keyID?.trim() ?? ''
	const { profile, loading, stale, refresh } = useValidatorWalletNodeProfile(eoa)

	const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>('idle')
	const [copiedIp, setCopiedIp] = useState<string | null>(null)

	const [lookupInput, setLookupInput] = useState('')
	const [lookingUp, setLookingUp] = useState(false)
	const [lookupError, setLookupError] = useState('')
	const [lookupResult, setLookupResult] = useState<Extract<NodeBeneficiaryProfileResult, { ok: true }> | null>(null)
	const [copiedBeneficiary, setCopiedBeneficiary] = useState(false)
	const [copiedNodeWallet, setCopiedNodeWallet] = useState(false)
	const [copiedLookupIp, setCopiedLookupIp] = useState<string | null>(null)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const handleRefresh = useCallback(async () => {
		if (refreshStatus !== 'idle') return
		setRefreshStatus('loading')
		try {
			refresh()
			await new Promise((r) => window.setTimeout(r, 600))
			setRefreshStatus('success')
		} catch {
			setRefreshStatus('error')
		} finally {
			window.setTimeout(() => setRefreshStatus('idle'), 3000)
		}
	}, [refresh, refreshStatus])

	const handleLookup = useCallback(async () => {
		const query = lookupInput.trim()
		setLookupError('')
		setLookupResult(null)
		if (!query) {
			setLookupError('Enter a DePIN node IP or wallet address.')
			return
		}
		setLookingUp(true)
		try {
			const res = await fetchNodeBeneficiaryProfile(query)
			if (!res.ok) {
				setLookupError(res.error)
				return
			}
			setLookupResult(res)
		} finally {
			setLookingUp(false)
		}
	}, [lookupInput])

	const copyLookupIp = useCallback(async (ip: string) => {
		try {
			await navigator.clipboard.writeText(ip)
			setCopiedLookupIp(ip)
			window.setTimeout(() => setCopiedLookupIp((cur) => (cur === ip ? null : cur)), 2000)
		} catch {
			Toast.show({ content: 'Copy failed', position: 'top' })
		}
	}, [])

	const copyNodeWallet = useCallback(async (addr: string) => {
		try {
			await navigator.clipboard.writeText(addr)
			setCopiedNodeWallet(true)
			window.setTimeout(() => setCopiedNodeWallet(false), 2000)
		} catch {
			Toast.show({ content: 'Copy failed', position: 'top' })
		}
	}, [])

	const copyBeneficiary = useCallback(async (addr: string) => {
		try {
			await navigator.clipboard.writeText(addr)
			setCopiedBeneficiary(true)
			window.setTimeout(() => setCopiedBeneficiary(false), 2000)
		} catch {
			Toast.show({ content: 'Copy failed', position: 'top' })
		}
	}, [])

	const copyIp = useCallback(async (ip: string) => {
		try {
			await navigator.clipboard.writeText(ip)
			setCopiedIp(ip)
			window.setTimeout(() => setCopiedIp((cur) => (cur === ip ? null : cur)), 2000)
		} catch {
			Toast.show({ content: 'Copy failed', position: 'top' })
		}
	}, [])

	const capsulePointer = capsuleOpacity < 0.05 ? 'none' : 'auto'
	const showInitialLoading = loading && !profile

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
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1562f0] text-white">
						<Server className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					</div>
					<span className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
						My CoNET Nodes
					</span>
				</div>

				<button
					type="button"
					onClick={() => void handleRefresh()}
					disabled={refreshStatus !== 'idle'}
					className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${capsuleChrome} text-[#1562f0] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80`}
					style={{ pointerEvents: capsulePointer }}
					aria-label="Refresh"
					title="Refresh"
				>
					{refreshStatus === 'loading' ? (
						<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
					) : refreshStatus === 'success' ? (
						<Check className="h-5 w-5 text-emerald-500" aria-hidden />
					) : refreshStatus === 'error' ? (
						<AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
					) : (
						<RefreshCw className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					)}
				</button>
			</div>

			<div
				ref={setScrollRef}
				onScroll={onCapsuleScroll}
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-10"
				style={{ WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }}
			>
				<div
					className="shrink-0"
					style={{ minHeight: 'calc(max(1rem, env(safe-area-inset-top, 0px)) + 5rem)' }}
				/>
				<main className="mx-auto w-full max-w-2xl space-y-6 px-6 pt-2">
					<div className={BEAMIO_CIRCULAR_BACK_ROW_CLASS}>
						<BeamioCircularBackButton
							variant="onLight"
							onClick={() => navigate('/wallet')}
							className="absolute left-0 top-0"
						/>
					</div>

					{showInitialLoading ? (
						<div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
							<Loader2 className="h-6 w-6 animate-spin text-[#1562f0]" aria-hidden />
							<span className="text-sm">Loading your CoNET node profile…</span>
						</div>
					) : (
						<>
							{stale ? (
								<div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
									<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
									<span>Showing the last known data — couldn’t refresh from CoNET just now.</span>
								</div>
							) : null}

							{/* Node counts */}
							<section className="grid grid-cols-2 gap-3">
								<div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
									<div className="flex items-center gap-2 text-[#1562f0]">
										<Server className="h-4 w-4" aria-hidden />
										<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
											Validator nodes
										</span>
									</div>
									<p className="mt-2 text-3xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
										{profile?.validatorNodeCount ?? 0}
									</p>
								</div>
								<div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
									<div className="flex items-center gap-2 text-[#1562f0]">
										<Cpu className="h-4 w-4" aria-hidden />
										<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
											GB mining nodes
										</span>
									</div>
									<p className="mt-2 text-3xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
										{profile?.gbMiningNodeCount ?? 0}
									</p>
								</div>
							</section>

							{/* Balances */}
							<section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
								<div className="flex items-center gap-2">
									<Coins className="h-4 w-4 text-[#1562f0]" aria-hidden />
									<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
										CoNET balances
									</h2>
								</div>
								<dl className="mt-4 space-y-3">
									<div className="flex items-center justify-between">
										<dt className="text-sm text-slate-500 dark:text-slate-400">CoNET (CNET)</dt>
										<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
											{profile ? formatBalance(profile.nativeBalance) : '—'}
										</dd>
									</div>
									<div className="flex items-center justify-between">
										<dt className="text-sm text-slate-500 dark:text-slate-400">GB</dt>
										<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
											{profile ? formatGbDisplay(profile.gbBalance) : '—'}
										</dd>
									</div>
									<div className="flex items-center justify-between">
										<dt className="text-sm text-slate-500 dark:text-slate-400">USDC</dt>
										<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
											{profile ? formatBalance(profile.usdcBalance) : '—'}
										</dd>
									</div>
								</dl>
							</section>

							{/* DePIN node IPs */}
							<section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
								<div className="flex items-center gap-2">
									<Network className="h-4 w-4 text-[#1562f0]" aria-hidden />
									<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
										CoNET DePIN node IPs
									</h2>
									<span className="ml-auto text-xs font-semibold tabular-nums text-slate-400">
										{profile?.conetDepinNodeIps.length ?? 0}
									</span>
								</div>
								{profile && profile.conetDepinNodeIps.length > 0 ? (
									<ul className="mt-4 space-y-2">
										{profile.conetDepinNodeIps.map((ip) => (
											<li
												key={ip}
												className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
											>
												<div className="flex min-w-0 items-center gap-2">
													<Globe className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
													<span className="truncate font-mono text-sm text-slate-800 dark:text-slate-100">{ip}</span>
												</div>
												<button
													type="button"
													onClick={() => void copyIp(ip)}
													className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1562f0] transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900"
													aria-label="Copy IP"
												>
													{copiedIp === ip ? (
														<Check className="h-4 w-4 text-emerald-500" aria-hidden />
													) : (
														<Copy className="h-4 w-4" aria-hidden />
													)}
												</button>
											</li>
										))}
									</ul>
								) : (
									<p className="mt-4 text-sm text-slate-400">
										No CoNET DePIN node IPs are associated with this wallet yet.
									</p>
								)}
							</section>

							{/* Reverse lookup: IP or wallet → beneficiary */}
							<section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
								<div className="flex items-center gap-2">
									<Search className="h-4 w-4 text-[#1562f0]" aria-hidden />
									<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
										Find beneficiary
									</h2>
								</div>
								<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
									Enter a DePIN node IP, node operator wallet, or beneficiary wallet to see the beneficiary’s full
									CoNET node profile: validator nodes, DePIN IPs and CNET / GB / USDC balances.
								</p>
								<div className="mt-4 flex gap-2">
									<input
										value={lookupInput}
										onChange={(e) => setLookupInput(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') void handleLookup()
										}}
										autoComplete="off"
										enterKeyHint="search"
										placeholder="DePIN IP or 0x wallet"
										className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 outline-none focus:border-[#1562f0] focus:ring-2 focus:ring-[#1562f0]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50"
									/>
									<button
										type="button"
										onClick={() => void handleLookup()}
										disabled={lookingUp}
										className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#1562f0] px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
									>
										{lookingUp ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
										Look up
									</button>
								</div>

								{lookupError ? (
									<div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
										<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
										<span>{lookupError}</span>
									</div>
								) : null}

								{lookupResult ? (
									<div className="mt-3 space-y-3">
										{lookupResult.nodeWallet ? (
											<div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
												<div className="flex items-center gap-2 text-[#1562f0]">
													<Server className="h-4 w-4" aria-hidden />
													<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
														Node wallet
													</span>
												</div>
												<div className="mt-2 flex items-center justify-between gap-3">
													<span className="truncate font-mono text-sm text-slate-800 dark:text-slate-100">
														{lookupResult.nodeWallet}
													</span>
													<button
														type="button"
														onClick={() => void copyNodeWallet(lookupResult.nodeWallet as string)}
														className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1562f0] transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900"
														aria-label="Copy node wallet address"
													>
														{copiedNodeWallet ? (
															<Check className="h-4 w-4 text-emerald-500" aria-hidden />
														) : (
															<Copy className="h-4 w-4" aria-hidden />
														)}
													</button>
												</div>
											</div>
										) : null}

										{lookupResult.beneficiary ? (
											<div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
												<div className="flex items-center gap-2 text-[#1562f0]">
													<UserCheck className="h-4 w-4" aria-hidden />
													<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
														Beneficiary
													</span>
												</div>
												<div className="mt-2 flex items-center justify-between gap-3">
													<span className="truncate font-mono text-sm text-slate-800 dark:text-slate-100">
														{lookupResult.beneficiary}
													</span>
													<button
														type="button"
														onClick={() => void copyBeneficiary(lookupResult.beneficiary as string)}
														className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1562f0] transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900"
														aria-label="Copy beneficiary address"
													>
														{copiedBeneficiary ? (
															<Check className="h-4 w-4 text-emerald-500" aria-hidden />
														) : (
															<Copy className="h-4 w-4" aria-hidden />
														)}
													</button>
												</div>
											</div>
										) : (
											<p className="text-sm text-slate-400">
												No redeem beneficiary is assigned for “{lookupResult.query}”.
											</p>
										)}

										{lookupResult.profile ? (
											<>
												{/* Beneficiary node counts */}
												<div className="grid grid-cols-2 gap-3">
													<div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
														<div className="flex items-center gap-2 text-[#1562f0]">
															<Server className="h-4 w-4" aria-hidden />
															<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
																Validator nodes
															</span>
														</div>
														<p className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
															{lookupResult.profile.validatorNodeCount}
														</p>
													</div>
													<div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
														<div className="flex items-center gap-2 text-[#1562f0]">
															<Cpu className="h-4 w-4" aria-hidden />
															<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
																GB mining nodes
															</span>
														</div>
														<p className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
															{lookupResult.profile.gbMiningNodeCount}
														</p>
													</div>
												</div>

												{/* Beneficiary balances */}
												<div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
													<div className="flex items-center gap-2 text-[#1562f0]">
														<Coins className="h-4 w-4" aria-hidden />
														<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
															CoNET balances
														</span>
													</div>
													<dl className="mt-2 space-y-2">
														<div className="flex items-center justify-between">
															<dt className="text-sm text-slate-500 dark:text-slate-400">CoNET (CNET)</dt>
															<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
																{formatBalance(lookupResult.profile.nativeBalance)}
															</dd>
														</div>
														<div className="flex items-center justify-between">
															<dt className="text-sm text-slate-500 dark:text-slate-400">GB</dt>
															<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
																{formatGbDisplay(lookupResult.profile.gbBalance)}
															</dd>
														</div>
														<div className="flex items-center justify-between">
															<dt className="text-sm text-slate-500 dark:text-slate-400">USDC</dt>
															<dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
																{formatBalance(lookupResult.profile.usdcBalance)}
															</dd>
														</div>
													</dl>
												</div>

												{/* Beneficiary DePIN node IPs */}
												<div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
													<div className="flex items-center gap-2 text-[#1562f0]">
														<Network className="h-4 w-4" aria-hidden />
														<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
															CoNET DePIN node IPs
														</span>
														<span className="ml-auto text-xs font-semibold tabular-nums text-slate-400">
															{lookupResult.profile.conetDepinNodeIps.length}
														</span>
													</div>
													{lookupResult.profile.conetDepinNodeIps.length > 0 ? (
														<ul className="mt-2 space-y-1.5">
															{lookupResult.profile.conetDepinNodeIps.map((ip) => (
																<li
																	key={ip}
																	className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900"
																>
																	<span className="truncate font-mono text-xs text-slate-700 dark:text-slate-200">{ip}</span>
																	<button
																		type="button"
																		onClick={() => void copyLookupIp(ip)}
																		className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1562f0] transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900"
																		aria-label="Copy IP"
																	>
																		{copiedLookupIp === ip ? (
																			<Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
																		) : (
																			<Copy className="h-3.5 w-3.5" aria-hidden />
																		)}
																	</button>
																</li>
															))}
														</ul>
													) : (
														<p className="mt-2 text-sm text-slate-400">No CoNET DePIN node IPs for this beneficiary.</p>
													)}
												</div>
											</>
										) : null}
									</div>
								) : null}
							</section>
						</>
					)}
				</main>
			</div>
		</div>
	)
}
