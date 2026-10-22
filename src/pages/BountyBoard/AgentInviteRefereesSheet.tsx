import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clipboard, Loader2, UserPlus } from 'lucide-react'
import {
	BeamioCircularBackButton,
	BEAMIO_CIRCULAR_BACK_ROW_CLASS,
} from '@/components/BeamioCircularBackButton'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { formatBeamioTagDisplayLine } from '@/utils/aaMultisigTaskUi'
import {
	fetchAgentInviteReferees,
	type AgentInviteRefereeRow,
} from '@/utils/agentReferrerRegistryClient'

const SLIDE_MS = 300

function RefereeAddressCapsule({ address }: { address: string }) {
	const [copied, setCopied] = useState(false)
	const short =
		address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
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
			className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#dce2f7] bg-[#e9edff] px-2.5 py-1 text-left font-mono text-[11px] text-[#424655]"
			aria-label={`Copy address ${address}`}
		>
			<span className="truncate">{short}</span>
			{copied ? (
				<Check className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
			) : (
				<Clipboard className="h-3 w-3 shrink-0 text-[#0051d1]" aria-hidden />
			)}
		</button>
	)
}

function InviteRefereeRow({ row }: { row: AgentInviteRefereeRow }) {
	const { resolveTag, ensureProfilesForAddresses } = useBeamioTagDatabase()
	useEffect(() => {
		void ensureProfilesForAddresses([row.referee])
	}, [row.referee, ensureProfilesForAddresses])
	const tagRaw = resolveTag(row.referee)
	const tagLine = tagRaw ? formatBeamioTagDisplayLine(tagRaw) : ''

	return (
		<li className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0 dark:border-slate-800">
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
				<UserPlus className="h-5 w-5" strokeWidth={2} aria-hidden />
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-[15px] font-bold text-[#1f2328] dark:text-slate-100">Registered</p>
				{tagLine ? (
					<p className="mt-0.5 truncate text-[13px] font-medium text-slate-500 dark:text-slate-400">
						{tagLine}
					</p>
				) : null}
				<div className="mt-1">
					<RefereeAddressCapsule address={row.referee} />
				</div>
			</div>
		</li>
	)
}

/** Full-screen sheet: EOAs registered under the current user's invite link. */
export function AgentInviteRefereesSheet({
	introducerEoa,
	onClose,
}: {
	introducerEoa: string
	onClose: () => void
}) {
	const { setShowFooter } = useDaemonContext()
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [loading, setLoading] = useState(true)
	const [rows, setRows] = useState<AgentInviteRefereeRow[] | null>(null)
	const [total, setTotal] = useState(0)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	useEffect(() => {
		const frame = requestAnimationFrame(() => setIsEntered(true))
		return () => cancelAnimationFrame(frame)
	}, [])

	useEffect(() => {
		let cancelled = false
		setLoading(true)
		void (async () => {
			const page = await fetchAgentInviteReferees(introducerEoa, { limit: 100, offset: 0 })
			if (cancelled) return
			if (page) {
				setRows(page.referees)
				setTotal(page.total)
			} else {
				setRows(null)
			}
			setLoading(false)
		})()
		return () => {
			cancelled = true
		}
	}, [introducerEoa])

	const close = useCallback(() => {
		if (isClosing) return
		setIsClosing(true)
		window.setTimeout(onClose, SLIDE_MS)
	}, [isClosing, onClose])

	const body = (
		<div
			className="fixed inset-0 z-[80] flex flex-col bg-[#f4f6f8] transition-transform duration-300 ease-out dark:bg-slate-950"
			style={{
				transform: isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)',
			}}
			role="dialog"
			aria-modal="true"
			aria-label="Registered through your link"
		>
			<div
				className="shrink-0 px-4"
				style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
			>
				<div className={`${BEAMIO_CIRCULAR_BACK_ROW_CLASS} relative`}>
					<BeamioCircularBackButton
						variant="onLight"
						onClick={close}
						className="absolute left-0 top-0"
					/>
				</div>
				<header className="pb-5 pt-8">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
						Referrals
					</p>
					<h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-50">
						Registered through your link
					</h1>
					<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
						{total > 0
							? `${total.toLocaleString('en-US')} wallet${total === 1 ? '' : 's'} used your invitation.`
							: 'Wallets that registered with your invite link appear here.'}
					</p>
				</header>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-10">
				{loading ? (
					<div className="flex items-center justify-center gap-2 py-16 text-slate-400">
						<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
						<span className="text-sm">Loading…</span>
					</div>
				) : rows == null ? (
					<p className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
						Unable to load registrations right now. Try again later.
					</p>
				) : rows.length === 0 ? (
					<p className="rounded-2xl border border-slate-200/80 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
						No registrations yet. Share your invite link to get started.
					</p>
				) : (
					<ul className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
						{rows.map((row) => (
							<InviteRefereeRow key={row.referee} row={row} />
						))}
					</ul>
				)}
			</div>
		</div>
	)

	return createPortal(body, document.body)
}
