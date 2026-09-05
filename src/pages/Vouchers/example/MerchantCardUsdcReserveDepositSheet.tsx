/**
 * Merchant OS Overview — fund the program-card #13 redeem pool (USDC Reserve).
 *
 * All sources end in owner EOA EIP-2612 `permit` (when needed) + `fundSocialExchangeUsdcEscrow`.
 * Master Settle_Conet sponsors CNET gas — merchant EOA does not need CNET.
 * A raw transfer / LockMint to the card address does not raise Reserve.
 *
 * - EOA CONET-USDC → permit (if needed) + fund escrow
 * - EOA Base USDC → LockMint CONET-USDC to the EOA, then permit + fund
 * - Third-party → walletDeposit URL (beneficiary = owner EOA), then permit + fund
 *
 * Retry: if the EOA already holds enough CONET-USDC, skip LockMint / checkout.
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
	fundProgramCardUsdcEscrowFromEoa,
	parseUsdcHumanToAmount6,
	sanitizeUsdcReserveDepositError,
} from '@/utils/merchantCardUsdcReserveEoaDeposit'
import {
	formatMerchantCardConetUsdcBalanceDisplay,
	readConetUsdcBalance6,
	readMerchantCardRewardEscrowUsdc,
	waitForConetUsdcArrival,
	waitForMerchantCardEscrowUsdcArrival,
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

/** Daemon `usdcReserve` / `reserveDifference` are 6-decimal integer strings. Missing ≠ 0. */
function parseReserveUsdcE6(raw: string | null | undefined): bigint | null {
	if (raw == null || raw === '') return null
	try {
		return BigInt(String(raw).trim())
	} catch {
		return null
	}
}

function formatReserveUsdcE6(raw: string | null | undefined): string | null {
	const n = parseReserveUsdcE6(raw)
	if (n == null) return null
	const abs = Number(n < 0n ? -n : n) / 1_000_000
	if (!Number.isFinite(abs)) return null
	const body = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
	return n < 0n ? `-$${body}` : `$${body}`
}

function isNegativeReserveDifference(raw: string | null | undefined): boolean {
	const n = parseReserveUsdcE6(raw)
	return n != null && n < 0n
}

const AMOUNT_CHIPS = [10, 25, 50, 100] as const

export type MerchantCardUsdcReserveDepositSheetProps = {
	open: boolean
	onClose: () => void
	cardAddress: string | null | undefined
	/** Card owner EOA — LockMint / walletDeposit beneficiary (not the card). */
	merchantEoa?: string | null
	/** Base USDC on merchant EOA (trusted string); null = unknown. */
	eoaBaseUsdcBalance?: string | null
	/** CONET-USDC on merchant EOA (trusted string); null = unknown. */
	eoaConetUsdcBalance?: string | null
	/** Trusted 6-decimal integer from Daemon `usdcReserve`. Missing ≠ 0. */
	usdcReserve?: string | null
	/** Trusted 6-decimal integer: pool − #13 quote. Negative = cannot cover minted Reward PT. */
	reserveDifference?: string | null
	uiLocale?: FuelPackUsdcTopupUiLocale
	bizFocusRingClass?: string
	/** After the #13 redeem pool (Reserve) increases. */
	onArrived?: (nextBalance: string) => void
}

