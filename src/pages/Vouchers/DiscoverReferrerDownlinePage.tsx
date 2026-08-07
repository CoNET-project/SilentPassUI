import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Users } from 'lucide-react'
import {
	BeamioCircularBackButton,
	BEAMIO_CIRCULAR_BACK_ROW_CLASS,
} from '@/components/BeamioCircularBackButton'
import { IpfsImg } from '@/components/IpfsImg'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { formatBeamioTagDisplayLine } from '@/utils/aaMultisigTaskUi'
import {
	fetchCardProgramMyReferees,
	formatReferrerRewardPointsDisplay,
	type CardProgramMyRefereeRow,
	type CardProgramMyRefereesSnapshot,
} from '@/utils/cardProgramReferrerDashboard'

const SLIDE_MS = 300

function DownlineBeamioTagCapsule({ eoa }: { eoa: string }) {
	const { lookupByAddress, resolveTag, avatarImgUrl, ensureProfilesForAddresses } = useBeamioTagDatabase()

	useEffect(() => {
		void ensureProfilesForAddresses([eoa])
	}, [eoa, ensureProfilesForAddresses])

	const record = lookupByAddress(eoa)
	const tagRaw = resolveTag(eoa)
	const tagLine = formatBeamioTagDisplayLine(tagRaw)
	const avatarSrc = avatarImgUrl(record?.accountName ?? tagRaw, eoa)

	return (
		<div
			className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-slate-200/90 bg-white py-1 pl-1 pr-3 shadow-sm dark:border-slate-600 dark:bg-slate-800"
			aria-label={tagLine}
		>
			<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-slate-200 dark:ring-slate-600">
				<IpfsImg src={avatarSrc} alt="" className="h-full w-full object-cover" draggable={false} />
			</div>
			<span className="truncate text-[14px] font-bold leading-none tracking-tight text-[#0F172A] dark:text-slate-100">
				{tagLine}
			</span>
		</div>
	)
}

function DownlineRefereeRow({ row }: { row: CardProgramMyRefereeRow }) {
	const pts = formatReferrerRewardPointsDisplay(row.refereeChargePointsTotal6)
	return (
		<li className="rounded-2xl border border-[#e8ecf0] bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
			<div className="flex min-w-0 items-center justify-between gap-3">
				<div className="min-w-0 flex-1">
					<DownlineBeamioTagCapsule eoa={row.refereeEoa} />
				</div>
				<div className="shrink-0 text-right">
					<p className="text-[18px] font-extrabold leading-none tracking-tight text-[#1f2328] dark:text-slate-100">
						{pts}
					</p>
					<p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
						Referrer pts
					</p>
				</div>
			</div>
		</li>
	)
}

/** Discover secondary page: list of my downline referees + referrer points from each. */
export function DiscoverReferrerDownlinePage({
	cardAddress,
	userEoa,
	merchantTitle,
	onClose,
}: {
	cardAddress: string
	userEoa: string
	merchantTitle?: string
	onClose: () => void
}) {
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [loading, setLoading] = useState(true)
	const [snapshot, setSnapshot] = useState<CardProgramMyRefereesSnapshot | null>(null)

	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setIsEntered(true))
		return () => window.cancelAnimationFrame(frame)
	}, [])

	const close = useCallback(() => {
		if (isClosing) return
		setIsClosing(true)
		window.setTimeout(onClose, SLIDE_MS)
	}, [isClosing, onClose])

	useEffect(() => {
		let cancelled = false
		setLoading(true)
		void fetchCardProgramMyReferees(cardAddress, userEoa)
			.then((snap) => {
				if (cancelled || !snap) return
				setSnapshot(snap)
			})
			.catch(() => {
				/* untrusted — keep last trusted */
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [cardAddress, userEoa])

	const { ensureProfilesForAddresses } = useBeamioTagDatabase()
	useEffect(() => {
		if (!snapshot?.rows.length) return
		void ensureProfilesForAddresses(snapshot.rows.map((r) => r.refereeEoa))
	}, [snapshot, ensureProfilesForAddresses])

	const transform = isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)'
	const rows = snapshot?.rows ?? []
	const totalLabel =
		snapshot != null
			? `${snapshot.total.toLocaleString('en-US')} downline`
			: loading
				? 'Loading…'
				: '0 downline'

	const portal = (
		<div
			className="fixed inset-0 z-[120] flex flex-col bg-[#f4f6f8] transition-transform duration-300 ease-out dark:bg-slate-950"
			style={{ transform }}
			role="dialog"
			aria-modal="true"
			aria-label="My referees"
			onTouchMove={(e) => e.stopPropagation()}
		>
			<div
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
				style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
			>
				<div className={`flex items-center justify-between ${BEAMIO_CIRCULAR_BACK_ROW_CLASS}`}>
					<BeamioCircularBackButton onClick={close} className="absolute left-0 top-0" />
				</div>

				<header className="pb-6 pt-2">
					<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
						Referrer
					</p>
					<h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
						My referees
					</h1>
					{merchantTitle ? (
						<p className="mt-2 text-[14px] font-medium text-slate-500 dark:text-slate-400">
							{merchantTitle}
						</p>
					) : null}
					<p className="mt-1 text-[13px] font-medium text-slate-400 dark:text-slate-500">{totalLabel}</p>
				</header>

				{loading && !snapshot ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
						<Loader2 className="h-7 w-7 animate-spin" strokeWidth={2} aria-hidden />
						<span className="text-[14px] font-medium">Loading downline…</span>
					</div>
				) : rows.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center dark:border-slate-600 dark:bg-slate-900/60">
						<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8d3a8b]/12 text-[#8d3a8b]">
							<Users className="h-6 w-6" strokeWidth={2} aria-hidden />
						</span>
						<p className="text-[15px] font-semibold text-[#1f2328] dark:text-slate-100">No referees yet</p>
						<p className="max-w-xs text-[13px] font-medium text-slate-500 dark:text-slate-400">
							Users who register under your referral will appear here with referrer points from each.
						</p>
					</div>
				) : (
					<ul className="space-y-3">
						{rows.map((row) => (
							<DownlineRefereeRow key={row.refereeEoa} row={row} />
						))}
					</ul>
				)}
			</div>
		</div>
	)

	return createPortal(portal, document.body)
}
