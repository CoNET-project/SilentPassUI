import React, { useMemo } from 'react'
import { AlertTriangle, Check, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { ethers } from 'ethers'
import {
	LONGDHANG_OLD_BASE_CARD,
	isLongDhangMigrationOwnerAmong,
	isLongDhangMigrationCompleted,
	type LongDhangMigrationAutoResult,
	type LongDhangMigrationAutoPhase,
} from '@/services/BeamioCard'

type LongDhangConetMigrationPanelProps = {
	currentEoa?: string | null
	privateKeyArmor?: string | null
	authorizedOwnerEoa?: string[] | null
	className?: string
	busy: boolean
	phase: LongDhangMigrationAutoPhase | null
	phaseDetail: string | null
	result: LongDhangMigrationAutoResult | null
	onStart: () => void
}

function shortAddr(address: string | undefined): string {
	if (!address || !ethers.isAddress(address)) return '—'
	const a = ethers.getAddress(address)
	return `${a.slice(0, 6)}…${a.slice(-4)}`
}

const PHASE_LABEL: Record<LongDhangMigrationAutoPhase, string> = {
	'loading-members': 'Loading frozen Base snapshot (5 members, 3 terminals)…',
	'creating-card': 'Creating CoNET card (inherits Base metadata)…',
	'authorizing-admin': 'Authorizing migration admin…',
	migrating: 'Airdropping member balances on CoNET…',
	'migrate-admins': 'Registering POS terminals under merchant owner admin…',
	completed: 'Migration complete',
	failed: 'Migration failed',
}

export function LongDhangConetMigrationPanel({
	currentEoa,
	privateKeyArmor,
	authorizedOwnerEoa,
	className = '',
	busy,
	phase,
	phaseDetail,
	result,
	onStart,
}: LongDhangConetMigrationPanelProps) {
	const isOwner = useMemo(
		() => isLongDhangMigrationOwnerAmong(currentEoa, authorizedOwnerEoa),
		[currentEoa, authorizedOwnerEoa]
	)
	const alreadyCompleted = useMemo(
		() => Boolean(currentEoa && ethers.isAddress(currentEoa) && isLongDhangMigrationCompleted(currentEoa)),
		[currentEoa]
	)
	const walletReady = Boolean(privateKeyArmor?.trim())

	if (authorizedOwnerEoa == null || !isOwner || (alreadyCompleted && !busy && !phase)) return null

	const primary =
		'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1562f0] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#0f4ec4] disabled:cursor-not-allowed disabled:opacity-60'

	return (
		<section className={`rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm sm:p-5 ${className}`}>
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
						<Sparkles className="h-3.5 w-3.5" />
						LongDhang Migration
					</span>
					<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
						<ShieldCheck className="h-3.5 w-3.5" />
						Authorized operator
					</span>
				</div>
				<h3 className="mt-2 font-manrope text-xl font-extrabold tracking-tight text-slate-950">
					Migrate LongDhang to CoNET
				</h3>
				<p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-600">
					One click: create a new CoNET card (inherits Base metadata), airdrop each Member&apos;s NFT #0 balance from{' '}
					<span className="font-mono text-xs">{shortAddr(LONGDHANG_OLD_BASE_CARD)}</span>, and copy all sub-admin
					terminals from the frozen Base snapshot.
				</p>
			</div>

			<div className="mt-4 rounded-xl border border-white bg-white/80 p-3 text-xs font-semibold text-slate-600">
				<p>1. New CoNET merchant card inherits Base card metadata.</p>
				<p className="mt-1">2. Members list (biz /Members) → read Base NFT #0 balance → mint to CoNET AA.</p>
				<p className="mt-1">3. Base sub-admin list + metadata → re-register on CoNET card.</p>
			</div>

			{busy ? (
				<p className="mt-3 rounded-xl border border-[#1562f0]/20 bg-[#1562f0]/5 px-3 py-2 text-sm font-semibold text-[#0f4ec4]">
					Migration is running — please keep this page open until you see success or an error (may take several
					minutes).
				</p>
			) : null}

			{!walletReady ? (
				<p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
					Unlock with @BeamioTag and access password to start migration.
				</p>
			) : null}

			<div className="mt-4 flex flex-col gap-2 sm:flex-row">
				<button type="button" className={primary} disabled={!walletReady || busy} onClick={onStart}>
					{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
					{busy ? 'Migration in progress…' : 'Start Migration'}
				</button>
			</div>

			{phase ? (
				<div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
					<p className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
						{busy ? (
							<Loader2 className="h-4 w-4 animate-spin text-[#1562f0]" aria-hidden />
						) : phase === 'completed' ? (
							<Check className="h-4 w-4 text-emerald-500" aria-hidden />
						) : phase === 'failed' ? (
							<AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden />
						) : null}
						{PHASE_LABEL[phase]}
					</p>
					{phaseDetail ? <p className="mt-1 break-all text-xs font-semibold text-slate-500">{phaseDetail}</p> : null}
				</div>
			) : null}

			{result?.success ? (
				<div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
					<p>Migration completed successfully.</p>
					<p className="font-mono text-xs">New CoNET card: {result.newCardAddress}</p>
					<p className="text-xs">
						Members: {result.members.minted} minted, {result.members.skipped} skipped · Sub-admins:{' '}
						{result.admins.registered} registered, {result.admins.skipped} skipped
					</p>
					{result.verify ? (
						<p className="text-xs">
							Verified {result.verify.memberMatches}/{result.verify.memberTotal} members,{' '}
							{result.verify.adminMatches}/{result.verify.adminTotal} sub-admins.
						</p>
					) : null}
				</div>
			) : null}

			{result && !result.success ? (
				<p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
					{result.error ?? phaseDetail ?? 'Migration failed.'}
				</p>
			) : null}

			{result?.phases && result.phases.length > 0 ? (
				<ul className="mt-3 space-y-1 rounded-xl border border-slate-100 bg-white/70 p-3 text-xs font-semibold text-slate-600">
					{result.phases.map((row) => (
						<li key={`${row.phase}-${row.detail ?? ''}`} className="flex items-start gap-2">
							{row.ok ? (
								<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
							) : (
								<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden />
							)}
							<span>
								{row.phase}
								{row.detail ? `: ${row.detail}` : ''}
							</span>
						</li>
					))}
				</ul>
			) : null}
		</section>
	)
}

export type LongDhangTerminalRepairPanelProps = {
	currentEoa?: string | null
	privateKeyArmor?: string | null
	authorizedOwnerEoa?: string[] | null
	newCardAddress?: string | null
	termTotal: number
	termMatches: number
	busy: boolean
	error?: string | null
	onRepair: () => void
}

/** Shown after card/member migration when POS sub-admins from the Base snapshot are not yet on the CoNET card. */
export function LongDhangTerminalRepairPanel({
	currentEoa,
	privateKeyArmor,
	authorizedOwnerEoa,
	newCardAddress,
	termTotal,
	termMatches,
	busy,
	error,
	onRepair,
}: LongDhangTerminalRepairPanelProps) {
	const isOwner = useMemo(
		() => isLongDhangMigrationOwnerAmong(currentEoa, authorizedOwnerEoa),
		[currentEoa, authorizedOwnerEoa],
	)
	const walletReady = Boolean(privateKeyArmor?.trim())
	const remaining = Math.max(0, termTotal - termMatches)

	if (!isOwner || termTotal <= 0 || remaining <= 0) return null

	const primary =
		'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1562f0] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#0f4ec4] disabled:cursor-not-allowed disabled:opacity-60'

	return (
		<section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm sm:mb-5 sm:p-5">
			<div className="flex flex-wrap items-center gap-2">
				<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">
					<Sparkles className="h-3.5 w-3.5" />
					Terminal migration
				</span>
				<span className="text-xs font-bold text-amber-900">
					{termMatches}/{termTotal} POS terminals on CoNET
				</span>
			</div>
			<h3 className="mt-2 font-manrope text-lg font-extrabold tracking-tight text-slate-950">
				Finish migrating POS terminals
			</h3>
			<p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-600">
				Member balances were moved to{' '}
				<span className="font-mono text-xs">{shortAddr(newCardAddress ?? undefined)}</span>. Register the{' '}
				{remaining} remaining terminal{remaining === 1 ? '' : 's'} from the frozen Base snapshot as sub-admins on
				your CoNET program card.
			</p>
			{busy ? (
				<p className="mt-3 flex items-center gap-2 rounded-xl border border-[#1562f0]/20 bg-[#1562f0]/5 px-3 py-2 text-sm font-semibold text-[#0f4ec4]">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
					Registering terminals on-chain — keep this page open (may take several minutes).
				</p>
			) : null}
			{!walletReady && !busy ? (
				<p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
					Unlock with @BeamioTag and access password to register terminals.
				</p>
			) : null}
			<div className="mt-4">
				<button type="button" className={primary} disabled={!walletReady || busy} onClick={onRepair}>
					{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
					{busy ? 'Registering terminals…' : `Register ${remaining} terminal${remaining === 1 ? '' : 's'}`}
				</button>
			</div>
			{error ? (
				<p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
					{error}
				</p>
			) : null}
		</section>
	)
}
