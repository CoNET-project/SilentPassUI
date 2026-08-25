import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clipboard, Loader2, ShoppingBag, UserPlus, Users } from 'lucide-react'
import {
	BeamioCircularBackButton,
	BEAMIO_CIRCULAR_BACK_ROW_CLASS,
} from '@/components/BeamioCircularBackButton'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { formatBeamioTagDisplayLine } from '@/utils/aaMultisigTaskUi'
import {
	fetchCardProgramMyRefereesPage,
	fetchCardProgramReferrerDashboard,
	formatNetworkPtsWhole,
	MY_NETWORK_PAGE_SIZE,
	pickNetworkEarningsRaw,
	type CardProgramMyRefereeRow,
	type CardProgramReferrerDashboardSnapshot,
} from '@/utils/cardProgramReferrerDashboard'

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

function DownlineActivityRow({ row }: { row: CardProgramMyRefereeRow }) {
	const { resolveTag, ensureProfilesForAddresses } = useBeamioTagDatabase()
	useEffect(() => {
		void ensureProfilesForAddresses([row.refereeEoa])
	}, [row.refereeEoa, ensureProfilesForAddresses])
	const tagRaw = resolveTag(row.refereeEoa)
	const tagLine = tagRaw ? formatBeamioTagDisplayLine(tagRaw) : ''
	const pts = formatNetworkPtsWhole(row.refereeChargePointsTotal6)

	return (
		<li className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0 dark:border-slate-800">
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
				<UserPlus className="h-5 w-5" strokeWidth={2} aria-hidden />
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-[15px] font-bold text-[#1f2328] dark:text-slate-100">Friend joined</p>
				{tagLine ? (
					<p className="mt-0.5 truncate text-[13px] font-medium text-slate-500 dark:text-slate-400">
						{tagLine}
					</p>
				) : (
					<div className="mt-1">
						<RefereeAddressCapsule address={row.refereeEoa} />
					</div>
				)}
			</div>
			<div className="shrink-0 text-right">
				<p className="text-[15px] font-extrabold text-emerald-600 dark:text-emerald-400">+{pts} Pts</p>
			</div>
		</li>
	)
}

/** Discover secondary page: paginated downline referees. */
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
	const { setShowFooter } = useDaemonContext()
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [rows, setRows] = useState<CardProgramMyRefereeRow[]>([])
	const [total, setTotal] = useState(0)
	const [nextOffset, setNextOffset] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const [lookupKey, setLookupKey] = useState<string | null>(null)
	const [dashboard, setDashboard] = useState<CardProgramReferrerDashboardSnapshot | null>(null)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

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
		void Promise.all([
			fetchCardProgramMyRefereesPage(cardAddress, userEoa, 0, MY_NETWORK_PAGE_SIZE),
			fetchCardProgramReferrerDashboard(cardAddress, userEoa),
		])
			.then(([page, dash]) => {
				if (cancelled) return
				if (page) {
					setRows(page.rows)
					setTotal(page.total)
					setNextOffset(page.nextOffset)
					setHasMore(page.hasMore)
					setLookupKey(page.lookupKey)
				}
				if (dash) setDashboard(dash)
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
		if (!rows.length) return
		void ensureProfilesForAddresses(rows.map((r) => r.refereeEoa))
	}, [rows, ensureProfilesForAddresses])

	const loadMore = useCallback(async () => {
		if (loadingMore || !hasMore) return
		setLoadingMore(true)
		try {
			const page = await fetchCardProgramMyRefereesPage(
				cardAddress,
				userEoa,
				nextOffset,
				MY_NETWORK_PAGE_SIZE,
				lookupKey,
			)
			if (!page) return
			setRows((prev) => {
				const seen = new Set(prev.map((r) => r.refereeEoa.toLowerCase()))
				const extra = page.rows.filter((r) => !seen.has(r.refereeEoa.toLowerCase()))
				return [...prev, ...extra]
			})
			setTotal(page.total)
			setNextOffset(page.nextOffset)
			setHasMore(page.hasMore)
			setLookupKey(page.lookupKey)
		} finally {
			setLoadingMore(false)
		}
	}, [loadingMore, hasMore, cardAddress, userEoa, nextOffset, lookupKey])

	const transform = isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)'
	const earningsRaw = pickNetworkEarningsRaw(dashboard?.rewardVoucher13Raw, dashboard?.rewardBalanceRaw)
	const earningsPts = formatNetworkPtsWhole(earningsRaw)
	const invited =
		dashboard?.myRefereeCount != null
			? dashboard.myRefereeCount
			: total

	const portal = (
		<div
			className="fixed inset-0 z-[120] flex flex-col bg-[#f4f6f8] transition-transform duration-300 ease-out dark:bg-slate-950"
			style={{ transform }}
			role="dialog"
			aria-modal="true"
			aria-label="My Network"
			onTouchMove={(e) => e.stopPropagation()}
		>
			<div
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
				style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
			>
				<div className={`flex items-center justify-between ${BEAMIO_CIRCULAR_BACK_ROW_CLASS}`}>
					<BeamioCircularBackButton
						variant="onLight"
						onClick={close}
						className="absolute left-0 top-0"
					/>
				</div>

				<header className="pb-5 pt-2">
					<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
						Referrer
					</p>
					<h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
						My Network
					</h1>
					{merchantTitle ? (
						<p className="mt-2 text-[14px] font-medium text-slate-500 dark:text-slate-400">
							{merchantTitle}
						</p>
					) : null}
				</header>

				<div className="rounded-[22px] bg-[#1562f0] px-5 py-6 text-white shadow-[0_10px_28px_rgba(21,98,240,0.28)]">
					<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
						Total network earnings
					</p>
					<p className="mt-2 text-[34px] font-extrabold leading-none tracking-tight">{earningsPts} Pts</p>
					<div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold">
						<Users className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						Total Friends Invited: {invited.toLocaleString('en-US')}
					</div>
				</div>

				<h2 className="mt-7 text-[17px] font-bold text-[#1f2328] dark:text-slate-100">Network Activity</h2>

				{loading && rows.length === 0 ? (
					<div className="mt-3 flex flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
						<Loader2 className="h-7 w-7 animate-spin" strokeWidth={2} aria-hidden />
						<span className="text-[14px] font-medium">Loading network…</span>
					</div>
				) : rows.length === 0 ? (
					<div className="mt-3 flex flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center dark:border-slate-600 dark:bg-slate-900/60">
						<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
							<ShoppingBag className="h-6 w-6" strokeWidth={2} aria-hidden />
						</span>
						<p className="text-[15px] font-semibold text-[#1f2328] dark:text-slate-100">No activity yet</p>
						<p className="max-w-xs text-[13px] font-medium text-slate-500 dark:text-slate-400">
							Friends who join with your store link will appear here.
						</p>
					</div>
				) : (
					<>
						<ul className="mt-3 overflow-hidden rounded-[22px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
							{rows.map((row) => (
								<DownlineActivityRow key={row.refereeEoa} row={row} />
							))}
						</ul>
						{hasMore ? (
							<button
								type="button"
								onClick={() => void loadMore()}
								disabled={loadingMore}
								aria-busy={loadingMore}
								className="mt-4 w-full rounded-full bg-slate-200 px-4 py-3 text-[14px] font-bold text-[#1562f0] transition active:scale-[0.98] disabled:opacity-60 dark:bg-slate-800 dark:text-blue-300"
							>
								{loadingMore ? (
									<span className="inline-flex items-center justify-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										Loading…
									</span>
								) : (
									'Load More Activity'
								)}
							</button>
						) : null}
					</>
				)}
			</div>
		</div>
	)

	return createPortal(portal, document.body)
}
