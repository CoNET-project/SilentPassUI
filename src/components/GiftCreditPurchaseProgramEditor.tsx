/**
 * Programs → Credit Gift (Discover burn-#0 purchase fee).
 * Drawer chrome: left Cancel / center Title / right Check (beamio-drawer-form-chrome).
 */
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, ChevronLeft, Gift, Loader2 } from 'lucide-react'
import { BeamioPercentSlider } from '@/components/BeamioPercentSlider'
import {
	cloneGiftCreditPurchaseConfig,
	giftCreditPurchaseConfigsEqual,
	type GiftCreditFeeKind,
	type GiftCreditPurchaseConfig,
} from '@/utils/giftCreditPurchaseMetadata'
import {
	actorBpsToPercentWhole,
	formatRewardPercentHumanDisplay,
	percentWholeToActorBps,
} from '@/utils/unifiedRewardPoints'
import {
	createNumericInputWheelNonPassiveRefCallback,
	preventNumericInputStepKeys,
	preventNumericInputWheelStep,
} from '@/utils/numericInputStepKeys'

function feeE6ToHuman(e6: bigint): string {
	if (e6 <= 0n) return ''
	const whole = e6 / 1_000_000n
	const frac = e6 % 1_000_000n
	if (frac === 0n) return whole.toString()
	return `${whole}.${frac.toString().padStart(6, '0').replace(/0+$/, '')}`
}

function humanToFeeE6(raw: string): bigint {
	const s = String(raw ?? '').replace(/,/g, '').trim()
	if (!s) return 0n
	const n = Number(s)
	if (!Number.isFinite(n) || n <= 0) return 0n
	return BigInt(Math.round(n * 1e6))
}

export type GiftCreditPurchaseProgramEditorProps = {
	open: boolean
	value: GiftCreditPurchaseConfig
	/** Fiat prefix for fixed-fee display (e.g. CA$, $). */
	currencyPrefix: string
	publishing: boolean
	serverError?: string
	focusRingClassName?: string
	numericNoSpinnerClassName?: string
	canSave: boolean
	onChange: (next: GiftCreditPurchaseConfig) => void
	onClose: () => void
	onSave: () => void
}

