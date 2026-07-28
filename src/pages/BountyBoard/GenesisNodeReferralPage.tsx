import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import {
	Ban,
	Check,
	Copy,
	Link2,
	Loader2,
	TicketPlus,
	Users,
	Wallet,
} from 'lucide-react'
import { Toast } from 'antd-mobile'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { resolveSessionEoa } from '@/utils/resolveSessionEoa'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { CoNET_Data } from '@/utils/globals'
import {
	buildGenesisEvangelistShareUrl,
	cancelGenesisL0RedeemCode,
	cancelGenesisL1RedeemCode,
	claimGenesisL0RedeemCode,
	claimGenesisL1RedeemCode,
	fetchGenesisL0List,
	fetchGenesisL0RedeemCodesForIssuer,
	fetchGenesisL1List,
	fetchGenesisL1RedeemCodesForIssuer,
	fetchGenesisMemberSnapshot,
	issueGenesisL0RedeemCode,
	issueGenesisL1RedeemCode,
	ratioBpsToPercentLabel,
	setGenesisDefaultAdminPayout,
	setGenesisFoundation,
	type GenesisL0RedeemRecord,
	type GenesisL1RedeemRecord,
	type GenesisMemberSnapshot,
} from '@/services/genesisNodeReferral'
import { CONET_GENESIS_NODE_REFERRAL_VAULT } from '@/config/chainAddresses'

function preventNumericStepKeys(e: React.KeyboardEvent<HTMLInputElement>): void {
	if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
		e.preventDefault()
		e.stopPropagation()
	}
}

function preventNumericWheelStep(e: React.WheelEvent<HTMLInputElement>): void {
	e.preventDefault()
	e.stopPropagation()
}

