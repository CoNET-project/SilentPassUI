import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Wallet } from 'lucide-react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { tu } from '@/locale/beamioLocale'

export type UsdcArrivalOverlayPhase = 'listening' | 'success'

type UsdcArrivalOverlayProps = {
	open: boolean
	phase: UsdcArrivalOverlayPhase
	/** Distinguishes wallet deposit vs merchant card top-up copy at the call site. */
	variant?: 'wallet' | 'card'
	listeningTitle: string
	listeningHint: string
	progressText?: string
	errorText?: string
	successTitle: string
	successSubtitle?: string
	balanceLabel: string
	balanceText: string
	/** Cancel listening (user did not pay / wants to stop waiting). */
	onCancel: () => void
	/** Dismiss the success panel. */
	onDone: () => void
}

/**
 * Right-slide full-screen overlay for CoNET-USDC arrival: listens after a deposit /
 * top-up and confirms with a success panel showing the new balance.
 *
 * - Enter: translateX(100%) → 0; exit: 0 → translateX(100%), 300ms (directional overlay protocol).
 * - Callbacks fire AFTER the close animation so the parent can unmount cleanly.
 * @see beamio-directional-overlay-transition.mdc, beamio-no-top-page-navigation.mdc
 */
export function UsdcArrivalOverlay({
	open,
	phase,
	listeningTitle,
	listeningHint,
	progressText,
	errorText,
	successTitle,
	successSubtitle,
	balanceLabel,
	balanceText,
	onCancel,
	onDone,
}: UsdcArrivalOverlayProps) {
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)

	useEffect(() => {
		if (!open) {
			// Reset so a subsequent open re-runs the enter animation cleanly.
			setIsEntered(false)
			setIsClosing(false)
			return
		}
		const frame = requestAnimationFrame(() => setIsEntered(true))
		return () => cancelAnimationFrame(frame)
	}, [open])

	const close = useCallback(
		(cb: () => void) => {
			if (isClosing) return
			setIsClosing(true)
			window.setTimeout(cb, 300)
		},
		[isClosing],
	)

	if (!open) return null

	const showListening = phase === 'listening'

	return (
		<div
			className="fixed inset-0 z-[70] flex flex-col bg-[#f4f6f8] transition-transform duration-300 ease-out dark:bg-slate-950"
			style={{
				transform: isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)',
				paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
			}}
			role="dialog"
			aria-modal="true"
		>
			<div className="relative flex items-center px-4">
				{showListening ? (
					<BeamioCircularBackButton
						variant="onLight"
						ariaLabel={tu('cancel')}
						onClick={() => close(onCancel)}
					/>
				) : null}
			</div>

			<div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
				{showListening ? (
					<>
						<span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#1562f0]/10">
							<Loader2 className="h-9 w-9 animate-spin text-[#1562f0]" strokeWidth={2.25} aria-hidden />
						</span>
						<h2 className="text-[22px] font-bold leading-tight tracking-tight text-[#1f2328] dark:text-slate-100">
							{listeningTitle}
						</h2>
						<p className="mt-3 max-w-xs text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
							{listeningHint}
						</p>
						{progressText ? (
							<p className="mt-4 text-[13px] font-medium text-[#1562f0]">{progressText}</p>
						) : null}
						{errorText ? (
							<p className="mt-3 max-w-xs text-[13px] font-medium text-amber-600 dark:text-amber-400">
								{errorText}
							</p>
						) : null}
						<button
							type="button"
							onClick={() => close(onCancel)}
							className="mt-8 w-full max-w-xs rounded-full border border-slate-200 bg-white px-6 py-3 text-[15px] font-semibold text-slate-600 shadow-sm transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
						>
							{tu('cancel')}
						</button>
					</>
				) : (
					<>
						<span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/12">
							<Check className="h-10 w-10 text-emerald-500" strokeWidth={2.75} aria-hidden />
						</span>
						<h2 className="text-[24px] font-bold leading-tight tracking-tight text-[#1f2328] dark:text-slate-100">
							{successTitle}
						</h2>
						{successSubtitle ? (
							<p className="mt-3 max-w-xs text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
								{successSubtitle}
							</p>
						) : null}

						<div className="mt-7 w-full max-w-xs rounded-2xl border border-slate-100 bg-white px-5 py-5 shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
							<div className="flex items-center justify-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
								<Wallet className="h-4 w-4 text-[#1562f0]" strokeWidth={2.25} aria-hidden />
								<span>{balanceLabel}</span>
							</div>
							<p className="mt-2 text-[30px] font-bold leading-none tracking-tight text-[#1f2328] dark:text-slate-100">
								{balanceText}
							</p>
						</div>

						<button
							type="button"
							onClick={() => close(onDone)}
							className="mt-8 w-full max-w-xs rounded-full bg-[#1562f0] px-6 py-3 text-[15px] font-bold text-white shadow-sm transition active:scale-[0.98]"
						>
							{tu('done')}
						</button>
					</>
				)}
			</div>
		</div>
	)
}
