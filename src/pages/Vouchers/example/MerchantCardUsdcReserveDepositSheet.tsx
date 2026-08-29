/**
 * Merchant OS Overview — deposit USDC into program-card Reserve.
 *
 * Sources (when available):
 * - Third-party wallet → walletDeposit URL (Base USDC → LockMint → card)
 * - Merchant EOA CONET-USDC → transfer on CoNET
 * - Merchant EOA Base USDC → initiateLockMint on Base
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownToLine, Check, ChevronLeft, Loader2, Wallet } from 'lucide-react'
import { AddressCapsule } from '@/components/AddressCapsule'
import {
	buildWalletUsdcDepositUrl,
	type FuelPackUsdcTopupUiLocale,
} from '@/utils/fuelPackUsdcTopupUrl'
import { ethers } from 'ethers'
import {
	depositBaseUsdcFromEoaViaLockMintToCard,
	depositConetUsdcFromEoaToCard,
	maxLockMintAmount6FromBalance,
	parseUsdcHumanToAmount6,
	readBaseUsdcLockMintFeeBps,
} from '@/utils/merchantCardUsdcReserveEoaDeposit'
import {
	formatMerchantCardConetUsdcBalanceDisplay,
	readMerchantCardConetUsdcBalance,
	waitForMerchantCardConetUsdcArrival,
} from '@/utils/merchantCardUsdcReserveArrivalWatch'
import { createNumericInputWheelNonPassiveRefCallback } from '@/utils/numericInputStepKeys'
import { preventNumericInputStepKeys } from '@/utils/numericInputStepKeys'
import { openExternalUrl } from '@/utils/openExternalUrl'

const SHEET_MS = 300

export type MerchantCardUsdcReserveDepositSource =
	| 'third_party'
	| 'eoa_conet_usdc'
	| 'eoa_base_usdc'

function parseTrustedUsdcBalance(raw: string | null | undefined): number | null {
	if (raw == null || raw === '') return null
	const n = Number(String(raw).replace(/,/g, ''))
	if (!Number.isFinite(n) || n < 0) return null
	return n
}

function formatUsdcBalanceLabel(raw: string | null | undefined): string {
	const n = parseTrustedUsdcBalance(raw)
	if (n == null) return '—'
	return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function trustedUsdcToAmount6(raw: string | null | undefined): bigint | null {
	if (raw == null || raw === '') return null
	try {
		return ethers.parseUnits(String(raw).replace(/,/g, '').trim() || '0', 6)
	} catch {
		return null
	}
}

function formatAmount6Input(amount6: bigint): string {
	const s = ethers.formatUnits(amount6, 6)
	// Trim trailing zeros after decimal for cleaner Max fill.
	if (!s.includes('.')) return s
	return s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '')
}

export type MerchantCardUsdcReserveDepositSheetProps = {
	open: boolean
	onClose: () => void
	cardAddress: string | null | undefined
	/** Base USDC on merchant EOA (trusted string); null = unknown. */
	eoaBaseUsdcBalance?: string | null
	/** CONET-USDC on merchant EOA (trusted string); null = unknown. */
	eoaConetUsdcBalance?: string | null
	uiLocale?: FuelPackUsdcTopupUiLocale
	bizFocusRingClass?: string
	/** After CONET-USDC arrives on the card (any source). */
	onArrived?: (nextBalance: string) => void
}

