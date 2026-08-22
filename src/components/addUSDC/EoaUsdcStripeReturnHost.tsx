import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import { refreshAppDaemonNow } from '@/services/appDaemonWorkerBridge'
import {
	clearPersistedEoaUsdcStripeSessionId,
	isEoaUsdcStripePollOk,
	parseEoaUsdcStripeReturn,
	pollEoaUsdcStripeSession,
	readPersistedEoaUsdcStripeSessionId,
	stripEoaUsdcStripeReturnParams,
} from '@/utils/eoaUsdcStripe'

type View = 'hidden' | 'waiting' | 'transferring' | 'success' | 'error' | 'cancel'

const POLL_MS = 2000
const POLL_MAX_MS = 8 * 60 * 1000

export default function EoaUsdcStripeReturnHost() {
	const location = useLocation()
	const [view, setView] = useState<View>('hidden')
	const [message, setMessage] = useState('')
	const [txHash, setTxHash] = useState('')
	const handledKeyRef = useRef('')
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

	useEffect(() => {
		return () => {
			if (timerRef.current !== undefined) clearTimeout(timerRef.current)
		}
	}, [])

	useEffect(() => {
		const parsed = parseEoaUsdcStripeReturn()
		const persisted = readPersistedEoaUsdcStripeSessionId()
		const sessionId = parsed?.sessionId || persisted
		if (!parsed && !sessionId) return
		if (!parsed && view !== 'hidden') return
		if (!parsed) return
		const key = `${parsed.kind}:${sessionId || 'none'}`
		if (handledKeyRef.current === key) return
		handledKeyRef.current = key
		stripEoaUsdcStripeReturnParams()

		if (parsed.kind === 'cancel') {
			setView('cancel')
			setMessage('Checkout closed. No USDC was sent.')
			if (sessionId) {
				void pollEoaUsdcStripeSession(sessionId, true)
			}
			return
		}

		if (!sessionId) {
			setView('error')
			setMessage('Payment return is missing a session. Check Wallet for USDC.')
			return
		}

		setView('waiting')
		setMessage('Confirming card payment…')
		setTxHash('')
		const started = Date.now()
		const tick = async () => {
			const out = await pollEoaUsdcStripeSession(sessionId)
			if (!isEoaUsdcStripePollOk(out)) {
				if (Date.now() - started > POLL_MAX_MS) {
					setView('error')
					setMessage(out.error)
					return
				}
				timerRef.current = setTimeout(() => void tick(), POLL_MS)
				return
			}
			if (out.status === 'failed') {
				setView('error')
				setMessage(out.chainFulfillment?.lastError?.trim() || 'Payment was not completed')
				return
			}
			if (out.status === 'succeeded') {
				const hash = out.chainFulfillment?.usdcTxHash?.trim() ?? ''
				const chainErr = out.chainFulfillment?.lastError?.trim() ?? ''
				if (hash) {
					setTxHash(hash)
					setView('success')
					setMessage('USDC sent to your EOA Wallet')
					clearPersistedEoaUsdcStripeSessionId()
					void refreshAppDaemonNow('wallet')
					return
				}
				if (chainErr) {
					setView('error')
					setMessage(chainErr)
					return
				}
				setView('transferring')
				setMessage('Payment received. Sending USDC on Base…')
			}
			if (Date.now() - started > POLL_MAX_MS) {
				setView('error')
				setMessage('Payment is taking longer than expected. Check Wallet in a moment.')
				return
			}
			timerRef.current = setTimeout(() => void tick(), POLL_MS)
		}
		void tick()
	}, [location.search, location.hash, location.pathname, view])

	if (view === 'hidden') return null

	return (
		<div className="fixed inset-0 z-[10050] flex items-end sm:items-center justify-center">
			<button
				type="button"
				className="absolute inset-0 bg-black/45 border-0"
				aria-label="Close"
				onClick={() => setView('hidden')}
			/>
			<div className="relative z-10 mx-4 mb-[max(1.5rem,env(safe-area-inset-bottom))] w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl">
				<div className="flex items-start justify-between gap-3 mb-3">
					<h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Buy USDC with card</h3>
					<button
						type="button"
						onClick={() => setView('hidden')}
						className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
						aria-label="Close"
						tabIndex={-1}
					>
						<X className="h-4 w-4" aria-hidden />
					</button>
				</div>
				{(view === 'waiting' || view === 'transferring') && (
					<div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
						<Loader2 className="h-5 w-5 animate-spin text-[#0051d1]" aria-hidden />
						<span>{message}</span>
					</div>
				)}
				{view === 'success' && (
					<div className="flex items-start gap-3 text-sm text-emerald-800 dark:text-emerald-200">
						<Check className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
						<div>
							<div className="font-semibold">{message}</div>
							{txHash ? <div className="mt-1 text-xs font-mono break-all text-slate-500">{txHash}</div> : null}
						</div>
					</div>
				)}
				{(view === 'error' || view === 'cancel') && (
					<div className="flex items-start gap-3 text-sm text-amber-900 dark:text-amber-100">
						<AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
						<span>{message}</span>
					</div>
				)}
			</div>
		</div>
	)
}
