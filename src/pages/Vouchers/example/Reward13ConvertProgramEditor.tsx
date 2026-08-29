/**
 * Programs — Reward PT conversion (#13 → #0 / #13 → Conet-USDC to AA).
 * Oracle FX spread lives in Program Basic (MerchantOracleSpreadProgramEditor).
 * Chrome: beamio-drawer-form-chrome (Cancel left / Check right).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, Loader2 } from 'lucide-react'

const SHEET_MS = 300

export type Reward13ConvertDraft = {
	toPointsEnabled: boolean
	toUsdcEnabled: boolean
	/** Kept for publish compatibility; edited only in Program Basic FX panel. */
	oracleSpreadBps: number
}

export type Reward13ConvertProgramEditorProps = {
	open: boolean
	draft: Reward13ConvertDraft
	baseline: Reward13ConvertDraft | null
	publishing: boolean
	serverError: string
	focusRingClassName?: string
	onDraftChange: (next: Reward13ConvertDraft) => void
	onClose: () => void
	onSave: () => void
}

export function Reward13ConvertProgramEditor({
	open,
	draft,
	baseline,
	publishing,
	serverError,
	focusRingClassName = '',
	onDraftChange,
	onClose,
	onSave,
}: Reward13ConvertProgramEditorProps) {
	const [entered, setEntered] = useState(false)
	const [closing, setClosing] = useState(false)
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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

	const dirty = useMemo(() => {
		if (!baseline) return true
		return (
			baseline.toPointsEnabled !== draft.toPointsEnabled ||
			baseline.toUsdcEnabled !== draft.toUsdcEnabled
		)
	}, [baseline, draft])

	const canSave = dirty && !publishing

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
				aria-labelledby="reward13-convert-editor-title"
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
						id="reward13-convert-editor-title"
						className="pointer-events-none absolute inset-x-12 truncate text-center text-base font-semibold text-[#2c2f31]"
					>
						Reward PT conversion
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
						Let members burn Reward PT (#13) for program points (#0) or Conet-USDC paid to their
						Smart Wallet. Oracle FX adjustment is configured under Program Basic → Exchange rate.
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
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0">
								<p className="text-sm font-semibold text-[#2c2f31]">#13 → Program points</p>
								<p className="mt-0.5 text-[11px] text-[#595c5e]">
									Atomic burn Reward PT and mint program points (#0) on the member Smart Wallet.
								</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={draft.toPointsEnabled}
								disabled={publishing}
								onClick={() =>
									onDraftChange({ ...draft, toPointsEnabled: !draft.toPointsEnabled })
								}
								className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
									draft.toPointsEnabled ? 'bg-[#0051d1]' : 'bg-slate-300'
								} disabled:opacity-50`}
							>
								<span
									className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
										draft.toPointsEnabled ? 'translate-x-5' : 'translate-x-0.5'
									}`}
								/>
							</button>
						</div>
					</div>

					<div className="rounded-xl border border-slate-200/80 bg-white p-4">
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0">
								<p className="text-sm font-semibold text-[#2c2f31]">#13 → Conet-USDC</p>
								<p className="mt-0.5 text-[11px] text-[#595c5e]">
									Atomic burn Reward PT and pay Conet-USDC from card reserve to the member Smart
									Wallet (not EOA).
								</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={draft.toUsdcEnabled}
								disabled={publishing}
								onClick={() => onDraftChange({ ...draft, toUsdcEnabled: !draft.toUsdcEnabled })}
								className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
									draft.toUsdcEnabled ? 'bg-[#0051d1]' : 'bg-slate-300'
								} disabled:opacity-50`}
							>
								<span
									className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
										draft.toUsdcEnabled ? 'translate-x-5' : 'translate-x-0.5'
									}`}
								/>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
