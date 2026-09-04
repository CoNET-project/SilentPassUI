/**
 * Program Basic — Settlement Margin (0.00–5.00%, step 0.25%).
 * Chrome: beamio-drawer-form-chrome (Cancel left / Check right).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, Info, Loader2, Shield } from 'lucide-react'
import {
	clampMerchantOracleSpreadBps,
	merchantOracleSpreadBpsToPercent,
	percentToMerchantOracleSpreadBps,
} from '@/utils/unifiedRewardPoints'
import {
	createNumericInputWheelNonPassiveRefCallback,
	preventNumericInputStepKeys,
	preventNumericInputWheelStep,
} from '@/utils/numericInputStepKeys'

const BEAMIO_PERCENT_SLIDER_TRACK_FILL = '#2c2f31'
const BEAMIO_PERCENT_SLIDER_TRACK_REST = '#e5e7eb'

const SHEET_MS = 300
const PERCENT_MAX = 5
const PERCENT_STEP = 0.25
const SAMPLE_TOPUP_UNITS = 100
const SLIDER_TICKS = [0, 1.25, 2.5, 3.75, 5] as const

/** @deprecated Prefer merchantOracleSpreadBpsToPercent from unifiedRewardPoints. */
export function merchantOracleSpreadBpsToPercentWhole(bps: number): number {
	return merchantOracleSpreadBpsToPercent(bps)
}

/** @deprecated Prefer percentToMerchantOracleSpreadBps from unifiedRewardPoints. */
export function percentWholeToMerchantOracleSpreadBps(percent: number): number {
	return percentToMerchantOracleSpreadBps(percent)
}

function formatOracleBenchmarkUsdc(n: number): string {
	if (!Number.isFinite(n) || n <= 0) return ''
	return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })
}