export function MerchantCardUsdcReserveDepositSheet({
	open,
	onClose,
	cardAddress,
	eoaBaseUsdcBalance = null,
	eoaConetUsdcBalance = null,
	uiLocale = 'en',
	bizFocusRingClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d1]/35',
	onArrived,
}: MerchantCardUsdcReserveDepositSheetProps) {
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [amountInput, setAmountInput] = useState('')
	const [source, setSource] = useState<MerchantCardUsdcReserveDepositSource>('third_party')
	const [phase, setPhase] = useState<'idle' | 'submitting' | 'listening' | 'success'>('idle')
	const [error, setError] = useState<string | null>(null)
	const [arrivedBalance, setArrivedBalance] = useState<string | null>(null)
	const [baselineBalance, setBaselineBalance] = useState<string | null>(null)
	const [lockMintFeeBps, setLockMintFeeBps] = useState<bigint>(0n)
	const abortRef = useRef<AbortController | null>(null)
	const amountInputWheelRef = useMemo(
		() => createNumericInputWheelNonPassiveRefCallback(),
		[],
	)

	const cardOk = Boolean(cardAddress && /^0x[a-fA-F0-9]{40}$/i.test(cardAddress.trim()))

	const eoaConetN = parseTrustedUsdcBalance(eoaConetUsdcBalance)
	const eoaBaseN = parseTrustedUsdcBalance(eoaBaseUsdcBalance)
	const showEoaConet = eoaConetN != null && eoaConetN > 0
	const showEoaBase = eoaBaseN != null && eoaBaseN > 0
	const eoaConetBal6 = trustedUsdcToAmount6(eoaConetUsdcBalance)
	const eoaBaseBal6 = trustedUsdcToAmount6(eoaBaseUsdcBalance)

	const availableSources = useMemo(() => {
		const list: MerchantCardUsdcReserveDepositSource[] = ['third_party']
		if (showEoaConet) list.push('eoa_conet_usdc')
		if (showEoaBase) list.push('eoa_base_usdc')
		return list
	}, [showEoaConet, showEoaBase])

	const amount6 = useMemo(() => parseUsdcHumanToAmount6(amountInput), [amountInput])

	const amountValidationError = useMemo(() => {
		if (!amountInput.trim()) return null
		if (amount6 == null) return 'Enter a valid USDC amount greater than zero.'
		if (source === 'eoa_conet_usdc' && eoaConetBal6 != null && amount6 > eoaConetBal6) {
			return `Amount exceeds your CONET-USDC balance ($${formatUsdcBalanceLabel(eoaConetUsdcBalance)}).`
		}
		if (source === 'eoa_base_usdc' && eoaBaseBal6 != null) {
			const fee6 = (amount6 * lockMintFeeBps) / 10_000n
			const need6 = amount6 + fee6
			if (need6 > eoaBaseBal6) {
				return fee6 > 0n
					? `Amount plus bridge fee ($${ethers.formatUnits(need6, 6)}) exceeds your Base USDC balance ($${formatUsdcBalanceLabel(eoaBaseUsdcBalance)}).`
					: `Amount exceeds your Base USDC balance ($${formatUsdcBalanceLabel(eoaBaseUsdcBalance)}).`
			}
		}
		return null
	}, [
		amountInput,
		amount6,
		source,
		eoaConetBal6,
		eoaBaseBal6,
		lockMintFeeBps,
		eoaConetUsdcBalance,
		eoaBaseUsdcBalance,
	])

	const canSubmit =
		cardOk &&
		amount6 != null &&
		!amountValidationError &&
		phase === 'idle' &&
		!isClosing

	useEffect(() => {
		if (!open) {
			setIsEntered(false)
			setIsClosing(false)
			return
		}
		const frame = requestAnimationFrame(() => setIsEntered(true))
		return () => cancelAnimationFrame(frame)
	}, [open])

	useEffect(() => {
		if (!open) return
		setAmountInput('')
		setError(null)
		setPhase('idle')
		setArrivedBalance(null)
		setBaselineBalance(null)
		// Prefer EOA CONET-USDC when available, else Base USDC, else third-party.
		if (showEoaConet) setSource('eoa_conet_usdc')
		else if (showEoaBase) setSource('eoa_base_usdc')
		else setSource('third_party')
		abortRef.current?.abort()
		abortRef.current = null
	}, [open, cardAddress, showEoaConet, showEoaBase])

	useEffect(() => {
		if (!open || !availableSources.includes(source)) {
			setSource(availableSources[0] ?? 'third_party')
		}
	}, [open, availableSources, source])

	useEffect(() => {
		if (!open || !showEoaBase) {
			setLockMintFeeBps(0n)
			return
		}
		let cancelled = false
		void readBaseUsdcLockMintFeeBps()
			.then((bps) => {
				if (!cancelled) setLockMintFeeBps(bps)
			})
			.catch(() => {
				if (!cancelled) setLockMintFeeBps(0n)
			})
		return () => {
			cancelled = true
		}
	}, [open, showEoaBase])

	const closeSheet = useCallback(() => {
		if (isClosing || phase === 'submitting') return
		abortRef.current?.abort()
		abortRef.current = null
		setIsClosing(true)
		window.setTimeout(() => {
			onClose()
		}, SHEET_MS)
	}, [isClosing, onClose, phase])

	const setMaxFromBalance = useCallback(() => {
		if (source === 'eoa_conet_usdc' && eoaConetBal6 != null && eoaConetBal6 > 0n) {
			setAmountInput(formatAmount6Input(eoaConetBal6))
			setError(null)
			return
		}
		if (source === 'eoa_base_usdc' && eoaBaseBal6 != null && eoaBaseBal6 > 0n) {
			const maxPrincipal = maxLockMintAmount6FromBalance(eoaBaseBal6, lockMintFeeBps)
			if (maxPrincipal <= 0n) {
				setError('Balance is too low to cover the bridge fee.')
				return
			}
			setAmountInput(formatAmount6Input(maxPrincipal))
			setError(null)
		}
	}, [source, eoaConetBal6, eoaBaseBal6, lockMintFeeBps])

	const startArrivalWatch = useCallback(
		async (card: string, baseline: string) => {
			const ac = new AbortController()
			abortRef.current = ac
			setPhase('listening')
			try {
				const outcome = await waitForMerchantCardConetUsdcArrival({
					cardAddress: card,
					baselineBalance: baseline,
					signal: ac.signal,
				})
				if (ac.signal.aborted || outcome.status === 'cancelled') return
				if (outcome.status === 'arrived') {
					setArrivedBalance(outcome.balanceDisplay)
					setPhase('success')
					onArrived?.(outcome.balanceDisplay)
					return
				}
				if (outcome.status === 'timeout') {
					setError('Timed out waiting for USDC on the program card.')
					setPhase('idle')
					return
				}
				setError(outcome.message || 'Could not confirm USDC on the program card.')
				setPhase('idle')
			} catch (e) {
				if (ac.signal.aborted) return
				const msg = e instanceof Error ? e.message : String(e)
				setError(msg || 'Timed out waiting for USDC on the program card.')
				setPhase('idle')
			} finally {
				if (abortRef.current === ac) abortRef.current = null
			}
		},
		[onArrived],
	)

	const handleSubmit = useCallback(async () => {
		if (!canSubmit || !cardAddress) return
		const card = cardAddress.trim()
		setError(null)
		setPhase('submitting')

		try {
			const baseline = await readMerchantCardConetUsdcBalance(card)
			setBaselineBalance(baseline)

			if (source === 'third_party') {
				const url = buildWalletUsdcDepositUrl({
					beneficiary: card,
					amountUsdc: amountInput.trim(),
					uiLocale,
				})
				if (!url) {
					setError('Could not build the deposit link. Check the program card address.')
					setPhase('idle')
					return
				}
				openExternalUrl(url)
				await startArrivalWatch(card, baseline)
				return
			}

			if (source === 'eoa_conet_usdc') {
				await depositConetUsdcFromEoaToCard({
					cardAddress: card,
					amountHuman: amountInput.trim(),
				})
				await startArrivalWatch(card, baseline)
				return
			}

			if (source === 'eoa_base_usdc') {
				await depositBaseUsdcFromEoaViaLockMintToCard({
					cardAddress: card,
					amountHuman: amountInput.trim(),
				})
				await startArrivalWatch(card, baseline)
				return
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			setError(msg || 'Deposit failed.')
			setPhase('idle')
		}
	}, [
		canSubmit,
		cardAddress,
		source,
		amountInput,
		uiLocale,
		startArrivalWatch,
	])

	if (!open && !isClosing) return null

	const busy = phase === 'submitting' || phase === 'listening'
	const listeningHint =
		source === 'eoa_conet_usdc'
			? 'Confirming CONET-USDC on your program card…'
			: source === 'eoa_base_usdc'
				? 'Waiting for Base → CoNET mint onto your program card…'
				: 'Waiting for CONET-USDC to arrive on your program card…'

	return (
		<div className="fixed inset-0 z-[92]" role="presentation">
			<button
				type="button"
				aria-label="Dismiss"
				className="absolute inset-0 bg-black/40 transition-opacity duration-300"
				style={{ opacity: isClosing || !isEntered ? 0 : 1 }}
				onClick={() => {
					if (busy) return
					closeSheet()
				}}
			/>
			<div
				className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-[#f4f6f8] shadow-2xl transition-transform duration-300 ease-out"
				style={{
					transform: isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)',
				}}
				role="dialog"
				aria-modal="true"
				aria-labelledby="merchant-card-usdc-reserve-deposit-title"
			>
				{/* Editor chrome: Back left · Title center · Check right (`beamio-drawer-form-chrome`) */}
				<div className="relative flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
					<button
						type="button"
						tabIndex={-1}
						aria-label="Cancel"
						disabled={busy}
						onClick={closeSheet}
						className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[#2c2f31] shadow-sm disabled:opacity-50 ${bizFocusRingClass}`}
					>
						<ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					</button>
					<h2
						id="merchant-card-usdc-reserve-deposit-title"
						className="pointer-events-none absolute inset-x-12 truncate text-center text-[15px] font-semibold text-[#0f172a]"
					>
						Deposit USDC Reserve
					</h2>
					<button
						type="button"
						tabIndex={-1}
						aria-label="Save"
						aria-busy={busy}
						disabled={!canSubmit}
						onClick={() => void handleSubmit()}
						className={`ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm disabled:opacity-40 ${bizFocusRingClass} ${
							canSubmit ? 'bg-[#0051d1]' : 'bg-slate-300'
						}`}
					>
						{busy ? (
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
						) : (
							<Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
						)}
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2">
					{phase === 'success' && arrivedBalance != null ? (
						<div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-900">
							<p className="font-semibold">USDC arrived on your program card</p>
							<p className="mt-1 text-emerald-800/90">
								Reserve balance:{' '}
								<span className="font-semibold tabular-nums">
									${formatMerchantCardConetUsdcBalanceDisplay(arrivedBalance)}
								</span>
							</p>
							<button
								type="button"
								onClick={closeSheet}
								className={`mt-4 w-full rounded-xl bg-[#0051d1] py-2.5 text-sm font-semibold text-white ${bizFocusRingClass}`}
							>
								Done
							</button>
						</div>
					) : (
						<>
							<p className="text-sm leading-relaxed text-slate-600">
								Add CONET-USDC to this program card&apos;s Reserve (on-card balance). Choose a source
								below.
							</p>

							{cardOk ? (
								<div className="mt-4">
									<p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
										Program card
									</p>
									<AddressCapsule
										address={cardAddress!.trim()}
										className="max-w-full border-slate-200 bg-white text-slate-700"
									/>
								</div>
							) : (
								<div
									role="alert"
									className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
									<p>Select a program card before depositing.</p>
								</div>
							)}

							{/* Source picker */}
							<div className="mt-5 space-y-2">
								<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
									Deposit from
								</p>
								{showEoaConet ? (
									<button
										type="button"
										disabled={busy}
										onClick={() => {
											setSource('eoa_conet_usdc')
											setError(null)
										}}
										className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
											source === 'eoa_conet_usdc'
												? 'border-[#0051d1] bg-[#e9edff] ring-1 ring-[#0051d1]/30'
												: 'border-slate-200 bg-white hover:border-slate-300'
										} ${bizFocusRingClass}`}
									>
										<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9edff] text-[#0051d1]">
											<Wallet className="h-4 w-4" strokeWidth={2.25} aria-hidden />
										</span>
										<span className="min-w-0 flex-1">
											<span className="block text-sm font-semibold text-[#0f172a]">
												EOA · CONET-USDC
											</span>
											<span className="mt-0.5 block text-xs text-slate-500">
												Transfer on CoNET · available $
												{formatUsdcBalanceLabel(eoaConetUsdcBalance)}
											</span>
										</span>
									</button>
								) : null}
								{showEoaBase ? (
									<button
										type="button"
										disabled={busy}
										onClick={() => {
											setSource('eoa_base_usdc')
											setError(null)
										}}
										className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
											source === 'eoa_base_usdc'
												? 'border-[#0051d1] bg-[#e9edff] ring-1 ring-[#0051d1]/30'
												: 'border-slate-200 bg-white hover:border-slate-300'
										} ${bizFocusRingClass}`}
									>
										<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9edff] text-[#0051d1]">
											<Wallet className="h-4 w-4" strokeWidth={2.25} aria-hidden />
										</span>
										<span className="min-w-0 flex-1">
											<span className="block text-sm font-semibold text-[#0f172a]">
												EOA · Base USDC
											</span>
											<span className="mt-0.5 block text-xs text-slate-500">
												LockMint via treasury · available $
												{formatUsdcBalanceLabel(eoaBaseUsdcBalance)}
											</span>
										</span>
									</button>
								) : null}
								<button
									type="button"
									disabled={busy}
									onClick={() => {
										setSource('third_party')
										setError(null)
									}}
									className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
										source === 'third_party'
											? 'border-[#0051d1] bg-[#e9edff] ring-1 ring-[#0051d1]/30'
											: 'border-slate-200 bg-white hover:border-slate-300'
									} ${bizFocusRingClass}`}
								>
									<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
										<ArrowDownToLine className="h-4 w-4" strokeWidth={2.25} aria-hidden />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block text-sm font-semibold text-[#0f172a]">
											Third-party wallet
										</span>
										<span className="mt-0.5 block text-xs text-slate-500">
											Pay with Base USDC in MetaMask / Coinbase Wallet / etc.
										</span>
									</span>
								</button>
							</div>

							<label
								htmlFor="merchant-card-usdc-reserve-deposit-amount"
								className="mt-5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
							>
								Amount (USDC)
							</label>
							<div className="mt-1.5 flex items-center gap-2">
								<input
									ref={amountInputWheelRef}
									id="merchant-card-usdc-reserve-deposit-amount"
									type="number"
									inputMode="decimal"
									autoComplete="off"
									enterKeyHint="done"
									min={0}
									step="any"
									disabled={busy || !cardOk}
									value={amountInput}
									onChange={(e) => {
										setAmountInput(e.target.value)
										setError(null)
									}}
									onKeyDown={(e) => {
										preventNumericInputStepKeys(e)
										if (e.key === 'Enter') {
											e.preventDefault()
											;(e.target as HTMLInputElement).blur()
											if (canSubmit) void handleSubmit()
										}
									}}
									placeholder="0.00"
									className={`min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base tabular-nums text-[#0f172a] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50 ${bizFocusRingClass}`}
								/>
								{(source === 'eoa_conet_usdc' || source === 'eoa_base_usdc') &&
								((source === 'eoa_conet_usdc' && eoaConetN != null && eoaConetN > 0) ||
									(source === 'eoa_base_usdc' && eoaBaseN != null && eoaBaseN > 0)) ? (
									<button
										type="button"
										disabled={busy}
										onClick={setMaxFromBalance}
										className={`shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#0051d1] disabled:opacity-50 ${bizFocusRingClass}`}
									>
										Max
									</button>
								) : null}
							</div>

							{source === 'third_party' ? (
								<p className="mt-3 text-xs leading-relaxed text-slate-500">
									Check opens Beamio checkout in a new tab. After you pay on Base, CoNET miners mint
									CONET-USDC to this card. This panel listens until the Reserve balance increases.
								</p>
							) : source === 'eoa_conet_usdc' ? (
								<p className="mt-3 text-xs leading-relaxed text-slate-500">
									Signs a CONET-USDC transfer from your unlocked EOA wallet to this program card. Requires
									a small amount of CNET for gas.
								</p>
							) : (
								<p className="mt-3 text-xs leading-relaxed text-slate-500">
									Approves and locks Base USDC in TreasuryBridgeV3, then mints CONET-USDC to this card.
									Requires ETH on Base for gas.
								</p>
							)}

							{(error || amountValidationError) && phase !== 'listening' ? (
								<div
									role="alert"
									className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
									<p>{error || amountValidationError}</p>
								</div>
							) : null}

							{phase === 'listening' ? (
								<div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700">
									<Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#0051d1]" aria-hidden />
									<div>
										<p className="font-medium">{listeningHint}</p>
										{baselineBalance != null ? (
											<p className="mt-1 text-xs text-slate-500">
												Baseline ${formatMerchantCardConetUsdcBalanceDisplay(baselineBalance)}
											</p>
										) : null}
										<button
											type="button"
											className={`mt-2 text-xs font-semibold text-slate-600 underline ${bizFocusRingClass}`}
											onClick={() => {
												abortRef.current?.abort()
												abortRef.current = null
												setPhase('idle')
												setError(null)
											}}
										>
											Cancel waiting
										</button>
									</div>
								</div>
							) : null}
						</>
					)}
				</div>
			</div>
		</div>
	)
}
