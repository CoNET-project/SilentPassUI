import { useCallback, useEffect, useState } from 'react'
import { Check, Clipboard, UserRound } from 'lucide-react'
import { ethers } from 'ethers'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { formatBeamioTagDisplayLine } from '@/utils/aaMultisigTaskUi'
import {
	AGENT_INVITE_INTRODUCER_STASHED_EVENT,
	readAgentInviteIntroducer,
} from '@/utils/agentInviteIntroducerStash'
import { fetchIntroducerOf } from '@/utils/agentReferrerRegistryClient'

/**
 * In-app “Invited by” chip for the referee (consumer who opened `?invite=0x…`).
 * Prefer on-chain `introducerOf(referee)`; fall back to local stash until bind confirms.
 * Before a wallet exists there is no referee: still show the stash as pending bind.
 * Desktop marketing Invited-by lives on homepage — this is the PWA surface.
 */
export function InvitedByIntroducerChip({
	refereeEoa,
	className = '',
}: {
	/** Omit on the no-wallet gate. Stash pending still renders. */
	refereeEoa?: string | null
	className?: string
}) {
	const { resolveTag, ensureProfilesForAddresses } = useBeamioTagDatabase()
	const [introducer, setIntroducer] = useState<string | null>(null)
	const [source, setSource] = useState<'chain' | 'stash' | null>(null)
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		let cancelled = false
		let seq = 0

		const apply = () => {
			const ticket = ++seq
			const referee = refereeEoa?.trim() ?? ''
			const hasReferee = Boolean(referee && ethers.isAddress(referee))
			// Stash without referee: CREATE YOUR BEAMIO ID gate has no EOA yet.
			const stash = readAgentInviteIntroducer()
			if (!hasReferee) {
				if (cancelled || ticket !== seq) return
				setIntroducer(stash)
				setSource(stash ? 'stash' : null)
				return
			}
			if (stash) {
				setIntroducer(stash)
				setSource('stash')
			}
			void (async () => {
				const onChain = await fetchIntroducerOf(referee)
				if (cancelled || ticket !== seq) return
				if (onChain) {
					setIntroducer(onChain)
					setSource('chain')
					return
				}
				// Untrusted / unbound: keep stash if present; do not clear to “none”.
				const stillStashed = readAgentInviteIntroducer()
				setIntroducer(stillStashed)
				setSource(stillStashed ? 'stash' : null)
			})()
		}

		apply()
		const onStash = () => apply()
		window.addEventListener(AGENT_INVITE_INTRODUCER_STASHED_EVENT, onStash)
		return () => {
			cancelled = true
			seq += 1
			window.removeEventListener(AGENT_INVITE_INTRODUCER_STASHED_EVENT, onStash)
		}
	}, [refereeEoa])

	useEffect(() => {
		if (!introducer) return
		void ensureProfilesForAddresses([introducer])
	}, [introducer, ensureProfilesForAddresses])

	const copy = useCallback(async () => {
		if (!introducer) return
		try {
			await navigator.clipboard.writeText(introducer)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch {
			setCopied(false)
		}
	}, [introducer])

	if (!introducer) return null

	const short =
		introducer.length > 10
			? `${introducer.slice(0, 6)}…${introducer.slice(-4)}`
			: introducer
	const tagRaw = resolveTag(introducer)
	const tagLine = tagRaw ? formatBeamioTagDisplayLine(tagRaw) : ''
	const pendingHint = source === 'stash' ? ' · pending bind' : ''

	return (
		<div
			className={`flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`.trim()}
			data-testid="invited-by-introducer-chip"
			data-introducer={introducer}
			data-source={source ?? ''}
		>
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e9edff] text-[#0051d1]">
				<UserRound className="h-5 w-5" strokeWidth={2} aria-hidden />
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
					Invited by{pendingHint}
				</p>
				{tagLine ? (
					<p className="mt-0.5 truncate text-[15px] font-bold text-[#1f2328] dark:text-slate-100">
						{tagLine}
					</p>
				) : null}
				<button
					type="button"
					onClick={() => void copy()}
					className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#dce2f7] bg-[#e9edff] px-2.5 py-1 text-left font-mono text-[11px] text-[#424655]"
					aria-label={`Copy introducer address ${introducer}`}
				>
					<span className="truncate">{short}</span>
					{copied ? (
						<Check className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
					) : (
						<Clipboard className="h-3 w-3 shrink-0 text-[#0051d1]" aria-hidden />
					)}
				</button>
			</div>
		</div>
	)
}
