import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { Ban, Check, Copy, Loader2, TicketPlus } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { resolveSessionEoa } from '@/utils/resolveSessionEoa'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { CoNET_Data } from '@/utils/globals'
import {
	cancelGenesisL0RedeemCode,
	fetchGenesisL0RedeemCodesForIssuer,
	fetchGenesisMemberSnapshot,
	issueGenesisL0RedeemCode,
	type GenesisL0RedeemRecord,
	type GenesisMemberSnapshot,
} from '@/services/genesisNodeReferral'

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

/**
 * Admin-only Genesis L0 redeem management — opened from Partnership top-right redeem icon.
 * Secondary screen: hides Footer; back returns to /BountyBoard/genesis-referral.
 */
export default function GenesisL0RedeemManagePage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter } = useDaemonContext()
	const eoa = useMemo(() => resolveSessionEoa(profiles), [profiles])

	const [snapshot, setSnapshot] = useState<GenesisMemberSnapshot | null>(null)
	const [codes, setCodes] = useState<GenesisL0RedeemRecord[]>([])
	const [loading, setLoading] = useState(false)
	const [issuing, setIssuing] = useState(false)
	const [cancellingHash, setCancellingHash] = useState<string | null>(null)
	const [copiedKey, setCopiedKey] = useState<string | null>(null)
	const [error, setError] = useState('')
	const [lastIssuedSecret, setLastIssuedSecret] = useState<string | null>(null)

	const issueInFlightRef = useRef(false)

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
			setCodes([])
			return
		}
		setLoading(true)
		setError('')
		try {
			const snap = await fetchGenesisMemberSnapshot(eoa)
			setSnapshot(snap)
			if (snap?.isAdmin) {
				const issued = await fetchGenesisL0RedeemCodesForIssuer(eoa).catch(
					() => [] as GenesisL0RedeemRecord[],
				)
				setCodes(issued)
			} else {
				setCodes([])
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not load L0 redeem codes.')
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

	const copyText = useCallback(async (key: string, text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			setCopiedKey(key)
			window.setTimeout(() => setCopiedKey(null), 2000)
		} catch {
			setError('Could not copy to clipboard.')
		}
	}, [])

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
							<BeamioCircularBackButton
								variant="onDark"
								onClick={() => navigate('/BountyBoard/genesis-referral')}
							/>
						</div>
						<header className="pb-7 pt-8">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
								Genesis Node
							</p>
							<div className="mt-2 flex items-center gap-3">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-400/15 text-indigo-200">
									<TicketPlus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</div>
								<h1 className="text-3xl font-semibold tracking-tight">L0 redeem</h1>
							</div>
							<p className="mt-2 text-sm text-slate-400">
								Issue and manage L0 partnership redeem codes. Full codes stay on this device; only
								hashes are written on CoNET.
							</p>
						</header>

						{!eoa ? (
							<div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-100">
								Connect a wallet to manage L0 redeem codes.
							</div>
						) : loading && !snapshot ? (
							<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
								<Loader2 className="h-5 w-5 animate-spin text-indigo-300" aria-hidden />
								<span>Loading…</span>
							</div>
						) : !snapshot?.isAdmin ? (
							<div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-100">
								Only Genesis Admin can issue L0 redeem codes.
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
																{row.secret ??
																	`${shortAddr(row.hash)} (secret not on this device)`}
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
																		<Check
																			className="h-3.5 w-3.5 text-emerald-400"
																			aria-hidden
																		/>
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
																		<Loader2
																			className="h-3.5 w-3.5 animate-spin"
																			aria-hidden
																		/>
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
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