function shortAddr(addr: string): string {
	if (!addr || addr.length < 12) return addr
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function statusChipClass(status: GenesisL0RedeemRecord['status']): string {
	switch (status) {
		case 'pending':
			return 'bg-amber-400/10 text-amber-100 border-amber-300/20'
		case 'claimed':
			return 'bg-emerald-400/10 text-emerald-100 border-emerald-300/20'
		case 'cancelled':
			return 'bg-white/[0.06] text-slate-300 border-white/10'
		default:
			return 'bg-white/[0.06] text-slate-300 border-white/10'
	}
}

/** percent 0–100 → ratioBps */
function percentInputToBps(raw: string): number | null {
	const n = Number(raw)
	if (!Number.isFinite(n) || n < 0 || n > 100) return null
	return Math.round(n * 100)
}

/**
 * Genesis Node referral — full-page secondary screen from Bounty Board Share.
 * Hides global Footer; circular back returns to /BountyBoard.
 */
export default function GenesisNodeReferralPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter } = useDaemonContext()
	const eoa = useMemo(() => resolveSessionEoa(profiles), [profiles])

	const [snapshot, setSnapshot] = useState<GenesisMemberSnapshot | null>(null)
	const [l0List, setL0List] = useState<string[]>([])
	const [l1List, setL1List] = useState<Array<{ address: string; ratioBps: number }>>([])
	const [codes, setCodes] = useState<GenesisL0RedeemRecord[]>([])
	const [l1Codes, setL1Codes] = useState<GenesisL1RedeemRecord[]>([])
	const [loading, setLoading] = useState(false)
	const [issuing, setIssuing] = useState(false)
	const [issuingL1, setIssuingL1] = useState(false)
	const [cancellingHash, setCancellingHash] = useState<string | null>(null)
	const [claimCode, setClaimCode] = useState('')
	const [claiming, setClaiming] = useState(false)
	const [l1SharePercent, setL1SharePercent] = useState('50')
	const [copiedKey, setCopiedKey] = useState<string | null>(null)
	const [error, setError] = useState('')
	const [lastIssuedSecret, setLastIssuedSecret] = useState<string | null>(null)
	const [lastIssuedL1Secret, setLastIssuedL1Secret] = useState<string | null>(null)
	const [foundationDraft, setFoundationDraft] = useState('')
	const [adminPayoutDraft, setAdminPayoutDraft] = useState('')
	const [savingPayout, setSavingPayout] = useState<'foundation' | 'adminPayout' | null>(null)

	const issueInFlightRef = useRef(false)
	const issueL1InFlightRef = useRef(false)
	const claimInFlightRef = useRef(false)
	const payoutInFlightRef = useRef(false)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const armor = useMemo(
		() => resolveSigningPrivateKeyArmor(profiles?.[0] ?? CoNET_Data?.profiles?.[0]),
		[profiles],
	)

	const reload = useCallback(async () => {
		if (!eoa || !ethers.isAddress(eoa)) {
			setSnapshot(null)
			setL0List([])
			setL1List([])
			setCodes([])
			setL1Codes([])
			return
		}
		setLoading(true)
		setError('')
		try {
			const snap = await fetchGenesisMemberSnapshot(eoa)
			setSnapshot(snap)
			if (snap) {
				setFoundationDraft(snap.foundation)
				setAdminPayoutDraft(snap.defaultAdminPayout)
			}
			if (snap?.isAdmin) {
				const [list, issued] = await Promise.all([
					fetchGenesisL0List(eoa).catch(() => [] as string[]),
					fetchGenesisL0RedeemCodesForIssuer(eoa).catch(() => [] as GenesisL0RedeemRecord[]),
				])
				setL0List(list)
				setCodes(issued)
			} else {
				setL0List([])
				setCodes([])
			}
			if (snap?.isL0) {
				const [children, issuedL1] = await Promise.all([
					fetchGenesisL1List(eoa).catch(() => [] as Array<{ address: string; ratioBps: number }>),
					fetchGenesisL1RedeemCodesForIssuer(eoa).catch(() => [] as GenesisL1RedeemRecord[]),
				])
				setL1List(children)
				setL1Codes(issuedL1)
			} else {
				setL1List([])
				setL1Codes([])
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not load Genesis referral data.')
		} finally {
			setLoading(false)
		}
	}, [eoa])

	useEffect(() => {
		void reload()
	}, [reload])

	const handleIssue = useCallback(async () => {
		if (issueInFlightRef.current || !snapshot?.isAdmin) return
		if (!armor) {
			setError('Unlock your wallet to sign.')
			return
		}
		issueInFlightRef.current = true
		setIssuing(true)
		setError('')
		try {
			const issued = await issueGenesisL0RedeemCode({ issuerPrivateKeyArmor: armor })
			setLastIssuedSecret(issued.secret)
			Toast.show({ content: 'L0 redeem code created', position: 'center' })
			await reload()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not issue L0 redeem code.')
		} finally {
			issueInFlightRef.current = false
			setIssuing(false)
		}
	}, [armor, reload, snapshot?.isAdmin])

	const handleIssueL1 = useCallback(async () => {
		if (issueL1InFlightRef.current || !snapshot?.isL0) return
		if (!armor) {
			setError('Unlock your wallet to sign.')
			return
		}
		const ratioBps = percentInputToBps(l1SharePercent)
		if (ratioBps == null) {
			setError('L1 share must be a number from 0 to 100.')
			return
		}
		issueL1InFlightRef.current = true
		setIssuingL1(true)
		setError('')
		try {
			const issued = await issueGenesisL1RedeemCode({ issuerPrivateKeyArmor: armor, ratioBps })
			setLastIssuedL1Secret(issued.secret)
			Toast.show({ content: 'L1 Evangelist code created', position: 'center' })
			await reload()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not issue L1 redeem code.')
		} finally {
			issueL1InFlightRef.current = false
			setIssuingL1(false)
		}
	}, [armor, l1SharePercent, reload, snapshot?.isL0])

	const handleCancel = useCallback(
		async (hash: string) => {
			if (!armor || cancellingHash) return
			setCancellingHash(hash)
			setError('')
			try {
				await cancelGenesisL0RedeemCode({ issuerPrivateKeyArmor: armor, hash })
				Toast.show({ content: 'Code cancelled', position: 'center' })
				await reload()
			} catch (cause) {
				setError(cause instanceof Error ? cause.message : 'Could not cancel code.')
			} finally {
				setCancellingHash(null)
			}
		},
		[armor, cancellingHash, reload],
	)

	const handleCancelL1 = useCallback(
		async (hash: string) => {
			if (!armor || cancellingHash) return
			setCancellingHash(hash)
			setError('')
			try {
				await cancelGenesisL1RedeemCode({ issuerPrivateKeyArmor: armor, hash })
				Toast.show({ content: 'L1 code cancelled', position: 'center' })
				await reload()
			} catch (cause) {
				setError(cause instanceof Error ? cause.message : 'Could not cancel L1 code.')
			} finally {
				setCancellingHash(null)
			}
		},
		[armor, cancellingHash, reload],
	)

	const handleClaim = useCallback(async () => {
		if (claimInFlightRef.current) return
		if (!armor) {
			setError('Unlock your wallet to sign.')
			return
		}
		const secret = claimCode.trim()
		if (!secret) {
			setError('Enter a Genesis redeem code.')
			return
		}
		claimInFlightRef.current = true
		setClaiming(true)
		setError('')
		try {
			const isL1Code = secret.toLowerCase().includes('genesis-l1')
			if (isL1Code) {
				await claimGenesisL1RedeemCode({ claimerPrivateKeyArmor: armor, secret })
				Toast.show({ content: 'You are now a Genesis L1 Evangelist', position: 'center' })
			} else {
				await claimGenesisL0RedeemCode({ claimerPrivateKeyArmor: armor, secret })
				Toast.show({ content: 'You are now a Genesis L0', position: 'center' })
			}
			setClaimCode('')
			await reload()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not claim redeem code.')
		} finally {
			claimInFlightRef.current = false
			setClaiming(false)
		}
	}, [armor, claimCode, reload])

	const handleSaveFoundation = useCallback(async () => {
		if (payoutInFlightRef.current || !snapshot?.isAdmin) return
		if (!armor) {
			setError('Unlock your wallet to sign.')
			return
		}
		payoutInFlightRef.current = true
		setSavingPayout('foundation')
		setError('')
		try {
			await setGenesisFoundation({ adminPrivateKeyArmor: armor, foundation: foundationDraft.trim() })
			Toast.show({ content: 'Foundation address updated', position: 'center' })
			await reload()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not update foundation.')
		} finally {
			payoutInFlightRef.current = false
			setSavingPayout(null)
		}
	}, [armor, foundationDraft, reload, snapshot?.isAdmin])

	const handleSaveAdminPayout = useCallback(async () => {
		if (payoutInFlightRef.current || !snapshot?.isAdmin) return
		if (!armor) {
			setError('Unlock your wallet to sign.')
			return
		}
		payoutInFlightRef.current = true
		setSavingPayout('adminPayout')
		setError('')
		try {
			await setGenesisDefaultAdminPayout({
				adminPrivateKeyArmor: armor,
				payout: adminPayoutDraft.trim(),
			})
			Toast.show({ content: 'Default admin payout updated', position: 'center' })
			await reload()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not update default admin payout.')
		} finally {
			payoutInFlightRef.current = false
			setSavingPayout(null)
		}
	}, [adminPayoutDraft, armor, reload, snapshot?.isAdmin])

	const copyText = useCallback(async (key: string, text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			setCopiedKey(key)
			window.setTimeout(() => setCopiedKey(null), 2000)
		} catch {
			setError('Could not copy to clipboard.')
		}
	}, [])

	const evangelistUrl = useMemo(() => {
		if (!eoa || !ethers.isAddress(eoa) || !snapshot?.isL1) return ''
		return buildGenesisEvangelistShareUrl(eoa)
	}, [eoa, snapshot?.isL1])

	const showClaim =
		!snapshot?.isL0 && !snapshot?.isL1 && !snapshot?.isAdmin

	const roleLabel = snapshot?.isAdmin
		? 'Admin'
		: snapshot?.isL0
			? 'L0'
			: snapshot?.isL1
				? 'L1 Evangelist'
				: 'Not registered'

	return (
		<div className="fixed inset-0 z-[90] flex min-h-0 flex-col overflow-hidden bg-[#050b1d] text-slate-50">
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-500/20 via-purple-500/5 to-transparent"
				aria-hidden
			/>
			<div className="relative z-10 flex min-h-0 flex-1 flex-col">
				<div
					className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-10"
					style={{ WebkitOverflowScrolling: 'touch' }}
				>
					<div
						className="mx-auto w-full max-w-2xl"
						style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
					>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={() => navigate('/BountyBoard')} />
						</div>
						<header className="pb-7 pt-8">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
								Genesis Node
							</p>
							<div className="mt-2 flex items-center justify-between gap-3">
								<h1 className="text-3xl font-semibold tracking-tight">Referral</h1>
								{eoa ? (
									<span
										className="shrink-0 rounded-full border border-indigo-200/20 bg-indigo-300/10 px-2.5 py-1 text-xs font-semibold text-indigo-100"
										aria-label={`Current Genesis referral role: ${roleLabel}`}
									>
										{roleLabel}
									</span>
								) : null}
							</div>
							<p className="mt-2 truncate font-mono text-[11px] text-slate-400">
								{shortAddr(CONET_GENESIS_NODE_REFERRAL_VAULT)}
							</p>
						</header>

						{!eoa ? (
							<div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-100">
								Connect a wallet to manage Genesis referral.
							</div>
						) : loading && !snapshot ? (
							<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
								<Loader2 className="h-5 w-5 animate-spin text-indigo-300" aria-hidden />
								<span>Loading…</span>
							</div>
						) : (
						<div className="space-y-4">
							{error ? (
								<div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-100">
									{error}
								</div>
							) : null}

							<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
								<div className="flex items-center gap-2">
									<Wallet className="h-4 w-4 text-[#7aa2ff]" aria-hidden />
									<h2 className="text-sm font-bold text-slate-50">Your role</h2>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{snapshot?.isAdmin ? (
										<span className="rounded-full border border-indigo-200/20 bg-indigo-300/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-100">
											Admin
										</span>
									) : null}
									{snapshot?.isL0 ? (
										<span className="rounded-full border border-purple-200/20 bg-purple-300/10 px-2.5 py-1 text-[11px] font-semibold text-purple-100">
											L0
										</span>
									) : null}
									{snapshot?.isL1 ? (
										<span className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
											L1 Evangelist
										</span>
									) : null}
									{!snapshot?.isAdmin && !snapshot?.isL0 && !snapshot?.isL1 ? (
										<span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
											Not registered
										</span>
									) : null}
								</div>
								<p className="mt-2 font-mono text-xs text-slate-400">{shortAddr(eoa)}</p>
								{snapshot?.isL0 && snapshot.parentAdmin ? (
									<p className="mt-1 text-xs text-slate-400">
										Parent admin:{' '}
										<span className="font-mono text-slate-300">{shortAddr(snapshot.parentAdmin)}</span>
									</p>
								) : null}
								{snapshot?.isL1 && snapshot.parentL0 ? (
									<p className="mt-1 text-xs text-slate-400">
										Parent L0: <span className="font-mono text-slate-300">{shortAddr(snapshot.parentL0)}</span>
										{' · '}
										Share of L0 pool:{' '}
										<span className="font-semibold text-slate-200">{ratioBpsToPercentLabel(snapshot.ratioBps)}</span>
									</p>
								) : null}
								<p className="mt-3 text-sm text-slate-200">
									Earned:{' '}
									<span className="font-semibold tabular-nums text-slate-50">
										{Number(snapshot?.earnedUsdcDisplay ?? '0').toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}{' '}
										USDC
									</span>
								</p>
							</section>

							{snapshot?.isL1 && evangelistUrl ? (
								<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
									<div className="flex items-center gap-2">
										<Link2 className="h-4 w-4 text-purple-200" aria-hidden />
										<h2 className="text-sm font-bold text-slate-50">Evangelist link</h2>
									</div>
									<p className="mt-1 text-xs text-slate-400">
										Buyers must attribute seats to an L1 Evangelist (not L0). Share this Discover link.
									</p>
									<button
										type="button"
										onClick={() => void copyText('evangelist', evangelistUrl)}
										className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8d3a8b] px-3 py-2.5 text-sm font-semibold text-white"
									>
										{copiedKey === 'evangelist' ? (
											<Check className="h-4 w-4 text-emerald-300" aria-hidden />
										) : (
											<Copy className="h-4 w-4" aria-hidden />
										)}
										{copiedKey === 'evangelist' ? 'Copied' : 'Copy Evangelist link'}
									</button>
								</section>
							) : null}

							{snapshot?.isL0 ? (
								<>
									<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
										<div className="flex items-center gap-2">
											<TicketPlus className="h-4 w-4 text-purple-200" aria-hidden />
											<h2 className="text-sm font-bold text-slate-50">Issue L1 Evangelist</h2>
										</div>
										<p className="mt-1 text-xs text-slate-400">
											Set what percent of your 10% node pool (125 USDC/node) goes to this L1. Remainder stays
											with you.
										</p>
										<label htmlFor="genesis-l1-share" className="mt-3 block text-xs font-semibold text-slate-300">
											L1 share of your 10% pool (%)
										</label>
										<input
											id="genesis-l1-share"
											type="number"
											inputMode="decimal"
											autoComplete="off"
											enterKeyHint="done"
											min={0}
											max={100}
											step={1}
											value={l1SharePercent}
											onChange={(e) => setL1SharePercent(e.target.value)}
											onKeyDown={preventNumericStepKeys}
											onWheel={preventNumericWheelStep}
											className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm tabular-nums text-slate-50 placeholder:text-slate-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
										/>
										<button
											type="button"
											onClick={() => void handleIssueL1()}
											disabled={issuingL1 || !armor}
											aria-busy={issuingL1}
											className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8d3a8b] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
										>
											{issuingL1 ? (
												<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											) : (
												<TicketPlus className="h-4 w-4" aria-hidden />
											)}
											{issuingL1 ? 'Creating…' : 'Create L1 redeem code'}
										</button>
										{lastIssuedL1Secret ? (
											<div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3">
												<p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
													New L1 code
												</p>
												<p className="mt-1 break-all font-mono text-xs text-emerald-50">
													{lastIssuedL1Secret}
												</p>
												<button
													type="button"
													onClick={() => void copyText('lastL1', lastIssuedL1Secret)}
													className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-200"
												>
													{copiedKey === 'lastL1' ? (
														<Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
													) : (
														<Copy className="h-3.5 w-3.5" aria-hidden />
													)}
													Copy code
												</button>
											</div>
										) : null}

										<ul className="mt-4 space-y-2">
											{l1Codes.length === 0 ? (
												<li className="text-xs text-slate-500">No L1 codes yet.</li>
											) : (
												l1Codes.map((row) => (
													<li
														key={row.hash}
														className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
													>
														<div className="flex items-start justify-between gap-2">
															<div className="min-w-0">
																<span
																	className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusChipClass(row.status)}`}
																>
																	{row.status}
																</span>
																<span className="ml-2 text-[10px] font-semibold text-slate-400">
																	{ratioBpsToPercentLabel(row.ratioBps)} of L0 pool
																</span>
																<p className="mt-1 break-all font-mono text-[11px] text-slate-300">
																	{row.secret ?? `${shortAddr(row.hash)} (secret not on this device)`}
																</p>
															</div>
															<div className="flex shrink-0 items-center gap-1">
																{row.secret ? (
																	<button
																		type="button"
																		onClick={() => void copyText(row.hash, row.secret!)}
																		className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-200"
																		aria-label="Copy redeem code"
																	>
																		{copiedKey === row.hash ? (
																			<Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
																		) : (
																			<Copy className="h-3.5 w-3.5" aria-hidden />
																		)}
																	</button>
																) : null}
																{row.status === 'pending' ? (
																	<button
																		type="button"
																		onClick={() => void handleCancelL1(row.hash)}
																		disabled={cancellingHash === row.hash}
																		aria-busy={cancellingHash === row.hash}
																		className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-300/20 bg-red-400/10 text-red-300"
																		aria-label="Cancel redeem code"
																	>
																		{cancellingHash === row.hash ? (
																			<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
																		) : (
																			<Ban className="h-3.5 w-3.5" aria-hidden />
																		)}
																	</button>
																) : null}
															</div>
														</div>
													</li>
												))
											)}
										</ul>
									</section>

									<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
										<div className="flex items-center gap-2">
											<Users className="h-4 w-4 text-purple-200" aria-hidden />
											<h2 className="text-sm font-bold text-slate-50">Downstream L1</h2>
											<span className="ml-auto text-xs font-semibold tabular-nums text-slate-500">
												{l1List.length}
											</span>
										</div>
										<ul className="mt-3 space-y-1.5">
											{l1List.length === 0 ? (
												<li className="text-xs text-slate-500">No L1 Evangelists yet.</li>
											) : (
												l1List.map((row) => (
													<li
														key={row.address}
														className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-2 text-xs"
													>
														<span className="truncate font-mono text-slate-300">{shortAddr(row.address)}</span>
														<span className="shrink-0 font-semibold text-slate-400">
															{ratioBpsToPercentLabel(row.ratioBps)}
														</span>
													</li>
												))
											)}
										</ul>
									</section>
								</>
							) : null}

							{snapshot?.isAdmin ? (
								<>
									<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
										<div className="flex items-center gap-2">
											<TicketPlus className="h-4 w-4 text-indigo-200" aria-hidden />
											<h2 className="text-sm font-bold text-slate-50">Issue L0 redeem</h2>
										</div>
										<p className="mt-1 text-xs text-slate-400">
											The full code is stored on this device only. Only its hash is written on CoNET.
										</p>
										<button
											type="button"
											onClick={() => void handleIssue()}
											disabled={issuing || !armor}
											aria-busy={issuing}
											className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1562f0] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
										>
											{issuing ? (
												<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											) : (
												<TicketPlus className="h-4 w-4" aria-hidden />
											)}
											{issuing ? 'Creating…' : 'Create L0 redeem code'}
										</button>
										{lastIssuedSecret ? (
											<div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3">
												<p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
													New code
												</p>
												<p className="mt-1 break-all font-mono text-xs text-emerald-50">
													{lastIssuedSecret}
												</p>
												<button
													type="button"
													onClick={() => void copyText('last', lastIssuedSecret)}
													className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-200"
												>
													{copiedKey === 'last' ? (
														<Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
													) : (
														<Copy className="h-3.5 w-3.5" aria-hidden />
													)}
													Copy code
												</button>
											</div>
										) : null}

										<ul className="mt-4 space-y-2">
											{codes.length === 0 ? (
												<li className="text-xs text-slate-500">No issued codes yet.</li>
											) : (
												codes.map((row) => (
													<li
														key={row.hash}
														className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
													>
														<div className="flex items-start justify-between gap-2">
															<div className="min-w-0">
																<span
																	className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusChipClass(row.status)}`}
																>
																	{row.status}
																</span>
																<p className="mt-1 break-all font-mono text-[11px] text-slate-300">
																	{row.secret ?? `${shortAddr(row.hash)} (secret not on this device)`}
																</p>
															</div>
															<div className="flex shrink-0 items-center gap-1">
																{row.secret ? (
																	<button
																		type="button"
																		onClick={() => void copyText(row.hash, row.secret!)}
																		className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-200"
																		aria-label="Copy redeem code"
																	>
																		{copiedKey === row.hash ? (
																			<Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
																		) : (
																			<Copy className="h-3.5 w-3.5" aria-hidden />
																		)}
																	</button>
																) : null}
																{row.status === 'pending' ? (
																	<button
																		type="button"
																		onClick={() => void handleCancel(row.hash)}
																		disabled={cancellingHash === row.hash}
																		aria-busy={cancellingHash === row.hash}
																		className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-300/20 bg-red-400/10 text-red-300"
																		aria-label="Cancel redeem code"
																	>
																		{cancellingHash === row.hash ? (
																			<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
																		) : (
																			<Ban className="h-3.5 w-3.5" aria-hidden />
																		)}
																	</button>
																) : null}
															</div>
														</div>
													</li>
												))
											)}
										</ul>
									</section>

									<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
										<div className="flex items-center gap-2">
											<Users className="h-4 w-4 text-indigo-200" aria-hidden />
											<h2 className="text-sm font-bold text-slate-50">Downstream L0</h2>
											<span className="ml-auto text-xs font-semibold tabular-nums text-slate-500">
												{l0List.length}
											</span>
										</div>
										<ul className="mt-3 space-y-1.5">
											{l0List.length === 0 ? (
												<li className="text-xs text-slate-500">No L0 members yet.</li>
											) : (
												l0List.map((addr) => (
													<li
														key={addr}
														className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-2 font-mono text-xs"
													>
														<span className="truncate text-slate-300">{shortAddr(addr)}</span>
														<a
															href={`https://mainnet.conet.network/address/${addr}`}
															target="_blank"
															rel="noopener noreferrer"
															className="shrink-0 text-indigo-300"
														>
															Explorer
														</a>
													</li>
												))
											)}
										</ul>
									</section>

									<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
										<h2 className="text-sm font-bold text-slate-50">Payout addresses</h2>
										<p className="mt-1 text-xs text-slate-400">
											Vault admins can update Foundation and Default admin payout (gasless relay).
										</p>
										<label
											htmlFor="genesis-foundation"
											className="mt-4 block text-xs font-semibold text-slate-400"
										>
											Foundation
										</label>
										<input
											id="genesis-foundation"
											type="text"
											value={foundationDraft}
											onChange={(e) => setFoundationDraft(e.target.value)}
											autoComplete="off"
											spellCheck={false}
											className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 font-mono text-xs text-slate-50 placeholder:text-slate-500"
										/>
										<button
											type="button"
											onClick={() => void handleSaveFoundation()}
											disabled={
												savingPayout !== null ||
												!armor ||
												foundationDraft.trim().toLowerCase() ===
													(snapshot.foundation ?? '').toLowerCase()
											}
											aria-busy={savingPayout === 'foundation'}
											className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1562f0] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
										>
											{savingPayout === 'foundation' ? (
												<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											) : null}
											{savingPayout === 'foundation' ? 'Saving…' : 'Save Foundation'}
										</button>

										<label
											htmlFor="genesis-admin-payout"
											className="mt-4 block text-xs font-semibold text-slate-400"
										>
											Default admin payout
										</label>
										<input
											id="genesis-admin-payout"
											type="text"
											value={adminPayoutDraft}
											onChange={(e) => setAdminPayoutDraft(e.target.value)}
											autoComplete="off"
											spellCheck={false}
											className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 font-mono text-xs text-slate-50 placeholder:text-slate-500"
										/>
										<button
											type="button"
											onClick={() => void handleSaveAdminPayout()}
											disabled={
												savingPayout !== null ||
												!armor ||
												adminPayoutDraft.trim().toLowerCase() ===
													(snapshot.defaultAdminPayout ?? '').toLowerCase()
											}
											aria-busy={savingPayout === 'adminPayout'}
											className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1562f0] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
										>
											{savingPayout === 'adminPayout' ? (
												<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											) : null}
											{savingPayout === 'adminPayout' ? 'Saving…' : 'Save Default admin payout'}
										</button>
									</section>
								</>
							) : null}

							{showClaim || (!snapshot?.isL0 && !snapshot?.isL1) ? (
								<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
									<h2 className="text-sm font-bold text-slate-50">Claim redeem code</h2>
									<p className="mt-1 text-xs text-slate-400">
										Paste an L0 code (from Admin) or L1 Evangelist code (from L0). Codes starting with{' '}
										<span className="font-mono text-slate-300">beamio-genesis-l1-</span> register as L1.
									</p>
									<input
										type="text"
										value={claimCode}
										onChange={(e) => setClaimCode(e.target.value)}
										placeholder="beamio-genesis-l0-… or beamio-genesis-l1-…"
										autoComplete="off"
										enterKeyHint="done"
										className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 font-mono text-sm text-slate-50 placeholder:text-slate-500"
									/>
									<button
										type="button"
										onClick={() => void handleClaim()}
										disabled={claiming || !armor || !claimCode.trim()}
										aria-busy={claiming}
										className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
									>
										{claiming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
										{claiming ? 'Claiming…' : 'Claim'}
									</button>
								</section>
							) : null}
						</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
