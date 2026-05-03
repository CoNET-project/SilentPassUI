import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Sparkles, Receipt } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'

const dicebearAvatar = (avatarSeed: string | undefined) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed || '@Beamio')}`

/** Two decimal places for all currency lines (product default). */
function fmtMoney(n: number): string {
	return new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(n)
}

/**
 * Sales Overview — reachable from Wallet (/History). Layout matches product mockup.
 * Values are placeholder until a dedicated reporting API is wired; structure is ready to swap for live data.
 */
export default function SalesOverview() {
	const navigate = useNavigate()
	const { beamio } = useDaemonContext()

	const period = useMemo(() => {
		const day = new Date()
		const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0)
		const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999)
		const dFmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
		const tFmt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
		const d0 = start.toLocaleString('en-US', dFmt).replace(',', '')
		const d1 = end.toLocaleString('en-US', dFmt).replace(',', '')
		const t0 = start.toLocaleString('en-US', tFmt).toLowerCase()
		const t1 = end.toLocaleString('en-US', tFmt).toLowerCase()
		return { line: `${d0} ${t0} — ${d1} ${t1}` }
	}, [])

	// Demo figures aligned with design reference (replace with API-derived totals).
	const grossSales = 352.48
	const refunds = 20.99
	const refundCount = 1
	const netSales = grossSales - refunds
	const usdcSubtotal = 120.0
	const taxesAndFees = 0.0
	const tips = 47.24
	const amountCollected = 378.73
	const transactionCount = 24
	const averageTicket = transactionCount > 0 ? amountCollected / transactionCount : 0

	const avatarSrc = beamio?.image?.trim() || dicebearAvatar(beamio?.accountName)

	return (
		<div className="flex min-h-screen min-h-[100dvh] flex-col bg-[#f5f6f8] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
			{/* Header */}
			<header
				className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95"
			>
				<button
					type="button"
					onClick={() => navigate('/History')}
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eefc] text-[#1562f0] shadow-sm ring-1 ring-[#1562f0]/15 transition active:scale-[0.97] dark:bg-slate-800 dark:text-blue-400 dark:ring-white/10"
					aria-label="Back"
				>
					<ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
				</button>
				<h1 className="min-w-0 flex-1 text-center font-manrope text-lg font-extrabold tracking-tight text-[#0f2747] dark:text-slate-100">
					Sales Overview
				</h1>
				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition active:scale-[0.97] dark:bg-slate-800 dark:text-slate-300"
						aria-label="Select period"
					>
						<CalendarDays className="h-5 w-5" strokeWidth={2} />
					</button>
					<div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-white shadow-md dark:ring-slate-700">
						<img src={avatarSrc} alt="" className="h-full w-full object-cover" />
					</div>
				</div>
			</header>

			<main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
				<section>
					<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
						Selected period
					</p>
					<p className="mt-1 font-mono text-[13px] leading-snug text-slate-700 dark:text-slate-300">
						{period.line}
					</p>
				</section>

				{/* Main summary card */}
				<section className="overflow-hidden rounded-[22px] bg-gradient-to-b from-[#eef3fb] to-[#e4eaf5] p-5 shadow-[0_8px_30px_rgba(15,39,71,0.08)] ring-1 ring-[#1562f0]/10 dark:from-slate-900 dark:to-slate-900/90 dark:ring-white/10">
					<div className="flex items-baseline justify-between gap-2">
						<span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Gross Sales</span>
						<span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
							${fmtMoney(grossSales)}
						</span>
					</div>
					<div className="mt-3 flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Refunds</span>
							<span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-400/25 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
								{refundCount}
							</span>
						</div>
						<span className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
							(${fmtMoney(refunds)})
						</span>
					</div>
					<div className="my-4 h-px bg-slate-300/60 dark:bg-slate-700" />
					<div className="flex items-baseline justify-between gap-2">
						<span className="text-base font-bold text-slate-800 dark:text-slate-200">Net Sales</span>
						<span className="text-xl font-extrabold tabular-nums text-[#1562f0] dark:text-blue-400">
							${fmtMoney(netSales)}
						</span>
					</div>
					<div className="my-4 h-px bg-slate-300/60 dark:bg-slate-700" />
					<div className="space-y-2 text-sm">
						<div className="flex justify-between text-slate-600 dark:text-slate-400">
							<span>USDC Subtotal</span>
							<span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
								${fmtMoney(usdcSubtotal)}
							</span>
						</div>
						<div className="flex justify-between text-slate-600 dark:text-slate-400">
							<span>Taxes &amp; Fees</span>
							<span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
								${fmtMoney(taxesAndFees)}
							</span>
						</div>
						<div className="flex justify-between text-slate-600 dark:text-slate-400">
							<span>Tips</span>
							<span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
								${fmtMoney(tips)}
							</span>
						</div>
					</div>
					<button
						type="button"
						className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1562f0] py-3.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-lg shadow-[#1562f0]/25 transition hover:opacity-95 active:scale-[0.99] dark:bg-blue-600"
					>
						<span>Amount collected: ${fmtMoney(amountCollected)}</span>
						<Sparkles className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />
					</button>
				</section>

				{/* Bottom metrics */}
				<div className="grid grid-cols-2 gap-3">
					<div className="rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
						<p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
							Transactions
						</p>
						<p className="mt-2 flex items-center gap-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
							{transactionCount}
							<Receipt className="h-5 w-5 text-[#1562f0] dark:text-blue-400" strokeWidth={2} />
						</p>
					</div>
					<div className="rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
						<p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
							Average ticket
						</p>
						<p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
							${fmtMoney(averageTicket)}
						</p>
					</div>
				</div>
			</main>
		</div>
	)
}
