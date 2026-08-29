/**
 * Program Basic — merchant-favorable oracle FX spread (0–10%).
 * Chrome: beamio-drawer-form-chrome (Cancel left / Check right).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, Loader2 } from 'lucide-react'
import {
	clampMerchantOracleSpreadBps,
	MERCHANT_ORACLE_SPREAD_BPS_MAX,
} from '@/utils/unifiedRewardPoints'
import {
	createNumericInputWheelNonPassiveRefCallback,
	preventNumericInputStepKeys,
	preventNumericInputWheelStep,
} from '@/utils/numericInputStepKeys'

const BEAMIO_PERCENT_SLIDER_TRACK_FILL = '#2c2f31'
const BEAMIO_PERCENT_SLIDER_TRACK_REST = '#e5e7eb'

const SHEET_MS = 300

/** Display 0–10 integer % (1000 bps = 10%). */
export function merchantOracleSpreadBpsToPercentWhole(bps: number): number {
	return Math.max(0, Math.min(10, Math.round(clampMerchantOracleSpreadBps(bps) / 100)))
}

export function percentWholeToMerchantOracleSpreadBps(percent: number): number {
	const whole = Math.max(0, Math.min(10, Math.round(percent)))
	return Math.min(MERCHANT_ORACLE_SPREAD_BPS_MAX, whole * 100)
}

export type MerchantOracleSpreadProgramEditorProps = {
	open: boolean
	/** Draft spread in bps (0–1000). */
	draftBps: number
	baselineBps: number | null
	publishing: boolean
	serverError: string
	focusRingClassName?: string
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
	onDraftBpsChange,
	onClose,
	onSave,
}: MerchantOracleSpreadProgramEditorProps) {
	const [entered, setEntered] = useState(false)
	const [closing, setClosing] = useState(false)
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const percentInputWheelRef = useMemo(() => createNumericInputWheelNonPassiveRefCallback(), [])

	useEffect(() => {
		if (!open) {
			setEntered(false)
			setClosing(false)
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
	const spreadPercent = merchantOracleSpreadBpsToPercentWhole(clampedDraft)

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
						Adjust oracle quotes in your favor by 0–10%. Deposit (buy) quotes move higher; withdraw
						(sell) quotes move lower by the same percent.
					</p>

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
									inputMode="numeric"
									autoComplete="off"
									enterKeyHint="done"
									min={0}
									max={10}
									step={1}
									disabled={publishing}
									value={spreadPercent}
									onChange={(e) =>
										onDraftBpsChange(percentWholeToMerchantOracleSpreadBps(Number(e.target.value)))
									}
									onKeyDown={preventNumericInputStepKeys}
									onWheel={preventNumericInputWheelStep}
									ref={percentInputWheelRef}
									className={`w-10 bg-transparent text-right [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${focusRingClassName}`}
								/>
								<span aria-hidden>%</span>
							</div>
						</div>
						<input
							type="range"
							min={0}
							max={10}
							step={1}
							disabled={publishing}
							value={spreadPercent}
							onChange={(e) =>
								onDraftBpsChange(percentWholeToMerchantOracleSpreadBps(Number(e.target.value)))
							}
							aria-label="Merchant FX adjustment percent"
							className="h-2 w-full cursor-pointer appearance-none rounded-full disabled:opacity-50"
							style={{
								background: `linear-gradient(to right, ${BEAMIO_PERCENT_SLIDER_TRACK_FILL} 0%, ${BEAMIO_PERCENT_SLIDER_TRACK_FILL} ${
									spreadPercent * 10
								}%, ${BEAMIO_PERCENT_SLIDER_TRACK_REST} ${spreadPercent * 10}%, ${BEAMIO_PERCENT_SLIDER_TRACK_REST} 100%)`,
							}}
						/>
						<div className="mt-1 flex justify-between text-[10px] text-[#595c5e]">
							<span>0%</span>
							<span>5%</span>
							<span>10%</span>
						</div>
						<p className="mt-2 text-[11px] leading-relaxed text-[#595c5e]">
							{spreadPercent === 0
								? 'Using the oracle rate with no merchant adjustment.'
								: `Deposit quotes +${spreadPercent}% · Withdraw quotes −${spreadPercent}% vs oracle (${clampedDraft} bps).`}
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}
