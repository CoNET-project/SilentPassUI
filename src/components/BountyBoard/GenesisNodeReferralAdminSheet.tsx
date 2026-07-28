import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
	X,
} from 'lucide-react'
import { Toast } from 'antd-mobile'
import { useDaemonContext } from '@/providers/DaemonProvider'
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

type Props = {
	open: boolean
	onClose: () => void
	eoa: string
}

function shortAddr(addr: string): string {
	if (!addr || addr.length < 12) return addr
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function statusChipClass(status: GenesisL0RedeemRecord['status']): string {
	switch (status) {
		case 'pending':
			return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900/50'
		case 'claimed':
			return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-900/50'
		case 'cancelled':
			return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
		default:
			return 'bg-slate-100 text-slate-600 border-slate-200'
	}
}

/** percent 0–100 → ratioBps */
function percentInputToBps(raw: string): number | null {
	const n = Number(raw)
	if (!Number.isFinite(n) || n < 0 || n > 100) return null
	return Math.round(n * 100)
}

export function GenesisNodeReferralAdminSheet({ open, onClose, eoa }: Props) {
	const { profiles } = useDaemonContext()
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)

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

	const issueInFlightRef = useRef(false)
	const issueL1InFlightRef = useRef(false)
	const claimInFlightRef = useRef(false)

	useEffect(() => {
		if (!open) {
			setIsEntered(false)
			setIsClosing(false)
			return
		}
		const frame = requestAnimationFrame(() => setIsEntered(true))
		return () => cancelAnimationFrame(frame)
	}, [open])

	const close = useCallback(() => {
		if (isClosing) return
		setIsClosing(true)
		window.setTimeout(onClose, 300)
	}, [isClosing, onClose])

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
		if (!open) return
		void reload()
	}, [open, reload])

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

	if (!open) return null

	const slideTransform = isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)'
	const showClaim =
		!snapshot?.isL0 && !snapshot?.isL1 && !snapshot?.isAdmin

	return (
		<div className="fixed inset-0 z-[80]">
			<button
				type="button"
				className="absolute inset-0 bg-black/40"
				aria-label="Close"
				onClick={close}
			/>
			<div
				className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-[#F2F2F7] shadow-2xl transition-transform duration-300 ease-out dark:bg-slate-950"
				style={{ transform: slideTransform }}
				role="dialog"
				aria-modal="true"
				aria-label="Genesis Node referral"
			>
				<header className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
					<button
						type="button"
						onClick={close}
						tabIndex={-1}
						className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
						aria-label="Cancel"
					>
						<X className="h-4 w-4" aria-hidden />
					</button>
					<div className="min-w-0 flex-1 text-center">
						<p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">Genesis Node referral</p>
						<p className="truncate font-mono text-[10px] text-slate-400">{shortAddr(CONET_GENESIS_NODE_REFERRAL_VAULT)}</p>
					</div>
					<span className="inline-flex h-9 w-9" aria-hidden />
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
					{loading && !snapshot ? (
						<div className="flex items-center justify-center gap-2 py-16 text-slate-500">
							<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
							<span className="text-sm">Loading…</span>
						</div>
					) : (
						<div className="space-y-4">
							{error ? (
								<p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
									{error}
								</p>
							) : null}

							<section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
								<div className="flex items-center gap-2">
									<Wallet className="h-4 w-4 text-[#0051d1]" aria-hidden />
									<h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Your role</h2>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{snapshot?.isAdmin ? (
										<span className="rounded-full bg-[#e9edff] px-2.5 py-1 text-[11px] font-semibold text-[#0051d1]">
											Admin
										</span>
									) : null}
									{snapshot?.isL0 ? (
										<span className="rounded-full bg-[#f5ecff] px-2.5 py-1 text-[11px] font-semibold text-[#8d3a8b]">
											L0
										</span>
									) : null}
									{snapshot?.isL1 ? (
										<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
											L1 Evangelist
										</span>
									) : null}
									{!snapshot?.isAdmin && !snapshot?.isL0 && !snapshot?.isL1 ? (
										<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
											Not registered
										</span>
									) : null}
								</div>
								<p className="mt-2 font-mono text-xs text-slate-500">{shortAddr(eoa)}</p>
								{snapshot?.isL0 && snapshot.parentAdmin ? (
									<p className="mt-1 text-xs text-slate-500">
										Parent admin:{' '}
										<span className="font-mono">{shortAddr(snapshot.parentAdmin)}</span>
									</p>
								) : null}
								{snapshot?.isL1 && snapshot.parentL0 ? (
									<p className="mt-1 text-xs text-slate-500">
										Parent L0: <span className="font-mono">{shortAddr(snapshot.parentL0)}</span>
										{' · '}
										Share of L0 pool:{' '}
										<span className="font-semibold">{ratioBpsToPercentLabel(snapshot.ratioBps)}</span>
									</p>
								) : null}
								<p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
									Earned:{' '}
									<span className="font-semibold tabular-nums">
										{Number(snapshot?.earnedUsdcDisplay ?? '0').toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}{' '}
										USDC
									</span>
								</p>
							</section>

							{snapshot?.isL1 && evangelistUrl ? (
								<section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
									<div className="flex items-center gap-2">
										<Link2 className="h-4 w-4 text-[#8d3a8b]" aria-hidden />
										<h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Evangelist link</h2>
									</div>
									<p className="mt-1 text-xs text-slate-500">
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
									<section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
										<div className="flex items-center gap-2">
											<TicketPlus className="h-4 w-4 text-[#8d3a8b]" aria-hidden />
											<h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Issue L1 Evangelist</h2>
										</div>
										<p className="mt-1 text-xs text-slate-500">
											Set what percent of your 10% node pool (125 USDC/node) goes to this L1. Remainder stays
											with you.
										</p>
										<label htmlFor="genesis-l1-share" className="mt-3 block text-xs font-semibold text-slate-600">
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
											className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] dark:border-slate-700 dark:bg-slate-950"
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
											<div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
												<p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
													New L1 code
												</p>
												<p className="mt-1 break-all font-mono text-xs text-emerald-900 dark:text-emerald-100">
													{lastIssuedL1Secret}
												</p>
												<button
													type="button"
													onClick={() => void copyText('lastL1', lastIssuedL1Secret)}
													className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
												>
													{copiedKey === 'lastL1' ? (
														<Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
													) : (
														<Copy className="h-3.5 w-3.5" aria-hidden />
													)}
													Copy code
												</button>
											</div>
										) : null}

										<ul className="mt-4 space-y-2">
											{l1Codes.length === 0 ? (
												<li className="text-xs text-slate-400">No L1 codes yet.</li>
											) : (
												l1Codes.map((row) => (
													<li
														key={row.hash}
														className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40"
													>
														<div className="flex items-start justify-between gap-2">
															<div className="min-w-0">
																<span
																	className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusChipClass(row.status)}`}
																>
																	{row.status}
																</span>
																<span className="ml-2 text-[10px] font-semibold text-slate-500">
																	{ratioBpsToPercentLabel(row.ratioBps)} of L0 pool
																</span>
																<p className="mt-1 break-all font-mono text-[11px] text-slate-600 dark:text-slate-300">
																	{row.secret ?? `${shortAddr(row.hash)} (secret not on this device)`}
																</p>
															</div>
															<div className="flex shrink-0 items-center gap-1">
																{row.secret ? (
																	<button
																		type="button"
																		onClick={() => void copyText(row.hash, row.secret!)}
																		className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-200"
																		aria-label="Copy redeem code"
																	>
																		{copiedKey === row.hash ? (
																			<Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
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
																		className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-500 shadow-sm dark:bg-slate-800"
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

									<section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
										<div className="flex items-center gap-2">
											<Users className="h-4 w-4 text-[#8d3a8b]" aria-hidden />
											<h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Downstream L1</h2>
											<span className="ml-auto text-xs font-semibold tabular-nums text-slate-400">
												{l1List.length}
											</span>
										</div>
										<ul className="mt-3 space-y-1.5">
											{l1List.length === 0 ? (
												<li className="text-xs text-slate-400">No L1 Evangelists yet.</li>
											) : (
												l1List.map((row) => (
													<li
														key={row.address}
														className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-xs dark:border-slate-800"
													>
														<span className="truncate font-mono">{shortAddr(row.address)}</span>
														<span className="shrink-0 font-semibold text-slate-500">
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
									<section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
										<div className="flex items-center gap-2">
											<TicketPlus className="h-4 w-4 text-[#1562f0]" aria-hidden />
											<h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Issue L0 redeem</h2>
										</div>
										<p className="mt-1 text-xs text-slate-500">
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
											<div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
												<p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
													New code
												</p>
												<p className="mt-1 break-all font-mono text-xs text-emerald-900 dark:text-emerald-100">
													{lastIssuedSecret}
												</p>
												<button
													type="button"
													onClick={() => void copyText('last', lastIssuedSecret)}
													className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
												>
													{copiedKey === 'last' ? (
														<Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
													) : (
														<Copy className="h-3.5 w-3.5" aria-hidden />
													)}
													Copy code
												</button>
											</div>
										) : null}

										<ul className="mt-4 space-y-2">
											{codes.length === 0 ? (
												<li className="text-xs text-slate-400">No issued codes yet.</li>
											) : (
												codes.map((row) => (
													<li
														key={row.hash}
														className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40"
													>
														<div className="flex items-start justify-between gap-2">
															<div className="min-w-0">
																<span
																	className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusChipClass(row.status)}`}
																>
																	{row.status}
																</span>
																<p className="mt-1 break-all font-mono text-[11px] text-slate-600 dark:text-slate-300">
																	{row.secret ?? `${shortAddr(row.hash)} (secret not on this device)`}
																</p>
															</div>
															<div className="flex shrink-0 items-center gap-1">
																{row.secret ? (
																	<button
																		type="button"
																		onClick={() => void copyText(row.hash, row.secret!)}
																		className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-200"
																		aria-label="Copy redeem code"
																	>
																		{copiedKey === row.hash ? (
																			<Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
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
																		className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-500 shadow-sm dark:bg-slate-800"
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

									<section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
										<div className="flex items-center gap-2">
											<Users className="h-4 w-4 text-[#1562f0]" aria-hidden />
											<h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Downstream L0</h2>
											<span className="ml-auto text-xs font-semibold tabular-nums text-slate-400">
												{l0List.length}
											</span>
										</div>
										<ul className="mt-3 space-y-1.5">
											{l0List.length === 0 ? (
												<li className="text-xs text-slate-400">No L0 members yet.</li>
											) : (
												l0List.map((addr) => (
													<li
														key={addr}
														className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2 font-mono text-xs dark:border-slate-800"
													>
														<span className="truncate">{shortAddr(addr)}</span>
														<a
															href={`https://mainnet.conet.network/address/${addr}`}
															target="_blank"
															rel="noopener noreferrer"
															className="shrink-0 text-[#0051d1]"
														>
															Explorer
														</a>
													</li>
												))
											)}
										</ul>
									</section>

									<section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
										<h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Payout addresses</h2>
										<p className="mt-1 text-xs text-slate-500">Read-only (owner can update on-chain).</p>
										<dl className="mt-3 space-y-2 text-xs">
											<div>
												<dt className="font-semibold text-slate-500">Foundation</dt>
												<dd className="mt-0.5 break-all font-mono text-slate-800 dark:text-slate-200">
													{snapshot.foundation}
												</dd>
											</div>
											<div>
												<dt className="font-semibold text-slate-500">Default admin payout</dt>
												<dd className="mt-0.5 break-all font-mono text-slate-800 dark:text-slate-200">
													{snapshot.defaultAdminPayout}
												</dd>
											</div>
										</dl>
									</section>
								</>
							) : null}

							{showClaim || (!snapshot?.isL0 && !snapshot?.isL1) ? (
								<section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
									<h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Claim redeem code</h2>
									<p className="mt-1 text-xs text-slate-500">
										Paste an L0 code (from Admin) or L1 Evangelist code (from L0). Codes starting with{' '}
										<span className="font-mono">beamio-genesis-l1-</span> register as L1.
									</p>
									<input
										type="text"
										value={claimCode}
										onChange={(e) => setClaimCode(e.target.value)}
										placeholder="beamio-genesis-l0-… or beamio-genesis-l1-…"
										autoComplete="off"
										enterKeyHint="done"
										className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
									/>
									<button
										type="button"
										onClick={() => void handleClaim()}
										disabled={claiming || !armor || !claimCode.trim()}
										aria-busy={claiming}
										className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
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
	)
}
