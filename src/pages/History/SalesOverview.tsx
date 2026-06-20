import { IpfsImg } from '@/components/IpfsImg';
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Receipt, Loader2, RefreshCw } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { displayFiatPrefixFromCode } from '@/services/currency'
import {
	approximateUsdGrossFromBuckets,
	fetchSalesOverviewBucketsForAccount,
	localCalendarDayBoundsUnixSec,
	type SalesOverviewLedgerBuckets,
} from '@/pages/History/salesOverviewLedger'
import base_icon from '@/components/assets/base-logo.png'

/** Match Merchant OS composite chip references (`beamio-usdc-base-composite-icon`). */
const USDC_ICON_URL = 'https://assets.coingecko.com/coins/images/6319/small/usdc.png'
const dicebearAvatar = (avatarSeed: string | undefined) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed || '@Beamio')}`

/** Two decimal places for all currency lines (product default). */
function fmtMoney(n: number): string {
	return new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(Number.isFinite(n) ? n : 0)
}

function emptyBuckets(): SalesOverviewLedgerBuckets {
	return {
		usdcSubtotal: 0,
		cardSubtotalsByCurrency: {},
		cashSubtotalsByCurrency: {},
		chargeLikeRowCount: 0,
	}
}

/** Positive fiat totals keyed by ISO-ish currency codes → stacked summary rows */
function CurrencyTotalsStack({
	label,
	totalsByCurrency,
	className,
}: {
	label: string
	totalsByCurrency: Record<string, number>
	className?: string
}) {
	const entries = Object.entries(totalsByCurrency).filter(([, v]) => v > 0.0000005)
	if (entries.length === 0) {
		return (
			<div className={`flex justify-between gap-2 ${className ?? ''}`}>
				<span className="text-slate-600 dark:text-slate-400">{label}</span>
				<span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">—</span>
			</div>
		)
	}
	return (
		<div className={`space-y-1 ${className ?? ''}`}>
			{entries.map(([ccy, amt]) => (
				<div key={`${label}-${ccy}`} className="flex justify-between gap-2 text-sm">
					<span className="text-slate-600 dark:text-slate-400">{`${label} (${ccy})`}</span>
					<span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
						{displayFiatPrefixFromCode(ccy, 'CAD')}
						{fmtMoney(amt)}
					</span>
				</div>
			))}
		</div>
	)
}

function UsdcOnBaseAmountRow({ amount }: { amount: number }) {
	const shown = fmtMoney(amount)
	return (
		<div className="flex justify-between text-sm">
			<span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
				<span className="relative inline-flex h-5 w-5 shrink-0">
					<IpfsImg src={USDC_ICON_URL} alt="" className="h-5 w-5 rounded-full object-contain" />
					<IpfsImg
						src={base_icon}
						alt=""
						className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border border-white bg-white object-contain dark:border-slate-900"
					/>
				</span>
				USDC Subtotal (Base)
			</span>
			<span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">{`${shown} USDC`}</span>
		</div>
	)
}

/**
 * Sales Overview — indexer-backed totals for the logged-in POS wallet (`DaemonProvider.myAddress`),
 * local-calendar selected day (default today).
 */
export default function SalesOverview() {
	const navigate = useNavigate()
	const { beamio, myAddress, currencyData } = useDaemonContext()

	const periodLine = useMemo(() => {
		const day = new Date()
		const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0)
		const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999)
		const dFmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
		const tFmt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
		const d0 = start.toLocaleString('en-US', dFmt).replace(',', '')
		const d1 = end.toLocaleString('en-US', dFmt).replace(',', '')
		const t0 = start.toLocaleString('en-US', tFmt).toLowerCase()
		const t1 = end.toLocaleString('en-US', tFmt).toLowerCase()
		return `${d0} ${t0} — ${d1} ${t1}`
	}, [])

	const [buckets, setBuckets] = useState<SalesOverviewLedgerBuckets>(() => emptyBuckets())
	const [loading, setLoading] = useState(false)
	const [refreshNonce, setRefreshNonce] = useState(0)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			const addr = myAddress?.trim() ?? ''
			if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
				if (!cancelled) setBuckets(emptyBuckets())
				return
			}
			setLoading(true)
			try {
				const bounds = localCalendarDayBoundsUnixSec()
				const b = await fetchSalesOverviewBucketsForAccount(addr, {
					dayStartSec: bounds.startSec,
					dayEndSec: bounds.endSec,
				})
				if (!cancelled) setBuckets(b)
			} catch {
				/* keep last trusted snapshot */
			} finally {
				if (!cancelled) setLoading(false)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [myAddress, refreshNonce])

	const grossUsdApprox = useMemo(
		() => approximateUsdGrossFromBuckets(buckets, currencyData ?? {}),
		[buckets, currencyData]
	)

	const netSalesUsdApprox = grossUsdApprox
	const amountCollectedUsdApprox = grossUsdApprox
	const transactionCount = buckets.chargeLikeRowCount
	const averageTicket = transactionCount > 0 ? grossUsdApprox / transactionCount : 0

	const avatarSrc = beamio?.image?.trim() || dicebearAvatar(beamio?.accountName)

	return (
		<div className="flex min-h-screen min-h-[100dvh] flex-col bg-[#f5f6f8] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
			<header
				className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95"
			>
				<button
					type="button"
					onClick={() => navigate('/History')}
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eefc] text-[#1562f0] shadow-sm ring-1 ring-[#1562f0]/15 transition active:scale-[0.97] dark:bg-slate-800 dark:text-blue-400 dark:ring-white/10"
					aria-label="返回"
				>
					<ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
				</button>
				<h1 className="min-w-0 flex-1 text-center font-manrope text-lg font-extrabold tracking-tight text-[#0f2747] dark:text-slate-100">
					Sales Overview
				</h1>
				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						disabled={loading || !myAddress?.trim()}
						onClick={() => setRefreshNonce((n) => n + 1)}
						className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition enabled:active:scale-[0.97] disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300"
						aria-label="Refresh sales data"
					>
						{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <RefreshCw className="h-5 w-5" aria-hidden />}
					</button>
					<div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-white shadow-md dark:ring-slate-700">
						<IpfsImg src={avatarSrc} alt="" className="h-full w-full object-cover" />
					</div>
				</div>
			</header>

			<main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
				<section>
					<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
						Selected period
					</p>
					<p className="mt-1 font-mono text-[13px] leading-snug text-slate-700 dark:text-slate-300">{periodLine}</p>
					<p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
						Subtotals are summed from indexed Charges today for this wallet (Beamio indexer). NFC Beamio checkout → Card;
						wallet USDC checkout → USDC; other routed Charges → Cash bucket (estimate).
					</p>
					{!myAddress?.trim() ? (
						<p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">Sign in to load ledger totals.</p>
					) : null}
				</section>

				<section className="overflow-hidden rounded-[22px] bg-gradient-to-b from-[#eef3fb] to-[#e4eaf5] p-5 shadow-[0_8px_30px_rgba(15,39,71,0.08)] ring-1 ring-[#1562f0]/10 dark:from-slate-900 dark:to-slate-900/90 dark:ring-white/10">
					<div className="flex items-baseline justify-between gap-2">
						<span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Gross Sales (approx. USD)</span>
						<span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">${fmtMoney(grossUsdApprox)}</span>
					</div>
					<div className="my-4 h-px bg-slate-300/60 dark:bg-slate-700" />
					<div className="flex items-baseline justify-between gap-2">
						<span className="text-base font-bold text-slate-800 dark:text-slate-200">Net Sales (approx. USD)</span>
						<span className="text-xl font-extrabold tabular-nums text-[#1562f0] dark:text-blue-400">${fmtMoney(netSalesUsdApprox)}</span>
					</div>
					<div className="my-4 h-px bg-slate-300/60 dark:bg-slate-700" />
					<div className="space-y-3 text-sm">
						<CurrencyTotalsStack label="Card Subtotal" totalsByCurrency={buckets.cardSubtotalsByCurrency} />
						<CurrencyTotalsStack label="Cash Subtotal" totalsByCurrency={buckets.cashSubtotalsByCurrency} />
						<UsdcOnBaseAmountRow amount={buckets.usdcSubtotal} />
						<p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
							Refund/tax/tip splits from indexer tips rows not summarized here yet; Charge totals above exclude standalone TX_TIP
							and settlement-clear punctuation lines.
						</p>
					</div>
					<button
						type="button"
						className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1562f0] py-3.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-lg shadow-[#1562f0]/25 transition hover:opacity-95 active:scale-[0.99] dark:bg-blue-600"
					>
						<span>Amount collected (approx. USD): ${fmtMoney(amountCollectedUsdApprox)}</span>
						<Sparkles className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />
					</button>
				</section>

				<div className="grid grid-cols-2 gap-3">
					<div className="rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
						<p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Charges</p>
						<p className="mt-2 flex items-center gap-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
							{transactionCount}
							<Receipt className="h-5 w-5 text-[#1562f0] dark:text-blue-400" strokeWidth={2} />
						</p>
					</div>
					<div className="rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
						<p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Average ticket</p>
						<p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
							${fmtMoney(averageTicket)}
						</p>
					</div>
				</div>
			</main>
		</div>
	)
}
