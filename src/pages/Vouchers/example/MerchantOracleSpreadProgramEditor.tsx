/**
 * Program Basic — merchant-favorable oracle FX spread (0.00–5.00%, step 0.25%).
 * Chrome: beamio-drawer-form-chrome (Cancel left / Check right).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, Loader2 } from 'lucide-react'
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

/** @deprecated Prefer merchantOracleSpreadBpsToPercent from unifiedRewardPoints. */
export function merchantOracleSpreadBpsToPercentWhole(bps: number): number {
	return merchantOracleSpreadBpsToPercent(bps)
}

/** @deprecated Prefer percentToMerchantOracleSpreadBps from unifiedRewardPoints. */
export function percentWholeToMerchantOracleSpreadBps(percent: number): number {
	return percentToMerchantOracleSpreadBps(percent)
}

function formatOraclePairRate(n: number): string {
	if (!Number.isFinite(n) || n <= 0) return ''
	const abs = Math.abs(n)
	const maxFrac = abs >= 100 ? 2 : abs >= 1 ? 4 : 6
	return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: maxFrac })
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
	const isUsdPeg = cardCcy === 'USD' || cardCcy === 'USDC'
	const inversePerUsdc = hasOracleRate ? 1 / (oracleUsdcPerUnit as number) : null
	const depositUsdcPerUnit =
		hasOracleRate && spreadPercent > 0
			? (oracleUsdcPerUnit as number) * (1 + spreadPercent / 100)
			: null
	const withdrawUsdcPerUnit =
		hasOracleRate && spreadPercent > 0
			? (oracleUsdcPerUnit as number) * (1 - spreadPercent / 100)
			: null

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
						Exchange rate
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

				<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
					<p className="text-xs leading-relaxed text-[#595c5e]">
						Adjust oracle quotes in your favor by 0.00–5.00% in 0.25% steps. Deposit (buy) quotes move
						higher; withdraw (sell) quotes move lower by the same percent.
					</p>

					<div className="rounded-xl border border-slate-200/80 bg-white p-4">
						<p className="text-sm font-semibold text-[#2c2f31]">Oracle rate</p>
						<dl className="mt-3 space-y-2 text-sm">
							<div className="flex items-baseline justify-between gap-3">
								<dt className="text-[#595c5e]">Card currency</dt>
								<dd className="font-semibold tabular-nums text-[#2c2f31]">{cardCcy}</dd>
							</div>
							{hasOracleRate ? (
								<>
									<div className="flex items-baseline justify-between gap-3">
										<dt className="text-[#595c5e]">{`1 ${cardCcy}`}</dt>
										<dd className="font-semibold tabular-nums text-[#2c2f31]">
											{`${formatOraclePairRate(oracleUsdcPerUnit as number)} USDC`}
										</dd>
									</div>
									{!isUsdPeg && inversePerUsdc != null ? (
										<div className="flex items-baseline justify-between gap-3">
											<dt className="text-[#595c5e]">1 USDC</dt>
											<dd className="font-semibold tabular-nums text-[#2c2f31]">
												{`${formatOraclePairRate(inversePerUsdc)} ${cardCcy}`}
											</dd>
										</div>
									) : null}
								</>
							) : (
								<p className="text-sm text-[#595c5e]" role="status">
									Oracle rate unavailable
								</p>
							)}
						</dl>
						{depositUsdcPerUnit != null && withdrawUsdcPerUnit != null ? (
							<div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm">
								<p className="text-[11px] font-medium uppercase tracking-wide text-[#595c5e]">
									{`After adjustment (+${spreadPercentLabel}%)`}
								</p>
								<div className="flex items-baseline justify-between gap-3">
									<span className="text-[#595c5e]">{`Deposit · 1 ${cardCcy}`}</span>
									<span className="tabular-nums text-[#2c2f31]">
										{`${formatOraclePairRate(depositUsdcPerUnit)} USDC`}
									</span>
								</div>
								<div className="flex items-baseline justify-between gap-3">
									<span className="text-[#595c5e]">{`Withdraw · 1 ${cardCcy}`}</span>
									<span className="tabular-nums text-[#2c2f31]">
										{`${formatOraclePairRate(withdrawUsdcPerUnit)} USDC`}
									</span>
								</div>
							</div>
						) : null}
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
						<div className="mb-2 flex items-center justify-between gap-2">
							<label
								htmlFor="merchant-oracle-spread-percent"
								className="text-sm font-semibold text-[#2c2f31]"
							>
								Merchant FX adjustment
							</label>
							<div className="inline-flex items-center gap-1 rounded-full border border-[#dce2f7] bg-[#e9edff] px-2.5 py-1 text-sm font-semibold text-[#0051d1]">
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
									className={`w-14 bg-transparent text-right [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${focusRingClassName}`}
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
							aria-label="Merchant FX adjustment percent"
							className="h-2 w-full cursor-pointer appearance-none rounded-full disabled:opacity-50"
							style={{
								background: `linear-gradient(to right, ${BEAMIO_PERCENT_SLIDER_TRACK_FILL} 0%, ${BEAMIO_PERCENT_SLIDER_TRACK_FILL} ${trackFillPct}%, ${BEAMIO_PERCENT_SLIDER_TRACK_REST} ${trackFillPct}%, ${BEAMIO_PERCENT_SLIDER_TRACK_REST} 100%)`,
							}}
						/>
						<div className="mt-1 flex justify-between text-[10px] text-[#595c5e]">
							<span>0%</span>
							<span>2.50%</span>
							<span>5%</span>
						</div>
						<p className="mt-2 text-[11px] leading-relaxed text-[#595c5e]">
							{spreadPercent === 0
								? 'Using the oracle rate with no merchant adjustment.'
								: `Deposit quotes +${spreadPercentLabel}% · Withdraw quotes −${spreadPercentLabel}% vs oracle (${clampedDraft} bps).`}
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}