function formatSimMoney(n: number): string {
	if (!Number.isFinite(n)) return ''
	return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTickLabel(n: number): string {
	if (n === 0) return '0%'
	if (n === 5) return '5%'
	return `${n.toFixed(2)}%`
}

export type MerchantOracleSpreadProgramEditorProps = {
	open: boolean
	/** Draft spread in bps (0–500, 25-step). */
	draftBps: number
	baselineBps: number | null
	publishing: boolean
	serverError: string
	focusRingClassName?: string
	/** Current merchant card ISO currency (e.g. CAD). */
	cardCurrency: string
	/**
	 * CoNET oracle: 1 card-currency unit = this many USDC.
	 * `null` = no trusted rate yet (do not treat as 0).
	 */
	oracleUsdcPerUnit: number | null
	onDraftBpsChange: (nextBps: number) => void
	onClose: () => void
	onSave: () => void
}

export function MerchantOracleSpreadProgramEditor({
	open,
	draftBps,
	baselineBps,
	publishing,
	serverError,
	focusRingClassName = '',
	cardCurrency,
	oracleUsdcPerUnit,
	onDraftBpsChange,
	onClose,
	onSave,
}: MerchantOracleSpreadProgramEditorProps) {
	const [entered, setEntered] = useState(false)
	const [closing, setClosing] = useState(false)
	const [percentDraft, setPercentDraft] = useState<string | null>(null)
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const percentInputWheelRef = useMemo(() => createNumericInputWheelNonPassiveRefCallback(), [])

	useEffect(() => {
		if (!open) {
			setEntered(false)
			setClosing(false)
			setPercentDraft(null)
			return
		}
		const frame = requestAnimationFrame(() => setEntered(true))
		return () => cancelAnimationFrame(frame)
	}, [open])

	useEffect(() => {
		return () => {
			if (closeTimerRef.current != null) clearTimeout(closeTimerRef.current)
		}
	}, [])

	const requestClose = useCallback(() => {
		if (publishing || closing) return
		setClosing(true)
		closeTimerRef.current = setTimeout(() => {
			onClose()
		}, SHEET_MS)
	}, [publishing, closing, onClose])

	const clampedDraft = clampMerchantOracleSpreadBps(draftBps)
	const dirty = useMemo(() => {
		if (baselineBps == null) return true
		return clampMerchantOracleSpreadBps(baselineBps) !== clampedDraft
	}, [baselineBps, clampedDraft])

	const canSave = dirty && !publishing
	const spreadPercent = merchantOracleSpreadBpsToPercent(clampedDraft)
	const spreadPercentLabel = spreadPercent.toFixed(2)
	const trackFillPct = (spreadPercent / PERCENT_MAX) * 100
	const cardCcy = (cardCurrency || 'CAD').trim().toUpperCase() || 'CAD'
	const hasOracleRate =
		oracleUsdcPerUnit != null && Number.isFinite(oracleUsdcPerUnit) && oracleUsdcPerUnit > 0

	const simulation = useMemo(() => {
		if (!hasOracleRate) return null
		const rawOracleUsdc = SAMPLE_TOPUP_UNITS * (oracleUsdcPerUnit as number)
		const appliedMarginUsdc = rawOracleUsdc * (spreadPercent / 100)
		return {
			rawOracleUsdc,
			appliedMarginUsdc,
			settlesUsdc: rawOracleUsdc + appliedMarginUsdc,
		}
	}, [hasOracleRate, oracleUsdcPerUnit, spreadPercent])

	const commitPercentDraft = useCallback(
		(raw: string) => {
			const next = percentToMerchantOracleSpreadBps(raw.trim() === '' ? 0 : Number(raw))
			onDraftBpsChange(next)
			setPercentDraft(null)
		},
		[onDraftBpsChange],
	)

	if (!open && !closing) return null

	return (
		<div className="fixed inset-0 z-[80] flex justify-end" role="presentation">
			<button
				type="button"
				className="absolute inset-0 bg-black/40"
				aria-label="Cancel"
				tabIndex={-1}
				disabled={publishing}
				onClick={requestClose}
			/>
			<div
				className="relative flex h-full w-full max-w-md flex-col bg-[#f4f6f8] shadow-2xl transition-transform duration-300 ease-out"
				style={{
					transform: closing || !entered ? 'translateX(100%)' : 'translateX(0)',
				}}
				role="dialog"
				aria-modal="true"
				aria-labelledby="merchant-oracle-spread-editor-title"
			>
				<div className="relative flex shrink-0 items-center justify-between px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
					<button
						type="button"
						tabIndex={-1}
						aria-label="Cancel"
						disabled={publishing}
						onClick={requestClose}
						className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white/90 text-[#2c2f31] shadow-sm disabled:opacity-50 ${focusRingClassName}`}
					>
						<ChevronLeft className="h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
					</button>
					<h2
						id="merchant-oracle-spread-editor-title"
						className="pointer-events-none absolute inset-x-12 truncate text-center text-base font-semibold text-[#2c2f31]"
					>
						Settlement Margin
					</h2>
					<button
						type="button"
						tabIndex={-1}
						aria-label="Save"
						aria-busy={publishing}
						disabled={!canSave}
						onClick={() => onSave()}
						className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0051d1] text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${focusRingClassName}`}
					>
						{publishing ? (
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
						) : (
							<Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
						)}
					</button>
				</div>

				<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
					<div className="flex gap-2.5 rounded-xl border border-[#1562f0]/15 bg-[#e9edff] px-3 py-2.5">
						<Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0051d1]" aria-hidden />
						<p className="min-w-0 text-xs leading-relaxed text-[#2c2f31]">
							Add a buffer (0–5%) to the real-time market rate. This helps cover your operational
							costs when receiving USDC.
						</p>
					</div>

					{serverError ? (
						<div
							role="alert"
							className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
						>
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
							<p className="min-w-0">{serverError}</p>
						</div>
					) : null}

					<div className="rounded-xl border border-slate-200/80 bg-white p-4">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="text-[11px] font-medium uppercase tracking-wide text-[#595c5e]">
									Oracle Benchmark Rate
								</p>
								{hasOracleRate ? (
									<p className="mt-1 text-sm font-semibold tabular-nums text-[#2c2f31]">
										{`1 ${cardCcy} = ${formatOracleBenchmarkUsdc(oracleUsdcPerUnit as number)} USDC`}
									</p>
								) : (
									<p className="mt-1 text-sm text-[#595c5e]" role="status">
										Oracle rate unavailable
									</p>
								)}
							</div>
							{hasOracleRate ? (
								<span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
									Live
								</span>
							) : (
								<span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
									Unavailable
								</span>
							)}
						</div>
					</div>

					<div className="rounded-xl border border-slate-200/80 bg-white p-4">
						<div className="mb-2 flex items-center justify-between gap-2">
							<label
								htmlFor="merchant-oracle-spread-percent"
								className="text-sm font-semibold text-[#2c2f31]"
							>
								Store Margin
							</label>
							<div className="inline-flex items-center gap-0.5 rounded-full border border-[#dce2f7] bg-[#e9edff] px-2.5 py-1 text-sm font-semibold text-[#0051d1]">
								<span aria-hidden>+</span>
								<input
									id="merchant-oracle-spread-percent"
									type="number"
									inputMode="decimal"
									autoComplete="off"
									enterKeyHint="done"
									min={0}
									max={PERCENT_MAX}
									step={PERCENT_STEP}
									disabled={publishing}
									value={percentDraft ?? spreadPercentLabel}
									onFocus={() => setPercentDraft(spreadPercentLabel)}
									onChange={(e) => setPercentDraft(e.target.value)}
									onBlur={() => {
										if (percentDraft === null) return
										commitPercentDraft(percentDraft)
									}}
									onKeyDown={(e) => {
										preventNumericInputStepKeys(e)
										if (e.key === 'Enter') {
											e.preventDefault()
											;(e.target as HTMLInputElement).blur()
										}
									}}
									onWheel={preventNumericInputWheelStep}
									ref={percentInputWheelRef}
									className={`w-12 bg-transparent text-right [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${focusRingClassName}`}
								/>
								<span aria-hidden>%</span>
							</div>
						</div>
						<input
							type="range"
							min={0}
							max={PERCENT_MAX}
							step={PERCENT_STEP}
							disabled={publishing}
							value={spreadPercent}
							onChange={(e) =>
								onDraftBpsChange(percentToMerchantOracleSpreadBps(Number(e.target.value)))
							}
							aria-label="Store margin percent"
							className="h-2 w-full cursor-pointer appearance-none rounded-full disabled:opacity-50"
							style={{
								background: `linear-gradient(to right, ${BEAMIO_PERCENT_SLIDER_TRACK_FILL} 0%, ${BEAMIO_PERCENT_SLIDER_TRACK_FILL} ${trackFillPct}%, ${BEAMIO_PERCENT_SLIDER_TRACK_REST} ${trackFillPct}%, ${BEAMIO_PERCENT_SLIDER_TRACK_REST} 100%)`,
							}}
						/>
						<div className="mt-1 flex justify-between gap-1">
							{SLIDER_TICKS.map((tick) => (
								<button
									key={tick}
									type="button"
									tabIndex={-1}
									disabled={publishing}
									onClick={() => onDraftBpsChange(percentToMerchantOracleSpreadBps(tick))}
									className={`text-[10px] tabular-nums disabled:opacity-50 ${
										spreadPercent === tick ? 'font-semibold text-[#2c2f31]' : 'text-[#595c5e]'
									}`}
								>
									{formatTickLabel(tick)}
								</button>
							))}
						</div>
						<p className="mt-2 text-[11px] leading-relaxed text-[#595c5e]">
							Adjust in 0.25% increments · Non-Custodial
						</p>
					</div>

					<div className="rounded-xl bg-[#0f172a] p-4 text-white">
						<p className="text-[11px] font-medium uppercase tracking-wide text-white/55">
							Live Settlement Simulation
						</p>
						<p className="mt-1 text-sm font-semibold text-white">
							{`Sample ${SAMPLE_TOPUP_UNITS} ${cardCcy}`}
						</p>
						{simulation ? (
							<dl className="mt-3 space-y-2 text-sm">
								<div className="flex items-baseline justify-between gap-3">
									<dt className="text-white/60">Customer Top-Up</dt>
									<dd className="font-medium tabular-nums">
										{`${formatSimMoney(SAMPLE_TOPUP_UNITS)} ${cardCcy}`}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3">
									<dt className="text-white/60">Raw Oracle</dt>
									<dd className="tabular-nums text-white/90">
										{`${formatSimMoney(simulation.rawOracleUsdc)} USDC`}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3">
									<dt className="text-white/60">Applied Margin</dt>
									<dd className="tabular-nums text-emerald-300">
										{`+${formatSimMoney(simulation.appliedMarginUsdc)} USDC`}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-2">
									<dt className="font-semibold text-white">Settles Instantly</dt>
									<dd className="font-semibold tabular-nums">
										{`${formatSimMoney(simulation.settlesUsdc)} USDC`}
									</dd>
								</div>
							</dl>
						) : (
							<p className="mt-3 text-sm text-white/60" role="status">
								Simulation unavailable until a live oracle rate is ready.
							</p>
						)}
					</div>

					<div className="flex gap-2 px-0.5 pb-1">
						<Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#595c5e]" aria-hidden />
						<p className="min-w-0 text-[11px] leading-relaxed text-[#595c5e]">
							Non-custodial settlement: USDC is delivered on-chain using the live oracle plus your
							store margin. Beamio does not custody customer funds.
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}