export function GiftCreditPurchaseProgramEditor({
	open,
	value,
	currencyPrefix,
	publishing,
	serverError = '',
	focusRingClassName = '',
	numericNoSpinnerClassName = '',
	canSave,
	onChange,
	onClose,
	onSave,
}: GiftCreditPurchaseProgramEditorProps) {
	const fixedFeeWheelRef = useMemo(() => createNumericInputWheelNonPassiveRefCallback(), [])
	const [fixedFeeDraft, setFixedFeeDraft] = useState(() => feeE6ToHuman(value.feeE6))

	useEffect(() => {
		if (open) setFixedFeeDraft(feeE6ToHuman(value.feeE6))
	}, [open, value.feeE6])

	const percentDisplay = formatRewardPercentHumanDisplay(actorBpsToPercentWhole(value.percentBps))

	const patch = (partial: Partial<GiftCreditPurchaseConfig>) => {
		onChange(cloneGiftCreditPurchaseConfig({ ...value, ...partial }))
	}

	return (
		<AnimatePresence>
			{open ? (
				<>
					<motion.button
						key="gift-credit-backdrop"
						type="button"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 z-[90] bg-black/40"
						aria-label="Cancel"
						disabled={publishing}
						onClick={() => {
							if (!publishing) onClose()
						}}
					/>
					<motion.div
						key="gift-credit-sheet"
						role="dialog"
						aria-modal="true"
						aria-labelledby="gift-credit-purchase-title"
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ type: 'spring', damping: 28, stiffness: 320 }}
						className="fixed inset-x-0 bottom-0 z-[91] mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-[0_-24px_64px_rgba(0,0,0,0.12)]"
					>
						<div className="flex justify-center pb-1 pt-3">
							<div className="h-1.5 w-12 rounded-full bg-slate-200" aria-hidden />
						</div>
						<div className="relative flex shrink-0 items-center justify-between px-4 pb-3 pt-1">
							<button
								type="button"
								tabIndex={-1}
								disabled={publishing}
								onClick={() => {
									if (!publishing) onClose()
								}}
								className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white/90 text-[#2c2f31] shadow-[0_2px_10px_rgba(0,0,0,0.16),0_1px_3px_rgba(0,0,0,0.12)] transition active:scale-[0.96] hover:bg-white disabled:opacity-50"
								aria-label="Cancel"
							>
								<ChevronLeft className="h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
							</button>
							<h2
								id="gift-credit-purchase-title"
								className="pointer-events-none absolute inset-x-12 truncate text-center text-[17px] font-semibold tracking-tight text-[#1a1b1f]"
							>
								Credit Gift
							</h2>
							<button
								type="button"
								tabIndex={-1}
								disabled={!canSave}
								aria-busy={publishing}
								aria-label="Save"
								onClick={() => {
									if (canSave) onSave()
								}}
								className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1562f0] text-white shadow-[0_2px_10px_rgba(21,98,240,0.35)] transition active:scale-[0.96] hover:bg-[#0f52d4] disabled:cursor-not-allowed disabled:opacity-40"
							>
								{publishing ? (
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								) : (
									<Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
								)}
							</button>
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 sm:px-6">
							<p className="mb-4 text-[15px] leading-5 text-[#424655]">
								Let Discover shoppers buy gift redeem codes by burning their store credit (#0)
								instead of USDC. Optional merchant fee is burned and never minted to the
								recipient.
							</p>

							<section className="rounded-3xl border border-[#c3c6d8]/30 bg-white p-5 shadow-[0px_10px_20px_rgba(0,0,0,0.05)]">
								<div className="flex items-center justify-between gap-3">
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1562f0]/10 text-[#1562f0]">
											<Gift className="h-5 w-5" strokeWidth={2} aria-hidden />
										</div>
										<div className="min-w-0">
											<h3 className="text-[18px] font-semibold tracking-tight text-[#1a1b1f]">
												Enable Credit Gift
											</h3>
											<p className="mt-0.5 text-xs text-[#747779]">
												Default off. Fee may be 0% / {currencyPrefix}0 when enabled.
											</p>
										</div>
									</div>
									<button
										type="button"
										role="switch"
										aria-checked={value.enabled}
										aria-label="Enable Credit Gift"
										disabled={publishing}
										onClick={() => patch({ enabled: !value.enabled })}
										className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
											value.enabled ? 'bg-[#1562f0]' : 'bg-[#c3c6d8]'
										} ${focusRingClassName}`}
									>
										<span
											className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
												value.enabled ? 'translate-x-7' : 'translate-x-1'
											}`}
										/>
									</button>
								</div>
							</section>

							{value.enabled ? (
								<div className="mt-4 space-y-4">
									<section className="rounded-3xl border border-[#c3c6d8]/30 bg-white p-5 shadow-[0px_10px_20px_rgba(0,0,0,0.05)]">
										<p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#595c5e]">
											Merchant fee
										</p>
										<div className="mb-4 flex gap-2">
											{(
												[
													{ id: 'percent' as GiftCreditFeeKind, label: 'Percent of gift' },
													{ id: 'fixed' as GiftCreditFeeKind, label: 'Fixed amount' },
												] as const
											).map((opt) => {
												const active = value.feeKind === opt.id
												return (
													<button
														key={opt.id}
														type="button"
														disabled={publishing}
														aria-pressed={active}
														onClick={() => patch({ feeKind: opt.id })}
														className={`flex-1 rounded-full px-3 py-2.5 text-sm font-semibold transition ${
															active
																? 'bg-[#1562f0] text-white'
																: 'bg-[#eeedf3] text-[#424655] hover:bg-[#e4e2ea]'
														} ${focusRingClassName}`}
													>
														{opt.label}
													</button>
												)
											})}
										</div>

										{value.feeKind === 'percent' ? (
											<>
												<BeamioPercentSlider
													id="gift-credit-fee-percent"
													label="Percent of full gift face"
													accent="blue"
													value={Number(percentDisplay) || 0}
													onChange={(n) =>
														patch({
															percentBps: percentWholeToActorBps(n),
														})
													}
													disabled={publishing}
													focusRingClassName={focusRingClassName}
												/>
												<p className="mt-3 text-xs leading-relaxed text-[#747779]">
													Percent applies to the entire gift face amount G (membership-fee
													slice + store-credit slice). Recipient only receives G; fee F is
													burned.
												</p>
											</>
										) : (
											<>
												<label
													htmlFor="gift-credit-fixed-fee"
													className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[#747779]"
												>
													Fixed fee (program points)
												</label>
												<div className="relative">
													<span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-[#1562f0]">
														{currencyPrefix}
													</span>
													<input
														id="gift-credit-fixed-fee"
														ref={fixedFeeWheelRef}
														type="number"
														inputMode="decimal"
														autoComplete="off"
														min={0}
														step={0.01}
														disabled={publishing}
														value={fixedFeeDraft}
														onKeyDown={preventNumericInputStepKeys}
														onWheel={preventNumericInputWheelStep}
														onChange={(e) => {
															const raw = e.target.value.replace(/,/g, '')
															setFixedFeeDraft(raw)
															patch({ feeE6: humanToFeeE6(raw) })
														}}
														onBlur={() => {
															const e6 = humanToFeeE6(fixedFeeDraft)
															setFixedFeeDraft(feeE6ToHuman(e6))
															patch({ feeE6: e6 })
														}}
														placeholder="0"
														className={`w-full rounded-md border-none bg-[#eef1f3] py-4 pl-12 pr-5 text-[15px] font-medium text-[#2c2f31] placeholder:text-[#595c5e]/70 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 ${focusRingClassName} ${numericNoSpinnerClassName}`}
													/>
												</div>
												<p className="mt-3 text-xs leading-relaxed text-[#747779]">
													Fixed fee is burned from the buyer’s #0 in addition to gift face G.
													Use 0 to enable Credit Gift with no merchant fee.
												</p>
											</>
										)}
									</section>

									<section className="rounded-2xl border border-[#eadcf7] bg-[#f5ecff]/40 px-4 py-3">
										<p className="text-xs leading-relaxed text-[#424655]">
											<strong className="font-semibold text-[#1a1b1f]">Protocol fuel:</strong>{' '}
											merchant card owner is charged <strong>20 B-Units</strong> when a Credit
											Gift code is purchased, and <strong>20 B-Units</strong> when it is claimed.
											Credit Gift never applies Top-up Promotion bonus or mints Reward PT (#13).
										</p>
									</section>
								</div>
							) : null}

							{serverError ? (
								<div
									role="alert"
									className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
									<p>{serverError}</p>
								</div>
							) : null}
						</div>
					</motion.div>
				</>
			) : null}
		</AnimatePresence>
	)
}

export function giftCreditPurchaseEditorIsDirty(
	draft: GiftCreditPurchaseConfig,
	baseline: GiftCreditPurchaseConfig | null,
): boolean {
	if (!baseline) return false
	return !giftCreditPurchaseConfigsEqual(draft, baseline)
}