export function MerchantCardUsdcReserveDepositSheet({
	open,
	onClose,
	cardAddress,
	merchantEoa = null,
	eoaBaseUsdcBalance = null,
	eoaConetUsdcBalance = null,
	usdcReserve = null,
	reserveDifference = null,
	uiLocale = 'en',
	bizFocusRingClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d1]/35',
	onArrived,
}: MerchantCardUsdcReserveDepositSheetProps) {
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [amountInput, setAmountInput] = useState('')
	const [lastChip, setLastChip] = useState<string | null>(null)
	const [source, setSource] = useState<MerchantCardUsdcReserveDepositSource>('third_party')
	const [phase, setPhase] = useState<'idle' | 'submitting' | 'listening' | 'success'>('idle')
	const [listenKind, setListenKind] = useState<'idle' | 'eoa' | 'funding' | 'escrow'>('idle')
	const [error, setError] = useState<string | null>(null)
	const [arrivedBalance, setArrivedBalance] = useState<string | null>(null)
	const [baselineBalance, setBaselineBalance] = useState<string | null>(null)
	const abortRef = useRef<AbortController | null>(null)
	const amountInputWheelRef = useMemo(
		() => createNumericInputWheelNonPassiveRefCallback(),
		[],
	)

	const cardOk = Boolean(cardAddress && /^0x[a-fA-F0-9]{40}$/i.test(cardAddress.trim()))
	const merchantEoaOk = Boolean(merchantEoa && /^0x[a-fA-F0-9]{40}$/i.test(merchantEoa.trim()))

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
		if (source === 'eoa_base_usdc' && eoaBaseBal6 != null && amount6 > eoaBaseBal6) {
			return `Amount exceeds your Base USDC balance ($${formatUsdcBalanceLabel(eoaBaseUsdcBalance)}).`
		}
		return null
	}, [
		amountInput,
		amount6,
		source,
		eoaConetBal6,
		eoaBaseBal6,
		eoaConetUsdcBalance,
		eoaBaseUsdcBalance,
	])

	const canSubmit =
		cardOk &&
		merchantEoaOk &&
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
		setLastChip(null)
		setError(null)
		setPhase('idle')
		setListenKind('idle')
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

	const closeSheet = useCallback(() => {
		if (isClosing || phase === 'submitting') return
		abortRef.current?.abort()
		abortRef.current = null
		setIsClosing(true)
		window.setTimeout(() => {
			onClose()
		}, SHEET_MS)
	}, [isClosing, onClose, phase])

	const reserveDisplay = formatReserveUsdcE6(usdcReserve)
	const reserveLow = isNegativeReserveDifference(reserveDifference)
	const reserveShortfallDisplay = useMemo(() => {
		const n = parseReserveUsdcE6(reserveDifference)
		if (n == null || n >= 0n) return null
		return formatReserveUsdcE6((-n).toString())
	}, [reserveDifference])
	const projectedReserveDisplay = useMemo(() => {
		const cur = parseReserveUsdcE6(usdcReserve)
		if (cur == null || amount6 == null) return null
		return formatReserveUsdcE6((cur + amount6).toString())
	}, [usdcReserve, amount6])
	const amountTokenLabel =
		source === 'eoa_conet_usdc' ? 'CONET-USDC' : source === 'eoa_base_usdc' ? 'Base USDC' : 'USDC'
	const gasLineLabel =
		source === 'eoa_conet_usdc'
			? 'Sponsored CNET gas'
			: source === 'eoa_base_usdc'
				? 'Sponsored Base + CNET gas'
				: 'Checkout on Base; mint + fund sponsored'
	const depositAmountDisplay =
		amount6 != null
			? `$${Number(ethers.formatUnits(amount6, 6)).toLocaleString('en-US', {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})}`
			: '—'

	const addAmountChip = useCallback(
		(delta: number) => {
			const add = parseUsdcHumanToAmount6(String(delta))
			if (add == null) return
			const current = parseUsdcHumanToAmount6(amountInput) ?? 0n
			setAmountInput(formatAmount6Input(current + add))
			setLastChip(String(delta))
			setError(null)
		},
		[amountInput],
	)

	const setMaxFromBalance = useCallback(() => {
		if (source === 'eoa_conet_usdc' && eoaConetBal6 != null && eoaConetBal6 > 0n) {
			setAmountInput(formatAmount6Input(eoaConetBal6))
			setLastChip('max')
			setError(null)
			return
		}
		if (source === 'eoa_base_usdc' && eoaBaseBal6 != null && eoaBaseBal6 > 0n) {
			setAmountInput(formatAmount6Input(eoaBaseBal6))
			setLastChip('max')
			setError(null)
		}
	}, [source, eoaConetBal6, eoaBaseBal6])

	const watchEoaArrival = useCallback(async (eoa: string, baseline: string): Promise<boolean> => {
		const ac = new AbortController()
		abortRef.current = ac
		setListenKind('eoa')
		setPhase('listening')
		setBaselineBalance(baseline)
		try {
			const outcome = await waitForConetUsdcArrival({
				account: eoa,
				baselineBalance: baseline,
				signal: ac.signal,
			})
			if (ac.signal.aborted || outcome.status === 'cancelled') return false
			if (outcome.status === 'arrived') return true
			if (outcome.status === 'timeout') {
				setError('Timed out waiting for CONET-USDC on your EOA. If mint already landed, tap Check to fund Reserve.')
				setPhase('idle')
				setListenKind('idle')
				return false
			}
			setError(outcome.message || 'Could not confirm CONET-USDC on your EOA.')
			setPhase('idle')
			setListenKind('idle')
			return false
		} catch (e) {
			if (ac.signal.aborted) return false
			setError(sanitizeUsdcReserveDepositError(e) || 'Could not confirm CONET-USDC on your EOA.')
			setPhase('idle')
			setListenKind('idle')
			return false
		} finally {
			if (abortRef.current === ac) abortRef.current = null
		}
	}, [])

	const fundEscrowAndWatch = useCallback(
		async (card: string): Promise<void> => {
			const escrowBaseline = await readMerchantCardRewardEscrowUsdc(card)
			setBaselineBalance(escrowBaseline)
			setListenKind('funding')
			setPhase('submitting')
			await fundProgramCardUsdcEscrowFromEoa({
				cardAddress: card,
				amountHuman: amountInput.trim(),
			})
			const ac = new AbortController()
			abortRef.current = ac
			setListenKind('escrow')
			setPhase('listening')
			try {
				const outcome = await waitForMerchantCardEscrowUsdcArrival({
					cardAddress: card,
					baselineBalance: escrowBaseline,
					signal: ac.signal,
				})
				if (ac.signal.aborted || outcome.status === 'cancelled') return
				if (outcome.status === 'arrived') {
					setArrivedBalance(outcome.balanceDisplay)
					setPhase('success')
					setListenKind('idle')
					onArrived?.(outcome.balanceDisplay)
					return
				}
				if (outcome.status === 'timeout') {
					setError('Timed out confirming the #13 redeem pool. Refresh Overview if Reserve already increased.')
					setPhase('idle')
					setListenKind('idle')
					return
				}
				setError(outcome.message || 'Could not confirm the #13 redeem pool.')
				setPhase('idle')
				setListenKind('idle')
			} catch (e) {
				if (ac.signal.aborted) return
				setError(sanitizeUsdcReserveDepositError(e) || 'Could not confirm the #13 redeem pool.')
				setPhase('idle')
				setListenKind('idle')
			} finally {
				if (abortRef.current === ac) abortRef.current = null
			}
		},
		[amountInput, onArrived],
	)

	const handleSubmit = useCallback(async () => {
		if (!canSubmit || !cardAddress || !merchantEoa || amount6 == null) return
		const card = cardAddress.trim()
		const eoa = merchantEoa.trim()
		setError(null)
		setPhase('submitting')
		setListenKind('idle')

		try {
			const needsInbound = source === 'third_party' || source === 'eoa_base_usdc'
			if (needsInbound) {
				const liveEoa6 = await readConetUsdcBalance6(eoa)
				const skipInbound = liveEoa6 != null && amount6 <= liveEoa6
				if (!skipInbound) {
					const eoaBaseline = ethers.formatUnits(liveEoa6 ?? 0n, 6)
					setBaselineBalance(eoaBaseline)
					if (source === 'third_party') {
						const url = buildWalletUsdcDepositUrl({
							beneficiary: eoa,
							amountUsdc: amountInput.trim(),
							uiLocale,
						})
						if (!url) {
							setError('Could not build the deposit link. Check your merchant wallet address.')
							setPhase('idle')
							setListenKind('idle')
							return
						}
						openExternalUrl(url)
					} else {
						await depositBaseUsdcFromEoaViaLockMintToCard({
							cardAddress: card,
							amountHuman: amountInput.trim(),
						})
					}
					const inboundOk = await watchEoaArrival(eoa, eoaBaseline)
					if (!inboundOk) return
				}
			}

			await fundEscrowAndWatch(card)
		} catch (e) {
			setError(sanitizeUsdcReserveDepositError(e) || 'Could not fund USDC Reserve.')
			setPhase('idle')
			setListenKind('idle')
		}
	}, [
		canSubmit,
		cardAddress,
		merchantEoa,
		amount6,
		source,
		amountInput,
		uiLocale,
		watchEoaArrival,
		fundEscrowAndWatch,
	])

	if (!open && !isClosing) return null

	const busy = phase === 'submitting' || phase === 'listening'
	const progressHint =
		listenKind === 'eoa'
			? 'Waiting for CONET-USDC on your EOA…'
			: listenKind === 'funding'
				? 'Signing and funding the #13 redeem pool…'
				: listenKind === 'escrow'
					? 'Confirming USDC Reserve (#13 redeem pool)…'
					: phase === 'submitting'
						? 'Preparing deposit…'
						: 'Waiting…'
	const baselineLabel = listenKind === 'eoa' ? 'EOA CONET-USDC baseline' : 'Reserve baseline'

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
							<p className="font-semibold">USDC Reserve funded</p>
							<p className="mt-1 text-emerald-800/90">
								Redeem pool (Reserve):{' '}
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
							<section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
								<div className="relative z-10 flex items-start justify-between gap-3">
									<div className="min-w-0">
										<span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
											#13 redeem pool
										</span>
										<h3 className="mt-0.5 text-base font-bold tracking-tight text-slate-900">
											Add funds to USDC Reserve
										</h3>
									</div>
									{reserveLow ? (
										<span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
											<AlertTriangle className="h-2.5 w-2.5" aria-hidden />
											<span>
												Low Reserve
												{reserveShortfallDisplay ? ` (${reserveShortfallDisplay} short)` : ''}
											</span>
										</span>
									) : null}
								</div>
								<p className="mt-2 text-xs leading-relaxed text-slate-500">
									Add CONET-USDC to this program card&apos;s #13 redeem pool. A transfer to the card
									address does not raise Reserve.
								</p>
								<div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
									<span className="font-medium text-slate-500">Current Reserve</span>
									<span className="text-sm font-bold tracking-tight text-slate-800 tabular-nums">
										{reserveDisplay ?? 'Not available'}
									</span>
								</div>
							</section>

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

							{cardOk && merchantEoaOk ? (
								<div className="mt-4">
									<p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
										Owner EOA
									</p>
									<AddressCapsule
										address={merchantEoa!.trim()}
										className="max-w-full border-[#dce2f7] bg-[#e9edff] text-[#424655]"
										leadingIcon={<Wallet className="h-3.5 w-3.5 text-[#0051d1]" strokeWidth={2.25} aria-hidden />}
									/>
								</div>
							) : cardOk ? (
								<div
									role="alert"
									className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
									<p>Unlock Merchant OS so your EOA can sign and fund the redeem pool.</p>
								</div>
							) : null}

							<div className="mt-5 space-y-2">
								<p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
									Deposit source
								</p>
								{showEoaConet ? (
									<button
										type="button"
										disabled={busy}
										onClick={() => {
											setSource('eoa_conet_usdc')
											setLastChip(null)
											setError(null)
										}}
										className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition ${
											source === 'eoa_conet_usdc'
												? 'border-2 border-[#0051d1] bg-white shadow-sm'
												: 'border border-slate-200 bg-white/80 hover:bg-white'
										} ${bizFocusRingClass}`}
									>
										<span className="flex min-w-0 items-center gap-3">
											<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dce2f7] bg-[#e9edff] text-[#0051d1]">
												<Wallet className="h-4 w-4" strokeWidth={2.25} aria-hidden />
											</span>
											<span className="min-w-0">
												<span className="flex items-center gap-2">
													<span className="text-sm font-semibold text-slate-900">EOA · CONET-USDC</span>
													<span className="rounded bg-[#e9edff] px-1.5 text-[10px] font-bold text-[#0051d1]">
														PRIMARY
													</span>
												</span>
												<span className="mt-0.5 block text-xs text-slate-500">
													Available:{' '}
													<span className="font-semibold text-slate-700">
														${formatUsdcBalanceLabel(eoaConetUsdcBalance)} CONET-USDC
													</span>
												</span>
											</span>
										</span>
										{source === 'eoa_conet_usdc' ? (
											<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0051d1] text-white">
												<Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
											</span>
										) : (
											<span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
										)}
									</button>
								) : null}
								{showEoaBase ? (
									<button
										type="button"
										disabled={busy}
										onClick={() => {
											setSource('eoa_base_usdc')
											setLastChip(null)
											setError(null)
										}}
										className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition ${
											source === 'eoa_base_usdc'
												? 'border-2 border-[#0051d1] bg-white shadow-sm'
												: 'border border-slate-200 bg-white/80 hover:bg-white'
										} ${bizFocusRingClass}`}
									>
										<span className="flex min-w-0 items-center gap-3">
											<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dce2f7] bg-[#e9edff] text-[#0051d1]">
												<Wallet className="h-4 w-4" strokeWidth={2.25} aria-hidden />
											</span>
											<span className="min-w-0">
												<span className="text-sm font-semibold text-slate-900">EOA · Base USDC</span>
												<span className="mt-0.5 block text-xs text-slate-500">
													LockMint to your EOA, then fund Reserve · available $
													{formatUsdcBalanceLabel(eoaBaseUsdcBalance)}
												</span>
											</span>
										</span>
										{source === 'eoa_base_usdc' ? (
											<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0051d1] text-white">
												<Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
											</span>
										) : (
											<span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
										)}
									</button>
								) : null}
								<button
									type="button"
									disabled={busy}
									onClick={() => {
										setSource('third_party')
										setLastChip(null)
										setError(null)
									}}
									className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition ${
										source === 'third_party'
											? 'border-2 border-[#0051d1] bg-white shadow-sm'
											: 'border border-slate-200 bg-white/80 hover:bg-white'
									} ${bizFocusRingClass}`}
								>
									<span className="flex min-w-0 items-center gap-3">
										<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
											<ArrowDownToLine className="h-4 w-4" strokeWidth={2.25} aria-hidden />
										</span>
										<span className="min-w-0">
											<span className="text-sm font-medium text-slate-800">Third-party wallet</span>
											<span className="mt-0.5 block text-xs text-slate-400">
												Pay with Base USDC; mint to your EOA, then fund Reserve.
											</span>
										</span>
									</span>
									{source === 'third_party' ? (
										<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0051d1] text-white">
											<Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
										</span>
									) : (
										<span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
									)}
								</button>
							</div>

							<section className="mt-5 space-y-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
								<div className="flex items-center justify-between">
									<label
										htmlFor="merchant-card-usdc-reserve-deposit-amount"
										className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
									>
										Deposit amount
									</label>
									<span className="rounded-md bg-[#e9edff] px-2 py-0.5 text-xs font-semibold text-[#0051d1]">
										{amountTokenLabel}
									</span>
								</div>
								<div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50 p-3 focus-within:border-[#0051d1] focus-within:ring-2 focus-within:ring-[#0051d1]/20">
									<span className="mr-2 text-2xl font-bold text-slate-400">$</span>
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
											setLastChip(null)
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
										className={`w-full border-0 bg-transparent p-0 text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums focus:outline-none focus:ring-0 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50 ${bizFocusRingClass}`}
									/>
									<div className="flex shrink-0 items-center gap-1.5 border-l border-slate-200 pl-2">
										<span className="text-xs font-bold text-slate-800">USDC</span>
									</div>
								</div>
								<div className="flex items-center justify-between gap-1.5">
									{AMOUNT_CHIPS.map((chip) => {
										const active = lastChip === String(chip)
										return (
											<button
												key={chip}
												type="button"
												disabled={busy || !cardOk}
												onClick={() => addAmountChip(chip)}
												className={`flex-1 rounded-lg px-2 py-1.5 text-center text-xs disabled:opacity-50 ${
													active
														? 'bg-[#0051d1] font-semibold text-white shadow-sm'
														: 'bg-slate-100 font-medium text-slate-700 hover:bg-slate-200'
												} ${bizFocusRingClass}`}
											>
												+{chip}
											</button>
										)
									})}
									{(source === 'eoa_conet_usdc' || source === 'eoa_base_usdc') &&
									((source === 'eoa_conet_usdc' && eoaConetN != null && eoaConetN > 0) ||
										(source === 'eoa_base_usdc' && eoaBaseN != null && eoaBaseN > 0)) ? (
										<button
											type="button"
											disabled={busy}
											onClick={setMaxFromBalance}
											className={`flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold disabled:opacity-50 ${
												lastChip === 'max'
													? 'bg-[#0051d1] text-white shadow-sm'
													: 'bg-slate-100 text-slate-700 hover:bg-slate-200'
											} ${bizFocusRingClass}`}
										>
											Max
										</button>
									) : null}
								</div>
							</section>

							{source === 'third_party' ? (
								<p className="mt-3 text-xs leading-relaxed text-slate-500">
									Check opens Beamio checkout. After you pay on Base, CoNET miners mint CONET-USDC to
									your EOA. This panel then funds the #13 redeem pool. If CONET-USDC is already on your
									EOA, retry skips checkout.
								</p>
							) : source === 'eoa_conet_usdc' ? (
								<p className="mt-3 text-xs leading-relaxed text-slate-500">
									Signs an EIP-2612 permit when needed, then funds the #13 redeem pool. Beamio sponsors
									CNET gas — your EOA does not need CNET.
								</p>
							) : (
								<p className="mt-3 text-xs leading-relaxed text-slate-500">
									Signs a Base USDC payment (EIP-3009). Beamio mints CONET-USDC to your EOA, then this
									panel funds Reserve — gas is sponsored on Base. If CONET-USDC is already on your EOA,
									retry skips LockMint.
								</p>
							)}

							<section className="mt-4 space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-100/90 p-4">
								<div className="flex items-center justify-between border-b border-slate-200/70 pb-1 text-xs font-medium text-slate-500">
									<span>Transaction breakdown</span>
									<span className="font-semibold text-emerald-700">Sponsored gas</span>
								</div>
								<div className="flex items-center justify-between text-xs">
									<span className="text-slate-600">Deposit amount</span>
									<span className="font-semibold tabular-nums text-slate-900">{depositAmountDisplay}</span>
								</div>
								<div className="flex items-center justify-between gap-3 text-xs">
									<span className="text-slate-600">Network gas</span>
									<span className="text-right font-semibold text-emerald-700">{gasLineLabel}</span>
								</div>
								<div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
									<span className="font-medium text-slate-700">Projected Reserve</span>
									<span className="text-sm font-bold tabular-nums text-[#0051d1]">
										{projectedReserveDisplay ?? '—'}
									</span>
								</div>
							</section>

							{(error || amountValidationError) && phase !== 'listening' ? (
								<div
									role="alert"
									className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
									<p>{error || amountValidationError}</p>
								</div>
							) : null}

							{busy ? (
								<div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700">
									<Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#0051d1]" aria-hidden />
									<div>
										<p className="font-medium">{progressHint}</p>
										{baselineBalance != null ? (
											<p className="mt-1 text-xs text-slate-500">
												{baselineLabel} ${formatMerchantCardConetUsdcBalanceDisplay(baselineBalance)}
											</p>
										) : null}
										{phase === 'listening' ? (
											<button
												type="button"
												className={`mt-2 text-xs font-semibold text-slate-600 underline ${bizFocusRingClass}`}
												onClick={() => {
													abortRef.current?.abort()
													abortRef.current = null
													setPhase('idle')
													setListenKind('idle')
													setError(null)
												}}
											>
												Cancel waiting
											</button>
										) : null}
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
