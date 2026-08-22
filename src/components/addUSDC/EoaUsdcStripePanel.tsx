import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, CreditCard, Loader2 } from 'lucide-react'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import {
	EOA_USDC_STRIPE_MAX_DOLLARS,
	EOA_USDC_STRIPE_MIN_DOLLARS,
	EOA_USDC_STRIPE_PRESETS,
	createEoaUsdcStripeSession,
	dollarsToAmountUsdc6,
	parseStripeDollarInput,
	persistEoaUsdcStripeSessionId,
	pollEoaUsdcStripeSession,
} from '@/utils/eoaUsdcStripe'

type Phase = 'idle' | 'opening' | 'waiting' | 'transferring' | 'success' | 'error'

const POLL_MS = 2000
const POLL_MAX_MS = 8 * 60 * 1000

function preventNumericStepKeys(e: React.KeyboardEvent<HTMLInputElement>) {
	const blocked = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])
	if (blocked.has(e.key) || blocked.has(e.code)) {
		e.preventDefault()
		e.stopPropagation()
	}
	if (e.key === 'Enter') {
		e.currentTarget.blur()
	}
}

type EoaUsdcStripePanelProps = {
	walletAddress: string
	onSuccess?: () => void
}

export default function EoaUsdcStripePanel({ walletAddress, onSuccess }: EoaUsdcStripePanelProps) {
	const [preset, setPreset] = useState<number | null>(25)
	const [customInput, setCustomInput] = useState('')
	const [phase, setPhase] = useState<Phase>('idle')
	const [errorText, setErrorText] = useState('')
	const [txHash, setTxHash] = useState('')
	const pollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const pollStartedAtRef = useRef(0)
	const customInputRef = useRef<HTMLInputElement | null>(null)

	useEffect(() => {
		const el = customInputRef.current
		if (!el) return
		const onWheel = (e: WheelEvent) => {
			e.preventDefault()
			e.stopPropagation()
		}
		el.addEventListener('wheel', onWheel, { passive: false })
		return () => el.removeEventListener('wheel', onWheel)
	}, [])

	useEffect(() => {
		return () => {
			if (pollTimerRef.current !== undefined) clearTimeout(pollTimerRef.current)
		}
	}, [])

	const dollars = useMemo(() => {
		if (preset != null) return preset
		return parseStripeDollarInput(customInput)
	}, [preset, customInput])

	const amountUsdc6 = dollars != null ? dollarsToAmountUsdc6(dollars) : null
	const canContinue =
		phase === 'idle' &&
		Boolean(walletAddress) &&
		amountUsdc6 != null &&
		dollars != null &&
		dollars >= EOA_USDC_STRIPE_MIN_DOLLARS &&
		dollars <= EOA_USDC_STRIPE_MAX_DOLLARS

	const stopPoll = () => {
		if (pollTimerRef.current !== undefined) {
			clearTimeout(pollTimerRef.current)
			pollTimerRef.current = undefined
		}
	}

	const startPoll = useCallback((sessionId: string) => {
		stopPoll()
		pollStartedAtRef.current = Date.now()
		const tick = async () => {
			const out = await pollEoaUsdcStripeSession(sessionId)
			if ('error' in out && !('status' in out)) {
				if (Date.now() - pollStartedAtRef.current > POLL_MAX_MS) {
					setPhase('error')
					setErrorText(out.error)
					return
				}
				pollTimerRef.current = setTimeout(() => void tick(), POLL_MS)
				return
			}
			if (!('status' in out)) return
			if (out.status === 'failed') {
				setPhase('error')
				setErrorText(out.chainFulfillment?.lastError?.trim() || 'Payment was not completed')
				return
			}
			if (out.status === 'succeeded') {
				const hash = out.chainFulfillment?.usdcTxHash?.trim() ?? ''
				const chainErr = out.chainFulfillment?.lastError?.trim() ?? ''
				if (hash) {
					setTxHash(hash)
					setPhase('success')
					onSuccess?.()
					return
				}
				if (chainErr) {
					setPhase('error')
					setErrorText(chainErr)
					return
				}
				setPhase('transferring')
			} else {
				setPhase('waiting')
			}
			if (Date.now() - pollStartedAtRef.current > POLL_MAX_MS) {
				setPhase('error')
				setErrorText('Payment is taking longer than expected. Check Wallet in a moment.')
				return
			}
			pollTimerRef.current = setTimeout(() => void tick(), POLL_MS)
		}
		void tick()
	}, [onSuccess])

	const handleContinue = async () => {
		if (!canContinue || !amountUsdc6) return
		setErrorText('')
		setTxHash('')
		setPhase('opening')
		const created = await createEoaUsdcStripeSession(walletAddress, amountUsdc6)
		if ('error' in created) {
			setPhase('error')
			setErrorText(created.error)
			return
		}
		persistEoaUsdcStripeSessionId(created.sessionId)
		openExternalUrl(created.url)
		setPhase('waiting')
		startPoll(created.sessionId)
	}

	const busy = phase === 'opening' || phase === 'waiting' || phase === 'transferring'

	return (
		<div className="w-full">
			<div className="flex items-center gap-3 mb-4">
				<div className="h-11 w-11 rounded-2xl bg-[#0051d1] flex items-center justify-center shrink-0">
					<CreditCard className="h-5 w-5 text-white" aria-hidden />
				</div>
				<div className="min-w-0">
					<h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Buy USDC with card</h4>
					<p className="text-xs text-slate-500 dark:text-slate-400">USDC on Base · deposited to your EOA Wallet</p>
				</div>
			</div>

			<div className="grid grid-cols-4 gap-2 mb-3">
				{EOA_USDC_STRIPE_PRESETS.map((n) => {
					const active = preset === n
					return (
						<button
							key={n}
							type="button"
							disabled={busy}
							onClick={() => {
								setPreset(n)
								setCustomInput('')
								if (phase === 'error' || phase === 'success') setPhase('idle')
							}}
							className={`rounded-xl py-2.5 text-sm font-bold border transition-all ${
								active
									? 'bg-[#0051d1] text-white border-[#0051d1]'
									: 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-600'
							} disabled:opacity-60`}
						>
							${n}
						</button>
					)
				})}
			</div>

			<label htmlFor="eoa-usdc-stripe-custom" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
				Custom amount (USD)
			</label>
			<div className="relative mb-4">
				<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">$</span>
				<input
					ref={customInputRef}
					id="eoa-usdc-stripe-custom"
					type="number"
					inputMode="decimal"
					autoComplete="off"
					enterKeyHint="done"
					min={EOA_USDC_STRIPE_MIN_DOLLARS}
					max={EOA_USDC_STRIPE_MAX_DOLLARS}
					step={1}
					tabIndex={1}
					disabled={busy}
					value={preset == null ? customInput : ''}
					placeholder="Other"
					onKeyDown={preventNumericStepKeys}
					onChange={(e) => {
						setPreset(null)
						setCustomInput(e.target.value)
						if (phase === 'error' || phase === 'success') setPhase('idle')
					}}
					className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-3 pl-7 pr-3 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none disabled:opacity-60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
				/>
			</div>

			{phase === 'waiting' && (
				<p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Complete card payment in Stripe. This screen updates when USDC is sent.</p>
			)}
			{phase === 'transferring' && (
				<p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Payment received. Sending USDC on Base…</p>
			)}
			{phase === 'success' && (
				<div className="mb-3 flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
					<Check className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
					<div>
						<div className="font-semibold">USDC sent to your EOA Wallet</div>
						{txHash ? <div className="mt-0.5 text-xs font-mono break-all">{txHash.slice(0, 10)}…{txHash.slice(-8)}</div> : null}
					</div>
				</div>
			)}
			{phase === 'error' && (
				<div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100">
					<AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
					<span>{errorText || 'Something went wrong'}</span>
				</div>
			)}
			{!walletAddress && (
				<p className="mb-3 text-xs text-amber-700">EOA Wallet is unavailable. Unlock your wallet and try again.</p>
			)}

			<button
				type="button"
				tabIndex={2}
				disabled={!canContinue}
				aria-busy={busy}
				onClick={() => void handleContinue()}
				className="w-full py-3.5 rounded-2xl bg-[#0051d1] text-white font-bold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.99]"
			>
				{busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
				{phase === 'opening'
					? 'Opening checkout…'
					: phase === 'waiting'
						? 'Waiting for payment…'
						: phase === 'transferring'
							? 'Sending USDC…'
							: phase === 'success'
								? 'Done'
								: 'Continue'}
			</button>
		</div>
	)
}
